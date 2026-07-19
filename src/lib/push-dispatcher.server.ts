// Dispatcher de notificações via Firebase Cloud Messaging HTTP v1 API.
// Roda no worker (Cloudflare) — usa `jose` para assinar o JWT do service
// account (RS256) e obter access_token OAuth2 do Google, sem depender do
// firebase-admin (que não é compatível com edge runtimes).
//
// Fluxo:
//  1. drainPushQueue lê push_notifications_queue (itens sem processed_at, attempts<3)
//  2. Lê todos os tokens de fcm_tokens
//  3. Para cada item da fila, envia para cada token via /v1/projects/{id}/messages:send
//  4. Remove tokens inválidos (UNREGISTERED, INVALID_ARGUMENT)
//  5. Marca itens da fila como processed_at=now()

import { SignJWT, importPKCS8 } from "jose";
import { logger } from "@/lib/logger";

type DispatchLogEntry = {
  trigger_source: string;
  queue_processed: number;
  tokens_total: number;
  sent: number;
  pruned: number;
  errors_count: number;
  duration_ms: number;
  ok: boolean;
  error_sample?: string | null;
  meta?: Record<string, unknown>;
};

async function recordDispatchLog(entry: DispatchLogEntry): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("fcm_dispatch_logs").insert({
      trigger_source: entry.trigger_source,
      queue_processed: entry.queue_processed,
      tokens_total: entry.tokens_total,
      sent: entry.sent,
      pruned: entry.pruned,
      errors_count: entry.errors_count,
      duration_ms: entry.duration_ms,
      ok: entry.ok,
      error_sample: entry.error_sample ?? null,
      meta: (entry.meta ?? {}) as never,
    });
    if (error) logger.error("[fcm] dispatch log insert falhou:", error.message);
  } catch (e) {
    logger.error("[fcm] recordDispatchLog crash:", e);
  }
}

type QueueRow = {
  id: string;
  title: string;
  body: string;
  url: string | null;
};

type TokenRow = {
  id: string;
  token: string;
  user_id: string | null;
};

type FcmCredentials = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

/**
 * Normaliza a private key vinda de secrets. Aceita todos os formatos comuns
 * em que a chave é colada em Cloudflare/Vercel/etc:
 *  - Com \n literais (2 chars) — o mais comum ao copiar do JSON do service account.
 *  - Com \\n (4 chars) — quando o JSON foi re-escapado.
 *  - Com aspas duplas ao redor (usuário copiou o valor com aspas do JSON).
 *  - Com \r\n do Windows.
 *  - Sem os headers BEGIN/END (só o miolo base64).
 */
export function normalizeFirebasePrivateKey(raw: string): string {
  let key = raw.trim();
  // Remove aspas duplas envoltas: "-----BEGIN..." → -----BEGIN...
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  // \\n (4 chars) → \n literal (2 chars) → newline real
  key = key.replace(/\\\\n/g, "\\n").replace(/\\n/g, "\n").replace(/\r/g, "");
  // Se veio só o miolo base64 sem headers, envelopa.
  if (!key.includes("-----BEGIN")) {
    const body = key.replace(/\s+/g, "");
    key = `-----BEGIN PRIVATE KEY-----\n${body.match(/.{1,64}/g)?.join("\n") ?? body}\n-----END PRIVATE KEY-----\n`;
  }
  // Garante newline final que o parser PKCS8 espera.
  if (!key.endsWith("\n")) key += "\n";
  return key;
}

function getFcmCredentials(): FcmCredentials {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !rawKey) {
    throw new Error(
      "[fcm] Credenciais ausentes: configure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY.",
    );
  }
  return { projectId, clientEmail, privateKey: normalizeFirebasePrivateKey(rawKey) };
}

// Cache do access_token OAuth2 (válido por 1h — reusamos entre invocações do worker).
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getGoogleAccessToken(creds: FcmCredentials): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt > now + 60) {
    return cachedToken.token;
  }

  const privateKey = await importPKCS8(creds.privateKey, "RS256");
  const assertion = await new SignJWT({
    scope: "https://www.googleapis.com/auth/firebase.messaging",
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(creds.clientEmail)
    .setSubject(creds.clientEmail)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }).toString(),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      `[fcm] Falha ao obter access_token (HTTP ${res.status}): ${errText.slice(0, 200)}`,
    );
  }

  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: json.access_token, expiresAt: now + json.expires_in };
  return json.access_token;
}

type SendResult = { ok: boolean; dead: boolean; status: number; error?: string };

async function sendToToken(
  accessToken: string,
  projectId: string,
  token: string,
  notif: { title: string; body: string; url: string },
): Promise<SendResult> {
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
  const payload = {
    message: {
      token,
      // DATA-ONLY: sem `notification` no topo e sem `webpush.notification`,
      // para evitar DUPLICATA. Com `notification` presente, o FCM Web SDK
      // exibe automaticamente E ainda chama onBackgroundMessage do SW,
      // resultando em 2 notificações no Android. Mantemos priority HIGH +
      // PRIORITY_MAX para furar o Doze e acordar a tela mesmo bloqueada.
      // O SW (public/firebase-messaging-sw.js) é a única autoridade que
      // exibe a notificação via showNotification.
      data: {
        title: notif.title,
        body: notif.body,
        url: notif.url,
      },
      android: {
        priority: "HIGH" as const,
        ttl: "3600s",
        // Sem bloco `notification` aqui: se presente, o FCM cria uma
        // "notification message" que também dispara auto-display no
        // Android nativo. Mantemos apenas priority + TTL para atravessar Doze.
      },
      apns: {
        // apns-push-type=alert + apns-priority=10 é OBRIGATÓRIO para
        // acordar a tela bloqueada no iOS. `background` (usado antes)
        // era um push silencioso e nunca exibia com o telefone bloqueado.
        headers: {
          "apns-priority": "10",
          "apns-push-type": "alert",
          "apns-expiration": "0",
        },
        payload: {
          aps: {
            alert: { title: notif.title, body: notif.body },
            sound: "default",
            "mutable-content": 1,
          },
          url: notif.url,
        },
      },
      webpush: {
        headers: { Urgency: "high", TTL: "3600" },
        // Sem `notification` aqui pelo mesmo motivo (auto-display no Chrome
        // desktop). O SW cuida da exibição com ícone/badge/click.
        fcm_options: { link: notif.url },
      },
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (res.ok) return { ok: true, dead: false, status: res.status };

  const errBody = await res.json().catch(() => null);
  const errStatus =
    errBody && typeof errBody === "object" && "error" in errBody
      ? ((errBody as { error?: { status?: string } }).error?.status ?? "")
      : "";
  const dead =
    res.status === 404 ||
    errStatus === "UNREGISTERED" ||
    errStatus === "INVALID_ARGUMENT" ||
    errStatus === "NOT_FOUND";

  const errMsg =
    errBody && typeof errBody === "object" && "error" in errBody
      ? ((errBody as { error?: { message?: string } }).error?.message ?? `HTTP ${res.status}`)
      : `HTTP ${res.status}`;

  return { ok: false, dead, status: res.status, error: errMsg };
}

export async function drainPushQueue(triggerSource: string = "queue"): Promise<{
  processed: number;
  sent: number;
  pruned: number;
  errors: string[];
}> {
  const startedAt = Date.now();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  let creds: FcmCredentials;
  try {
    creds = getFcmCredentials();
  } catch (e) {
    const msg = (e as Error).message;
    logger.error("[fcm] drainPushQueue abortado:", e);
    await recordDispatchLog({
      trigger_source: triggerSource,
      queue_processed: 0,
      tokens_total: 0,
      sent: 0,
      pruned: 0,
      errors_count: 1,
      duration_ms: Date.now() - startedAt,
      ok: false,
      error_sample: msg,
      meta: { stage: "credentials" },
    });
    return { processed: 0, sent: 0, pruned: 0, errors: [msg] };
  }

  const { data: queue, error: qErr } = await supabaseAdmin
    .from("push_notifications_queue")
    .select("id, title, body, url")
    .is("processed_at", null)
    .lt("attempts", 3)
    .order("created_at", { ascending: true })
    .limit(50);

  if (qErr) {
    logger.error("[fcm] erro ao buscar fila:", qErr);
    await recordDispatchLog({
      trigger_source: triggerSource,
      queue_processed: 0,
      tokens_total: 0,
      sent: 0,
      pruned: 0,
      errors_count: 1,
      duration_ms: Date.now() - startedAt,
      ok: false,
      error_sample: qErr.message,
      meta: { stage: "queue-fetch" },
    });
    throw qErr;
  }
  if (!queue || queue.length === 0) {
    return { processed: 0, sent: 0, pruned: 0, errors: [] };
  }

  const ids = (queue as QueueRow[]).map((r) => r.id);

  const { data: tokens, error: tErr } = await supabaseAdmin
    .from("fcm_tokens")
    .select("id, token, user_id");

  if (tErr) {
    logger.error("[fcm] erro ao buscar tokens:", tErr);
    throw tErr;
  }

  const tokenRows = (tokens ?? []) as TokenRow[];

  if (tokenRows.length === 0) {
    await supabaseAdmin
      .from("push_notifications_queue")
      .update({ processed_at: new Date().toISOString(), status: "sent" })
      .in("id", ids);
    await recordDispatchLog({
      trigger_source: triggerSource,
      queue_processed: queue.length,
      tokens_total: 0,
      sent: 0,
      pruned: 0,
      errors_count: 0,
      duration_ms: Date.now() - startedAt,
      ok: true,
      meta: { note: "no-tokens" },
    });
    return { processed: queue.length, sent: 0, pruned: 0, errors: [] };
  }

  let accessToken: string;
  try {
    accessToken = await getGoogleAccessToken(creds);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error("[fcm] getAccessToken falhou:", msg);
    await recordDispatchLog({
      trigger_source: triggerSource,
      queue_processed: queue.length,
      tokens_total: tokenRows.length,
      sent: 0,
      pruned: 0,
      errors_count: 1,
      duration_ms: Date.now() - startedAt,
      ok: false,
      error_sample: msg,
      meta: { stage: "google-token" },
    });
    return { processed: 0, sent: 0, pruned: 0, errors: [msg] };
  }

  let sent = 0;
  const deadTokens: string[] = [];
  const errors: string[] = [];

  for (const row of queue as QueueRow[]) {
    const notif = {
      title: row.title,
      body: row.body,
      url: row.url ?? "/",
    };

    // Envia em paralelo (mas limitado — FCM aceita altas taxas)
    await Promise.all(
      tokenRows.map(async (t) => {
        try {
          const result = await sendToToken(accessToken, creds.projectId, t.token, notif);
          if (result.ok) {
            sent++;
          } else if (result.dead) {
            if (!deadTokens.includes(t.token)) deadTokens.push(t.token);
          } else {
            errors.push(`token ${t.id}: ${result.error}`);
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          errors.push(msg);
        }
      }),
    );
  }

  let pruned = 0;
  if (deadTokens.length > 0) {
    await supabaseAdmin.from("fcm_tokens").delete().in("token", deadTokens);
    pruned = deadTokens.length;
  }

  await supabaseAdmin
    .from("push_notifications_queue")
    .update({
      processed_at: new Date().toISOString(),
      status: errors.length === 0 ? "sent" : sent > 0 ? "partial" : "failed",
      last_error: errors[0] ?? null,
    })
    .in("id", ids);

  logger.debug(
    `[fcm] processados=${queue.length} enviados=${sent} removidos=${pruned} erros=${errors.length}`,
  );

  await recordDispatchLog({
    trigger_source: triggerSource,
    queue_processed: queue.length,
    tokens_total: tokenRows.length,
    sent,
    pruned,
    errors_count: errors.length,
    duration_ms: Date.now() - startedAt,
    ok: errors.length === 0,
    error_sample: errors[0] ?? null,
    meta: { queue_ids: ids.slice(0, 10) },
  });

  return { processed: queue.length, sent, pruned, errors };
}

export async function sendPushToUser(
  userId: string,
  notif: { title: string; body: string; url?: string },
): Promise<{ sent: number; total: number; pruned: number; errors: string[] }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  let creds: FcmCredentials;
  try {
    creds = getFcmCredentials();
  } catch (e) {
    return { sent: 0, total: 0, pruned: 0, errors: [(e as Error).message] };
  }

  const { data: tokens, error } = await supabaseAdmin
    .from("fcm_tokens")
    .select("id, token, user_id")
    .eq("user_id", userId);
  if (error) throw error;

  const tokenRows = (tokens ?? []) as TokenRow[];
  if (tokenRows.length === 0) {
    return { sent: 0, total: 0, pruned: 0, errors: [] };
  }

  const accessToken = await getGoogleAccessToken(creds);
  const payload = { title: notif.title, body: notif.body, url: notif.url ?? "/" };

  let sent = 0;
  const deadTokens: string[] = [];
  const errors: string[] = [];

  await Promise.all(
    tokenRows.map(async (t) => {
      const result = await sendToToken(accessToken, creds.projectId, t.token, payload);
      if (result.ok) sent++;
      else if (result.dead) deadTokens.push(t.token);
      else errors.push(result.error ?? `HTTP ${result.status}`);
    }),
  );

  let pruned = 0;
  if (deadTokens.length > 0) {
    await supabaseAdmin.from("fcm_tokens").delete().in("token", deadTokens);
    pruned = deadTokens.length;
  }

  await recordDispatchLog({
    trigger_source: "sendPushToUser",
    queue_processed: 0,
    tokens_total: tokenRows.length,
    sent,
    pruned,
    errors_count: errors.length,
    duration_ms: 0,
    ok: errors.length === 0,
    error_sample: errors[0] ?? null,
    meta: { userId },
  });
  return { sent, total: tokenRows.length, pruned, errors };
}

export async function sendTestPushToUser(
  userId: string,
): Promise<{ sent: number; total: number; pruned: number; errors: string[] }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  let creds: FcmCredentials;
  try {
    creds = getFcmCredentials();
  } catch (e) {
    return { sent: 0, total: 0, pruned: 0, errors: [(e as Error).message] };
  }

  const { data: tokens, error } = await supabaseAdmin
    .from("fcm_tokens")
    .select("id, token, user_id")
    .eq("user_id", userId);

  if (error) throw error;

  const tokenRows = (tokens ?? []) as TokenRow[];
  if (tokenRows.length === 0) {
    return { sent: 0, total: 0, pruned: 0, errors: ["Nenhum token FCM para este usuário."] };
  }

  const accessToken = await getGoogleAccessToken(creds);
  const notif = {
    title: "Notificação de teste ✅",
    body: "FCM funcionando! Você receberá alertas mesmo com o app fechado.",
    url: "/painel",
  };

  let sent = 0;
  const deadTokens: string[] = [];
  const errors: string[] = [];

  await Promise.all(
    tokenRows.map(async (t) => {
      const result = await sendToToken(accessToken, creds.projectId, t.token, notif);
      if (result.ok) sent++;
      else if (result.dead) deadTokens.push(t.token);
      else errors.push(result.error ?? `HTTP ${result.status}`);
    }),
  );

  let pruned = 0;
  if (deadTokens.length > 0) {
    await supabaseAdmin.from("fcm_tokens").delete().in("token", deadTokens);
    pruned = deadTokens.length;
  }

  await recordDispatchLog({
    trigger_source: "sendTestPushToUser",
    queue_processed: 0,
    tokens_total: tokenRows.length,
    sent,
    pruned,
    errors_count: errors.length,
    duration_ms: 0,
    ok: errors.length === 0,
    error_sample: errors[0] ?? null,
    meta: { userId },
  });
  return { sent, total: tokenRows.length, pruned, errors };
}

export async function broadcastTestPushToAll(): Promise<{
  sent: number;
  total: number;
  pruned: number;
  errors: string[];
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  let creds: FcmCredentials;
  try {
    creds = getFcmCredentials();
  } catch (e) {
    return { sent: 0, total: 0, pruned: 0, errors: [(e as Error).message] };
  }

  const { data: tokens, error } = await supabaseAdmin
    .from("fcm_tokens")
    .select("id, token, user_id");

  if (error) throw error;

  const tokenRows = (tokens ?? []) as TokenRow[];
  if (tokenRows.length === 0) {
    return { sent: 0, total: 0, pruned: 0, errors: ["Nenhum token FCM ativo."] };
  }

  const accessToken = await getGoogleAccessToken(creds);
  const notif = {
    title: "Teste de notificação 📣",
    body: "Push de teste enviado via Firebase Cloud Messaging para todos os dispositivos.",
    url: "/",
  };

  let sent = 0;
  const deadTokens: string[] = [];
  const errors: string[] = [];

  await Promise.all(
    tokenRows.map(async (t) => {
      const result = await sendToToken(accessToken, creds.projectId, t.token, notif);
      if (result.ok) sent++;
      else if (result.dead) deadTokens.push(t.token);
      else errors.push(result.error ?? `HTTP ${result.status}`);
    }),
  );

  let pruned = 0;
  if (deadTokens.length > 0) {
    await supabaseAdmin.from("fcm_tokens").delete().in("token", deadTokens);
    pruned = deadTokens.length;
  }

  await recordDispatchLog({
    trigger_source: "broadcastTestPushToAll",
    queue_processed: 0,
    tokens_total: tokenRows.length,
    sent,
    pruned,
    errors_count: errors.length,
    duration_ms: 0,
    ok: errors.length === 0,
    error_sample: errors[0] ?? null,
  });
  return { sent, total: tokenRows.length, pruned, errors };
}

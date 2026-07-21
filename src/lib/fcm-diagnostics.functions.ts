import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { logger, safeError } from "@/lib/logger";

// ============ Schemas ============

const logSchema = z.object({
  phase: z.enum(["probe", "subscribe", "getToken", "retry"]).default("probe"),
  success: z.boolean().default(false),
  platform: z.string().max(40).default("unknown"),
  userAgent: z.string().max(500).nullable().optional(),
  isIframe: z.boolean().nullable().optional(),
  isPreview: z.boolean().nullable().optional(),
  isStandalone: z.boolean().nullable().optional(),
  isInAppBrowser: z.boolean().nullable().optional(),
  notificationPermission: z.string().max(20).nullable().optional(),
  serviceWorkerSupported: z.boolean().nullable().optional(),
  serviceWorkerRegistered: z.boolean().nullable().optional(),
  serviceWorkerScript: z.string().max(500).nullable().optional(),
  indexedDbOk: z.boolean().nullable().optional(),
  cookiesEnabled: z.boolean().nullable().optional(),
  fcmConfigOk: z.boolean().nullable().optional(),
  errorCode: z.string().max(80).nullable().optional(),
  errorMessage: z.string().max(1000).nullable().optional(),
  extra: z.record(z.string(), z.unknown()).optional(),
});

export type LogFcmDiagnosticInput = z.infer<typeof logSchema>;

// ============ Public write (visitantes) ============

/**
 * Registra um evento de diagnóstico. Aberto (anon+auth) — precisamos capturar
 * falhas mesmo de visitantes deslogados. Uma policy `WITH CHECK (true)`
 * limita a apenas INSERT nesta tabela e RLS impede SELECT sem role.
 */
export const logFcmDiagnostic = createServerFn({ method: "POST" })
  .validator((data: unknown) => logSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("fcm_diagnostics").insert({
      phase: data.phase,
      success: data.success,
      platform: data.platform,
      user_agent: data.userAgent ?? null,
      is_iframe: data.isIframe ?? null,
      is_preview: data.isPreview ?? null,
      is_standalone: data.isStandalone ?? null,
      is_in_app_browser: data.isInAppBrowser ?? null,
      notification_permission: data.notificationPermission ?? null,
      service_worker_supported: data.serviceWorkerSupported ?? null,
      service_worker_registered: data.serviceWorkerRegistered ?? null,
      service_worker_script: data.serviceWorkerScript ?? null,
      indexeddb_ok: data.indexedDbOk ?? null,
      cookies_enabled: data.cookiesEnabled ?? null,
      fcm_config_ok: data.fcmConfigOk ?? null,
      error_code: data.errorCode ?? null,
      error_message: data.errorMessage ?? null,
      extra: (data.extra ?? {}) as never,
    });
    if (error) {
      logger.error("[fcm-diag] insert falhou", safeError(error));
      return { ok: false, reason: "Falha ao registrar diagnóstico." };
    }
    return { ok: true };
  });

// ============ Developer reads ============

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertStaff(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .in("role", ["desenvolvedor", "developer", "admin", "diretor", "director"])
    .maybeSingle();
  if (error) throw new Error("Não foi possível verificar permissão.");
  if (!data) throw new Error("Acesso restrito a desenvolvedores/diretores.");
}

export const listFcmDiagnostics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const { data, error } = await context.supabase
      .from("fcm_diagnostics")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data ?? [];
  });

export const getFcmTokenStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);

    const [tokensRes, diagRes, queueRes] = await Promise.all([
      context.supabase.from("fcm_tokens").select("id, platform, user_id, created_at, updated_at"),
      context.supabase
        .from("fcm_diagnostics")
        .select("success, platform, error_code, created_at")
        .gte("created_at", new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()),
      context.supabase
        .from("push_notifications_queue")
        .select("id, title, source, processed_at, attempts, created_at")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    if (tokensRes.error) throw tokensRes.error;
    if (diagRes.error) throw diagRes.error;
    if (queueRes.error) throw queueRes.error;

    const tokens = tokensRes.data ?? [];
    const diagnostics = diagRes.data ?? [];

    const byPlatform: Record<string, number> = {};
    let withUser = 0;
    for (const t of tokens) {
      byPlatform[t.platform ?? "unknown"] = (byPlatform[t.platform ?? "unknown"] ?? 0) + 1;
      if (t.user_id) withUser++;
    }

    const failuresByPlatform: Record<string, number> = {};
    let failures = 0;
    let successes = 0;
    for (const d of diagnostics) {
      if (d.success) successes++;
      else {
        failures++;
        failuresByPlatform[d.platform ?? "unknown"] =
          (failuresByPlatform[d.platform ?? "unknown"] ?? 0) + 1;
      }
    }

    return {
      tokens: {
        total: tokens.length,
        withUser,
        anonymous: tokens.length - withUser,
        byPlatform,
        latest: tokens
          .slice()
          .sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""))
          .slice(0, 5)
          .map((t) => ({
            id: t.id,
            platform: t.platform,
            hasUser: !!t.user_id,
            updated_at: t.updated_at,
          })),
      },
      diagnostics7d: {
        total: diagnostics.length,
        successes,
        failures,
        failuresByPlatform,
      },
      queue: queueRes.data ?? [],
      generatedAt: new Date().toISOString(),
    };
  });

export const listPushDispatchLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const { data, error } = await context.supabase
      .from("fcm_dispatch_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data ?? [];
  });

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const STAFF = new Set([
  "desenvolvedor",
  "developer",
  "diretor",
  "director",
  "admin",
  "coordenador",
  "secretario",
  "professor",
]);

async function assertStaff(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  const roles = (data ?? []).map((r: { role: string }) => String(r.role));
  if (!roles.some((r: string) => STAFF.has(r))) throw new Error("Acesso negado.");
}

export type DiagnosticStep = {
  id: string;
  label: string;
  status: "ok" | "error" | "warn";
  detail?: string;
  httpStatus?: number;
  raw?: string;
};

/**
 * Executa checagens sequenciais na Google Drive API e devolve
 * detalhes de cada etapa (inclui status HTTP e corpo bruto do erro
 * — útil pra diagnosticar 401/403/404 e permissão de compartilhamento).
 */
export const runDriveDiagnostics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const steps: DiagnosticStep[] = [];

    // 1. Presença das credenciais
    const clientEmail = process.env.GOOGLE_DRIVE_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL;
    const source = process.env.GOOGLE_DRIVE_CLIENT_EMAIL
      ? "GOOGLE_DRIVE_*"
      : process.env.FIREBASE_CLIENT_EMAIL
        ? "FIREBASE_* (fallback)"
        : "nenhuma";
    const hasKey = Boolean(
      process.env.GOOGLE_DRIVE_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY,
    );
    if (clientEmail && hasKey) {
      steps.push({
        id: "creds",
        label: "Credenciais de Service Account",
        status: "ok",
        detail: `Fonte: ${source} · ${clientEmail}`,
      });
    } else {
      steps.push({
        id: "creds",
        label: "Credenciais de Service Account",
        status: "error",
        detail:
          "Faltam GOOGLE_DRIVE_CLIENT_EMAIL/PRIVATE_KEY (ou FIREBASE_* como fallback) nas secrets do worker.",
      });
      return { steps, serviceAccount: clientEmail ?? null };
    }

    // 2. Trocar JWT por access_token
    let tokenOk = false;
    try {
      const { driveFetchServer } = await import("@/lib/google-drive.server");
      // Chamada leve só pra forçar minting do token
      await driveFetchServer("/drive/v3/about?fields=kind");
      tokenOk = true;
      steps.push({
        id: "oauth",
        label: "OAuth2 (JWT → access_token)",
        status: "ok",
      });
    } catch (e) {
      const msg = (e as Error).message ?? "";
      const m = /google_drive_auth_(\d+):\s*(.*)$/s.exec(msg);
      if (m) {
        steps.push({
          id: "oauth",
          label: "OAuth2 (JWT → access_token)",
          status: "error",
          httpStatus: Number(m[1]),
          detail:
            "Google recusou o JWT. Verifique se a chave privada está intacta e o email confere.",
          raw: m[2],
        });
        return { steps, serviceAccount: clientEmail };
      }
      steps.push({
        id: "oauth",
        label: "OAuth2 (JWT → access_token)",
        status: "error",
        detail: msg,
      });
      // Continua pra tentar identificar problema de API/permissão abaixo
    }

    // 3. Acesso a /about (chamada mais simples da API)
    try {
      const { driveFetchServer } = await import("@/lib/google-drive.server");
      const res = await driveFetchServer(
        "/drive/v3/about?fields=user(emailAddress,displayName),storageQuota(limit,usage)",
      );
      const json = (await res.json()) as {
        user?: { emailAddress?: string; displayName?: string };
        storageQuota?: { limit?: string; usage?: string };
      };
      steps.push({
        id: "about",
        label: "Drive API — /about",
        status: "ok",
        detail: `Autenticado como ${json.user?.emailAddress ?? "?"}`,
      });
    } catch (e) {
      parseAndPushHttpError(steps, "about", "Drive API — /about", (e as Error).message);
      return { steps, serviceAccount: clientEmail };
    }

    if (!tokenOk) return { steps, serviceAccount: clientEmail };

    // 4. Localizar pasta UEECM compartilhada com o SA
    try {
      const { driveFetchServer } = await import("@/lib/google-drive.server");
      const q = encodeURIComponent(
        "name='UEECM' and mimeType='application/vnd.google-apps.folder' and trashed=false",
      );
      const res = await driveFetchServer(
        `/drive/v3/files?q=${q}&fields=files(id,name,owners(emailAddress))&pageSize=5`,
      );
      const json = (await res.json()) as {
        files?: Array<{ id: string; name: string; owners?: Array<{ emailAddress?: string }> }>;
      };
      if (!json.files || json.files.length === 0) {
        steps.push({
          id: "ueecm",
          label: "Pasta UEECM visível ao SA",
          status: "warn",
          detail: `Nenhuma pasta chamada "UEECM" está compartilhada com ${clientEmail}. Compartilhe-a como Editor.`,
        });
      } else {
        const owners = json.files.map((f) => f.owners?.[0]?.emailAddress ?? "?").join(", ");
        steps.push({
          id: "ueecm",
          label: "Pasta UEECM visível ao SA",
          status: "ok",
          detail: `${json.files.length} pasta(s) encontrada(s) · owners: ${owners}`,
        });
      }
    } catch (e) {
      parseAndPushHttpError(steps, "ueecm", "Pasta UEECM visível ao SA", (e as Error).message);
    }

    return { steps, serviceAccount: clientEmail };
  });

function parseAndPushHttpError(steps: DiagnosticStep[], id: string, label: string, msg: string) {
  const m = /google_drive_(\d+):\s*(.*)$/s.exec(msg);
  if (!m) {
    steps.push({ id, label, status: "error", detail: msg });
    return;
  }
  const status = Number(m[1]);
  const raw = m[2] ?? "";
  let hint = "";
  if (status === 401) hint = "Token inválido/expirado. Verifique a chave privada.";
  else if (status === 403) {
    hint =
      raw.includes("SERVICE_DISABLED") || raw.includes("accessNotConfigured")
        ? "A Google Drive API não está habilitada no projeto do Google Cloud."
        : "Sem permissão. Compartilhe a pasta/arquivo com o email do service account como Editor.";
  } else if (status === 404) hint = "Recurso não encontrado ou não compartilhado com o SA.";
  else if (status === 429)
    hint = "Rate limit da API atingido — tente novamente em alguns segundos.";
  steps.push({
    id,
    label,
    status: "error",
    httpStatus: status,
    detail: hint || `HTTP ${status}`,
    raw,
  });
}

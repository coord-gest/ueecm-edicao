/**
 * Logger server-only para erros de execução em server functions e rotas /api/*.
 *
 * Uso:
 *   await logSystemError({ source: "api:chat", severity: "error", message, error, request });
 *
 * Sempre não-bloqueante: nunca lança para o chamador (protege o fluxo principal
 * caso a própria inserção falhe).
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Severity = "info" | "warning" | "error" | "critical";

type LogArgs = {
  source: string;
  message: string;
  severity?: Severity;
  error?: unknown;
  context?: Record<string, unknown>;
  actorId?: string | null;
  request?: Request;
};

function getEnv(names: string[], request?: Request): string | undefined {
  const requestEnv = request
    ? (
        request as Request & {
          runtime?: { cloudflare?: { env?: Record<string, string | undefined> } };
        }
      ).runtime?.cloudflare?.env
    : undefined;
  const globalEnv = (
    globalThis as typeof globalThis & { __env__?: Record<string, string | undefined> }
  ).__env__;
  const processEnv = typeof process !== "undefined" ? process.env : undefined;
  for (const name of names) {
    for (const src of [requestEnv, globalEnv, processEnv]) {
      const v = src?.[name];
      if (typeof v === "string" && v.trim() !== "") return v;
    }
  }
  return undefined;
}

function serializeError(err: unknown): { message: string; stack: string | null } {
  if (err instanceof Error) {
    return { message: err.message, stack: err.stack ?? null };
  }
  if (typeof err === "string") return { message: err, stack: null };
  try {
    return { message: JSON.stringify(err), stack: null };
  } catch {
    return { message: String(err), stack: null };
  }
}

export async function logSystemError(args: LogArgs): Promise<void> {
  try {
    const url = getEnv(["SUPABASE_URL", "VITE_SUPABASE_URL"], args.request);
    const key = getEnv(["SUPABASE_SERVICE_ROLE_KEY", "SERVICE_ROLE_KEY"], args.request);
    if (!url || !key) {
      // Sem service role no runtime: apenas log local; não bloqueia o fluxo.
      console.error(`[system_errors:${args.source}] ${args.message}`, args.error ?? "");
      return;
    }

    const admin = createClient<Database>(url, key, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });

    const { message: errMsg, stack } = serializeError(args.error);
    const combinedMessage = args.error ? `${args.message}: ${errMsg}` : args.message;

    const requestPath = args.request ? new URL(args.request.url).pathname : null;

    await admin.from("system_errors").insert({
      source: args.source,
      severity: args.severity ?? "error",
      message: combinedMessage.slice(0, 2000),
      stack: stack ? stack.slice(0, 8000) : null,
      context: (args.context ?? {}) as never,
      actor_id: args.actorId ?? null,
      request_path: requestPath,
    });
  } catch (loggingErr) {
    // Nunca propagar erros do logger; apenas registrar localmente.
    console.error("[logSystemError] falhou:", loggingErr);
  }
}

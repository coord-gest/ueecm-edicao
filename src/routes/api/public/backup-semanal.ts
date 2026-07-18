import { createFileRoute } from "@tanstack/react-router";
import { logSystemError } from "@/lib/system-errors.server";
import { readServerEnv } from "@/lib/server-env";
import { logger } from "@/lib/logger";

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Cron endpoint para backup semanal. Configurar pg_cron para POST semanal
 * com header `x-dispatch-secret: <DISPATCH_SECRET>` ou
 * `Authorization: Bearer <DISPATCH_SECRET>`. Comparação timing-safe.
 */
export const Route = createFileRoute("/api/public/backup-semanal")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const SHARED = readServerEnv(request, "DISPATCH_SECRET") ?? "";
          const authHeader = request.headers.get("authorization") ?? "";
          const bearer = authHeader.toLowerCase().startsWith("bearer ")
            ? authHeader.slice(7).trim()
            : "";
          const dispatch = request.headers.get("x-dispatch-secret") ?? "";
          const provided = bearer || dispatch;
          if (!SHARED || !provided || !timingSafeEqualStr(provided, SHARED)) {
            return new Response("Unauthorized", { status: 401 });
          }

          const { runBackup } = await import("@/lib/backup.server");
          const result = await runBackup();

          return new Response(JSON.stringify(result), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (err) {
          logger.error("[backup-semanal]", err);
          void logSystemError({
            source: "api:backup-semanal",
            severity: "critical",
            message: "Falha ao gerar backup semanal",
            error: err,
            request,
          });
          return new Response(JSON.stringify({ error: "internal", message: String(err) }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});

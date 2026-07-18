import { createFileRoute } from "@tanstack/react-router";
import { logSystemError } from "@/lib/system-errors.server";
import { readServerEnv } from "@/lib/server-env";
import { logger } from "@/lib/logger";

/**
 * Cron endpoint para backup semanal. Configurar pg_cron para POST semanal
 * com header `x-dispatch-secret: <DISPATCH_SECRET>`.
 */
export const Route = createFileRoute("/api/public/backup-semanal")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const SHARED = readServerEnv(request, "DISPATCH_SECRET") ?? "";
          const dispatch = request.headers.get("x-dispatch-secret") ?? "";
          if (!SHARED || dispatch !== SHARED) {
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

import { createFileRoute } from "@tanstack/react-router";
import { logger } from "@/lib/logger";

/**
 * POST /api/public/dispatch-push
 *
 * Chamado pelo trigger `tg_push_queue_dispatch` (pg_net) automaticamente
 * quando novos itens entram em `push_notifications_queue`, e também
 * pelos painéis autenticados após criar alertas/posts.
 *
 * Segurança (S2): endpoint público-por-URL, autenticado por secret
 * compartilhado. Aceita EITHER:
 *   - Authorization: Bearer <DISPATCH_SECRET>   (padrão preferido)
 *   - x-dispatch-secret: <DISPATCH_SECRET>      (compat com pg_net)
 * Sem secret válido → 401. Se DISPATCH_SECRET não estiver configurado
 * no ambiente do Worker, o endpoint fica indisponível (500) — fail-closed,
 * nunca fail-open.
 */

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function handleDispatchPush(request: Request): Promise<Response> {
  const expected = process.env.DISPATCH_SECRET;
  if (!expected) {
    // Fail-closed: sem secret configurado, ninguém dispara — nem cron nem atacante.
    logger.error("[dispatch-push] DISPATCH_SECRET ausente no ambiente do Worker");
    return new Response("Service unavailable", { status: 500 });
  }

  // Aceita Bearer OU x-dispatch-secret (transição sem quebrar pg_cron atual).
  const authHeader = request.headers.get("authorization") ?? "";
  const bearer = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  const legacy = request.headers.get("x-dispatch-secret") ?? "";
  const provided = bearer || legacy;

  if (!provided || !timingSafeEqualStr(provided, expected)) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const { drainPushQueue } = await import("@/lib/push-dispatcher.server");
    const result = await drainPushQueue();
    if (result.errors.length > 0) {
      logger.error("[dispatch-push] erros durante envio:", result.errors.length);
    }
    return Response.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error("[dispatch-push] erro crítico:", msg);
    // S4: retornar 500 para que pg_cron / monitor externo detecte a falha.
    // Antes retornávamos 200 e a fila travava silenciosamente.
    return Response.json({ error: msg, processed: 0, sent: 0, pruned: 0 }, { status: 500 });
  }
}

export const Route = createFileRoute("/api/public/dispatch-push")({
  server: {
    handlers: {
      POST: async ({ request }) => handleDispatchPush(request),
    },
  },
});

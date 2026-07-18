import { createFileRoute } from "@tanstack/react-router";
import { logger } from "@/lib/logger";

/**
 * Cron endpoint — chamar a cada 1 minuto via pg_cron.
 *
 * Segurança: mesmo padrão de `dispatch-push.ts` — aceita
 *   - Authorization: Bearer <DISPATCH_SECRET>
 *   - x-dispatch-secret: <DISPATCH_SECRET>
 * Comparação timing-safe. Fail-closed se DISPATCH_SECRET ausente.
 *
 * Fluxo:
 *  1. Busca reminders vencidos (data_hora <= now(), notificado=false, concluido=false).
 *  2. Para cada um, envia push FCM ao dono via sendPushToUser().
 *  3. Marca notificado=true.
 */

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export const Route = createFileRoute("/api/public/reminders-dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.DISPATCH_SECRET;
        if (!expected) {
          logger.error("[reminders-dispatch] DISPATCH_SECRET ausente no ambiente do Worker");
          return new Response("Service unavailable", { status: 500 });
        }

        const authHeader = request.headers.get("authorization") ?? "";
        const bearer = authHeader.toLowerCase().startsWith("bearer ")
          ? authHeader.slice(7).trim()
          : "";
        const legacy = request.headers.get("x-dispatch-secret") ?? "";
        const provided = bearer || legacy;

        if (!provided || !timingSafeEqualStr(provided, expected)) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendPushToUser } = await import("@/lib/push-dispatcher.server");

        const nowIso = new Date().toISOString();

        const { data: due, error } = await supabaseAdmin
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .from("reminders" as any)
          .select("id, user_id, texto, prioridade")
          .eq("notificado", false)
          .eq("concluido", false)
          .lte("data_hora", nowIso)
          .order("data_hora", { ascending: true })
          .limit(200);

        if (error) {
          logger.error("[reminders-dispatch] erro ao buscar:", error);
          return Response.json({ error: error.message }, { status: 500 });
        }

        const rows = (due ?? []) as unknown as Array<{
          id: string;
          user_id: string;
          texto: string;
          prioridade: "alta" | "media" | "baixa";
        }>;

        if (rows.length === 0) {
          return Response.json({ ok: true, processed: 0 });
        }

        let sent = 0;
        const errors: string[] = [];

        for (const r of rows) {
          const prefix = r.prioridade === "alta" ? "🔴" : r.prioridade === "baixa" ? "🟢" : "🔔";
          try {
            const res = await sendPushToUser(r.user_id, {
              title: `${prefix} Lembrete`,
              body: r.texto,
              url: "/painel-anotacoes",
            });
            sent += res.sent;
            if (res.errors.length) errors.push(...res.errors);
          } catch (e) {
            errors.push(e instanceof Error ? e.message : String(e));
          }
        }

        const ids = rows.map((r) => r.id);
        await supabaseAdmin
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .from("reminders" as any)
          .update({ notificado: true })
          .in("id", ids);

        return Response.json({ ok: true, processed: rows.length, sent, errors });
      },
    },
  },
});

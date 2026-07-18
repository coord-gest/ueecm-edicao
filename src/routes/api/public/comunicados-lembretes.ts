import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
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
 * Cron endpoint (chamar a cada 5 min via pg_cron):
 * Reenvia push de lembrete para comunicados que:
 *  - tenham lembrete_apos_horas definido
 *  - lembrete_enviado = false
 *  - created_at + lembrete_apos_horas <= now()
 *
 * Enfileira 1 push agrupado por (autor, título) e marca lembrete_enviado.
 */
export const Route = createFileRoute("/api/public/comunicados-lembretes")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const SUPABASE_URL = readServerEnv(request, "SUPABASE_URL", "VITE_SUPABASE_URL") ?? "";
          const SERVICE_KEY =
            readServerEnv(request, "SUPABASE_SERVICE_ROLE_KEY", "SERVICE_ROLE_KEY") ?? "";
          const SHARED = readServerEnv(request, "DISPATCH_SECRET") ?? "";

          if (!SUPABASE_URL || !SERVICE_KEY) {
            return new Response(JSON.stringify({ error: "missing_env" }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }
          const authHeader = request.headers.get("authorization") ?? "";
          const bearer = authHeader.toLowerCase().startsWith("bearer ")
            ? authHeader.slice(7).trim()
            : "";
          const legacy = request.headers.get("x-dispatch-secret") ?? "";
          const provided = bearer || legacy;
          if (!SHARED || !provided || !timingSafeEqualStr(provided, SHARED)) {
            return new Response("Unauthorized", { status: 401 });
          }

          const admin = createClient<Database>(SUPABASE_URL, SERVICE_KEY, {
            auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
          });

          // Busca comunicados vencidos com lembrete pendente.
          // Postgres: filtra em SQL bruto via .rpc não existe — usamos filter no cliente.
          const { data: rows, error } = await (admin.from("comunicados") as any)
            .select("id, titulo, mensagem, autor_id, created_at, lembrete_apos_horas")
            .not("lembrete_apos_horas", "is", null)
            .eq("lembrete_enviado", false)
            .limit(500);
          if (error) throw error;

          const now = Date.now();
          const vencidos = (rows ?? []).filter((r: any) => {
            const criado = new Date(r.created_at).getTime();
            return criado + Number(r.lembrete_apos_horas) * 3600_000 <= now;
          }) as Array<{ id: string; titulo: string; mensagem: string; autor_id: string | null }>;

          // Agrupa por (autor, título) para não spammar
          const grupos = new Map<string, { titulo: string; ids: string[] }>();
          for (const r of vencidos) {
            const k = `${r.autor_id ?? ""}::${r.titulo}`;
            const g = grupos.get(k);
            if (g) g.ids.push(r.id);
            else grupos.set(k, { titulo: r.titulo, ids: [r.id] });
          }

          let pushCount = 0;
          for (const g of grupos.values()) {
            await admin.from("push_notifications_queue").insert({
              title: "🔔 Lembrete: comunicado não lido",
              body: g.titulo.slice(0, 240),
              url: "/meus-comunicados",
              source: "comunicado_lembrete",
              source_id: g.ids[0],
            });
            pushCount += 1;
            await admin
              .from("comunicados")
              .update({ lembrete_enviado: true } as never)
              .in("id", g.ids);
          }

          return new Response(
            JSON.stringify({ ok: true, processados: vencidos.length, pushs: pushCount }),
            { headers: { "Content-Type": "application/json" } },
          );
        } catch (err) {
          logger.error("[comunicados-lembretes]", err);
          void logSystemError({
            source: "api:comunicados-lembretes",
            severity: "critical",
            message: "Falha ao processar lembretes de comunicados",
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

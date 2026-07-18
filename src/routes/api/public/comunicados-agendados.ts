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
 * Cron endpoint: dispara comunicados com `agendado_para <= now()` que ainda
 * não tiveram push enfileirado. Agrupa por título+autor+minuto para não
 * gerar N pushes iguais quando o mesmo comunicado é criado para várias turmas.
 *
 * Configurar pg_cron para chamar este endpoint a cada 1 minuto.
 */
export const Route = createFileRoute("/api/public/comunicados-agendados")({
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

          const nowIso = new Date().toISOString();

          const { data: pendentes, error } = await (admin.from("comunicados") as any)
            .select("id, titulo, mensagem, autor_id, created_at, agendado_para, push_enfileirado")
            .lte("agendado_para", nowIso)
            .is("push_enfileirado", false)
            .not("agendado_para", "is", null)
            .limit(200);

          if (error) throw error;

          const rows = (pendentes ?? []) as Array<{
            id: string;
            titulo: string;
            mensagem: string;
            autor_id: string | null;
          }>;

          // Agrupa por (autor_id + titulo) para enfileirar apenas 1 push por lote
          const grupos = new Map<string, { titulo: string; mensagem: string; ids: string[] }>();
          for (const r of rows) {
            const k = `${r.autor_id ?? ""}::${r.titulo}`;
            const g = grupos.get(k);
            if (g) g.ids.push(r.id);
            else grupos.set(k, { titulo: r.titulo, mensagem: r.mensagem, ids: [r.id] });
          }

          let pushCount = 0;
          for (const g of grupos.values()) {
            await admin.from("push_notifications_queue").insert({
              title: g.titulo || "Novo comunicado",
              body: (g.mensagem ?? "").slice(0, 240),
              url: "/escola/comunicados",
              source: "comunicado",
              source_id: g.ids[0],
            });
            pushCount += 1;

            await admin
              .from("comunicados")
              .update({ push_enfileirado: true } as never)
              .in("id", g.ids);
          }

          return new Response(
            JSON.stringify({ ok: true, processados: rows.length, pushs: pushCount }),
            { headers: { "Content-Type": "application/json" } },
          );
        } catch (err) {
          logger.error("[comunicados-agendados]", err);
          void logSystemError({
            source: "api:comunicados-agendados",
            severity: "critical",
            message: "Falha ao processar comunicados agendados",
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

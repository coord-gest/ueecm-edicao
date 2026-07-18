import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { logSystemError } from "@/lib/system-errors.server";
import { readServerEnv } from "@/lib/server-env";
import { logger } from "@/lib/logger";

function getEnv(request: Request, names: string[]): string | undefined {
  return readServerEnv(request, ...names);
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function fmtBr(d: Date): string {
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Fortaleza",
  });
}

/**
 * Cron endpoint: enfileira lembretes de agendamentos que estão a ~24h ou ~1h
 * do horário marcado. Usa a fila `push_notifications_queue`.
 *
 * Configurar pg_cron para chamar este endpoint a cada 15 minutos.
 */
export const Route = createFileRoute("/api/public/agendamentos-lembretes")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const SUPABASE_URL = getEnv(request, ["SUPABASE_URL", "VITE_SUPABASE_URL"]) ?? "";
          const SERVICE_KEY =
            getEnv(request, ["SUPABASE_SERVICE_ROLE_KEY", "SERVICE_ROLE_KEY"]) ?? "";
          const SHARED = getEnv(request, ["DISPATCH_SECRET"]) ?? "";

          if (!SUPABASE_URL || !SERVICE_KEY) {
            return new Response(JSON.stringify({ error: "missing_env" }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }

          // Autorização: exige DISPATCH_SECRET obrigatório com comparação timing-safe.
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

          const now = Date.now();
          const in24h = new Date(now + 24 * 60 * 60 * 1000);
          const in23h = new Date(now + 23 * 60 * 60 * 1000);
          const in1h = new Date(now + 60 * 60 * 1000);
          const in45m = new Date(now + 45 * 60 * 1000);

          // Janela 24h: agendamentos confirmados começando entre 23h e 24h,
          // ainda sem lembrete_24h enviado.
          const { data: janela24 } = await admin
            .from("agendamentos")
            .select("id, protocolo, inicio_at, solicitante_nome")
            .eq("status", "confirmado")
            .is("lembrete_24h_enviado_em", null)
            .gte("inicio_at", in23h.toISOString())
            .lte("inicio_at", in24h.toISOString());

          // Janela 1h: entre 45min e 1h
          const { data: janela1 } = await admin
            .from("agendamentos")
            .select("id, protocolo, inicio_at, solicitante_nome")
            .eq("status", "confirmado")
            .is("lembrete_1h_enviado_em", null)
            .gte("inicio_at", in45m.toISOString())
            .lte("inicio_at", in1h.toISOString());

          const enfileirados: string[] = [];

          for (const a of janela24 ?? []) {
            const inicio = new Date(a.inicio_at);
            await admin.from("push_notifications_queue").insert({
              title: "Lembrete: reunião amanhã",
              body: `${a.solicitante_nome}, sua reunião está agendada para ${fmtBr(inicio)}. Protocolo ${a.protocolo}.`,
              url: "/meus-agendamentos",
              source: "agendamento",
              source_id: a.id,
            });
            await admin
              .from("agendamentos")
              .update({ lembrete_24h_enviado_em: new Date().toISOString() })
              .eq("id", a.id);
            enfileirados.push(a.id);
          }

          for (const a of janela1 ?? []) {
            const inicio = new Date(a.inicio_at);
            await admin.from("push_notifications_queue").insert({
              title: "Sua reunião começa em breve",
              body: `${a.solicitante_nome}, faltam menos de 1 hora para sua reunião (${fmtBr(inicio)}).`,
              url: "/meus-agendamentos",
              source: "agendamento",
              source_id: a.id,
            });
            await admin
              .from("agendamentos")
              .update({ lembrete_1h_enviado_em: new Date().toISOString() })
              .eq("id", a.id);
            enfileirados.push(a.id);
          }

          return new Response(JSON.stringify({ ok: true, enfileirados: enfileirados.length }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (err) {
          logger.error("[agendamentos-lembretes]", err);
          void logSystemError({
            source: "api:agendamentos-lembretes",
            severity: "critical",
            message: "Falha ao enfileirar lembretes de agendamentos",
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

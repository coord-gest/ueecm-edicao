import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireAdmin(ctx: { supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> }; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("is_school_admin", { _user_id: ctx.userId });
  if (error) throw error as Error;
  if (!data) throw new Error("Acesso restrito a administradores.");
}

/**
 * Agenda uma rajada recorrente para um alerta existente.
 * O cron pg_cron "alert-burst-tick" executa a cada minuto e enfileira
 * os pushes na hora certa — funciona mesmo com a aba do painel fechada.
 */
export const scheduleAlertBurst = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        alertId: z.string().uuid(),
        startsAt: z.string().datetime(),
        intervalMinutes: z.number().int().min(1).max(1440),
        repeatCount: z.number().int().min(1).max(50),
      })
      .parse(data),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await requireAdmin(context as never);

    // Rate-limit criação de rajadas: 5/hora por admin
    const { data: allowed } = await context.supabase.rpc("check_rate_limit", {
      _key: `alert-burst-schedule:${context.userId}`,
      _max_requests: 5,
      _window_seconds: 3600,
    });
    if (allowed === false) {
      await context.supabase.rpc("log_alert_action", {
        _alert_id: data.alertId,
        _action: "rate_limited",
        _result: "rate_limited",
        _details: { scope: "burst_schedule", limit: 5, window_seconds: 3600 },
      });
      throw new Error("Limite atingido: máximo de 5 rajadas agendadas por hora por administrador.");
    }

    const startsAt = new Date(data.startsAt);
    if (startsAt.getTime() < Date.now() - 60_000) {
      throw new Error("A data/hora de início precisa estar no futuro.");
    }

    const { data: row, error } = await context.supabase
      .from("alert_burst_schedules")
      .insert({
        alert_id: data.alertId,
        starts_at: startsAt.toISOString(),
        interval_minutes: data.intervalMinutes,
        repeat_count: data.repeatCount,
        next_run_at: startsAt.toISOString(),
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await context.supabase.rpc("log_alert_action", {
      _alert_id: data.alertId,
      _action: "burst_scheduled",
      _result: "success",
      _details: {
        burst_id: row.id,
        starts_at: startsAt.toISOString(),
        interval_minutes: data.intervalMinutes,
        repeat_count: data.repeatCount,
      },
    });

    return { id: row.id };
  });

export const cancelAlertBurst = createServerFn({ method: "POST" })
  .validator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await requireAdmin(context as never);

    const { data: row, error: qErr } = await context.supabase
      .from("alert_burst_schedules")
      .select("id, alert_id, sent_count, repeat_count")
      .eq("id", data.id)
      .maybeSingle();
    if (qErr) throw new Error(qErr.message);
    if (!row) throw new Error("Rajada não encontrada.");

    const { error } = await context.supabase
      .from("alert_burst_schedules")
      .update({ active: false, cancelled_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    await context.supabase.rpc("log_alert_action", {
      _alert_id: row.alert_id,
      _action: "burst_cancelled",
      _result: "success",
      _details: { burst_id: row.id, sent_count: row.sent_count, total: row.repeat_count },
    });

    return { ok: true };
  });

/**
 * Registra uma ação do painel (criar/editar/excluir/ativar/desativar) na
 * auditoria. Chamado do cliente após uma mutação bem-sucedida via Supabase.
 */
export const logAlertClientAction = createServerFn({ method: "POST" })
  .validator((input) =>
    z
      .object({
        alertId: z.string().uuid().nullable(),
        action: z.enum(["created", "updated", "deleted", "activated", "deactivated"]),
        result: z.enum(["success", "failed"]).default("success"),
        details: z.record(z.string(), z.unknown()).optional(),
      })
      .parse(input),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await requireAdmin(context as never);
    const { error } = await context.supabase.rpc("log_alert_action", {
      _alert_id: (data.alertId ?? null) as unknown as string,
      _action: data.action,
      _result: data.result,
      _details: (data.details ?? {}) as never,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAlertAuditLogs = createServerFn({ method: "GET" })
  .validator((input) =>
    z
      .object({
        alertId: z.string().uuid().optional(),
        action: z.string().optional(),
        limit: z.number().int().min(1).max(500).default(100),
      })
      .parse(input ?? {}),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await requireAdmin(context as never);
    let q = context.supabase
      .from("alert_audit_logs")
      .select("id, alert_id, actor_id, actor_email, action, result, details, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.alertId) q = q.eq("alert_id", data.alertId);
    if (data.action) q = q.eq("action", data.action);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

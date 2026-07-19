import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Enfileira 1 push referente a um alerta (existente ou avulso) e dispara
// o drain imediato. Restrito a administradores da escola, com rate-limit
// anti-spam (10/h por admin, 30/h global) e registro em alert_audit_logs.
export const sendAlertPushNow = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        alertId: z.string().uuid().optional(),
        title: z.string().min(1).max(140).optional(),
        body: z.string().min(1).max(500).optional(),
        url: z.string().max(500).optional().nullable(),
        origin: z.enum(["manual", "burst"]).optional(),
      })
      .parse(data),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("is_school_admin", {
      _user_id: context.userId,
    });
    if (roleErr) throw roleErr;
    if (!isAdmin) throw new Error("Acesso restrito a administradores.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // --- Rate limit (10/h por admin, 30/h global) ---
    const { data: perUser } = await context.supabase.rpc("check_rate_limit", {
      _key: `alert-push:${context.userId}`,
      _max_requests: 10,
      _window_seconds: 3600,
    });
    if (perUser === false) {
      await context.supabase.rpc("log_alert_action", {
        _alert_id: (data.alertId ?? null) as unknown as string,
        _action: "rate_limited",
        _result: "rate_limited",
        _details: { scope: "per_user", limit: 10, window_seconds: 3600 },
      });
      throw new Error(
        "Limite atingido: você já enviou 10 pushes na última hora. Aguarde antes de reenviar.",
      );
    }
    const { data: global } = await context.supabase.rpc("check_rate_limit", {
      _key: "alert-push:__global__",
      _max_requests: 30,
      _window_seconds: 3600,
    });
    if (global === false) {
      await context.supabase.rpc("log_alert_action", {
        _alert_id: (data.alertId ?? null) as unknown as string,
        _action: "rate_limited",
        _result: "rate_limited",
        _details: { scope: "global", limit: 30, window_seconds: 3600 },
      });
      throw new Error(
        "Limite global atingido: já foram enviados 30 pushes de alerta na última hora.",
      );
    }

    let title = data.title ?? "Alerta da escola";
    let body = data.body ?? "";
    let url = data.url ?? "/";
    let sourceId: string | null = null;

    if (data.alertId) {
      const { data: alert, error } = await supabaseAdmin
        .from("alerts")
        .select("id, message, variant, link_url")
        .eq("id", data.alertId)
        .maybeSingle();
      if (error) throw error;
      if (!alert) throw new Error("Alerta não encontrado.");
      const variantTitles: Record<string, string> = {
        destructive: "🚨 Alerta urgente",
        warning: "⚠️ Aviso",
        success: "✅ Comunicado",
        info: "📢 Informação",
      };
      title = variantTitles[alert.variant ?? "info"] ?? "📢 Alerta da escola";
      body = alert.message;
      url = alert.link_url ?? "/";
      sourceId = alert.id;
    }

    if (!body) throw new Error("Mensagem obrigatória.");

    const { error: qErr } = await supabaseAdmin.from("push_notifications_queue").insert({
      title,
      body,
      url,
      source: "alert",
      source_id: sourceId,
    });
    if (qErr) throw qErr;

    await context.supabase.rpc("log_alert_action", {
      _alert_id: sourceId as unknown as string,
      _action: "resend_push",
      _result: "success",
      _details: { origin: data.origin ?? "manual", title },
    });

    const { drainPushQueue } = await import("./push-dispatcher.server");
    return drainPushQueue();
  });
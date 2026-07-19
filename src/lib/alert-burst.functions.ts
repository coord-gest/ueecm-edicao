import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Enfileira 1 push referente a um alerta (existente ou avulso) e dispara
// o drain imediato. Restrito a administradores da escola.
export const sendAlertPushNow = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        alertId: z.string().uuid().optional(),
        title: z.string().min(1).max(140).optional(),
        body: z.string().min(1).max(500).optional(),
        url: z.string().max(500).optional().nullable(),
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

    const { drainPushQueue } = await import("./push-dispatcher.server");
    return drainPushQueue();
  });
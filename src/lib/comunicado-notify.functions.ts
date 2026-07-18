import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Enfileira uma notificação push para um comunicado recém-criado e
// dispara o drain imediato. O conteúdo entregue é genérico (sem
// dados sensíveis); o link leva para /meus-comunicados onde o RLS
// filtra o que cada responsável pode ver.
export const notifyComunicadoCreated = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        titulo: z.string().min(1).max(140),
        count: z.number().int().positive().max(500).default(1),
      })
      .parse(data),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const body =
      data.count > 1
        ? `${data.count} novos comunicados da escola`
        : `Novo comunicado: ${data.titulo}`;

    const { error } = await supabaseAdmin.from("push_notifications_queue").insert({
      title: "📣 Comunicado da escola",
      body,
      url: "/meus-comunicados",
      source: "comunicado",
    });
    if (error) throw error;

    const { drainPushQueue } = await import("./push-dispatcher.server");
    return drainPushQueue();
  });

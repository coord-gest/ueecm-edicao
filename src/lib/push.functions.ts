import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Drena a fila — exige sessão autenticada (chamada pelos painéis após
// criar alertas/posts). O dispatch automático via banco usa a rota HTTP
// /api/public/dispatch-push protegida por DISPATCH_SECRET.
export const dispatchPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { drainPushQueue } = await import("./push-dispatcher.server");
    return drainPushQueue();
  });

export const sendTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { sendTestPushToUser } = await import("./push-dispatcher.server");
    return sendTestPushToUser(context.userId);
  });

// Envia um push de teste para TODAS as subscrições ativas (inclui visitantes
// anônimos). Restrito a administradores da escola.
export const broadcastTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin, error } = await context.supabase.rpc("is_school_admin", {
      _user_id: context.userId,
    });
    if (error) throw error;
    if (!isAdmin) throw new Error("Acesso restrito a administradores.");
    const { broadcastTestPushToAll } = await import("./push-dispatcher.server");
    return broadcastTestPushToAll();
  });

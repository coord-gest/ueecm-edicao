import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { logger, safeError } from "@/lib/logger";

/**
 * Dispara a drenagem da fila de push a partir do painel de developer.
 *
 * Não usa o endpoint HTTP `/api/public/dispatch-push` (que agora exige
 * DISPATCH_SECRET). Em vez disso, chama `drainPushQueue()` diretamente,
 * protegido por:
 *   1. `requireSupabaseAuth` — precisa estar logado.
 *   2. Verificação de role `desenvolvedor` consultando `user_roles` sob RLS.
 */
export const triggerPushDispatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roleRow, error: roleErr } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "desenvolvedor")
      .maybeSingle();
    if (roleErr) {
      logger.error("[triggerPushDispatch] falha ao verificar role", safeError(roleErr));
      throw new Error("Não foi possível verificar permissão.");
    }
    if (!roleRow) {
      throw new Error("Acesso restrito a desenvolvedores.");
    }

    const { drainPushQueue } = await import("@/lib/push-dispatcher.server");
    return drainPushQueue();
  });

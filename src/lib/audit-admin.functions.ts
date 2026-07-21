import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertDeveloper(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "desenvolvedor")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Apenas o Desenvolvedor pode limpar o log de auditoria.");
}

export const clearAuditLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => z.object({ confirm: z.literal(true) }).parse(input))
  .handler(async ({ context }) => {
    await assertDeveloper(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error, count } = await supabaseAdmin
      .from("audit_logs")
      .delete({ count: "exact" })
      .not("id", "is", null);
    if (error) throw new Error(error.message);
    return { deleted: count ?? 0 };
  });

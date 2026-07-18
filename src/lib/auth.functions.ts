import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeRoles } from "@/lib/roles";

export const getCurrentUserRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);

    if (error) {
      throw new Error(`Falha ao carregar papéis do usuário: ${error.message}`);
    }

    return { roles: normalizeRoles((data ?? []).map((row) => row.role as string)) };
  });

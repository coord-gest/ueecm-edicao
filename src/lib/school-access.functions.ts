import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { hasAnyRole, normalizeRoles } from "@/lib/roles";

export type TeacherProfile = {
  id: string;
  display_name: string | null;
  email: string | null;
};

export const listTeacherProfiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TeacherProfile[]> => {
    const { data: currentRoleRows, error: currentRoleError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);

    if (currentRoleError) throw new Error(currentRoleError.message);

    const currentRoles = normalizeRoles((currentRoleRows ?? []).map((row) => row.role as string));
    if (
      !hasAnyRole(currentRoles, ["desenvolvedor", "admin", "diretor", "coordenador", "secretario"])
    ) {
      throw new Error("Acesso restrito à administração escolar.");
    }

    const { data: roleRows, error: roleError } = await context.supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ["professor", "teacher"]);

    if (roleError) throw new Error(roleError.message);

    const ids = Array.from(new Set((roleRows ?? []).map((row) => row.user_id).filter(Boolean)));
    if (ids.length === 0) return [];

    const { data, error } = await context.supabase
      .from("profiles")
      .select("id, display_name, email")
      .in("id", ids)
      .order("display_name", { ascending: true });

    if (error) throw new Error(error.message);
    return (data ?? []) as TeacherProfile[];
  });

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Profissional } from "@/lib/profissionais";

export const listProfissionaisAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Profissional[]> => {
    const ctx = context as unknown as {
      supabase: {
        from: (table: string) => {
          select: (columns: string) => {
            eq: (
              column: string,
              value: string,
            ) => {
              in: (
                column: string,
                values: string[],
              ) => {
                limit: (count: number) => Promise<{
                  data: Array<{ role: string }> | null;
                  error: { message: string } | null;
                }>;
              };
            };
          };
        };
      };
      userId: string;
    };

    const allowedRoles = [
      "desenvolvedor",
      "developer",
      "diretor",
      "director",
      "coordenador",
      "coordinator",
      "admin",
    ];

    const { data: roleRows, error: roleError } = await ctx.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", ctx.userId)
      .in("role", allowedRoles)
      .limit(1);

    if (roleError) throw new Error(roleError.message);
    if (!roleRows || roleRows.length === 0) {
      throw new Error("Acesso restrito a Desenvolvedor, Diretor ou Coordenador.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("profissionais")
      .select("*")
      .order("ordem", { ascending: true, nullsFirst: false })
      .order("nome", { ascending: true });

    if (error) throw new Error(error.message);
    return (data ?? []) as Profissional[];
  });

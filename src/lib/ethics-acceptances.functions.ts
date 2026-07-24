import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type EthicsAcceptanceRow = {
  id: string;
  user_id: string;
  version: number;
  accepted_at: string;
  ip: string | null;
  user_agent: string | null;
  display_name: string | null;
  full_name: string | null;
  email: string | null;
  cargo: string | null;
  roles: string[];
};

const ALLOWED = ["desenvolvedor", "developer", "admin", "diretor", "coordenador"];

export const listEthicsAcceptances = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EthicsAcceptanceRow[]> => {
    const ctx = context as unknown as {
      supabase: {
        from: (t: string) => {
          select: (c: string) => {
            eq: (col: string, val: string) => {
              in: (col: string, vals: string[]) => {
                limit: (n: number) => Promise<{ data: Array<{ role: string }> | null; error: { message: string } | null }>;
              };
            };
          };
        };
      };
      userId: string;
    };

    const { data: roleRows, error: roleErr } = await ctx.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", ctx.userId)
      .in("role", ALLOWED)
      .limit(1);
    if (roleErr) throw new Error(roleErr.message);
    if (!roleRows || roleRows.length === 0) {
      throw new Error("Acesso restrito a Administrador, Diretor ou Coordenador.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: accs, error } = await supabaseAdmin
      .from("code_of_ethics_acceptances")
      .select("*")
      .order("accepted_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);

    const list = (accs ?? []) as Array<{
      id: string; user_id: string; version: number; accepted_at: string; ip: string | null; user_agent: string | null;
    }>;
    const ids = Array.from(new Set(list.map((r) => r.user_id)));
    if (ids.length === 0) return [];

    const [{ data: profs }, { data: roles }] = await Promise.all([
      supabaseAdmin.from("profiles").select("user_id,display_name,full_name,email,cargo").in("user_id", ids),
      supabaseAdmin.from("user_roles").select("user_id,role").in("user_id", ids),
    ]);

    const pMap = new Map<string, { display_name: string | null; full_name: string | null; email: string | null; cargo: string | null }>();
    for (const p of (profs ?? []) as Array<{ user_id: string; display_name: string | null; full_name: string | null; email: string | null; cargo: string | null }>) {
      pMap.set(p.user_id, { display_name: p.display_name, full_name: p.full_name, email: p.email, cargo: p.cargo });
    }
    const rMap = new Map<string, string[]>();
    for (const r of (roles ?? []) as Array<{ user_id: string; role: string }>) {
      const arr = rMap.get(r.user_id) ?? [];
      arr.push(r.role);
      rMap.set(r.user_id, arr);
    }

    return list.map((r) => ({
      ...r,
      display_name: pMap.get(r.user_id)?.display_name ?? null,
      full_name: pMap.get(r.user_id)?.full_name ?? null,
      email: pMap.get(r.user_id)?.email ?? null,
      cargo: pMap.get(r.user_id)?.cargo ?? null,
      roles: rMap.get(r.user_id) ?? [],
    }));
  });
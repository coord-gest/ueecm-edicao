import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type CleanupInput = {
  scope: "all" | "older_than_days" | "severity" | "ids";
  days?: number;
  severity?: "info" | "warning" | "error" | "critical";
  ids?: string[];
};

export const cleanupSystemErrors = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: CleanupInput) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Authorize: only desenvolvedor / diretor / admin can purge
    const { data: roles, error: rolesErr } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (rolesErr) throw new Error("Falha ao validar permissões.");
    const allowed = new Set(["desenvolvedor", "developer", "diretor", "director", "admin"]);
    const isAllowed = (roles ?? []).some((r) => allowed.has(String(r.role)));
    if (!isAllowed) throw new Error("Acesso negado.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let query = supabaseAdmin.from("system_errors").delete({ count: "exact" });

    switch (data.scope) {
      case "all":
        query = query.not("id", "is", null);
        break;
      case "older_than_days": {
        const days = Math.max(1, Math.min(365, Number(data.days ?? 30)));
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
        query = query.lt("created_at", cutoff);
        break;
      }
      case "severity":
        if (!data.severity) throw new Error("Severidade obrigatória.");
        query = query.eq("severity", data.severity);
        break;
      case "ids":
        if (!data.ids?.length) throw new Error("Nenhum ID informado.");
        query = query.in("id", data.ids);
        break;
    }

    const { error, count } = await query;
    if (error) throw new Error(error.message);
    return { deleted: count ?? 0 };
  });

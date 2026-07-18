import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ADMIN_ROUTE_PERMISSIONS, allowedRolesFor } from "@/lib/admin-routes";

const InputSchema = z.object({
  route: z.string().min(1).max(200),
  userAgent: z.string().max(500).nullable().optional(),
});

/**
 * Grava um log de acesso administrativo. A avaliação de granted/denied é feita
 * SERVER-SIDE (a partir das roles reais do usuário em `user_roles`), impedindo
 * que o cliente forje o campo `outcome`, `roles` ou `required_roles`.
 */
export const logAdminAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rolesRows, error: rolesErr } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (rolesErr) throw new Error(rolesErr.message);

    const roles = (rolesRows ?? []).map((r) => r.role as string);
    const entry = ADMIN_ROUTE_PERMISSIONS[data.route];
    const allowed = allowedRolesFor(data.route);
    const isDev = roles.includes("desenvolvedor") || roles.includes("developer");
    const isAdmin = roles.includes("admin");
    const isAllowed = isDev || isAdmin || (allowed ? allowed.some((r) => roles.includes(r)) : true);

    const email = (context.claims?.email as string | undefined) ?? null;

    const { error } = await supabaseAdmin.from("admin_access_logs").insert({
      user_id: context.userId,
      user_email: email,
      route: data.route,
      area: entry?.area ?? data.route,
      outcome: isAllowed ? "granted" : "denied",
      roles,
      required_roles: entry?.roles ?? [],
      user_agent: data.userAgent ?? null,
    });
    if (error) throw new Error(error.message);

    return { outcome: isAllowed ? "granted" : "denied", isAllowed };
  });

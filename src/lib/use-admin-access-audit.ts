import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/use-auth";
import { painelPathForRoles } from "@/lib/role-panels";
import { allowedRolesFor } from "@/lib/admin-routes";
import { logAdminAccess } from "@/lib/admin-access-audit.functions";

/**
 * Guarda + auditoria para rotas administrativas.
 *
 * - Bloqueia acesso direto no navegador quando o usuário não tem a role correta.
 * - Registra em `admin_access_logs` cada acesso via server function (roles e
 *   outcome resolvidos server-side, para não permitir forja).
 */
export function useAdminAccessAudit(routePath: string) {
  const { user, roles, loading, isDeveloper, isAdmin } = useAuth();
  const navigate = useNavigate();
  const loggedRef = useRef(false);
  const log = useServerFn(logAdminAccess);

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    if (loggedRef.current) return;

    const allowed = allowedRolesFor(routePath);
    const isAllowed =
      isDeveloper || isAdmin || (allowed ? allowed.some((r) => roles.includes(r)) : true);

    loggedRef.current = true;
    void log({
      data: {
        route: routePath,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null,
      },
    }).catch(() => {
      // best-effort; falhas de auditoria não devem quebrar a UX
    });

    if (!isAllowed) {
      navigate({ to: painelPathForRoles(roles), replace: true });
    }
  }, [loading, user, roles, isDeveloper, isAdmin, routePath, navigate, log]);

  return { checking: loading };
}

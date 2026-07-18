import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/use-auth";
import { painelPathForRoles } from "@/lib/role-panels";
import type { AppRole } from "@/lib/roles";

/**
 * Guard para rotas de painel por perfil.
 *
 * - Se a sessão ainda estiver carregando, aguarda.
 * - Se o usuário NÃO tem os papéis permitidos, redireciona para o painel correspondente ao papel dele.
 * - Se roles estiver vazio, força um refresh uma vez para descartar cache antigo da sessão.
 *
 * @param allow lista de papéis permitidos nesta rota (além de desenvolvedor/admin, que sempre passam).
 * @returns { checking } — true enquanto o guard resolve; a rota deve mostrar loader/fallback.
 */
export function useRolePainelGuard(allow: AppRole[]) {
  const { roles, loading, isDeveloper, isAdmin, refreshRoles } = useAuth();
  const navigate = useNavigate();
  const refreshedOnceRef = useRef(false);

  // Se roles chegou vazio após loading, tenta um refresh (sessão antiga sem GRANTs).
  useEffect(() => {
    if (loading) return;
    if (roles.length === 0 && !refreshedOnceRef.current) {
      refreshedOnceRef.current = true;
      refreshRoles();
    }
  }, [loading, roles, refreshRoles]);

  useEffect(() => {
    if (loading) return;
    if (roles.length === 0) return; // ainda pode estar carregando após o refresh
    if (isDeveloper || isAdmin) return;
    const allowed = allow.some((r) => roles.includes(r));
    if (!allowed) {
      navigate({ to: painelPathForRoles(roles), replace: true });
    }
  }, [loading, roles, isDeveloper, isAdmin, allow, navigate]);

  return { checking: loading };
}

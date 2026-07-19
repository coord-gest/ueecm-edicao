import type { AppRole } from "@/lib/roles";

/**
 * Ordem de prioridade dos papéis para escolher qual painel exibir por padrão.
 * O primeiro papel encontrado na lista do usuário define o painel principal.
 */
export const ROLE_PRIORITY: AppRole[] = [
  "desenvolvedor",
  "diretor",
  "admin",
  "coordenador",
  "secretario",
  "professor",
  "social_media",
  "leitor",
];

export const ROLE_PANEL_PATH: Record<AppRole, string> = {
  desenvolvedor: "/painel",
  admin: "/painel",
  diretor: "/painel-diretor",
  coordenador: "/painel-coordenador",
  secretario: "/painel-secretario",
  professor: "/painel-professor",
  social_media: "/painel-social-media",
  leitor: "/painel-responsavel",
};

export function primaryRole(roles: AppRole[]): AppRole | null {
  for (const r of ROLE_PRIORITY) if (roles.includes(r)) return r;
  return null;
}

export function painelPathForRoles(roles: AppRole[]): string {
  const p = primaryRole(roles);
  return p ? ROLE_PANEL_PATH[p] : "/painel";
}

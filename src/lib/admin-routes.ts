import type { AppRole } from "@/lib/roles";

/**
 * Fonte única de verdade para permissões de rotas administrativas.
 * Usada tanto pelo sidebar (para exibir itens) quanto pelas próprias rotas
 * (via `useAdminAccessAudit`) para bloquear acesso direto pelo navegador.
 *
 * `desenvolvedor` e `admin` têm acesso automático a todas as rotas listadas.
 */
export type AdminRoutePermission = {
  /** Nome amigável da área (usado no log de auditoria). */
  area: string;
  /** Papéis autorizados, além de desenvolvedor/admin. */
  roles: AppRole[];
};

export const ADMIN_ROUTE_PERMISSIONS: Record<string, AdminRoutePermission> = {
  // ---------- Conteúdo ----------
  "/painel-posts": {
    area: "Publicações",
    roles: ["diretor", "coordenador", "secretario", "professor"],
  },
  "/painel-aprovacao": { area: "Fila de aprovação", roles: ["diretor", "coordenador"] },
  "/painel-comentarios": { area: "Comentários", roles: ["diretor", "coordenador", "secretario"] },
  "/painel-familias": { area: "Famílias UEECM", roles: ["diretor", "coordenador", "secretario"] },
  "/painel-destaques": { area: "Destaques da Home", roles: ["diretor", "coordenador"] },
  "/painel-destaques-alunos": {
    area: "Alunos do Mês",
    roles: ["diretor", "coordenador", "professor"],
  },
  "/painel-alertas": { area: "Alertas globais", roles: ["diretor", "coordenador"] },
  "/painel-patrocinadores": { area: "Patrocinadores", roles: ["diretor"] },

  // ---------- Acadêmico ----------
  "/painel-academico": { area: "Turmas & Disciplinas", roles: ["diretor", "coordenador"] },
  "/escola/alunos": { area: "Alunos", roles: ["diretor", "coordenador", "secretario"] },
  "/escola/alunos-importar": {
    area: "Importar alunos",
    roles: ["diretor", "coordenador", "secretario"],
  },
  "/escola/turmas": { area: "Turmas (escola)", roles: ["diretor", "coordenador"] },
  "/escola/professores": { area: "Professores (escola)", roles: ["diretor", "coordenador"] },
  "/painel-profissionais": { area: "Profissionais", roles: ["diretor", "coordenador"] },
  "/escola/comunicados": { area: "Comunicados", roles: ["diretor", "coordenador", "secretario"] },
  "/painel-agendamentos": {
    area: "Agendamentos",
    roles: ["diretor", "coordenador", "secretario", "professor"],
  },
  "/painel-arquivos": {
    area: "Arquivos",
    roles: ["diretor", "coordenador", "professor", "secretario"],
  },

  // ---------- Pais e Responsáveis (áreas críticas) ----------
  "/escola/responsaveis": { area: "Responsáveis (escola)", roles: ["diretor", "coordenador"] },
  "/painel-autorizacoes": { area: "Autorizações", roles: ["diretor", "coordenador"] },
  "/painel-mensagens": { area: "Mensagens da coordenação", roles: ["diretor", "coordenador"] },

  // ---------- Administração ----------
  "/usuarios": { area: "Usuários", roles: ["diretor"] },
  "/painel-analytics": { area: "Analytics", roles: ["diretor", "coordenador"] },
  "/painel-finops": { area: "FinOps (custos & uso)", roles: ["diretor"] },
  "/painel-auditoria": { area: "Auditoria", roles: [] }, // apenas desenvolvedor/admin
  "/painel-acessos": { area: "Acessos administrativos", roles: [] }, // apenas desenvolvedor/admin
  "/painel-erros": { area: "Painel de erros", roles: [] },
  "/painel-runtime": { area: "Runtime & diagnóstico", roles: [] },
  "/painel-tema": { area: "Animações do tema", roles: ["diretor", "coordenador"] },
  "/painel-lgpd": { area: "Solicitações LGPD", roles: ["diretor", "coordenador", "secretario"] },
  "/painel-etica": {
    area: "Código de Ética (aceites)",
    roles: ["diretor", "coordenador"],
  },
  "/painel-desenvolvedor": {
    area: "FAQ do desenvolvedor",
    roles: ["diretor", "coordenador", "secretario", "professor"],
  },
  "/painel-manutencao": { area: "Manutenção (backup, recursos, imagens)", roles: ["diretor"] },
  "/painel-google-drive": { area: "Google Drive", roles: ["diretor"] },
  "/painel-enviar-drive": {
    area: "Enviar para o Drive",
    roles: ["diretor", "coordenador", "secretario", "professor"],
  },
  "/painel-anotacoes": {
    area: "Anotações & Lembretes",
    roles: ["diretor", "coordenador", "secretario", "professor", "leitor"],
  },
  "/painel-cards": {
    area: "Cards de Anotação",
    roles: ["diretor", "coordenador", "secretario", "professor", "leitor"],
  },
  "/painel-enquetes": { area: "Enquetes & Pesquisas", roles: ["diretor", "coordenador"] },
  "/painel-galeria": {
    area: "Galeria de Eventos",
    roles: ["diretor", "coordenador", "secretario", "professor"],
  },
};

/**
 * Retorna a lista completa de papéis autorizados (incluindo desenvolvedor/admin).
 */
export function allowedRolesFor(path: string): AppRole[] | null {
  const entry = ADMIN_ROUTE_PERMISSIONS[path];
  if (!entry) return null;
  return Array.from(new Set<AppRole>(["desenvolvedor", "admin", ...entry.roles]));
}

export function canAccessRoute(path: string, userRoles: AppRole[]): boolean {
  const allowed = allowedRolesFor(path);
  if (!allowed) return true; // rota não gerenciada aqui → sem restrição extra
  return allowed.some((r) => userRoles.includes(r));
}

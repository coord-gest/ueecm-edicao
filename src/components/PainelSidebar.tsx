import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  FileText,
  CheckCircle2,
  Megaphone,
  Calendar,
  Clock,
  BookOpen,
  Users,
  Star,
  History,
  GraduationCap,
  Shield,
  Home,
  FolderOpen,
  BarChart3,
  DollarSign,
  Sparkles,
  Heart,
  NotebookPen,
  Vote,
  Images,
  MessageCircle,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth, type AppRole } from "@/lib/use-auth";
import { painelPathForRoles, primaryRole } from "@/lib/role-panels";
import { SIDEBAR_CONFIG, type SidebarItem } from "@/lib/sidebar-config";
import { canAccessRoute, ADMIN_ROUTE_PERMISSIONS } from "@/lib/admin-routes";

import logo from "@/assets/logo.png";

type NavItem = {
  title: string;
  url: string;
  icon: typeof FileText;
  roles?: AppRole[] | "staff" | "any";
};

const conteudo: NavItem[] = [
  { title: "Publicações", url: "/painel-posts", icon: FileText, roles: "staff" },

  {
    title: "Fila de aprovação",
    url: "/painel-aprovacao",
    icon: CheckCircle2,
    roles: ["desenvolvedor", "diretor", "coordenador"],
  },
  {
    title: "Comentários",
    url: "/painel-comentarios",
    icon: Megaphone,
    roles: ["desenvolvedor", "admin", "diretor", "coordenador", "secretario"],
  },
  {
    title: "Famílias UEECM",
    url: "/painel-familias",
    icon: Users,
    roles: ["desenvolvedor", "admin", "diretor", "coordenador", "secretario"],
  },
  {
    title: "Destaques da Home",
    url: "/painel-destaques",
    icon: Star,
    roles: ["desenvolvedor", "admin", "diretor", "coordenador"],
  },
  {
    title: "Alunos de Destaque",
    url: "/painel-destaques-alunos",
    icon: GraduationCap,
    roles: ["desenvolvedor", "admin", "diretor", "coordenador", "professor"],
  },
  {
    title: "Alertas globais",
    url: "/painel-alertas",
    icon: Megaphone,
    roles: ["desenvolvedor", "diretor", "coordenador"],
  },
  {
    title: "Patrocinadores",
    url: "/painel-patrocinadores",
    icon: Heart,
    roles: ["desenvolvedor", "diretor"],
  },
  {
    title: "Enquetes",
    url: "/painel-enquetes",
    icon: Vote,
    roles: ["desenvolvedor", "diretor", "coordenador"],
  },
  {
    title: "Galeria de Eventos",
    url: "/painel-galeria",
    icon: Images,
    roles: ["desenvolvedor", "diretor", "coordenador", "secretario", "professor"],
  },
  {
    title: "Autorizações",
    url: "/painel-autorizacoes",
    icon: Shield,
    roles: ["desenvolvedor", "diretor", "coordenador", "secretario", "professor"],
  },
  {
    title: "Mensagens",
    url: "/painel-mensagens",
    icon: Megaphone,
    roles: ["desenvolvedor", "diretor", "coordenador", "secretario"],
  },
];

const academico: NavItem[] = [
  { title: "Calendário", url: "/calendario", icon: Calendar, roles: "staff" },
  { title: "Horários", url: "/horarios", icon: Clock, roles: "staff" },
  { title: "Minhas turmas", url: "/minhas-turmas", icon: BookOpen, roles: ["professor"] },
  {
    title: "Turmas & Disciplinas",
    url: "/painel-academico",
    icon: BookOpen,
    roles: ["desenvolvedor", "admin", "diretor", "coordenador"],
  },
  {
    title: "Alunos",
    url: "/escola/alunos",
    icon: GraduationCap,
    roles: ["desenvolvedor", "admin", "diretor", "coordenador", "secretario"],
  },
  {
    title: "Importar alunos",
    url: "/escola/alunos-importar",
    icon: GraduationCap,
    roles: ["desenvolvedor", "admin", "diretor", "coordenador", "secretario"],
  },
  {
    title: "Profissionais",
    url: "/painel-profissionais",
    icon: Users,
    roles: ["desenvolvedor", "diretor", "coordenador"],
  },
  { title: "Arquivos", url: "/painel-arquivos", icon: FolderOpen, roles: "staff" },
];

const responsaveis: NavItem[] = [
  { title: "Meus filhos", url: "/meus-filhos", icon: GraduationCap, roles: "any" },
  { title: "Meus comunicados", url: "/meus-comunicados", icon: FileText, roles: "any" },
  { title: "Conversas por aluno", url: "/chat-aluno", icon: MessageCircle, roles: "any" },
];

const produtividade: NavItem[] = [
  { title: "Anotações & Lembretes", url: "/painel-anotacoes", icon: NotebookPen, roles: "any" },
];

const administracao: NavItem[] = [
  { title: "Usuários", url: "/usuarios", icon: Users, roles: ["desenvolvedor", "diretor"] },
  { title: "Auditoria", url: "/painel-auditoria", icon: History, roles: ["desenvolvedor"] },
  {
    title: "Analytics",
    url: "/painel-analytics",
    icon: BarChart3,
    roles: ["desenvolvedor", "admin", "diretor", "coordenador"],
  },
  {
    title: "FinOps — Custos",
    url: "/painel-finops",
    icon: DollarSign,
    roles: ["desenvolvedor", "admin", "diretor"],
  },
  {
    title: "Animações do tema",
    url: "/painel-tema",
    icon: Sparkles,
    roles: ["desenvolvedor", "diretor", "coordenador"],
  },
  {
    title: "Runtime & diagnóstico",
    url: "/painel-runtime",
    icon: Shield,
    roles: ["desenvolvedor"],
  },
  { title: "FAQ do desenvolvedor", url: "/painel-desenvolvedor", icon: FileText, roles: "staff" },
];

export function PainelSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const currentPath = useRouterState({ select: (s) => s.location.pathname });
  const { isStaff, hasRole, roles } = useAuth();

  const overview: NavItem[] = [
    { title: "Meu painel", url: painelPathForRoles(roles), icon: LayoutDashboard, roles: "any" },
    {
      title: "Dashboard escolar",
      url: "/escola/dashboard",
      icon: LayoutDashboard,
      roles: ["desenvolvedor", "admin", "diretor", "coordenador", "secretario"],
    },
  ];

  const canSee = (item: NavItem) => {
    if (!item.roles || item.roles === "any") return true;
    if (item.roles === "staff") return isStaff;
    return item.roles.some((r) => hasRole(r));
  };

  const isActive = (url: string) => currentPath === url;

  const renderGroup = (label: string, items: NavItem[]) => {
    const visible = items.filter(canSee);
    if (visible.length === 0) return null;
    return (
      <SidebarGroup>
        <SidebarGroupLabel>{label}</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {visible.map((item) => (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                  <Link to={item.url} className="flex items-center gap-2">
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span className="truncate">{item.title}</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link to="/painel" className="flex items-center gap-2 px-2 py-1.5">
          <img src={logo} alt="Logo" className="h-8 w-8 shrink-0" width={512} height={512} />
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <p className="truncate font-display text-sm font-semibold text-primary">Painel</p>
              <p className="truncate text-[10px] text-muted-foreground">U.E. Evaristo Campelo</p>
            </div>
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {(() => {
          const primary = primaryRole(roles);
          const custom = primary ? SIDEBAR_CONFIG[primary] : undefined;
          if (custom) {
            const resolveUrl = (item: SidebarItem) =>
              item.dynamic === "meu-painel" ? painelPathForRoles(roles) : item.url;
            return custom.map((section) => {
              const visibleItems = section.items.filter((item) => {
                const url = item.dynamic === "meu-painel" ? painelPathForRoles(roles) : item.url;
                // Se a rota está no mapa de permissões, respeita esse mapa.
                // Caso contrário (rotas pessoais como "Meus filhos"), mantém visível.
                if (ADMIN_ROUTE_PERMISSIONS[url]) return canAccessRoute(url, roles);
                return true;
              });
              if (visibleItems.length === 0) return null;
              return (
                <SidebarGroup key={section.label}>
                  <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {visibleItems.map((item) => {
                        const url = resolveUrl(item);
                        return (
                          <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton
                              asChild
                              isActive={isActive(url)}
                              tooltip={item.title}
                            >
                              <Link to={url} className="flex items-center gap-2">
                                <item.icon className="h-4 w-4 shrink-0" />
                                {!collapsed && <span className="truncate">{item.title}</span>}
                              </Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              );
            });
          }
          return (
            <>
              {renderGroup("Geral", overview)}
              {renderGroup("Conteúdo", conteudo)}
              {renderGroup("Acadêmico", academico)}
              {renderGroup("Produtividade", produtividade)}
              {renderGroup("Responsáveis", responsaveis)}
              {renderGroup("Administração", administracao)}
            </>
          );
        })()}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Voltar ao site">
                  <Link to="/" className="flex items-center gap-2">
                    <Home className="h-4 w-4 shrink-0" />
                    {!collapsed && <span>Voltar ao site</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

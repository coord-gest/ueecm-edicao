import {
  LayoutDashboard,
  FileText,
  CheckCircle2,
  Megaphone,
  Calendar,
  CalendarClock,
  Clock,
  BookOpen,
  Users,
  Star,
  FolderOpen,
  GraduationCap,
  ScrollText,
  Sparkles,
  Award,
  Shield,
  History,
  BarChart3,
  Heart,
  AlertTriangle,
  UserCog,
  Activity,
  HelpCircle,
  Wrench,
  NotebookPen,
  type LucideIcon,
} from "lucide-react";
import { ClipboardList } from "lucide-react";
import { Radar } from "lucide-react";
import { Award as AwardIcon } from "lucide-react";

import type { AppRole } from "@/lib/roles";

export type SidebarItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  /** Se true, o url é resolvido dinamicamente (ex.: /painel do papel atual) */
  dynamic?: "meu-painel";
};

export type SidebarSection = {
  label: string;
  items: SidebarItem[];
};

/**
 * Configuração de sidebar por perfil primário.
 * Cada perfil pode ter sua própria lista de seções e itens.
 * Se um perfil não estiver definido aqui, o sidebar cai no comportamento
 * padrão (filtrado por role).
 */
export const SIDEBAR_CONFIG: Partial<Record<AppRole, SidebarSection[]>> = {
  desenvolvedor: [
    {
      label: "Geral",
      items: [
        {
          title: "Meu painel",
          url: "/painel-desenvolvedor",
          icon: LayoutDashboard,
          dynamic: "meu-painel",
        },
        { title: "Dashboard escolar", url: "/escola/dashboard", icon: LayoutDashboard },
      ],
    },
    {
      label: "Conteúdo",
      items: [
        { title: "Publicações", url: "/painel-posts", icon: FileText },
        { title: "Fila de aprovação", url: "/painel-aprovacao", icon: CheckCircle2 },
        { title: "Comentários", url: "/painel-comentarios", icon: Megaphone },
        { title: "Famílias UEECM", url: "/painel-familias", icon: Users },
        { title: "Destaques da Home", url: "/painel-destaques", icon: Star },
        { title: "Alunos do Mês", url: "/painel-destaques-alunos", icon: Award },
        { title: "Alertas globais", url: "/painel-alertas", icon: Megaphone },
        { title: "Patrocinadores", url: "/painel-patrocinadores", icon: Heart },
      ],
    },
    {
      label: "Acadêmico",
      items: [
        { title: "Calendário", url: "/calendario", icon: Calendar },
        { title: "Horários", url: "/horarios", icon: Clock },
        { title: "Turmas & Disciplinas", url: "/painel-academico", icon: BookOpen },
        { title: "Alunos", url: "/escola/alunos", icon: GraduationCap },
        { title: "Importar alunos", url: "/escola/alunos-importar", icon: GraduationCap },
        { title: "Turmas (escola)", url: "/escola/turmas", icon: BookOpen },
        { title: "Professores (escola)", url: "/escola/professores", icon: Users },
        { title: "Profissionais", url: "/painel-profissionais", icon: Users },
        { title: "Comunicados", url: "/escola/comunicados", icon: Megaphone },
        { title: "Agendamentos", url: "/painel-agendamentos", icon: CalendarClock },
        { title: "Arquivos", url: "/painel-arquivos", icon: FolderOpen },
        { title: "Atividades e Trabalhos", url: "/painel-atividades", icon: ClipboardList },
        { title: "Ranking de Atividades", url: "/painel-atividades-ranking", icon: Award },
        { title: "Diário de Bordo", url: "/painel-diario-bordo-supervisao", icon: NotebookPen },
      ],
    },
    {
      label: "Pais e Responsáveis",
      items: [
        { title: "Responsáveis (escola)", url: "/escola/responsaveis", icon: UserCog },
        { title: "Autorizações", url: "/painel-autorizacoes", icon: Shield },
        { title: "Mensagens (coord.)", url: "/painel-mensagens", icon: Megaphone },
      ],
    },
    {
      label: "Meu acesso",
      items: [
        { title: "Meus filhos", url: "/meus-filhos", icon: GraduationCap },
        { title: "Meus comunicados", url: "/meus-comunicados", icon: FileText },
        { title: "Meus agendamentos", url: "/meus-agendamentos", icon: CalendarClock },
      ],
    },
    {
      label: "Produtividade",
      items: [
        { title: "Anotações & Lembretes", url: "/painel-anotacoes", icon: NotebookPen },
        { title: "Cards de Anotação", url: "/painel-cards", icon: Sparkles },
      ],
    },
    {
      label: "Administração",
      items: [
        { title: "Usuários", url: "/usuarios", icon: UserCog },
        { title: "Analytics", url: "/painel-analytics", icon: BarChart3 },
        { title: "Auditoria", url: "/painel-auditoria", icon: History },
        { title: "Acessos administrativos", url: "/painel-acessos", icon: Shield },
        { title: "Painel de erros", url: "/painel-erros", icon: AlertTriangle },
        { title: "Runtime & diagnóstico", url: "/painel-runtime", icon: Activity },
        { title: "Animações do tema", url: "/painel-tema", icon: Sparkles },
        { title: "Solicitações LGPD", url: "/painel-lgpd", icon: ScrollText },
        { title: "FAQ do desenvolvedor", url: "/painel-desenvolvedor", icon: HelpCircle },
        { title: "Manutenção", url: "/painel-manutencao", icon: Wrench },
        { title: "Google Drive", url: "/painel-google-drive", icon: FolderOpen },
        { title: "Enviar p/ o Drive", url: "/painel-enviar-drive", icon: FolderOpen },
      ],
    },
    {
      label: "Comunidade",
      items: [
        { title: "Mural da Comunidade", url: "/mural", icon: Users },
        { title: "Moderação do Mural", url: "/painel-mural-moderacao", icon: Shield },
      ],
    },
  ],
  diretor: [
    {
      label: "Geral",
      items: [
        {
          title: "Meu painel",
          url: "/painel-diretor",
          icon: LayoutDashboard,
          dynamic: "meu-painel",
        },
        { title: "Dashboard escolar", url: "/escola/dashboard", icon: LayoutDashboard },
      ],
    },
    {
      label: "Conteúdo",
      items: [
        { title: "Publicações", url: "/painel-posts", icon: FileText },
        { title: "Fila de aprovação", url: "/painel-aprovacao", icon: CheckCircle2 },
        { title: "Comentários", url: "/painel-comentarios", icon: Megaphone },
        { title: "Famílias UEECM", url: "/painel-familias", icon: Users },
        { title: "Destaques da Home", url: "/painel-destaques", icon: Star },
        { title: "Alunos do Mês", url: "/painel-destaques-alunos", icon: Award },
        { title: "Alertas globais", url: "/painel-alertas", icon: Megaphone },
        { title: "Patrocinadores", url: "/painel-patrocinadores", icon: Heart },
      ],
    },
    {
      label: "Acadêmico",
      items: [
        { title: "Calendário", url: "/calendario", icon: Calendar },
        { title: "Horários", url: "/horarios", icon: Clock },
        { title: "Turmas & Disciplinas", url: "/painel-academico", icon: BookOpen },
        { title: "Alunos", url: "/escola/alunos", icon: GraduationCap },
        { title: "Importar alunos", url: "/escola/alunos-importar", icon: GraduationCap },
        { title: "Profissionais", url: "/painel-profissionais", icon: Users },
        { title: "Comunicados", url: "/escola/comunicados", icon: Megaphone },
        { title: "Agendamentos", url: "/painel-agendamentos", icon: CalendarClock },
        { title: "Arquivos", url: "/painel-arquivos", icon: FolderOpen },
        { title: "Diário de Bordo", url: "/painel-diario-bordo-supervisao", icon: NotebookPen },
      ],
    },
    {
      label: "Pais e Responsáveis",
      items: [
        { title: "Responsáveis (escola)", url: "/escola/responsaveis", icon: UserCog },
        { title: "Autorizações", url: "/painel-autorizacoes", icon: Shield },
        { title: "Mensagens (coord.)", url: "/painel-mensagens", icon: Megaphone },
      ],
    },
    {
      label: "Meu acesso",
      items: [
        { title: "Meus filhos", url: "/meus-filhos", icon: GraduationCap },
        { title: "Meus comunicados", url: "/meus-comunicados", icon: FileText },
        { title: "Meus agendamentos", url: "/meus-agendamentos", icon: CalendarClock },
      ],
    },
    {
      label: "Produtividade",
      items: [
        { title: "Anotações & Lembretes", url: "/painel-anotacoes", icon: NotebookPen },
        { title: "Cards de Anotação", url: "/painel-cards", icon: Sparkles },
      ],
    },
    {
      label: "Administração",
      items: [
        { title: "Usuários", url: "/usuarios", icon: UserCog },
        { title: "Analytics", url: "/painel-analytics", icon: BarChart3 },
        { title: "Animações do tema", url: "/painel-tema", icon: Sparkles },
        { title: "Solicitações LGPD", url: "/painel-lgpd", icon: ScrollText },
        { title: "Manutenção", url: "/painel-manutencao", icon: Wrench },
        { title: "Google Drive", url: "/painel-google-drive", icon: FolderOpen },
        { title: "Enviar p/ o Drive", url: "/painel-enviar-drive", icon: FolderOpen },
      ],
    },
    {
      label: "Comunidade",
      items: [
        { title: "Mural da Comunidade", url: "/mural", icon: Users },
        { title: "Moderação do Mural", url: "/painel-mural-moderacao", icon: Shield },
      ],
    },
  ],
  coordenador: [
    {
      label: "Geral",
      items: [
        {
          title: "Meu painel",
          url: "/painel-coordenador",

          icon: LayoutDashboard,
          dynamic: "meu-painel",
        },
        { title: "Dashboard escolar", url: "/escola/dashboard", icon: LayoutDashboard },
      ],
    },
    {
      label: "Conteúdo",
      items: [
        { title: "Publicações", url: "/painel-posts", icon: FileText },
        { title: "Fila de aprovação", url: "/painel-aprovacao", icon: CheckCircle2 },
        { title: "Comentários", url: "/painel-comentarios", icon: Megaphone },
        { title: "Famílias UEECM", url: "/painel-familias", icon: Users },
        { title: "Destaques da Home", url: "/painel-destaques", icon: Star },
        { title: "Alunos do Mês", url: "/painel-destaques-alunos", icon: Award },
        { title: "Alertas globais", url: "/painel-alertas", icon: Megaphone },
      ],
    },
    {
      label: "Acadêmico",
      items: [
        { title: "Calendário", url: "/calendario", icon: Calendar },
        { title: "Horários", url: "/horarios", icon: Clock },
        { title: "Turmas & Disciplinas", url: "/painel-academico", icon: BookOpen },
        { title: "Alunos", url: "/escola/alunos", icon: GraduationCap },
        { title: "Importar alunos", url: "/escola/alunos-importar", icon: GraduationCap },
        { title: "Profissionais", url: "/painel-profissionais", icon: Users },
        { title: "Comunicados", url: "/escola/comunicados", icon: Megaphone },
        { title: "Agendamentos", url: "/painel-agendamentos", icon: CalendarClock },
        { title: "Arquivos", url: "/painel-arquivos", icon: FolderOpen },
        { title: "Enviar p/ o Drive", url: "/painel-enviar-drive", icon: FolderOpen },
        { title: "Atividades e Trabalhos", url: "/painel-atividades", icon: ClipboardList },
        { title: "Ranking de Atividades", url: "/painel-atividades-ranking", icon: Award },
      ],
    },
    {
      label: "Pais e Responsáveis",
      items: [
        { title: "Responsáveis (escola)", url: "/escola/responsaveis", icon: UserCog },
        { title: "Autorizações", url: "/painel-autorizacoes", icon: Shield },
        { title: "Mensagens (coord.)", url: "/painel-mensagens", icon: Megaphone },
      ],
    },
    {
      label: "Meu acesso",
      items: [
        { title: "Meus filhos", url: "/meus-filhos", icon: GraduationCap },
        { title: "Meus comunicados", url: "/meus-comunicados", icon: FileText },
        { title: "Meus agendamentos", url: "/meus-agendamentos", icon: CalendarClock },
      ],
    },
    {
      label: "Produtividade",
      items: [
        { title: "Anotações & Lembretes", url: "/painel-anotacoes", icon: NotebookPen },
        { title: "Cards de Anotação", url: "/painel-cards", icon: Sparkles },
      ],
    },
    {
      label: "Administração",
      items: [
        { title: "Analytics", url: "/painel-analytics", icon: BarChart3 },
        { title: "Animações do tema", url: "/painel-tema", icon: Sparkles },
        { title: "Solicitações LGPD", url: "/painel-lgpd", icon: ScrollText },
      ],
    },
    {
      label: "Comunidade",
      items: [
        { title: "Mural da Comunidade", url: "/mural", icon: Users },
        { title: "Moderação do Mural", url: "/painel-mural-moderacao", icon: Shield },
      ],
    },
  ],

  secretario: [
    {
      label: "Geral",
      items: [
        {
          title: "Meu painel",
          url: "/painel-secretario",
          icon: LayoutDashboard,
          dynamic: "meu-painel",
        },
        { title: "Dashboard escolar", url: "/escola/dashboard", icon: LayoutDashboard },
      ],
    },
    {
      label: "Conteúdo",
      items: [
        { title: "Publicações", url: "/painel-posts", icon: FileText },
        { title: "Comentários", url: "/painel-comentarios", icon: Megaphone },
        { title: "Destaques da Home", url: "/painel-destaques", icon: Star },
        { title: "Alunos do Mês", url: "/painel-destaques-alunos", icon: Award },
        { title: "Alertas globais", url: "/painel-alertas", icon: Megaphone },
      ],
    },
    {
      label: "Acadêmico",
      items: [
        { title: "Agendamentos", url: "/painel-agendamentos", icon: CalendarClock },
        { title: "Atividades e Trabalhos", url: "/painel-atividades", icon: ClipboardList },
        { title: "Ranking de Atividades", url: "/painel-atividades-ranking", icon: Award },
        { title: "Diário de Bordo", url: "/painel-diario-bordo-supervisao", icon: NotebookPen },
        { title: "Alerta de Evasão", url: "/painel-alertas-evasao", icon: AlertTriangle },
      ],
    },
    {
      label: "Responsáveis",
      items: [
        { title: "Meus filhos", url: "/meus-filhos", icon: GraduationCap },
        { title: "Meus comunicados", url: "/meus-comunicados", icon: FileText },
        { title: "Meus agendamentos", url: "/meus-agendamentos", icon: CalendarClock },
      ],
    },
    {
      label: "Produtividade",
      items: [
        { title: "Anotações & Lembretes", url: "/painel-anotacoes", icon: NotebookPen },
        { title: "Cards de Anotação", url: "/painel-cards", icon: Sparkles },
      ],
    },
    {
      label: "Compliance",
      items: [{ title: "Solicitações LGPD", url: "/painel-lgpd", icon: ScrollText }],
    },
    {
      label: "Comunidade",
      items: [
        { title: "Mural da Comunidade", url: "/mural", icon: Users },
      ],
    },
  ],
  professor: [
    {
      label: "Geral",
      items: [
        {
          title: "Meu painel",
          url: "/painel-professor",
          icon: LayoutDashboard,
          dynamic: "meu-painel",
        },
      ],
    },
    {
      label: "Conteúdo",
      items: [
        { title: "Publicações", url: "/painel-posts", icon: FileText },
        { title: "Alunos do Mês", url: "/painel-destaques-alunos", icon: Award },
      ],
    },
    {
      label: "Acadêmico",
      items: [
        { title: "Calendário", url: "/calendario", icon: Calendar },
        { title: "Horários", url: "/horarios", icon: Clock },
        { title: "Minhas turmas", url: "/minhas-turmas", icon: BookOpen },
        { title: "Atividades e Trabalhos", url: "/painel-atividades", icon: ClipboardList },
        { title: "Diário de Bordo", url: "/painel-diario-bordo", icon: NotebookPen },
        { title: "Méritos e Ocorrências", url: "/painel-meritos", icon: AwardIcon },
        { title: "Contratos de Compromisso", url: "/painel-contratos", icon: ScrollText },
        { title: "Arquivos", url: "/painel-arquivos", icon: FolderOpen },
        { title: "Enviar p/ o Drive", url: "/painel-enviar-drive", icon: FolderOpen },
      ],
    },
    {
      label: "Produtividade",
      items: [
        { title: "Anotações & Lembretes", url: "/painel-anotacoes", icon: NotebookPen },
        { title: "Cards de Anotação", url: "/painel-cards", icon: Sparkles },
      ],
    },
    {
      label: "Responsáveis",
      items: [
        { title: "Meus filhos", url: "/meus-filhos", icon: GraduationCap },
        { title: "Meus comunicados", url: "/meus-comunicados", icon: FileText },
        { title: "Meus agendamentos", url: "/meus-agendamentos", icon: CalendarClock },
      ],
    },
  ],
  leitor: [

    {
      label: "Geral",
      items: [
        {
          title: "Meu painel",
          url: "/painel-responsavel",
          icon: LayoutDashboard,
          dynamic: "meu-painel",
        },
      ],
    },
    {
      label: "Acadêmico",
      items: [
        { title: "Radar do Filho", url: "/painel-radar-filho", icon: Radar },
        { title: "Atividades e Trabalhos", url: "/painel-atividades-filhos", icon: ClipboardList },
        { title: "Diário de Bordo", url: "/painel-diario-filho", icon: NotebookPen },
        { title: "Reconhecimentos", url: "/painel-meritos-filhos", icon: AwardIcon },
        { title: "Contratos de Compromisso", url: "/painel-contratos-filhos", icon: ScrollText },
      ],
    },
    {
      label: "Reconhecimento",
      items: [
        { title: "Selo de Presença", url: "/painel-presenca-parental", icon: Award },
      ],
    },
    {
      label: "Produtividade",
      items: [
        { title: "Anotações & Lembretes", url: "/painel-anotacoes", icon: NotebookPen },
      ],
    },
    {
      label: "Responsáveis",
      items: [
        { title: "Meus filhos", url: "/meus-filhos", icon: GraduationCap },
        { title: "Meus comunicados", url: "/meus-comunicados", icon: FileText },
        { title: "Meus agendamentos", url: "/meus-agendamentos", icon: CalendarClock },
      ],
    },
    {
      label: "Comunidade",
      items: [
        { title: "Mural da Comunidade", url: "/mural", icon: Users },
      ],
    },
  ],
};

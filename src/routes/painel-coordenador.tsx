import { createFileRoute, redirect } from "@tanstack/react-router";
import {
  BookOpen,
  Calendar,
  Clock,
  Users,
  Megaphone,
  CheckCircle2,
  FileText,
  Star,
  FolderOpen,
  LayoutDashboard,
  GraduationCap,
  BarChart3,
  Sparkles,
  Tv,
  Presentation,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { useRolePainelGuard } from "@/lib/use-role-guard";
import { RolePainelShell, ShortcutSection } from "@/components/RolePainelShell";
import { RolesFallback } from "@/components/RolesFallback";

export const Route = createFileRoute("/painel-coordenador")({
  ssr: false,
  head: () => ({ meta: [{ title: "Painel da Coordenação | U.E. - Evaristo Campelo de Matos" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: PainelCoordenador,
});

function PainelCoordenador() {
  useRolePainelGuard(["coordenador", "diretor"]);
  const { roles, loading } = useAuth();

  if (!loading && roles.length === 0) {
    return (
      <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <RolesFallback />
      </main>
    );
  }

  return (
    <RolePainelShell
      title="Painel da Coordenação"
      subtitle="Acompanhamento pedagógico: turmas, professores, aprovação e comunicação."
    >
      <ShortcutSection
        title="Vida acadêmica"
        description="Turmas, disciplinas, alunos e agenda escolar."
        icon={<BookOpen className="size-5 text-primary" />}
        items={[
          {
            label: "Dashboard escolar",
            to: "/escola/dashboard",
            icon: <LayoutDashboard className="size-4" />,
          },
          {
            label: "Turmas & Disciplinas",
            to: "/painel-academico",
            icon: <BookOpen className="size-4" />,
          },
          { label: "Turmas", to: "/escola/turmas", icon: <BookOpen className="size-4" /> },
          { label: "Alunos", to: "/escola/alunos", icon: <GraduationCap className="size-4" /> },
          { label: "Professores", to: "/escola/professores", icon: <Users className="size-4" /> },
          {
            label: "Profissionais",
            to: "/painel-profissionais",
            icon: <Users className="size-4" />,
          },
          { label: "Calendário", to: "/calendario", icon: <Calendar className="size-4" /> },
          { label: "Horários", to: "/horarios", icon: <Clock className="size-4" /> },
        ]}
      />

      <ShortcutSection
        title="Publicações"
        description="Aprovação pedagógica, comentários e destaques."
        icon={<FileText className="size-5 text-primary" />}
        items={[
          { label: "Publicações", to: "/painel-posts", icon: <FileText className="size-4" /> },
          {
            label: "Fila de aprovação",
            to: "/painel-aprovacao",
            icon: <CheckCircle2 className="size-4" />,
          },
          {
            label: "Comentários",
            to: "/painel-comentarios",
            icon: <Megaphone className="size-4" />,
          },
          {
            label: "Destaques da Home",
            to: "/painel-destaques",
            icon: <Star className="size-4" />,
          },
          {
            label: "Alertas globais",
            to: "/painel-alertas",
            icon: <Megaphone className="size-4" />,
          },
          {
            label: "Comunicados",
            to: "/escola/comunicados",
            icon: <Megaphone className="size-4" />,
          },
        ]}
      />

      <ShortcutSection
        title="Consulta"
        description="Analytics e arquivos pedagógicos."
        icon={<BarChart3 className="size-5 text-primary" />}
        items={[
          { label: "Analytics", to: "/painel-analytics", icon: <BarChart3 className="size-4" /> },
          { label: "Arquivos", to: "/painel-arquivos", icon: <FolderOpen className="size-4" /> },
        ]}
      />

      <ShortcutSection
        title="Aparência do site"
        description="Ative animações sazonais (Festa Junina, Natal, Carnaval...) para todos os visitantes."
        icon={<Sparkles className="size-5 text-primary" />}
        items={[
          {
            label: "Animações do tema",
            to: "/painel-tema",
            icon: <Sparkles className="size-4" />,
          },
        ]}
      />

      <ShortcutSection
        title="Produtividade pessoal"
        description="Anotações rápidas e lembretes agendados com notificação."
        icon={<Sparkles className="size-5 text-primary" />}
        items={[
          {
            label: "Anotações & Lembretes",
            to: "/painel-anotacoes",
            icon: <Sparkles className="size-4" />,
          },
        ]}
      />

      <ShortcutSection
        title="Telas & Apresentações"
        description="Painel rotativo da TV e slides para reuniões e comunicados."
        icon={<Presentation className="size-5 text-primary" />}
        items={[
          {
            label: "Modo TV (painel rotativo)",
            to: "/tv",
            icon: <Tv className="size-4" />,
          },
          {
            label: "Apresentações (slides)",
            to: "/painel-apresentacoes",
            icon: <Presentation className="size-4" />,
          },
        ]}
      />
    </RolePainelShell>
  );
}

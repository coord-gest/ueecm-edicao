import { createFileRoute, redirect } from "@tanstack/react-router";
import {
  BookOpen,
  Calendar,
  ClipboardList,
  Clock,
  FileText,
  FolderOpen,
  Megaphone,
  NotebookPen,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { useRolePainelGuard } from "@/lib/use-role-guard";
import { RolePainelShell, ShortcutSection } from "@/components/RolePainelShell";
import { RolesFallback } from "@/components/RolesFallback";

export const Route = createFileRoute("/painel-professor")({
  ssr: false,
  head: () => ({ meta: [{ title: "Painel do Professor | U.E. - Evaristo Campelo de Matos" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: PainelProfessor,
});

function PainelProfessor() {
  useRolePainelGuard(["professor", "diretor", "coordenador"]);
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
      title="Painel do Professor"
      subtitle="Suas turmas, aulas, comunicações e materiais."
    >
      <ShortcutSection
        title="Minhas turmas"
        description="Acompanhe alunos, notas e frequência das suas turmas."
        icon={<BookOpen className="size-5 text-primary" />}
        items={[
          { label: "Minhas turmas", to: "/minhas-turmas", icon: <BookOpen className="size-4" /> },
          {
            label: "Atividades e Trabalhos",
            to: "/painel-atividades",
            icon: <ClipboardList className="size-4" />,
          },
          { label: "Calendário", to: "/calendario", icon: <Calendar className="size-4" /> },
          { label: "Horários", to: "/horarios", icon: <Clock className="size-4" /> },
        ]}
      />

      <ShortcutSection
        title="Comunicação"
        description="Publique conteúdo e envie comunicados às suas turmas."
        icon={<Megaphone className="size-5 text-primary" />}
        items={[
          { label: "Publicações", to: "/painel-posts", icon: <FileText className="size-4" /> },
          {
            label: "Comunicados",
            to: "/escola/comunicados",
            icon: <Megaphone className="size-4" />,
          },
          { label: "Arquivos", to: "/painel-arquivos", icon: <FolderOpen className="size-4" /> },
        ]}
      />

      <ShortcutSection
        title="Produtividade pessoal"
        description="Anotações rápidas e lembretes agendados com notificação."
        icon={<NotebookPen className="size-5 text-primary" />}
        items={[
          {
            label: "Anotações & Lembretes",
            to: "/painel-anotacoes",
            icon: <NotebookPen className="size-4" />,
          },
        ]}
      />
    </RolePainelShell>
  );
}

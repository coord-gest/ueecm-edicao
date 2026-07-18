import { createFileRoute, redirect } from "@tanstack/react-router";
import {
  Users,
  GraduationCap,
  BookOpen,
  Calendar,
  Clock,
  Megaphone,
  FolderOpen,
  NotebookPen,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { useRolePainelGuard } from "@/lib/use-role-guard";
import { RolePainelShell, ShortcutSection } from "@/components/RolePainelShell";
import { RolesFallback } from "@/components/RolesFallback";

export const Route = createFileRoute("/painel-secretario")({
  ssr: false,
  head: () => ({ meta: [{ title: "Painel da Secretaria | U.E. - Evaristo Campelo de Matos" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: PainelSecretario,
});

function PainelSecretario() {
  useRolePainelGuard(["secretario", "diretor"]);
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
      title="Painel da Secretaria"
      subtitle="Cadastros, matrículas, vínculos e rotina administrativa."
    >
      <ShortcutSection
        title="Cadastros escolares"
        description="Alunos, responsáveis, turmas e disciplinas."
        icon={<Users className="size-5 text-primary" />}
        items={[
          { label: "Alunos", to: "/escola/alunos", icon: <GraduationCap className="size-4" /> },
          { label: "Responsáveis", to: "/escola/responsaveis", icon: <Users className="size-4" /> },
          { label: "Turmas", to: "/escola/turmas", icon: <BookOpen className="size-4" /> },
          {
            label: "Professores",
            to: "/escola/professores",
            icon: <GraduationCap className="size-4" />,
          },
        ]}
      />

      <ShortcutSection
        title="Rotina"
        description="Calendário, horários, comunicados e arquivos."
        icon={<Calendar className="size-5 text-primary" />}
        items={[
          { label: "Calendário", to: "/calendario", icon: <Calendar className="size-4" /> },
          { label: "Horários", to: "/horarios", icon: <Clock className="size-4" /> },
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

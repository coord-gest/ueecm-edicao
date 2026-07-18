import { createFileRoute, redirect } from "@tanstack/react-router";
import { GraduationCap, FileText, Calendar, Clock, ShieldCheck, MessageSquare } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { useRolePainelGuard } from "@/lib/use-role-guard";
import { RolePainelShell, ShortcutSection } from "@/components/RolePainelShell";
import { RolesFallback } from "@/components/RolesFallback";

export const Route = createFileRoute("/painel-responsavel")({
  ssr: false,
  head: () => ({ meta: [{ title: "Painel do Responsável | U.E. - Evaristo Campelo de Matos" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: PainelResponsavel,
});

function PainelResponsavel() {
  // Guard: só leitor/responsável (dev e admin também passam por padrão do hook)
  useRolePainelGuard(["leitor"]);
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
      title="Painel do Responsável"
      subtitle="Acompanhe as informações escolares dos seus filhos."
    >
      <ShortcutSection
        title="Meus filhos"
        description="Notas, frequência e informações escolares dos seus filhos."
        icon={<GraduationCap className="size-5 text-primary" />}
        items={[
          { label: "Meus filhos", to: "/meus-filhos", icon: <GraduationCap className="size-4" /> },
          {
            label: "Meus comunicados",
            to: "/meus-comunicados",
            icon: <FileText className="size-4" />,
          },
          {
            label: "Autorizações",
            to: "/meus-filhos",
            icon: <ShieldCheck className="size-4" />,
          },
          {
            label: "Fale com a Coordenação",
            to: "/mensagens-coordenacao",
            icon: <MessageSquare className="size-4" />,
          },
        ]}
      />

      <ShortcutSection
        title="Agenda escolar"
        description="Calendário e horários vinculados aos seus filhos."
        icon={<Calendar className="size-5 text-primary" />}
        items={[
          { label: "Calendário", to: "/calendario", icon: <Calendar className="size-4" /> },
          { label: "Horários", to: "/horarios", icon: <Clock className="size-4" /> },
        ]}
      />
    </RolePainelShell>
  );
}

import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Users, GraduationCap, UserCog, Megaphone, BookOpen, LayoutDashboard } from "lucide-react";
import { useAuth } from "@/lib/use-auth";
import { AccessDenied, EscolaShell, useIsSchoolAdmin } from "@/components/escola/EscolaShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/escola/")({
  ssr: false,
  head: () => ({ meta: [{ title: "Escola | Gestão" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: EscolaHub,
});

const ITEMS = [
  {
    to: "/escola/dashboard",
    icon: LayoutDashboard,
    label: "Dashboard",
    desc: "Indicadores e gráficos da escola",
  },
  {
    to: "/escola/turmas",
    icon: BookOpen,
    label: "Turmas",
    desc: "Cadastrar e importar turmas escolares",
  },
  {
    to: "/escola/alunos",
    icon: GraduationCap,
    label: "Alunos",
    desc: "Matrículas, perfis e importação em massa",
  },
  {
    to: "/escola/responsaveis",
    icon: Users,
    label: "Pais / Responsáveis",
    desc: "Vincular responsáveis aos alunos",
  },
  {
    to: "/escola/professores",
    icon: UserCog,
    label: "Professores",
    desc: "Atribuição de turmas a professores",
  },
  {
    to: "/escola/comunicados",
    icon: Megaphone,
    label: "Comunicados",
    desc: "(Fase 3) Mensagens para turma ou pais",
  },
] as const;

function EscolaHub() {
  const { hasRole, loading } = useAuth();
  const isAdmin = useIsSchoolAdmin(hasRole);
  if (loading) return null;
  if (!isAdmin) return <AccessDenied />;
  return (
    <EscolaShell title="Módulo Escolar" description="Gestão de turmas, alunos e responsáveis">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ITEMS.map((i) => (
          <Link
            key={i.to}
            to={i.to}
            className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <i.icon className="size-6 text-primary" />
            <p className="mt-3 font-display text-lg font-semibold text-foreground">{i.label}</p>
            <p className="text-sm text-muted-foreground">{i.desc}</p>
          </Link>
        ))}
      </div>
    </EscolaShell>
  );
}

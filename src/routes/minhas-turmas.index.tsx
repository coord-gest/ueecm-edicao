import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Users, ArrowRight } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { EscolaShell } from "@/components/escola/EscolaShell";

import { PainelLayout } from "@/components/PainelLayout";

export const Route = createFileRoute("/minhas-turmas")({
  ssr: false,
  head: () => ({ meta: [{ title: "Minhas Turmas | Escola" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: MinhasTurmasPage,
});

function MinhasTurmasPage() {
  const { user, loading } = useAuth();

  const { data: turmas, isLoading } = useQuery({
    queryKey: ["minhas-turmas", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: ts } = await supabase
        .from("turmas_escolares")
        .select("id, nome, ano_serie, turno, ano_letivo")
        .eq("professor_responsavel_id", user!.id)
        .order("ano_letivo", { ascending: false });
      const items = ts ?? [];
      const counts = await Promise.all(
        items.map(async (t) => {
          const { count } = await supabase
            .from("alunos")
            .select("id", { count: "exact", head: true })
            .eq("turma_id", t.id);
          return count ?? 0;
        }),
      );
      return items.map((t, i) => ({ ...t, total: counts[i] }));
    },
  });

  if (loading) return null;

  return (
    <PainelLayout>
      <EscolaShell title="Minhas turmas" description="Lance notas, frequência e envie comunicados">
        {isLoading ? (
          <Skeleton className="h-40 rounded-2xl" />
        ) : !turmas || turmas.length === 0 ? (
          <div className="rounded-2xl border border-border/70 bg-card p-10 text-center">
            <BookOpen className="mx-auto size-10 text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">
              Você ainda não é responsável por nenhuma turma.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {turmas.map((t) => (
              <Link
                key={t.id}
                to="/minhas-turmas/$turmaId"
                params={{ turmaId: t.id }}
                className="group rounded-2xl border border-border/70 bg-card p-5 shadow-sm transition hover:shadow-md"
              >
                <BookOpen className="size-6 text-primary" />
                <p className="mt-3 font-display text-lg font-semibold">{t.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {t.ano_serie ?? ""} • {t.turno ?? ""} • {t.ano_letivo}
                </p>
                <p className="mt-3 flex items-center gap-1 text-sm text-muted-foreground">
                  <Users className="size-4" /> {t.total} alunos
                </p>
                <p className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary group-hover:gap-2 transition-all">
                  Abrir <ArrowRight className="size-4" />
                </p>
              </Link>
            ))}
          </div>
        )}
      </EscolaShell>
    </PainelLayout>
  );
}

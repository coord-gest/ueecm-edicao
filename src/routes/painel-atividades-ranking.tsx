import { useMemo, useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Award,
  ClipboardList,
  GraduationCap,
  Loader2,
  TrendingUp,
  Users,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { rankingAtividades } from "@/lib/atividades.functions";

export const Route = createFileRoute("/painel-atividades-ranking")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Ranking de Atividades | Gestão Escolar" }],
  }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: PainelAtividadesRankingPage,
});

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

function PainelAtividadesRankingPage() {
  const fetchRanking = useServerFn(rankingAtividades);
  const { data, isLoading, error } = useQuery({
    queryKey: ["atividades-ranking"],
    queryFn: () => fetchRanking(),
  });

  const [busca, setBusca] = useState("");
  const [turmaFiltro, setTurmaFiltro] = useState<string>("todas");

  const alunosFiltrados = useMemo(() => {
    if (!data) return [];
    const q = busca.trim().toLowerCase();
    return data.alunos.filter((a) => {
      if (turmaFiltro !== "todas" && a.turma_id !== turmaFiltro) return false;
      if (!q) return true;
      return (
        a.aluno_nome.toLowerCase().includes(q) ||
        (a.matricula ?? "").toLowerCase().includes(q)
      );
    });
  }, [data, busca, turmaFiltro]);

  const topAlunos = useMemo(() => alunosFiltrados.slice(0, 20), [alunosFiltrados]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2">
            <Link to="/painel-atividades">
              <ArrowLeft className="mr-2 size-4" /> Atividades
            </Link>
          </Button>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground sm:text-3xl">
            <Award className="size-6 text-primary" />
            Ranking de Atividades e Trabalhos
          </h1>
          <p className="text-sm text-muted-foreground">
            Visão da gestão escolar sobre entregas por aluno e por turma.
          </p>
        </div>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 size-5 animate-spin" /> Calculando ranking...
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-destructive">
            {(error as Error).message}
          </CardContent>
        </Card>
      ) : !data ? null : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={<ClipboardList className="size-4" />} label="Atividades ativas" value={data.totais.atividades} />
            <StatCard icon={<TrendingUp className="size-4" />} label="Entregas registradas" value={data.totais.entregas} />
            <StatCard icon={<Users className="size-4" />} label="Alunos ativos" value={data.totais.alunos} />
            <StatCard icon={<GraduationCap className="size-4" />} label="Taxa geral de entrega" value={pct(data.totais.taxa)} />
          </section>

          <Tabs defaultValue="alunos" className="w-full">
            <TabsList>
              <TabsTrigger value="alunos">Alunos</TabsTrigger>
              <TabsTrigger value="turmas">Turmas</TabsTrigger>
            </TabsList>

            <TabsContent value="alunos" className="mt-4 space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  placeholder="Buscar por nome ou matrícula"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="sm:max-w-xs"
                />
                <Select value={turmaFiltro} onValueChange={setTurmaFiltro}>
                  <SelectTrigger className="sm:max-w-xs">
                    <SelectValue placeholder="Filtrar por turma" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as turmas</SelectItem>
                    {data.turmas.map((t) => (
                      <SelectItem key={t.turma_id} value={t.turma_id}>
                        {t.turma_nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Top alunos por entregas</CardTitle>
                  <CardDescription>
                    Ordenado por total de entregas e depois por taxa. Mostrando {topAlunos.length} de {alunosFiltrados.length}.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {topAlunos.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum aluno encontrado.</p>
                  ) : (
                    topAlunos.map((a, idx) => (
                      <div
                        key={a.aluno_id}
                        className="flex flex-col gap-2 rounded-[5px] border p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                            {idx + 1}
                          </span>
                          <div>
                            <p className="text-sm font-medium text-foreground">{a.aluno_nome}</p>
                            <p className="text-xs text-muted-foreground">
                              {a.turma_nome ?? "Sem turma"}{a.matricula ? ` • Mat. ${a.matricula}` : ""}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">
                            {a.total_entregues}/{a.total_atribuidas} entregas
                          </Badge>
                          <Badge
                            className={
                              a.taxa >= 0.8
                                ? "bg-emerald-600 text-white hover:bg-emerald-600"
                                : a.taxa >= 0.5
                                  ? "bg-amber-500 text-white hover:bg-amber-500"
                                  : "bg-destructive text-white hover:bg-destructive"
                            }
                          >
                            {pct(a.taxa)}
                          </Badge>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="turmas" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Ranking por turma</CardTitle>
                  <CardDescription>Ordenado pela taxa de entrega da turma.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {data.turmas.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sem turmas com dados.</p>
                  ) : (
                    data.turmas.map((t, idx) => (
                      <div
                        key={t.turma_id}
                        className="flex flex-col gap-2 rounded-[5px] border p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                            {idx + 1}
                          </span>
                          <div>
                            <p className="text-sm font-medium text-foreground">{t.turma_nome}</p>
                            <p className="text-xs text-muted-foreground">
                              {t.total_alunos} alunos • {t.total_entregues}/{t.total_atribuidas} entregas
                            </p>
                          </div>
                        </div>
                        <Badge
                          className={
                            t.taxa >= 0.8
                              ? "bg-emerald-600 text-white hover:bg-emerald-600"
                              : t.taxa >= 0.5
                                ? "bg-amber-500 text-white hover:bg-amber-500"
                                : "bg-destructive text-white hover:bg-destructive"
                          }
                        >
                          {pct(t.taxa)}
                        </Badge>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </main>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 py-4">
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          {icon}
          {label}
        </span>
        <span className="text-2xl font-semibold text-foreground">{value}</span>
      </CardContent>
    </Card>
  );
}
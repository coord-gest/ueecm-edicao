import { useMemo, useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Award,
  ChevronRight,
  ClipboardList,
  Download,
  FileText,
  GraduationCap,
  Loader2,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";

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
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { rankingAtividades } from "@/lib/atividades.functions";
import { exportRowsAsCsv } from "@/lib/csv-export";

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

// ==================== FILTROS DE PERÍODO ==================== //
type Preset =
  | "custom"
  | "todos"
  | "ano-atual"
  | "1o-bim"
  | "2o-bim"
  | "3o-bim"
  | "4o-bim"
  | "ultimos-30";

function presetRange(preset: Preset, ano: number): { data_inicio: string; data_fim: string } {
  const iso = (y: number, m: number, d: number) =>
    `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  switch (preset) {
    case "ano-atual":
      return { data_inicio: iso(ano, 1, 1), data_fim: iso(ano, 12, 31) };
    case "1o-bim":
      return { data_inicio: iso(ano, 2, 1), data_fim: iso(ano, 4, 30) };
    case "2o-bim":
      return { data_inicio: iso(ano, 5, 1), data_fim: iso(ano, 7, 15) };
    case "3o-bim":
      return { data_inicio: iso(ano, 8, 1), data_fim: iso(ano, 9, 30) };
    case "4o-bim":
      return { data_inicio: iso(ano, 10, 1), data_fim: iso(ano, 12, 20) };
    case "ultimos-30": {
      const hoje = new Date();
      const antes = new Date();
      antes.setDate(antes.getDate() - 30);
      return { data_inicio: antes.toISOString().slice(0, 10), data_fim: hoje.toISOString().slice(0, 10) };
    }
    default:
      return { data_inicio: "", data_fim: "" };
  }
}

function printablePdf(title: string, html: string) {
  if (typeof window === "undefined") return;
  const w = window.open("", "_blank", "width=1024,height=768");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
    <style>
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:24px;color:#111}
      h1{font-size:20px;margin:0 0 4px}
      h2{font-size:14px;margin:16px 0 8px;color:#333}
      .muted{color:#666;font-size:12px}
      table{width:100%;border-collapse:collapse;margin-top:8px;font-size:12px}
      th,td{border-bottom:1px solid #eee;padding:6px 8px;text-align:left}
      th{background:#f7f7f7}
      .kpi{display:inline-block;border:1px solid #eee;border-radius:6px;padding:8px 12px;margin:4px 6px 0 0}
      .kpi b{display:block;font-size:16px}
      @media print{ button{display:none} }
    </style></head><body>${html}
    <script>setTimeout(()=>window.print(),300)</script></body></html>`);
  w.document.close();
}

function PainelAtividadesRankingPage() {
  const fetchRanking = useServerFn(rankingAtividades);

  const anoAtual = new Date().getFullYear();
  const [preset, setPreset] = useState<Preset>("todos");
  const [ano, setAno] = useState<number>(anoAtual);
  const [dataInicio, setDataInicio] = useState<string>("");
  const [dataFim, setDataFim] = useState<string>("");

  const filtros = useMemo(() => {
    if (preset === "custom") return { data_inicio: dataInicio, data_fim: dataFim };
    if (preset === "todos") return { data_inicio: "", data_fim: "" };
    return presetRange(preset, ano);
  }, [preset, ano, dataInicio, dataFim]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["atividades-ranking", filtros.data_inicio, filtros.data_fim],
    queryFn: () =>
      fetchRanking({
        data: {
          data_inicio: filtros.data_inicio || undefined,
          data_fim: filtros.data_fim || undefined,
        },
      }),
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

  const topAlunos = useMemo(() => alunosFiltrados.slice(0, 50), [alunosFiltrados]);

  const periodoLabel = useMemo(() => {
    if (!filtros.data_inicio && !filtros.data_fim) return "Todo o histórico";
    return `${filtros.data_inicio || "…"} até ${filtros.data_fim || "…"}`;
  }, [filtros]);

  const exportarCsvAlunos = () => {
    exportRowsAsCsv(
      `ranking-alunos-${filtros.data_inicio || "tudo"}-${filtros.data_fim || "tudo"}`,
      alunosFiltrados.map((a) => ({
        aluno: a.aluno_nome,
        matricula: a.matricula ?? "",
        turma: a.turma_nome ?? "",
        atribuidas: a.total_atribuidas,
        entregues: a.total_entregues,
        taxa: `${Math.round(a.taxa * 100)}%`,
      })),
      [
        { key: "aluno", label: "Aluno" },
        { key: "matricula", label: "Matrícula" },
        { key: "turma", label: "Turma" },
        { key: "atribuidas", label: "Atribuídas" },
        { key: "entregues", label: "Entregues" },
        { key: "taxa", label: "Taxa" },
      ],
    );
  };

  const exportarCsvTurmas = () => {
    if (!data) return;
    exportRowsAsCsv(
      `ranking-turmas-${filtros.data_inicio || "tudo"}-${filtros.data_fim || "tudo"}`,
      data.turmas.map((t) => ({
        turma: t.turma_nome,
        alunos: t.total_alunos,
        atribuidas: t.total_atribuidas,
        entregues: t.total_entregues,
        taxa: `${Math.round(t.taxa * 100)}%`,
      })),
      [
        { key: "turma", label: "Turma" },
        { key: "alunos", label: "Alunos" },
        { key: "atribuidas", label: "Atribuídas" },
        { key: "entregues", label: "Entregues" },
        { key: "taxa", label: "Taxa" },
      ],
    );
  };

  const exportarPdf = () => {
    if (!data) return;
    const tAlunos = topAlunos
      .map(
        (a, i) =>
          `<tr><td>${i + 1}</td><td>${a.aluno_nome}</td><td>${a.turma_nome ?? ""}</td><td>${a.total_entregues}/${a.total_atribuidas}</td><td>${pct(a.taxa)}</td></tr>`,
      )
      .join("");
    const tTurmas = data.turmas
      .map(
        (t, i) =>
          `<tr><td>${i + 1}</td><td>${t.turma_nome}</td><td>${t.total_alunos}</td><td>${t.total_entregues}/${t.total_atribuidas}</td><td>${pct(t.taxa)}</td></tr>`,
      )
      .join("");
    printablePdf(
      "Ranking de Atividades",
      `<h1>Ranking de Atividades e Trabalhos</h1>
       <div class="muted">Período: ${periodoLabel} · Gerado em ${new Date().toLocaleString("pt-BR")}</div>
       <h2>Indicadores</h2>
       <div>
         <div class="kpi"><span>Atividades</span><b>${data.totais.atividades}</b></div>
         <div class="kpi"><span>Entregas</span><b>${data.totais.entregas}</b></div>
         <div class="kpi"><span>Alunos ativos</span><b>${data.totais.alunos}</b></div>
         <div class="kpi"><span>Taxa geral</span><b>${pct(data.totais.taxa)}</b></div>
       </div>
       <h2>Top alunos</h2>
       <table><thead><tr><th>#</th><th>Aluno</th><th>Turma</th><th>Entregas</th><th>Taxa</th></tr></thead><tbody>${tAlunos}</tbody></table>
       <h2>Ranking por turma</h2>
       <table><thead><tr><th>#</th><th>Turma</th><th>Alunos</th><th>Entregas</th><th>Taxa</th></tr></thead><tbody>${tTurmas}</tbody></table>`,
    );
  };

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
            Visão da gestão escolar sobre entregas por aluno e por turma. Período: {periodoLabel}.
          </p>
        </div>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros por período</CardTitle>
          <CardDescription>Ano letivo, bimestre ou intervalo personalizado.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Período</Label>
            <Select value={preset} onValueChange={(v) => setPreset(v as Preset)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todo o histórico</SelectItem>
                <SelectItem value="ano-atual">Ano letivo inteiro</SelectItem>
                <SelectItem value="1o-bim">1º Bimestre</SelectItem>
                <SelectItem value="2o-bim">2º Bimestre</SelectItem>
                <SelectItem value="3o-bim">3º Bimestre</SelectItem>
                <SelectItem value="4o-bim">4º Bimestre</SelectItem>
                <SelectItem value="ultimos-30">Últimos 30 dias</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Ano letivo</Label>
            <Select
              value={String(ano)}
              onValueChange={(v) => setAno(Number(v))}
              disabled={preset === "todos" || preset === "custom" || preset === "ultimos-30"}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[anoAtual - 1, anoAtual, anoAtual + 1].map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">De</Label>
            <Input
              type="date"
              value={preset === "custom" ? dataInicio : filtros.data_inicio}
              disabled={preset !== "custom"}
              onChange={(e) => setDataInicio(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Até</Label>
            <Input
              type="date"
              value={preset === "custom" ? dataFim : filtros.data_fim}
              disabled={preset !== "custom"}
              onChange={(e) => setDataFim(e.target.value)}
            />
          </div>
          <div className="flex items-end gap-2">
            <Button variant="outline" size="sm" onClick={exportarCsvAlunos} disabled={!data}>
              <Download className="mr-1 size-4" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={exportarPdf} disabled={!data}>
              <FileText className="mr-1 size-4" /> PDF
            </Button>
          </div>
        </CardContent>
      </Card>

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

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Tendência semanal</CardTitle>
              <CardDescription>Entregas e taxa de conclusão por semana no período.</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              {data.serie.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Sem dados no período selecionado.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.serie.map((s) => ({ ...s, taxaPct: Math.round(s.taxa * 100) }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="inicio" fontSize={11} />
                    <YAxis yAxisId="left" fontSize={11} />
                    <YAxis yAxisId="right" orientation="right" fontSize={11} domain={[0, 100]} />
                    <RTooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line yAxisId="left" type="monotone" dataKey="entregues" name="Entregas" stroke="hsl(var(--primary))" strokeWidth={2} />
                    <Line yAxisId="left" type="monotone" dataKey="atribuidas" name="Atribuídas" stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="4 4" />
                    <Line yAxisId="right" type="monotone" dataKey="taxaPct" name="Taxa %" stroke="#10b981" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

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
                    Clique para abrir o detalhamento. Mostrando {topAlunos.length} de {alunosFiltrados.length}.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {topAlunos.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum aluno encontrado.</p>
                  ) : (
                    topAlunos.map((a, idx) => (
                      <Link
                        key={a.aluno_id}
                        to="/painel-atividades-ranking/$alunoId"
                        params={{ alunoId: a.aluno_id }}
                        search={{
                          data_inicio: filtros.data_inicio || undefined,
                          data_fim: filtros.data_fim || undefined,
                        }}
                        className="flex flex-col gap-2 rounded-[5px] border p-3 transition hover:border-primary hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
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
                          <ChevronRight className="size-4 text-muted-foreground" />
                        </div>
                      </Link>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="turmas" className="mt-4">
              <div className="mb-2 flex justify-end">
                <Button variant="outline" size="sm" onClick={exportarCsvTurmas}>
                  <Download className="mr-1 size-4" /> Exportar CSV
                </Button>
              </div>
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
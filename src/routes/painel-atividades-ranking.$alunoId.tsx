import { useMemo } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Loader2,
  TrendingUp,
  XCircle,
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
import { z } from "zod";
import { fallback, zodValidator } from "@tanstack/zod-adapter";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { detalhesAlunoRanking } from "@/lib/atividades.functions";
import { exportRowsAsCsv } from "@/lib/csv-export";

const searchSchema = z.object({
  data_inicio: fallback(z.string().optional(), undefined),
  data_fim: fallback(z.string().optional(), undefined),
});

export const Route = createFileRoute("/painel-atividades-ranking/$alunoId")({
  ssr: false,
  validateSearch: zodValidator(searchSchema),
  head: () => ({ meta: [{ title: "Detalhe do aluno | Ranking de Atividades" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: DetalheAlunoRankingPage,
});

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

function fmt(d: string | null): string {
  if (!d) return "—";
  const iso = d.length >= 10 ? d.slice(0, 10) : d;
  const [y, m, day] = iso.split("-");
  return `${day}/${m}/${y}`;
}

function printablePdf(title: string, html: string) {
  if (typeof window === "undefined") return;
  const w = window.open("", "_blank", "width=1024,height=768");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
    <style>
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:24px;color:#111}
      h1{font-size:20px;margin:0 0 4px} h2{font-size:14px;margin:16px 0 8px;color:#333}
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

function DetalheAlunoRankingPage() {
  const { alunoId } = Route.useParams();
  const search = Route.useSearch();
  const fetchDetalhe = useServerFn(detalhesAlunoRanking);

  const { data, isLoading, error } = useQuery({
    queryKey: ["ranking-detalhe", alunoId, search.data_inicio, search.data_fim],
    queryFn: () =>
      fetchDetalhe({
        data: {
          aluno_id: alunoId,
          data_inicio: search.data_inicio,
          data_fim: search.data_fim,
        },
      }),
    refetchInterval: 30_000,
  });

  const periodoLabel = useMemo(() => {
    if (!search.data_inicio && !search.data_fim) return "Todo o histórico";
    return `${search.data_inicio ?? "…"} até ${search.data_fim ?? "…"}`;
  }, [search]);

  const backSearch = {
    data_inicio: search.data_inicio,
    data_fim: search.data_fim,
  };

  const exportarCsv = () => {
    if (!data) return;
    exportRowsAsCsv(
      `aluno-${data.aluno.nome.replace(/\s+/g, "_")}-${search.data_inicio ?? "tudo"}-${search.data_fim ?? "tudo"}`,
      data.atividades.map((a) => ({
        titulo: a.titulo,
        disciplina: a.disciplina ?? "",
        data_entrega: a.data_entrega,
        status: a.entregue ? (a.atrasado ? "Entregue com atraso" : "Entregue") : a.atrasado ? "Pendente (atrasada)" : "Pendente",
        entregue_em: a.entregue_em ? a.entregue_em.slice(0, 10) : "",
        observacao: a.observacao ?? "",
      })),
      [
        { key: "titulo", label: "Atividade" },
        { key: "disciplina", label: "Disciplina" },
        { key: "data_entrega", label: "Data de entrega" },
        { key: "status", label: "Status" },
        { key: "entregue_em", label: "Entregue em" },
        { key: "observacao", label: "Observação" },
      ],
    );
  };

  const exportarPdf = () => {
    if (!data) return;
    const linhas = data.atividades
      .map(
        (a) =>
          `<tr><td>${a.titulo}</td><td>${a.disciplina ?? ""}</td><td>${fmt(a.data_entrega)}</td><td>${a.entregue ? (a.atrasado ? "Entregue com atraso" : "Entregue") : a.atrasado ? "Pendente (atrasada)" : "Pendente"}</td><td>${fmt(a.entregue_em)}</td></tr>`,
      )
      .join("");
    printablePdf(
      `Aluno ${data.aluno.nome}`,
      `<h1>${data.aluno.nome}</h1>
       <div class="muted">${data.aluno.turma_nome ?? "Sem turma"}${data.aluno.matricula ? ` · Mat. ${data.aluno.matricula}` : ""} · Período: ${periodoLabel}</div>
       <h2>Indicadores</h2>
       <div>
         <div class="kpi"><span>Atribuídas</span><b>${data.totais.atribuidas}</b></div>
         <div class="kpi"><span>Entregues</span><b>${data.totais.entregues}</b></div>
         <div class="kpi"><span>Pendentes</span><b>${data.totais.pendentes}</b></div>
         <div class="kpi"><span>Atrasadas</span><b>${data.totais.atrasadas}</b></div>
         <div class="kpi"><span>Taxa</span><b>${pct(data.totais.taxa)}</b></div>
         <div class="kpi"><span>Taxa da turma</span><b>${pct(data.turma_taxa)}</b></div>
       </div>
       <h2>Atividades</h2>
       <table><thead><tr><th>Atividade</th><th>Disciplina</th><th>Entrega</th><th>Status</th><th>Entregue em</th></tr></thead><tbody>${linhas}</tbody></table>`,
    );
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3">
        <Button asChild variant="ghost" size="sm" className="w-fit">
          <Link to="/painel-atividades-ranking" search={backSearch}>
            <ArrowLeft className="mr-2 size-4" /> Voltar ao ranking
          </Link>
        </Button>
        {data && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold sm:text-3xl">{data.aluno.nome}</h1>
              <p className="text-sm text-muted-foreground">
                {data.aluno.turma_nome ?? "Sem turma"}
                {data.aluno.matricula ? ` • Mat. ${data.aluno.matricula}` : ""} • Período: {periodoLabel}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportarCsv}>
                <Download className="mr-1 size-4" /> CSV
              </Button>
              <Button variant="outline" size="sm" onClick={exportarPdf}>
                <FileText className="mr-1 size-4" /> PDF
              </Button>
            </div>
          </div>
        )}
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 size-5 animate-spin" /> Carregando detalhes...
        </div>
      ) : error ? (
        <Card><CardContent className="py-8 text-center text-sm text-destructive">{(error as Error).message}</CardContent></Card>
      ) : !data ? null : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Kpi label="Atribuídas" value={data.totais.atribuidas} />
            <Kpi label="Entregues" value={data.totais.entregues} tone="ok" />
            <Kpi label="Pendentes" value={data.totais.pendentes} tone="warn" />
            <Kpi label="Atrasadas" value={data.totais.atrasadas} tone="danger" />
            <Kpi label="Taxa do aluno" value={pct(data.totais.taxa)} sub={`Turma: ${pct(data.turma_taxa)}`} />
          </section>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="size-4 text-primary" /> Evolução semanal
              </CardTitle>
              <CardDescription>Entregas e taxa de conclusão do aluno por semana.</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              {data.serie.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Sem dados no período.</p>
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

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Atividades no período</CardTitle>
              <CardDescription>Atualiza em tempo real a cada 30 segundos.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.atividades.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma atividade encontrada.</p>
              ) : (
                data.atividades.map((a) => {
                  const status = a.entregue
                    ? a.atrasado
                      ? { label: "Entregue com atraso", tone: "warn" as const, icon: <Clock className="size-4" /> }
                      : { label: "Entregue", tone: "ok" as const, icon: <CheckCircle2 className="size-4" /> }
                    : a.atrasado
                      ? { label: "Pendente (atrasada)", tone: "danger" as const, icon: <XCircle className="size-4" /> }
                      : { label: "Pendente", tone: "muted" as const, icon: <Clock className="size-4" /> };
                  const toneClass =
                    status.tone === "ok"
                      ? "bg-emerald-600 text-white hover:bg-emerald-600"
                      : status.tone === "warn"
                        ? "bg-amber-500 text-white hover:bg-amber-500"
                        : status.tone === "danger"
                          ? "bg-destructive text-white hover:bg-destructive"
                          : "";
                  return (
                    <div key={a.atividade_id} className="flex flex-col gap-2 rounded-[5px] border p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">{a.titulo}</p>
                        <p className="text-xs text-muted-foreground">
                          {a.disciplina ?? "Sem disciplina"} • Entrega: {fmt(a.data_entrega)}
                          {a.entregue_em ? ` • Entregue em ${fmt(a.entregue_em)}` : ""}
                        </p>
                        {a.observacao ? (
                          <p className="mt-1 text-xs text-muted-foreground">Obs.: {a.observacao}</p>
                        ) : null}
                      </div>
                      <Badge variant={status.tone === "muted" ? "secondary" : "default"} className={toneClass}>
                        <span className="mr-1 inline-flex">{status.icon}</span>
                        {status.label}
                      </Badge>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </>
      )}
    </main>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: number | string;
  sub?: string;
  tone?: "ok" | "warn" | "danger";
}) {
  const color =
    tone === "ok"
      ? "text-emerald-600"
      : tone === "warn"
        ? "text-amber-600"
        : tone === "danger"
          ? "text-destructive"
          : "text-foreground";
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 py-4">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={`text-2xl font-semibold ${color}`}>{value}</span>
        {sub ? <span className="text-xs text-muted-foreground">{sub}</span> : null}
      </CardContent>
    </Card>
  );
}
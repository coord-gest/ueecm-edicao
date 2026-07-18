import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2,
  Download,
  Search,
  TrendingUp,
  TrendingDown,
  Users as UsersIcon,
  UserCheck,
  Award,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

type Turma = { id: string; nome: string };
type Aluno = { id: string; nome_completo: string; matricula: string; turma_id: string | null };
type Nota = { aluno_id: string; disciplina: string; bimestre: number; valor: number | null };
type Freq = { aluno_id: string; presente: boolean; data: string };

const APROV_MIN = 6;
const RECUP_MIN = 4;

function classify(media: number | null) {
  if (media == null) return { label: "Sem notas", tone: "muted" as const };
  if (media >= APROV_MIN) return { label: "Aprovado", tone: "success" as const };
  if (media >= RECUP_MIN) return { label: "Recuperação", tone: "warning" as const };
  return { label: "Reprovado", tone: "danger" as const };
}

const toneClass: Record<string, string> = {
  success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  danger: "bg-red-500/15 text-red-700 dark:text-red-300",
  muted: "bg-muted text-muted-foreground",
};

const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 12,
  color: "hsl(var(--foreground))",
  fontSize: 12,
} as const;

export function RelatorioAcademico() {
  const [turmaId, setTurmaId] = useState<string>("all");
  const [bimestre, setBimestre] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"nome" | "media_desc" | "media_asc" | "presenca">("nome");
  const [detalheAluno, setDetalheAluno] = useState<Aluno | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["relatorio-academico"],
    queryFn: async () => {
      const iso180 = new Date(Date.now() - 180 * 864e5).toISOString().slice(0, 10);
      const [turmas, alunos, notas, freq] = await Promise.all([
        supabase.from("turmas_escolares").select("id, nome").order("nome"),
        supabase.from("alunos").select("id, nome_completo, matricula, turma_id").eq("ativo", true),
        supabase
          .from("notas")
          .select("aluno_id, disciplina, bimestre, valor")
          .not("valor", "is", null),
        supabase.from("frequencia").select("aluno_id, presente, data").gte("data", iso180),
      ]);
      if (turmas.error) throw turmas.error;
      if (alunos.error) throw alunos.error;
      if (notas.error) throw notas.error;
      if (freq.error) throw freq.error;
      return {
        turmas: (turmas.data ?? []) as Turma[],
        alunos: (alunos.data ?? []) as Aluno[],
        notas: (notas.data ?? []) as Nota[],
        freq: (freq.data ?? []) as Freq[],
      };
    },
  });

  const relatorio = useMemo(() => {
    if (!data) return null;
    const bimNum = bimestre === "all" ? null : Number(bimestre);
    const alunosFiltrados = data.alunos.filter((a) => turmaId === "all" || a.turma_id === turmaId);
    const alunoIds = new Set(alunosFiltrados.map((a) => a.id));
    const notasFiltradas = data.notas.filter(
      (n) => alunoIds.has(n.aluno_id) && (bimNum == null || n.bimestre === bimNum),
    );
    const freqFiltrada = data.freq.filter((f) => alunoIds.has(f.aluno_id));

    // Por aluno
    const porAluno: Record<
      string,
      {
        soma: number;
        n: number;
        pres: number;
        falt: number;
        disciplinas: Record<string, { soma: number; n: number }>;
      }
    > = {};
    for (const a of alunosFiltrados) {
      porAluno[a.id] = { soma: 0, n: 0, pres: 0, falt: 0, disciplinas: {} };
    }
    for (const nota of notasFiltradas) {
      const v = Number(nota.valor);
      if (!Number.isFinite(v)) continue;
      const rec = porAluno[nota.aluno_id];
      if (!rec) continue;
      rec.soma += v;
      rec.n += 1;
      const d = (nota.disciplina || "—").trim();
      rec.disciplinas[d] ||= { soma: 0, n: 0 };
      rec.disciplinas[d].soma += v;
      rec.disciplinas[d].n += 1;
    }
    for (const f of freqFiltrada) {
      const rec = porAluno[f.aluno_id];
      if (!rec) continue;
      if (f.presente) rec.pres += 1;
      else rec.falt += 1;
    }

    const linhas = alunosFiltrados.map((a) => {
      const r = porAluno[a.id];
      const media = r.n > 0 ? +(r.soma / r.n).toFixed(2) : null;
      const totalFreq = r.pres + r.falt;
      const presenca = totalFreq ? +((r.pres / totalFreq) * 100).toFixed(1) : null;
      return {
        aluno: a,
        media,
        presenca,
        faltas: r.falt,
        notasLancadas: r.n,
        disciplinas: r.disciplinas,
      };
    });

    // KPIs
    const comNotas = linhas.filter((l) => l.media != null);
    const mediaGeral = comNotas.length
      ? +(comNotas.reduce((s, l) => s + (l.media ?? 0), 0) / comNotas.length).toFixed(2)
      : 0;
    const aprovados = comNotas.filter((l) => (l.media ?? 0) >= APROV_MIN).length;
    const recup = comNotas.filter(
      (l) => (l.media ?? 0) >= RECUP_MIN && (l.media ?? 0) < APROV_MIN,
    ).length;
    const reprov = comNotas.filter((l) => (l.media ?? 0) < RECUP_MIN).length;
    const totalPres = linhas.reduce((s, l) => s + (l.presenca == null ? 0 : 1), 0);
    const somaPres = linhas.reduce((s, l) => s + (l.presenca ?? 0), 0);
    const presencaMedia = totalPres ? +(somaPres / totalPres).toFixed(1) : 0;

    // Média por disciplina (agregado da turma/seleção)
    const discAgg: Record<string, { soma: number; n: number }> = {};
    for (const n of notasFiltradas) {
      const v = Number(n.valor);
      if (!Number.isFinite(v)) continue;
      const d = (n.disciplina || "—").trim();
      discAgg[d] ||= { soma: 0, n: 0 };
      discAgg[d].soma += v;
      discAgg[d].n += 1;
    }
    const chartDisciplinas = Object.entries(discAgg)
      .map(([nome, v]) => ({ nome, media: +(v.soma / v.n).toFixed(2) }))
      .sort((a, b) => b.media - a.media);

    return {
      linhas,
      kpis: {
        totalAlunos: alunosFiltrados.length,
        mediaGeral,
        aprovados,
        recup,
        reprov,
        presencaMedia,
        taxaAprov: comNotas.length ? Math.round((aprovados / comNotas.length) * 100) : 0,
      },
      chartDisciplinas,
    };
  }, [data, turmaId, bimestre]);

  const linhasVisiveis = useMemo(() => {
    if (!relatorio) return [];
    const term = search.trim().toLowerCase();
    const filtered = term
      ? relatorio.linhas.filter(
          (l) =>
            l.aluno.nome_completo.toLowerCase().includes(term) ||
            l.aluno.matricula?.toLowerCase().includes(term),
        )
      : relatorio.linhas;
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      if (sortBy === "nome")
        return a.aluno.nome_completo.localeCompare(b.aluno.nome_completo, "pt-BR");
      if (sortBy === "media_desc") return (b.media ?? -1) - (a.media ?? -1);
      if (sortBy === "media_asc") return (a.media ?? 999) - (b.media ?? 999);
      if (sortBy === "presenca") return (b.presenca ?? -1) - (a.presenca ?? -1);
      return 0;
    });
    return sorted;
  }, [relatorio, search, sortBy]);

  const exportCsv = () => {
    if (!relatorio) return;
    const header = [
      "Matrícula",
      "Aluno",
      "Turma",
      "Média",
      "Situação",
      "Presença (%)",
      "Faltas",
      "Notas lançadas",
    ];
    const turmaNome = new Map((data?.turmas ?? []).map((t) => [t.id, t.nome]));
    const rows = linhasVisiveis.map((l) => [
      l.aluno.matricula ?? "",
      l.aluno.nome_completo,
      turmaNome.get(l.aluno.turma_id ?? "") ?? "",
      l.media?.toString().replace(".", ",") ?? "",
      classify(l.media).label,
      l.presenca?.toString().replace(".", ",") ?? "",
      String(l.faltas),
      String(l.notasLancadas),
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-academico-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading || !relatorio) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { kpis, chartDisciplinas } = relatorio;

  return (
    <div className="space-y-5">
      {/* Filtros */}
      <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Turma</label>
            <Select value={turmaId} onValueChange={setTurmaId}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as turmas</SelectItem>
                {data?.turmas.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Bimestre</label>
            <Select value={bimestre} onValueChange={setBimestre}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="1">1º Bimestre</SelectItem>
                <SelectItem value="2">2º Bimestre</SelectItem>
                <SelectItem value="3">3º Bimestre</SelectItem>
                <SelectItem value="4">4º Bimestre</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Ordenar por</label>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nome">Nome (A-Z)</SelectItem>
                <SelectItem value="media_desc">Maior média</SelectItem>
                <SelectItem value="media_asc">Menor média</SelectItem>
                <SelectItem value="presenca">Maior presença</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Buscar aluno</label>
            <div className="relative mt-1">
              <Search className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nome ou matrícula"
                className="pl-8"
              />
            </div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          icon={<UsersIcon className="size-4" />}
          label="Alunos"
          value={kpis.totalAlunos}
          tint="#6366f1"
        />
        <Kpi
          icon={<Award className="size-4" />}
          label="Média geral"
          value={kpis.mediaGeral.toFixed(2)}
          tint="#10b981"
        />
        <Kpi
          icon={<TrendingUp className="size-4" />}
          label="Taxa de aprovação"
          value={`${kpis.taxaAprov}%`}
          tint="#14b8a6"
          hint={`${kpis.aprovados} aprovados · ${kpis.recup} recup. · ${kpis.reprov} reprov.`}
        />
        <Kpi
          icon={<UserCheck className="size-4" />}
          label="Presença média (180d)"
          value={`${kpis.presencaMedia}%`}
          tint="#f59e0b"
        />
      </div>

      {/* Gráfico por disciplina */}
      {chartDisciplinas.length > 0 && (
        <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="font-display text-base font-semibold">Média por disciplina</h3>
              <p className="text-xs text-muted-foreground">Consolidado dos filtros selecionados</p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartDisciplinas}
                margin={{ top: 8, right: 8, left: -12, bottom: 40 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="nome"
                  tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }}
                  interval={0}
                  angle={-30}
                  textAnchor="end"
                  height={70}
                />
                <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ fill: "hsl(var(--muted))", opacity: 0.35 }}
                />
                <Bar dataKey="media" radius={[8, 8, 0, 0]}>
                  {chartDisciplinas.map((d, i) => (
                    <Cell
                      key={i}
                      fill={
                        d.media >= APROV_MIN
                          ? "#10b981"
                          : d.media >= RECUP_MIN
                            ? "#f59e0b"
                            : "#ef4444"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* Tabela de alunos */}
      <section className="rounded-2xl border border-border/70 bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 p-4">
          <div>
            <h3 className="font-display text-base font-semibold">
              Alunos ({linhasVisiveis.length})
            </h3>
            <p className="text-xs text-muted-foreground">
              Clique em um aluno para ver o detalhamento por disciplina
            </p>
          </div>
          <Button size="sm" variant="outline" className="rounded-full" onClick={exportCsv}>
            <Download className="size-4" /> Exportar CSV
          </Button>
        </div>

        {linhasVisiveis.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            Nenhum aluno encontrado com os filtros atuais.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Aluno</th>
                  <th className="px-4 py-2 text-right font-medium">Média</th>
                  <th className="px-4 py-2 text-left font-medium">Situação</th>
                  <th className="px-4 py-2 text-right font-medium">Presença</th>
                  <th className="px-4 py-2 text-right font-medium">Faltas</th>
                  <th className="px-4 py-2 text-right font-medium">Notas</th>
                </tr>
              </thead>
              <tbody>
                {linhasVisiveis.map((l) => {
                  const c = classify(l.media);
                  return (
                    <tr
                      key={l.aluno.id}
                      onClick={() => setDetalheAluno(l.aluno)}
                      className="cursor-pointer border-t border-border/40 hover:bg-muted/30"
                    >
                      <td className="px-4 py-2.5">
                        <p className="font-medium">{l.aluno.nome_completo}</p>
                        <p className="text-xs text-muted-foreground">{l.aluno.matricula}</p>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold">
                        {l.media != null ? (
                          <span
                            className={
                              l.media >= APROV_MIN
                                ? "text-emerald-600"
                                : l.media >= RECUP_MIN
                                  ? "text-amber-600"
                                  : "text-red-600"
                            }
                          >
                            {l.media.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${toneClass[c.tone]}`}
                        >
                          {c.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono">
                        {l.presenca != null ? `${l.presenca}%` : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono">
                        {l.faltas > 0 ? (
                          <span className="inline-flex items-center gap-1 text-red-600">
                            <TrendingDown className="size-3" /> {l.faltas}
                          </span>
                        ) : (
                          l.faltas
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">
                        {l.notasLancadas}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Diálogo detalhes do aluno */}
      <DetalheAlunoDialog
        aluno={detalheAluno}
        onClose={() => setDetalheAluno(null)}
        linha={linhasVisiveis.find((l) => l.aluno.id === detalheAluno?.id) ?? null}
        allNotas={data?.notas ?? []}
      />
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  tint,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  tint: string;
  hint?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
      <div aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: tint }} />
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-xs font-medium">{label}</span>
        <span
          className="grid size-8 place-items-center rounded-lg"
          style={{ background: `${tint}1a`, color: tint }}
        >
          {icon}
        </span>
      </div>
      <p className="mt-1 font-display text-2xl font-semibold text-foreground">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function DetalheAlunoDialog({
  aluno,
  onClose,
  linha,
  allNotas,
}: {
  aluno: Aluno | null;
  onClose: () => void;
  linha: {
    media: number | null;
    presenca: number | null;
    faltas: number;
    disciplinas: Record<string, { soma: number; n: number }>;
  } | null;
  allNotas: Nota[];
}) {
  const open = !!aluno;

  const detalhes = useMemo(() => {
    if (!aluno) return null;
    const minhas = allNotas.filter((n) => n.aluno_id === aluno.id);
    const porDisc: Record<string, Record<number, number[]>> = {};
    for (const n of minhas) {
      const v = Number(n.valor);
      if (!Number.isFinite(v)) continue;
      const d = (n.disciplina || "—").trim();
      porDisc[d] ||= {};
      porDisc[d][n.bimestre] ||= [];
      porDisc[d][n.bimestre].push(v);
    }
    const rows = Object.entries(porDisc)
      .map(([disc, bims]) => {
        const bim: Record<number, number | null> = { 1: null, 2: null, 3: null, 4: null };
        for (const b of [1, 2, 3, 4]) {
          const arr = bims[b];
          if (arr && arr.length) {
            bim[b] = +(arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(2);
          }
        }
        const vals = [bim[1], bim[2], bim[3], bim[4]].filter((v): v is number => v != null);
        const media = vals.length
          ? +(vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(2)
          : null;
        return { disciplina: disc, bim, media };
      })
      .sort((a, b) => a.disciplina.localeCompare(b.disciplina, "pt-BR"));
    return rows;
  }, [aluno, allNotas]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{aluno?.nome_completo}</DialogTitle>
          <DialogDescription>
            Matrícula {aluno?.matricula} · Detalhamento por disciplina e bimestre
          </DialogDescription>
        </DialogHeader>

        {linha && (
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Média geral</p>
              <p className="font-display text-xl font-semibold">
                {linha.media != null ? linha.media.toFixed(2) : "—"}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Presença</p>
              <p className="font-display text-xl font-semibold">
                {linha.presenca != null ? `${linha.presenca}%` : "—"}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Faltas</p>
              <p className="font-display text-xl font-semibold">{linha.faltas}</p>
            </div>
          </div>
        )}

        <div className="max-h-96 overflow-y-auto rounded-xl border border-border/60">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/60 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Disciplina</th>
                <th className="px-3 py-2 text-right font-medium">1º Bim</th>
                <th className="px-3 py-2 text-right font-medium">2º Bim</th>
                <th className="px-3 py-2 text-right font-medium">3º Bim</th>
                <th className="px-3 py-2 text-right font-medium">4º Bim</th>
                <th className="px-3 py-2 text-right font-medium">Média</th>
              </tr>
            </thead>
            <tbody>
              {detalhes && detalhes.length > 0 ? (
                detalhes.map((r) => (
                  <tr key={r.disciplina} className="border-t border-border/40">
                    <td className="px-3 py-2 font-medium">{r.disciplina}</td>
                    {[1, 2, 3, 4].map((b) => (
                      <td key={b} className="px-3 py-2 text-right font-mono">
                        {r.bim[b] != null ? r.bim[b]!.toFixed(1) : "—"}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right font-mono font-semibold">
                      {r.media != null ? (
                        <span
                          className={
                            r.media >= APROV_MIN
                              ? "text-emerald-600"
                              : r.media >= RECUP_MIN
                                ? "text-amber-600"
                                : "text-red-600"
                          }
                        >
                          {r.media.toFixed(2)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-sm text-muted-foreground">
                    Nenhuma nota lançada para este aluno.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

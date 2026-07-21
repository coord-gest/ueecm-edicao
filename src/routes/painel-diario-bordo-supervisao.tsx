import { useMemo, useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, Loader2, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { supabase } from "@/integrations/supabase/client";
import {
  listSupervisao,
  listTurmasSupervisao,
} from "@/lib/diario-bordo.functions";

export const Route = createFileRoute("/painel-diario-bordo-supervisao")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Diário de Bordo — Supervisão | Gestão Escolar" }],
  }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: PainelSupervisao,
});

function isoDaysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function PainelSupervisao() {
  const listTurmas = useServerFn(listTurmasSupervisao);
  const listSup = useServerFn(listSupervisao);

  const [turmaId, setTurmaId] = useState<string>("__all");
  const [desde, setDesde] = useState<string>(isoDaysAgo(30));
  const [ate, setAte] = useState<string>(isoDaysAgo(0));

  const { data: turmas = [] } = useQuery({
    queryKey: ["sup-turmas"],
    queryFn: () => listTurmas(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["sup", turmaId, desde, ate],
    queryFn: () =>
      listSup({
        data: { turma_id: turmaId === "__all" ? "" : turmaId, desde, ate },
      }),
  });

  const alunos = data?.alunos ?? [];
  const total = data?.total_registros ?? 0;

  const kpis = useMemo(() => {
    let elogios = 0,
      atencoes = 0,
      atencaoAlta = 0;
    for (const a of alunos) {
      elogios += a.elogios;
      atencoes += a.atencoes;
      if (a.atencoes >= 3) atencaoAlta += 1;
    }
    return { elogios, atencoes, atencaoAlta, alunosAtivos: alunos.length };
  }, [alunos]);

  const exportCsv = () => {
    const header = [
      "Aluno",
      "Turma",
      "Total",
      "Elogios",
      "Participações",
      "Avanços",
      "Observações",
      "Atenções",
      "Último registro",
    ];
    const rows = alunos.map((a) => [
      a.aluno_nome,
      a.turma_nome ?? "",
      a.total,
      a.elogios,
      a.participacoes,
      a.avancos,
      a.observacoes,
      a.atencoes,
      a.ultimo_registro
        ? new Date(a.ultimo_registro).toLocaleString("pt-BR")
        : "",
    ]);
    const csv = [header, ...rows]
      .map((r) =>
        r
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(";"),
      )
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `diario-bordo-${desde}_a_${ate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Início
      </Link>
      <div className="mt-2 mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">
            Diário de Bordo — Supervisão
          </h1>
          <p className="text-sm text-muted-foreground">
            Visão consolidada por aluno no período selecionado.
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={exportCsv} disabled={!alunos.length}>
          <Download className="size-4" /> Exportar CSV
        </Button>
      </div>

      {/* Filtros */}
      <Card className="mb-4">
        <CardContent className="grid gap-3 py-4 sm:grid-cols-4">
          <div>
            <Label className="mb-1 block text-xs">Turma</Label>
            <Select value={turmaId} onValueChange={setTurmaId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Todas as turmas</SelectItem>
                {turmas.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block text-xs">De</Label>
            <Input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
            />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Até</Label>
            <Input
              type="date"
              value={ate}
              onChange={(e) => setAte(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setDesde(isoDaysAgo(30));
                setAte(isoDaysAgo(0));
                setTurmaId("__all");
              }}
            >
              Últimos 30 dias
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Kpi label="Alunos c/ registros" value={kpis.alunosAtivos} />
        <Kpi label="Total de registros" value={total} />
        <Kpi label="Elogios" value={kpis.elogios} tone="good" />
        <Kpi
          label="Atenções (≥3 no aluno)"
          value={`${kpis.atencoes} · ${kpis.atencaoAlta} aluno(s)`}
          tone="warn"
        />
      </div>

      {/* Tabela */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : alunos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhum registro no período selecionado.
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2">Aluno</th>
                <th className="px-3 py-2">Turma</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2 text-right">Elogios</th>
                <th className="px-3 py-2 text-right">Partic.</th>
                <th className="px-3 py-2 text-right">Avanços</th>
                <th className="px-3 py-2 text-right">Observ.</th>
                <th className="px-3 py-2 text-right">Atenções</th>
                <th className="px-3 py-2">Último</th>
              </tr>
            </thead>
            <tbody>
              {alunos.map((a) => (
                <tr key={a.aluno_id} className="border-b">
                  <td className="px-3 py-2 font-medium">
                    <div className="flex items-center gap-2">
                      {a.atencoes >= 3 && (
                        <AlertTriangle
                          className="size-4 text-amber-500"
                          aria-label="3+ atenções no período"
                        />
                      )}
                      {a.aluno_nome}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {a.turma_nome ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold">
                    {a.total}
                  </td>
                  <td className="px-3 py-2 text-right text-emerald-600">
                    {a.elogios}
                  </td>
                  <td className="px-3 py-2 text-right text-blue-600">
                    {a.participacoes}
                  </td>
                  <td className="px-3 py-2 text-right text-purple-600">
                    {a.avancos}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-300">
                    {a.observacoes}
                  </td>
                  <td className="px-3 py-2 text-right text-amber-600">
                    {a.atencoes}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {a.ultimo_registro
                      ? new Date(a.ultimo_registro).toLocaleDateString("pt-BR")
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: "good" | "warn";
}) {
  const cls =
    tone === "good"
      ? "border-l-4 border-l-emerald-500"
      : tone === "warn"
        ? "border-l-4 border-l-amber-500"
        : "";
  return (
    <Card className={cls}>
      <CardContent className="py-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

// Silence unused Badge import (kept for future status chips)
void Badge;
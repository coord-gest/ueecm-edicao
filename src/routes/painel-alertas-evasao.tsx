import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AlertTriangle, TrendingDown, Users, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "@tanstack/react-router";
import {
  listarAlunosEmRisco,
  type AlunoEmRisco,
  corNivel,
  rotuloNivel,
} from "@/lib/alertas-evasao.functions";

export const Route = createFileRoute("/painel-alertas-evasao")({
  ssr: false,
  component: PainelAlertasEvasao,
  head: () => ({
    meta: [
      { title: "Alerta Preditivo de Evasão | Conecta UEECM" },
      {
        name: "description",
        content:
          "Painel de gestão escolar com alunos em risco de evasão calculado a partir de frequência, notas, atividades e comportamento.",
      },
      { property: "og:title", content: "Alerta Preditivo de Evasão" },
      {
        property: "og:description",
        content: "Antecipe o risco de evasão dos alunos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function PainelAlertasEvasao() {
  const [nivel, setNivel] = useState<"baixo" | "medio" | "alto">("medio");
  const listar = useServerFn(listarAlunosEmRisco);

  const query = useQuery({
    queryKey: ["alertas-evasao", nivel],
    queryFn: () => listar({ data: { nivelMin: nivel } }),
  });

  const alunos = (query.data ?? []) as AlunoEmRisco[];
  const totalAlto = alunos.filter((a) => a.nivel === "alto").length;
  const totalMedio = alunos.filter((a) => a.nivel === "medio").length;
  const totalBaixo = alunos.filter((a) => a.nivel === "baixo").length;
  const mediaScore =
    alunos.length > 0 ? Math.round(alunos.reduce((s, a) => s + a.score, 0) / alunos.length) : 0;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <AlertTriangle className="h-8 w-8 text-amber-500" />
            Alerta Preditivo de Evasão
          </h1>
          <p className="text-muted-foreground mt-1">
            Alunos com sinais precoces de risco — combine frequência, notas, atividades e comportamento
            dos últimos 30–60 dias.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={nivel} onValueChange={(v) => setNivel(v as "baixo" | "medio" | "alto")}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="baixo">Baixo risco ou +</SelectItem>
              <SelectItem value="medio">Risco médio ou +</SelectItem>
              <SelectItem value="alto">Somente alto risco</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}>
            {query.isFetching ? "Atualizando..." : "Atualizar"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={AlertTriangle} label="Alto risco" value={totalAlto} tint="text-red-600" />
        <KpiCard icon={TrendingDown} label="Risco médio" value={totalMedio} tint="text-amber-600" />
        <KpiCard icon={Activity} label="Baixo risco" value={totalBaixo} tint="text-yellow-600" />
        <KpiCard icon={Users} label="Score médio" value={`${mediaScore}/100`} tint="text-primary" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Alunos em risco ({alunos.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {query.isLoading ? (
            <p className="text-sm text-muted-foreground">Calculando risco de {"< 200"} alunos...</p>
          ) : query.isError ? (
            <p className="text-sm text-red-600">
              Erro ao carregar: {(query.error as Error)?.message}
            </p>
          ) : alunos.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">🎉</div>
              <p className="font-medium">Nenhum aluno no nível selecionado.</p>
              <p className="text-sm text-muted-foreground">Sua escola está no verde.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {alunos.map((a) => (
                <div
                  key={a.aluno_id}
                  className="flex flex-wrap items-center justify-between gap-3 border rounded-md p-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{a.nome}</span>
                      <Badge variant="outline" className={corNivel(a.nivel)}>
                        {rotuloNivel(a.nivel)} · {a.score}/100
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {a.turma_nome ?? "Sem turma"}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs">
                    <Metric
                      label="Freq."
                      value={a.frequencia_pct !== null ? `${a.frequencia_pct}%` : "—"}
                      warn={a.frequencia_pct !== null && a.frequencia_pct < 75}
                    />
                    <Metric
                      label="Média"
                      value={a.media_notas !== null ? String(a.media_notas) : "—"}
                      warn={a.media_notas !== null && a.media_notas < 6}
                    />
                    <Metric
                      label="Atrasadas"
                      value={String(a.ativ_atrasadas)}
                      warn={a.ativ_atrasadas >= 2}
                    />
                    <Metric
                      label="Atenção"
                      value={String(a.meritos_atencao)}
                      warn={a.meritos_atencao >= 2}
                    />
                  </div>
                  <Button asChild variant="ghost" size="sm">
                    <Link
                      to="/painel-atividades-ranking/$alunoId"
                      params={{ alunoId: a.aluno_id }}
                    >
                      Detalhes
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Como o risco é calculado</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>• Frequência dos últimos 30 dias (peso até 40)</p>
          <p>• Média das últimas 10 notas (peso até 25)</p>
          <p>• Atividades atrasadas nos últimos 60 dias (peso até 20)</p>
          <p>• Ocorrências e registros de atenção nos últimos 60 dias (peso até 15)</p>
          <p className="pt-2">
            Score ≥ 60 = alto · 30–59 = médio · 10–29 = baixo · &lt; 10 = OK
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  tint,
}: {
  icon: typeof AlertTriangle;
  label: string;
  value: string | number;
  tint: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className={`text-2xl font-bold ${tint}`}>{value}</p>
          </div>
          <Icon className={`h-8 w-8 ${tint} opacity-60`} />
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="text-center">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className={`font-semibold ${warn ? "text-red-600" : ""}`}>{value}</div>
    </div>
  );
}
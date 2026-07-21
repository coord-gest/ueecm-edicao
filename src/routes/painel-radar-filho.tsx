import { useState, useEffect, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Radar, Loader2, TrendingUp, TrendingDown, Minus, Calendar, GraduationCap, ClipboardList, Heart, Lightbulb } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  listarMeusFilhosRadar,
  getRadarFilho,
  corFrequencia,
  corNotas,
  corAtividades,
  corComportamento,
  sugestaoFrequencia,
  sugestaoNotas,
  sugestaoAtividades,
  sugestaoComportamento,
  type Semaforo,
} from "@/lib/radar-filho.functions";

export const Route = createFileRoute("/painel-radar-filho")({
  head: () => ({
    meta: [
      { title: "Radar do Filho — Conecta UEECM" },
      { name: "description", content: "Painel único para acompanhar frequência, notas, atividades e comportamento do seu filho." },
    ],
  }),
  component: RadarFilhoPage,
});

const TONE: Record<Semaforo, { bg: string; text: string; border: string; label: string; icon: React.ComponentType<{ className?: string }> }> = {
  verde: { bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-500", label: "Dentro do esperado", icon: TrendingUp },
  amarelo: { bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-300", border: "border-amber-500", label: "Atenção", icon: Minus },
  vermelho: { bg: "bg-red-50 dark:bg-red-950/30", text: "text-red-700 dark:text-red-300", border: "border-red-500", label: "Ação recomendada", icon: TrendingDown },
  neutro: { bg: "bg-muted/40", text: "text-muted-foreground", border: "border-muted", label: "Sem dados", icon: Minus },
};

function RadarFilhoPage() {
  const listFn = useServerFn(listarMeusFilhosRadar);
  const radarFn = useServerFn(getRadarFilho);
  const [alunoId, setAlunoId] = useState<string | null>(null);

  const filhosQ = useQuery({ queryKey: ["radar-meus-filhos"], queryFn: () => listFn(), staleTime: 5 * 60_000 });

  useEffect(() => {
    if (!alunoId && filhosQ.data && filhosQ.data.length > 0) setAlunoId(filhosQ.data[0].aluno_id);
  }, [filhosQ.data, alunoId]);

  const radarQ = useQuery({
    queryKey: ["radar-filho", alunoId],
    queryFn: () => radarFn({ data: { alunoId: alunoId! } }),
    enabled: !!alunoId,
    staleTime: 60_000,
  });

  const semaforos = useMemo(() => {
    if (!radarQ.data) return null;
    const r = radarQ.data;
    return {
      frequencia: corFrequencia(r.frequencia.percentual),
      notas: corNotas(r.notas.media_ultimas ?? r.notas.media_geral),
      atividades: corAtividades(r.atividades.percentual),
      comportamento: corComportamento(r.comportamento.saldo, r.comportamento.atencao),
    };
  }, [radarQ.data]);

  return (
    <div className="container mx-auto max-w-5xl p-4 md:p-6 space-y-6">
      <header className="flex items-start gap-3">
        <div className="rounded-[5px] bg-primary/10 p-2 text-primary"><Radar className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Radar do Filho</h1>
          <p className="text-sm text-muted-foreground">Visão consolidada de frequência, notas, atividades e comportamento nos últimos 30 dias.</p>
        </div>
      </header>

      {filhosQ.isLoading ? (
        <Loading />
      ) : (filhosQ.data ?? []).length === 0 ? (
        <EmptyCard>Nenhum filho vinculado à sua conta. Fale com a secretaria.</EmptyCard>
      ) : (
        <>
          {(filhosQ.data?.length ?? 0) > 1 && (
            <Card>
              <CardContent className="p-4">
                <label className="text-xs font-medium text-muted-foreground mb-2 block">Selecione o filho</label>
                <Select value={alunoId ?? undefined} onValueChange={setAlunoId}>
                  <SelectTrigger className="w-full md:w-96"><SelectValue placeholder="Escolha um filho…" /></SelectTrigger>
                  <SelectContent>
                    {filhosQ.data?.map((f) => (
                      <SelectItem key={f.aluno_id} value={f.aluno_id}>
                        {f.nome}{f.turma_nome ? ` — ${f.turma_nome}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          )}

          {radarQ.isLoading ? <Loading /> : radarQ.error ? (
            <Card><CardContent className="p-6 text-sm text-destructive">Erro ao carregar radar: {(radarQ.error as Error).message}</CardContent></Card>
          ) : radarQ.data && semaforos ? (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">{radarQ.data.aluno.nome}</CardTitle>
                  {radarQ.data.aluno.turma_nome && <CardDescription>Turma: {radarQ.data.aluno.turma_nome}</CardDescription>}
                </CardHeader>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <KpiCard
                  icon={Calendar}
                  titulo="Frequência"
                  semaforo={semaforos.frequencia}
                  valor={radarQ.data.frequencia.percentual !== null ? `${radarQ.data.frequencia.percentual}%` : "—"}
                  subtitulo={`${radarQ.data.frequencia.presentes} de ${radarQ.data.frequencia.total} aulas (últimos 30 dias)`}
                  progresso={radarQ.data.frequencia.percentual}
                  sugestao={sugestaoFrequencia(semaforos.frequencia, radarQ.data.frequencia.percentual)}
                />
                <KpiCard
                  icon={GraduationCap}
                  titulo="Notas"
                  semaforo={semaforos.notas}
                  valor={(radarQ.data.notas.media_ultimas ?? radarQ.data.notas.media_geral)?.toString() ?? "—"}
                  subtitulo={`${radarQ.data.notas.total_lancamentos} nota(s) lançada(s)${radarQ.data.notas.media_geral !== null ? ` • Média geral: ${radarQ.data.notas.media_geral}` : ""}`}
                  progresso={((radarQ.data.notas.media_ultimas ?? radarQ.data.notas.media_geral) ?? 0) * 10}
                  sugestao={sugestaoNotas(semaforos.notas, radarQ.data.notas.media_ultimas ?? radarQ.data.notas.media_geral)}
                />
                <KpiCard
                  icon={ClipboardList}
                  titulo="Atividades"
                  semaforo={semaforos.atividades}
                  valor={radarQ.data.atividades.percentual !== null ? `${radarQ.data.atividades.percentual}%` : "—"}
                  subtitulo={`${radarQ.data.atividades.entregues} de ${radarQ.data.atividades.total} entregues${radarQ.data.atividades.atrasadas > 0 ? ` • ${radarQ.data.atividades.atrasadas} atrasada(s)` : ""}`}
                  progresso={radarQ.data.atividades.percentual}
                  sugestao={sugestaoAtividades(semaforos.atividades, radarQ.data.atividades.atrasadas)}
                />
                <KpiCard
                  icon={Heart}
                  titulo="Comportamento"
                  semaforo={semaforos.comportamento}
                  valor={radarQ.data.comportamento.saldo >= 0 ? `+${radarQ.data.comportamento.saldo}` : `${radarQ.data.comportamento.saldo}`}
                  subtitulo={`${radarQ.data.comportamento.elogios} elogio(s) • ${radarQ.data.comportamento.avancos} avanço(s) • ${radarQ.data.comportamento.atencao} atenção(ões)`}
                  progresso={null}
                  sugestao={sugestaoComportamento(semaforos.comportamento, radarQ.data.comportamento.atencao)}
                />
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Atualizado em {new Date(radarQ.data.calculado_em).toLocaleString("pt-BR")}
              </p>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}

function KpiCard({
  icon: Icon, titulo, semaforo, valor, subtitulo, progresso, sugestao,
}: {
  icon: React.ComponentType<{ className?: string }>;
  titulo: string;
  semaforo: Semaforo;
  valor: string;
  subtitulo: string;
  progresso: number | null;
  sugestao: string | null;
}) {
  const tone = TONE[semaforo];
  const ToneIcon = tone.icon;
  return (
    <Card className={`border-l-4 ${tone.border}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className={`rounded-[5px] p-2 ${tone.bg} ${tone.text}`}><Icon className="h-4 w-4" /></div>
            <CardTitle className="text-sm font-medium">{titulo}</CardTitle>
          </div>
          <Badge className={`gap-1 ${tone.bg} ${tone.text} hover:${tone.bg}`} variant="outline">
            <ToneIcon className="h-3 w-3" />
            {tone.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className={`text-3xl font-bold ${tone.text}`}>{valor}</div>
        <p className="text-xs text-muted-foreground">{subtitulo}</p>
        {progresso !== null && progresso >= 0 && (
          <Progress value={Math.min(Math.max(progresso, 0), 100)} className="h-2" />
        )}
        {sugestao && (
          <div className={`flex gap-2 rounded-[5px] p-3 text-xs ${tone.bg} ${tone.text}`}>
            <Lightbulb className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{sugestao}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Loading() {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground p-6">
      <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
    </div>
  );
}

function EmptyCard({ children }: { children: React.ReactNode }) {
  return <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">{children}</CardContent></Card>;
}
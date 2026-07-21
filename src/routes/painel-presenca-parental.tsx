import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Award, Loader2, Trophy, BookOpen, ClipboardCheck, Zap, CalendarDays, Sparkles } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  getMinhaPresencaParental,
  getRankingPresencaParental,
  BADGES,
  calcularBadges,
  nivel,
} from "@/lib/presenca-parental.functions";

export const Route = createFileRoute("/painel-presenca-parental")({
  head: () => ({
    meta: [
      { title: "Selo de Presença Parental — Conecta UEECM" },
      { name: "description", content: "Ganhe reconhecimento por acompanhar a vida escolar do seu filho: pontos, badges e ranking das famílias mais presentes." },
    ],
  }),
  component: PresencaParentalPage,
});

function PresencaParentalPage() {
  const resumoFn = useServerFn(getMinhaPresencaParental);
  const rankFn = useServerFn(getRankingPresencaParental);

  const resumoQ = useQuery({ queryKey: ["presenca-minha", 90], queryFn: () => resumoFn({ data: { dias: 90 } }), staleTime: 60_000 });
  const rankQ = useQuery({ queryKey: ["presenca-ranking", 90], queryFn: () => rankFn({ data: { limite: 10, dias: 90 } }), staleTime: 60_000 });

  const badgesConquistados = useMemo(() => (resumoQ.data ? calcularBadges(resumoQ.data) : []), [resumoQ.data]);
  const nv = useMemo(() => (resumoQ.data ? nivel(resumoQ.data.pontos) : null), [resumoQ.data]);

  return (
    <div className="container mx-auto max-w-5xl p-4 md:p-6 space-y-6">
      <header className="flex items-start gap-3">
        <div className="rounded-[5px] bg-primary/10 p-2 text-primary"><Award className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Selo de Presença Parental</h1>
          <p className="text-sm text-muted-foreground">Reconhecimento por acompanhar comunicados, autorizações e a rotina escolar do seu filho nos últimos 90 dias.</p>
        </div>
      </header>

      {resumoQ.isLoading ? <Loading /> : resumoQ.error ? (
        <Card><CardContent className="p-6 text-sm text-destructive">Erro: {(resumoQ.error as Error).message}</CardContent></Card>
      ) : resumoQ.data && nv ? (
        <>
          {/* Nível + pontuação */}
          <Card className="border-l-4 border-primary">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardDescription>Seu nível atual</CardDescription>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" /> {nv.nome}
                  </CardTitle>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-primary">{resumoQ.data.pontos}</div>
                  <div className="text-xs text-muted-foreground">pontos</div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {nv.proximo !== null ? (
                <>
                  <Progress value={nv.progresso} className="h-2" />
                  <p className="text-xs text-muted-foreground">Faltam {nv.proximo - resumoQ.data.pontos} pontos para o próximo nível.</p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Você alcançou o nível máximo. Continue acompanhando!</p>
              )}
            </CardContent>
          </Card>

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard icon={BookOpen} label="Comunicados lidos" value={`${resumoQ.data.comunicados_lidos}/${resumoQ.data.comunicados_total}`} sub={`${resumoQ.data.taxa_leitura}% de leitura`} />
            <MetricCard icon={ClipboardCheck} label="Autorizações" value={String(resumoQ.data.autorizacoes_respondidas)} sub="respostas enviadas" />
            <MetricCard icon={Zap} label="Respostas rápidas" value={String(resumoQ.data.autorizacoes_rapidas)} sub="em menos de 24h" />
            <MetricCard icon={CalendarDays} label="Dias ativos" value={String(resumoQ.data.dias_ativos)} sub="nos últimos 90 dias" />
          </div>

          {/* Badges */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Award className="h-5 w-5" /> Seus selos</CardTitle>
              <CardDescription>Conquiste selos ao acompanhar a vida escolar. {badgesConquistados.length} de {BADGES.length} desbloqueados.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {BADGES.map((b) => {
                  const won = badgesConquistados.includes(b.id);
                  return (
                    <div
                      key={b.id}
                      className={`rounded-[5px] border p-3 transition ${won ? b.cor + " border-transparent" : "bg-muted/30 text-muted-foreground border-dashed opacity-60"}`}
                    >
                      <div className="text-3xl mb-1">{b.icone}</div>
                      <div className="font-semibold text-sm">{b.nome}</div>
                      <div className="text-xs">{b.descricao}</div>
                      {won && <Badge className="mt-2" variant="secondary">Conquistado</Badge>}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Ranking discreto */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Trophy className="h-5 w-5 text-amber-500" /> Famílias mais presentes</CardTitle>
              <CardDescription>Somente as 10 famílias mais engajadas aparecem — sem lista de ausentes. Identidade preservada com iniciais.</CardDescription>
            </CardHeader>
            <CardContent>
              {rankQ.isLoading ? <Loading /> : (rankQ.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Ainda não há dados suficientes para o ranking.</p>
              ) : (
                <ol className="space-y-2">
                  {(rankQ.data ?? []).map((row) => (
                    <li
                      key={row.posicao}
                      className={`flex items-center justify-between gap-3 rounded-[5px] p-3 border ${row.is_you ? "border-primary bg-primary/5" : "border-border"}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${row.posicao === 1 ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-200" : row.posicao === 2 ? "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-100" : row.posicao === 3 ? "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-200" : "bg-muted text-muted-foreground"}`}>
                          {row.posicao}
                        </span>
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">
                            Família {row.iniciais} {row.is_you && <Badge variant="outline" className="ml-1">Você</Badge>}
                          </div>
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-primary">{row.pontos} pts</div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground text-center">
            Pontos: leitura de comunicado (+2), autorização respondida (+5), resposta em &lt; 24h (+10 extra), dia ativo (+3).
          </p>
        </>
      ) : null}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, sub }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; sub: string }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-1">
        <div className="flex items-center gap-2 text-muted-foreground text-xs"><Icon className="h-3.5 w-3.5" /> {label}</div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground">{sub}</div>
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
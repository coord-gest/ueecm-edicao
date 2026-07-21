import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { AccessDenied, EscolaShell } from "@/components/escola/EscolaShell";
import { PainelLayout } from "@/components/PainelLayout";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { listarComunicadosSemConfirmacao } from "@/lib/comunicado-confirmacao.functions";

export const Route = createFileRoute("/painel-confirmacao-comunicados")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Confirmação de Comunicados | Gestão" }],
  }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: PainelConfirmacaoComunicados,
});

function PainelConfirmacaoComunicados() {
  const { hasRole, loading } = useAuth();
  const listar = useServerFn(listarComunicadosSemConfirmacao);

  const isStaff =
    hasRole("admin") ||
    hasRole("diretor") ||
    hasRole("coordenador") ||
    hasRole("secretario") ||
    hasRole("desenvolvedor");

  const query = useQuery({
    queryKey: ["confirmacao-comunicados"],
    enabled: isStaff,
    queryFn: () => listar(),
    refetchInterval: 60_000,
  });

  if (loading) return null;
  if (!isStaff) return <AccessDenied />;

  const items = query.data ?? [];
  const alertas = items.filter(
    (c) =>
      c.alerta_gestao_apos_horas &&
      c.horas_desde_envio >= c.alerta_gestao_apos_horas &&
      c.total_confirmado < c.total_esperado,
  );

  return (
    <PainelLayout>
      <EscolaShell
        title="Confirmação de compreensão"
        description="Comunicados que exigem confirmação dos responsáveis"
      >
        {query.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Carregando…
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <CheckCircle2 className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              Nenhum comunicado com exigência de confirmação no momento.
            </p>
          </div>
        ) : (
          <>
            {alertas.length > 0 && (
              <div className="mb-4 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                  <AlertTriangle className="size-4" />
                  {alertas.length} comunicado(s) fora do prazo de confirmação
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ligue para os responsáveis que ainda não confirmaram compreensão.
                </p>
              </div>
            )}

            <ul className="space-y-3">
              {items.map((c) => {
                const pct =
                  c.total_esperado > 0
                    ? Math.round((c.total_confirmado / c.total_esperado) * 100)
                    : 0;
                const prazo = c.alerta_gestao_apos_horas ?? 48;
                const foraDoPrazo =
                  c.horas_desde_envio >= prazo && c.total_confirmado < c.total_esperado;

                return (
                  <li
                    key={c.id}
                    className={`rounded-2xl border p-5 shadow-sm ${
                      foraDoPrazo
                        ? "border-destructive/40 bg-destructive/5"
                        : "border-border/70 bg-card"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-display text-base font-semibold">{c.titulo}</p>
                        <p className="text-xs text-muted-foreground">
                          Enviado em{" "}
                          {format(new Date(c.created_at), "dd 'de' MMM 'às' HH:mm", {
                            locale: ptBR,
                          })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {foraDoPrazo ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="size-3" /> Fora do prazo
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1">
                            <Clock className="size-3" /> {c.horas_desde_envio}h · prazo {prazo}h
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {c.total_confirmado} de {c.total_esperado} responsáveis confirmaram
                        </span>
                        <span className="font-medium">{pct}%</span>
                      </div>
                      <Progress value={pct} />
                    </div>

                    <div className="mt-3">
                      <Button asChild size="sm" variant="outline" className="rounded-full">
                        <Link
                          to="/escola/comunicados/dashboard"
                          search={{ id: c.id } as never}
                        >
                          Ver detalhes
                        </Link>
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </EscolaShell>
    </PainelLayout>
  );
}

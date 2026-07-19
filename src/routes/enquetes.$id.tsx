import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, BarChart3, CheckCircle2, Lock, Vote as VoteIcon } from "lucide-react";
import { toast } from "sonner";
import {
  getEnquetePublica,
  votarEnquete,
  getMeuVoto,
  type EnqueteOpcao,
  type EnqueteResultado,
} from "@/lib/enquetes.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { uniqueRealtimeChannelName } from "@/lib/realtime-channel";

export const Route = createFileRoute("/enquetes/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Enquete | UEECM` },
      { name: "description", content: `Participe da enquete ${params.id}` },
    ],
  }),
  loader: async ({ params }) => await getEnquetePublica({ data: { id: params.id } }),
  component: EnqueteDetail,
  errorComponent: () => <div className="p-8">Erro ao carregar.</div>,
  notFoundComponent: () => <div className="p-8">Enquete não encontrada.</div>,
});

function EnqueteDetail() {
  const initial = Route.useLoaderData();
  const { id } = Route.useParams();
  const { user } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);

  const { data = initial } = useQuery({
    queryKey: ["enquete", id],
    queryFn: () => getEnquetePublica({ data: { id } }),
    initialData: initial,
  });

  const { data: meuVoto } = useQuery({
    queryKey: ["enquete-voto", id, user?.id],
    queryFn: () =>
      user ? getMeuVoto({ data: { enquete_id: id } }) : Promise.resolve({ opcao_ids: [] }),
    enabled: !!user,
  });

  // Realtime — atualiza resultados quando alguém vota
  useEffect(() => {
    const channel = supabase
      .channel(uniqueRealtimeChannelName(`enquete-${id}`))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "enquete_respostas", filter: `enquete_id=eq.${id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["enquete", id] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, qc]);

  const votar = useMutation({
    mutationFn: () => votarEnquete({ data: { enquete_id: id, opcao_ids: selected } }),
    onSuccess: () => {
      toast.success("Voto registrado!");
      qc.invalidateQueries({ queryKey: ["enquete", id] });
      qc.invalidateQueries({ queryKey: ["enquete-voto", id, user?.id] });
      setSelected([]);
    },
    onError: (err: Error) => toast.error(err.message || "Erro ao votar"),
  });

  if (!data.enquete) {
    return (
      <div className="min-h-dvh flex flex-col">
        <SiteHeader />
        <main className="flex-1 container mx-auto px-4 py-10">Enquete não encontrada.</main>
        <SiteFooter />
      </div>
    );
  }

  const enq = data.enquete;
  const encerrada = enq.encerra_em ? new Date(enq.encerra_em) < new Date() : false;
  const total = (data.resultados as EnqueteResultado[]).reduce(
    (s: number, r: EnqueteResultado) => s + r.votos,
    0,
  );
  const jaVotou = (meuVoto?.opcao_ids.length ?? 0) > 0;
  const podeVotar = enq.ativo && !encerrada && !jaVotou;
  const precisaLogin = enq.publico !== "todos" && !user;
  const mostrarResultados = jaVotou || encerrada || !enq.ativo || enq.mostrar_resultados_antes;

  const toggleSelected = (opcaoId: string) => {
    if (enq.tipo === "unica") setSelected([opcaoId]);
    else
      setSelected((prev) =>
        prev.includes(opcaoId) ? prev.filter((i) => i !== opcaoId) : [...prev, opcaoId],
      );
  };

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-3xl">
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link to="/enquetes">
            <ArrowLeft className="h-4 w-4 mr-2" /> Todas as enquetes
          </Link>
        </Button>

        <article className="rounded-2xl border bg-card p-6 md:p-8 shadow-sm">
          <div className="flex items-start gap-3 mb-4">
            <VoteIcon className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{enq.titulo}</h1>
              {enq.descricao && <p className="text-muted-foreground mt-2">{enq.descricao}</p>}
              <div className="flex flex-wrap gap-2 mt-3">
                <Badge variant="secondary">
                  {enq.tipo === "unica" ? "Escolha única" : "Múltipla escolha"}
                </Badge>
                {encerrada && <Badge variant="destructive">Encerrada</Badge>}
                {!encerrada && enq.encerra_em && (
                  <Badge variant="outline">
                    Encerra em {new Date(enq.encerra_em).toLocaleString("pt-BR")}
                  </Badge>
                )}
                <Badge variant="outline" className="gap-1">
                  <BarChart3 className="h-3 w-3" /> {total} {total === 1 ? "voto" : "votos"}
                </Badge>
              </div>
            </div>
          </div>

          {precisaLogin && (
            <div className="mt-6 p-4 rounded-lg border border-dashed bg-muted/30 flex items-center gap-3">
              <Lock className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1 text-sm">Faça login para votar nesta enquete.</div>
              <Button asChild size="sm">
                <Link to="/login">Entrar</Link>
              </Button>
            </div>
          )}

          {jaVotou && (
            <div className="mt-6 p-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <div className="text-sm">Você já registrou seu voto. Obrigado por participar!</div>
            </div>
          )}

          {/* Formulário de voto */}
          {podeVotar && !precisaLogin && !mostrarResultados && (
            <div className="mt-6">
              {enq.tipo === "unica" ? (
                <RadioGroup value={selected[0] ?? ""} onValueChange={(v) => setSelected([v])}>
                  {(data.opcoes as EnqueteOpcao[]).map((op: EnqueteOpcao) => (
                    <div
                      key={op.id}
                      className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                      onClick={() => setSelected([op.id])}
                    >
                      <RadioGroupItem value={op.id} id={op.id} />
                      <Label htmlFor={op.id} className="flex-1 cursor-pointer">
                        {op.texto}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              ) : (
                <div className="space-y-2">
                  {(data.opcoes as EnqueteOpcao[]).map((op: EnqueteOpcao) => (
                    <div
                      key={op.id}
                      className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                      onClick={() => toggleSelected(op.id)}
                    >
                      <Checkbox
                        checked={selected.includes(op.id)}
                        onCheckedChange={() => toggleSelected(op.id)}
                      />
                      <Label className="flex-1 cursor-pointer">{op.texto}</Label>
                    </div>
                  ))}
                </div>
              )}
              <Button
                className="mt-6 w-full"
                size="lg"
                disabled={selected.length === 0 || votar.isPending}
                onClick={() => votar.mutate()}
              >
                {votar.isPending ? "Enviando..." : "Registrar meu voto"}
              </Button>
            </div>
          )}

          {/* Resultados */}
          {(mostrarResultados || jaVotou) && (
            <div className="mt-6 space-y-3">
              <h2 className="font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4" /> Resultados em tempo real
              </h2>
              {(data.opcoes as EnqueteOpcao[]).map((op: EnqueteOpcao) => {
                const r = (data.resultados as EnqueteResultado[]).find(
                  (x: EnqueteResultado) => x.opcao_id === op.id,
                );
                const votos = r?.votos ?? 0;
                const pct = total > 0 ? Math.round((votos / total) * 100) : 0;
                const eumarcou = meuVoto?.opcao_ids.includes(op.id);
                return (
                  <div key={op.id} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className={eumarcou ? "font-medium text-primary" : ""}>
                        {op.texto} {eumarcou && "✓"}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {votos} ({pct}%)
                      </span>
                    </div>
                    <Progress value={pct} />
                  </div>
                );
              })}
            </div>
          )}
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}

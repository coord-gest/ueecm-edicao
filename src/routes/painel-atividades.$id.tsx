import { useMemo, useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  CircleAlert,
  Eraser,
  Loader2,
  Send,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { supabase } from "@/integrations/supabase/client";
import {
  getAtividade,
  limparEntregas,
  listEntregas,
  marcarTodosEntregues,
  notificarPaisAtividade,
  upsertEntrega,
  type EntregaAluno,
} from "@/lib/atividades.functions";

export const Route = createFileRoute("/painel-atividades/$id")({
  ssr: false,
  head: () => ({ meta: [{ title: "Entregas | Atividades e Trabalhos" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: DetalheAtividadePage,
});

type Categoria = "andamento" | "realizados" | "encerrados" | "inadimplentes";

function categorize(e: EntregaAluno, prazo: string): Categoria {
  const prazoTs = new Date(prazo).getTime();
  if (e.entregue) {
    const dentro = e.entregue_em ? new Date(e.entregue_em).getTime() <= prazoTs : true;
    return dentro ? "encerrados" : "realizados";
  }
  return prazoTs < Date.now() ? "inadimplentes" : "andamento";
}

function DetalheAtividadePage() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();

  const getAtividadeFn = useServerFn(getAtividade);
  const listEntregasFn = useServerFn(listEntregas);
  const upsertFn = useServerFn(upsertEntrega);
  const marcarTodosFn = useServerFn(marcarTodosEntregues);
  const limparFn = useServerFn(limparEntregas);
  const notificarFn = useServerFn(notificarPaisAtividade);

  const { data: atividadeData, isLoading: loadingAt } = useQuery({
    queryKey: ["atividade", id],
    queryFn: () => getAtividadeFn({ data: { id } }),
  });

  const { data: entregas = [], isLoading: loadingE } = useQuery({
    queryKey: ["atividade", id, "entregas"],
    queryFn: () => listEntregasFn({ data: { atividade_id: id } }),
  });

  const toggleMut = useMutation({
    mutationFn: (vars: { aluno_id: string; entregue: boolean }) =>
      upsertFn({ data: { atividade_id: id, ...vars } }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["atividade", id, "entregas"] }),
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Erro ao atualizar"),
  });

  const marcarTodosMut = useMutation({
    mutationFn: () => marcarTodosFn({ data: { atividade_id: id } }),
    onSuccess: (r) => {
      toast.success(`${r.count} alunos marcados como entregue`);
      queryClient.invalidateQueries({ queryKey: ["atividade", id, "entregas"] });
    },
  });

  const limparMut = useMutation({
    mutationFn: () => limparFn({ data: { atividade_id: id } }),
    onSuccess: () => {
      toast.success("Marcações limpas");
      queryClient.invalidateQueries({ queryKey: ["atividade", id, "entregas"] });
    },
  });

  const prazo = atividadeData?.atividade.data_entrega;

  const [busca, setBusca] = useState("");
  const [tab, setTab] = useState<Categoria>("andamento");
  const [openNotif, setOpenNotif] = useState(false);
  const [mensagemExtra, setMensagemExtra] = useState("");

  const notificarMut = useMutation({
    mutationFn: () =>
      notificarFn({ data: { atividade_id: id, mensagem: mensagemExtra || null } }),
    onSuccess: () => {
      toast.success("Comunicado enviado aos responsáveis da turma");
      setOpenNotif(false);
      setMensagemExtra("");
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Erro ao notificar"),
  });

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return entregas;
    return entregas.filter(
      (e) =>
        e.aluno_nome.toLowerCase().includes(q) ||
        (e.aluno_matricula ?? "").toLowerCase().includes(q),
    );
  }, [entregas, busca]);

  const buckets = useMemo(() => {
    const acc: Record<Categoria, EntregaAluno[]> = {
      andamento: [],
      realizados: [],
      encerrados: [],
      inadimplentes: [],
    };
    if (!prazo) return acc;
    for (const e of filtered) acc[categorize(e, prazo)].push(e);
    return acc;
  }, [filtered, prazo]);

  const counts = useMemo(() => {
    const c: Record<Categoria, number> = {
      andamento: 0,
      realizados: 0,
      encerrados: 0,
      inadimplentes: 0,
    };
    if (!prazo) return c;
    for (const e of entregas) c[categorize(e, prazo)]++;
    return c;
  }, [entregas, prazo]);

  const total = entregas.length;
  const entreguesTotal = counts.realizados + counts.encerrados;
  const pct = total ? Math.round((entreguesTotal / total) * 100) : 0;

  const listaAtiva = buckets[tab];

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <Link
        to="/painel-atividades"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Atividades e Trabalhos
      </Link>

      <div className="mt-2">
        <h1 className="text-2xl font-bold sm:text-3xl">
          {loadingAt ? "Carregando..." : atividadeData?.atividade.titulo}
        </h1>
        {atividadeData && (
          <p className="mt-1 text-sm text-muted-foreground">
            {atividadeData.turma_nome ?? "Turma"}
            {atividadeData.atividade.disciplina
              ? ` · ${atividadeData.atividade.disciplina}`
              : ""}
            {" · Entrega até "}
            {new Date(atividadeData.atividade.data_entrega).toLocaleString("pt-BR")}
          </p>
        )}
        {atividadeData?.atividade.descricao && (
          <p className="mt-2 whitespace-pre-wrap text-sm">
            {atividadeData.atividade.descricao}
          </p>
        )}
        <div className="mt-3 rounded-[5px] border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
          <strong className="text-foreground">Objetivo:</strong> acompanhar e
          controlar as entregas de atividades e trabalhos. O professor notifica os
          responsáveis sobre a criação e o prazo, e marca o status individual de
          cada aluno como <em>realizado</em>. Alunos que não entregarem dentro do
          prazo aparecem em <strong>Inadimplentes</strong>.
        </div>
      </div>

      {/* Resumo */}
      <Card className="mt-4 rounded-[5px]">
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Entregaram</p>
              <p className="text-2xl font-bold">
                {entreguesTotal}
                <span className="text-base font-normal text-muted-foreground">
                  /{total}
                </span>
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Inadimplentes</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {counts.inadimplentes}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Em andamento</p>
              <p className="text-2xl font-bold text-muted-foreground">
                {counts.andamento}
              </p>
            </div>
            <div className="ml-auto min-w-[180px] flex-1">
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-1 text-right text-xs text-muted-foreground">{pct}%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ações em lote + busca */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          placeholder="Buscar aluno..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="h-9 flex-1 min-w-[180px] rounded-[5px] border bg-background px-3 text-sm"
        />

        <Dialog open={openNotif} onOpenChange={setOpenNotif}>
          <DialogTrigger asChild>
            <Button className="gap-2 rounded-[5px]">
              <Send className="size-4" /> Notificar pais
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-[5px] sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Notificar responsáveis</DialogTitle>
              <DialogDescription>
                Um comunicado será enviado a todos os responsáveis da turma com o
                título, prazo e descrição desta atividade.
              </DialogDescription>
            </DialogHeader>
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="msg-extra">
                Mensagem adicional (opcional)
              </label>
              <Textarea
                id="msg-extra"
                rows={3}
                value={mensagemExtra}
                onChange={(e) => setMensagemExtra(e.target.value)}
                placeholder="Ex.: Lembrem-se de trazer o material impresso."
              />
            </div>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setOpenNotif(false)}
                disabled={notificarMut.isPending}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => notificarMut.mutate()}
                disabled={notificarMut.isPending}
                className="gap-2"
              >
                {notificarMut.isPending && <Loader2 className="size-4 animate-spin" />}
                Enviar comunicado
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              className="gap-2 rounded-[5px]"
              disabled={marcarTodosMut.isPending || total === 0}
            >
              <CheckCircle2 className="size-4" />
              Marcar todos como entregue
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="rounded-[5px]">
            <AlertDialogHeader>
              <AlertDialogTitle>Marcar todos os alunos como entregue?</AlertDialogTitle>
              <AlertDialogDescription>
                Isso registrará a entrega de todos os {total} alunos com a data/hora
                atual. Marcações anteriores serão preservadas.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => marcarTodosMut.mutate()}>
                Confirmar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              className="gap-2 rounded-[5px] text-muted-foreground"
              disabled={limparMut.isPending || entreguesTotal === 0}
            >
              <Eraser className="size-4" />
              Limpar marcações
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="rounded-[5px]">
            <AlertDialogHeader>
              <AlertDialogTitle>Limpar todas as marcações?</AlertDialogTitle>
              <AlertDialogDescription>
                Todos os registros de entrega desta atividade serão removidos. Você
                poderá marcar novamente em seguida.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => limparMut.mutate()}>
                Limpar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Abas */}
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as Categoria)}
        className="mt-4"
      >
        <TabsList className="grid w-full grid-cols-2 rounded-[5px] sm:grid-cols-4">
          <TabsTrigger value="andamento" className="rounded-[5px] gap-1">
            <Circle className="size-3.5" /> Em Andamento
            <Badge variant="secondary" className="ml-1 rounded-[5px]">
              {counts.andamento}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="realizados" className="rounded-[5px] gap-1">
            <CheckCircle2 className="size-3.5" /> Realizados
            <Badge variant="secondary" className="ml-1 rounded-[5px]">
              {counts.realizados + counts.encerrados}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="encerrados" className="rounded-[5px] gap-1">
            <Users className="size-3.5" /> Encerrados
            <Badge variant="secondary" className="ml-1 rounded-[5px]">
              {counts.encerrados}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="inadimplentes" className="rounded-[5px] gap-1">
            <CircleAlert className="size-3.5" /> Inadimplentes
            <Badge variant="secondary" className="ml-1 rounded-[5px]">
              {counts.inadimplentes}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {(["andamento", "realizados", "encerrados", "inadimplentes"] as Categoria[]).map(
          (t) => (
            <TabsContent key={t} value={t} className="mt-4">
              {t === "andamento" && (
                <p className="mb-2 text-xs text-muted-foreground">
                  Alunos da turma que ainda precisam concluir a tarefa.
                </p>
              )}
              {t === "realizados" && (
                <p className="mb-2 text-xs text-muted-foreground">
                  Alunos já marcados como <strong>Realizado</strong> pelo professor.
                </p>
              )}
              {t === "encerrados" && (
                <p className="mb-2 text-xs text-muted-foreground">
                  Alunos que cumpriram a entrega <strong>dentro do prazo</strong>.
                </p>
              )}
              {t === "inadimplentes" && (
                <p className="mb-2 text-xs text-muted-foreground">
                  Alunos que <strong>não entregaram</strong> dentro do prazo
                  estipulado.
                </p>
              )}

              <div className="grid gap-2">
                {loadingE ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                  </div>
                ) : tab === t && listaAtiva.length === 0 ? (
                  <Card className="rounded-[5px]">
                    <CardContent className="py-12 text-center text-sm text-muted-foreground">
                      {total === 0
                        ? "Esta turma não possui alunos ativos."
                        : "Nenhum aluno nesta aba."}
                    </CardContent>
                  </Card>
                ) : (
                  (tab === t ? listaAtiva : []).map((e) => {
                    const isBusy =
                      toggleMut.isPending &&
                      toggleMut.variables?.aluno_id === e.aluno_id;
                    return (
                      <Card key={e.aluno_id} className="rounded-[5px]">
                        <CardContent className="flex flex-wrap items-center gap-3 py-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{e.aluno_nome}</p>
                            {e.aluno_matricula && (
                              <p className="text-xs text-muted-foreground">
                                Matrícula: {e.aluno_matricula}
                              </p>
                            )}
                            {e.entregue && e.entregue_em && (
                              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                                Marcado em{" "}
                                {new Date(e.entregue_em).toLocaleString("pt-BR", {
                                  day: "2-digit",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {isBusy && (
                              <Loader2 className="size-4 animate-spin text-muted-foreground" />
                            )}
                            <Button
                              size="sm"
                              variant={e.entregue ? "default" : "outline"}
                              className={`gap-1 rounded-[5px] ${e.entregue ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950"}`}
                              disabled={isBusy}
                              onClick={() =>
                                toggleMut.mutate({
                                  aluno_id: e.aluno_id,
                                  entregue: true,
                                })
                              }
                              aria-pressed={e.entregue}
                            >
                              <CheckCircle2 className="size-4" /> Fez
                            </Button>
                            <Button
                              size="sm"
                              variant={!e.entregue ? "default" : "outline"}
                              className={`gap-1 rounded-[5px] ${!e.entregue ? "bg-red-600 hover:bg-red-700 text-white" : "border-red-300 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"}`}
                              disabled={isBusy}
                              onClick={() =>
                                toggleMut.mutate({
                                  aluno_id: e.aluno_id,
                                  entregue: false,
                                })
                              }
                              aria-pressed={!e.entregue}
                            >
                              <CircleAlert className="size-4" /> Não fez
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </TabsContent>
          ),
        )}
      </Tabs>
    </main>
  );
}
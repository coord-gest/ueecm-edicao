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
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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

type Status = "entregue" | "pendente" | "aberto";

function computeStatus(e: EntregaAluno, prazo: string): Status {
  if (e.entregue) return "entregue";
  return new Date(prazo).getTime() < Date.now() ? "pendente" : "aberto";
}

function StatusBadge({ status }: { status: Status }) {
  if (status === "entregue")
    return (
      <Badge className="gap-1 rounded-[5px] bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-300">
        <CheckCircle2 className="size-3.5" /> Entregue
      </Badge>
    );
  if (status === "pendente")
    return (
      <Badge className="gap-1 rounded-[5px] bg-red-500/15 text-red-700 hover:bg-red-500/25 dark:text-red-300">
        <CircleAlert className="size-3.5" /> Pendente
      </Badge>
    );
  return (
    <Badge className="gap-1 rounded-[5px] bg-muted text-muted-foreground hover:bg-muted">
      <Circle className="size-3.5" /> Em aberto
    </Badge>
  );
}

function DetalheAtividadePage() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();

  const getAtividadeFn = useServerFn(getAtividade);
  const listEntregasFn = useServerFn(listEntregas);
  const upsertFn = useServerFn(upsertEntrega);
  const marcarTodosFn = useServerFn(marcarTodosEntregues);
  const limparFn = useServerFn(limparEntregas);

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

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return entregas;
    return entregas.filter(
      (e) =>
        e.aluno_nome.toLowerCase().includes(q) ||
        (e.aluno_matricula ?? "").toLowerCase().includes(q),
    );
  }, [entregas, busca]);

  const resumo = useMemo(() => {
    if (!prazo) return { entregues: 0, pendentes: 0, abertos: 0 };
    let entregues = 0;
    let pendentes = 0;
    let abertos = 0;
    entregas.forEach((e) => {
      const s = computeStatus(e, prazo);
      if (s === "entregue") entregues++;
      else if (s === "pendente") pendentes++;
      else abertos++;
    });
    return { entregues, pendentes, abertos };
  }, [entregas, prazo]);

  const total = entregas.length;
  const pct = total ? Math.round((resumo.entregues / total) * 100) : 0;

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
      </div>

      {/* Resumo */}
      <Card className="mt-4 rounded-[5px]">
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Entregaram</p>
              <p className="text-2xl font-bold">
                {resumo.entregues}
                <span className="text-base font-normal text-muted-foreground">
                  /{total}
                </span>
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pendentes</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {resumo.pendentes}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Em aberto</p>
              <p className="text-2xl font-bold text-muted-foreground">
                {resumo.abertos}
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
              disabled={limparMut.isPending || resumo.entregues === 0}
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

      {/* Lista de alunos */}
      <div className="mt-4 grid gap-2">
        {loadingE ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <Card className="rounded-[5px]">
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              {total === 0
                ? "Esta turma não possui alunos ativos."
                : "Nenhum aluno encontrado com este filtro."}
            </CardContent>
          </Card>
        ) : (
          filtered.map((e) => {
            const status = prazo ? computeStatus(e, prazo) : "aberto";
            const isBusy =
              toggleMut.isPending && toggleMut.variables?.aluno_id === e.aluno_id;
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
                  <StatusBadge status={status} />
                  <Button
                    size="sm"
                    variant={e.entregue ? "outline" : "default"}
                    className="gap-1 rounded-[5px]"
                    disabled={isBusy}
                    onClick={() =>
                      toggleMut.mutate({
                        aluno_id: e.aluno_id,
                        entregue: !e.entregue,
                      })
                    }
                  >
                    {isBusy ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : e.entregue ? (
                      "Desmarcar"
                    ) : (
                      "Marcar entregue"
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </main>
  );
}
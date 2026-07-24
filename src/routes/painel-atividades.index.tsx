import { useMemo, useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  ClipboardList,
  Loader2,
  Plus,
  Trash2,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  createAtividade,
  deleteAtividade,
  listAtividades,
  listTurmasParaAtividade,
  type AtividadeComResumo,
} from "@/lib/atividades.functions";

export const Route = createFileRoute("/painel-atividades/")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Atividades e Trabalhos | Painel do Professor" }],
  }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: PainelAtividadesPage,
});

function formatDate(v: string): string {
  try {
    return new Date(v).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return v;
  }
}

function statusPrazo(dataEntrega: string): "vencido" | "hoje" | "futuro" {
    const now = Date.now();
    const d = new Date(dataEntrega).getTime();
    if (d < now) return "vencido";
    if (d - now < 24 * 60 * 60 * 1000) return "hoje";
    return "futuro";
}

function PainelAtividadesPage() {
  const queryClient = useQueryClient();
  const list = useServerFn(listAtividades);
  const listTurmas = useServerFn(listTurmasParaAtividade);
  const criar = useServerFn(createAtividade);
  const excluir = useServerFn(deleteAtividade);

  const { data: atividades = [], isLoading } = useQuery({
    queryKey: ["atividades"],
    queryFn: () => list(),
  });

  const { data: turmas = [] } = useQuery({
    queryKey: ["atividades", "turmas"],
    queryFn: () => listTurmas(),
  });

  const [openNova, setOpenNova] = useState(false);
  const [form, setForm] = useState({
    titulo: "",
    descricao: "",
    turma_id: "",
    disciplina: "",
    data_entrega: "",
  });

  const criarMut = useMutation({
    mutationFn: () =>
      criar({
        data: {
          titulo: form.titulo,
          descricao: form.descricao || null,
          turma_id: form.turma_id,
          disciplina: form.disciplina || null,
          data_entrega: new Date(form.data_entrega).toISOString(),
        },
      }),
    onSuccess: () => {
      toast.success("Atividade criada!");
      queryClient.invalidateQueries({ queryKey: ["atividades"] });
      setOpenNova(false);
      setForm({ titulo: "", descricao: "", turma_id: "", disciplina: "", data_entrega: "" });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro ao criar"),
  });

  const excluirMut = useMutation({
    mutationFn: (id: string) => excluir({ data: { id } }),
    onSuccess: () => {
      toast.success("Atividade excluída");
      queryClient.invalidateQueries({ queryKey: ["atividades"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro ao excluir"),
  });

  const resumoGeral = useMemo(() => {
    let alunos = 0;
    let entregues = 0;
    atividades.forEach((a) => {
      alunos += a.total_alunos;
      entregues += a.total_entregues;
    });
    return { alunos, entregues };
  }, [atividades]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <Link
            to="/painel-professor"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Painel do Professor
          </Link>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Atividades e Trabalhos</h1>
          <p className="text-sm text-muted-foreground">
            Crie atividades e acompanhe as entregas de cada aluno.
          </p>
        </div>

        <Dialog open={openNova} onOpenChange={setOpenNova}>
          <DialogTrigger asChild>
            <Button className="gap-2 rounded-[5px]">
              <Plus className="size-4" /> Nova atividade
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-[5px] sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Nova atividade</DialogTitle>
              <DialogDescription>
                Preencha os dados. Você poderá marcar as entregas em seguida.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div>
                <Label htmlFor="titulo">Título *</Label>
                <Input
                  id="titulo"
                  value={form.titulo}
                  onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                  placeholder="Ex.: Trabalho de História — Idade Média"
                />
              </div>
              <div>
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  rows={3}
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  placeholder="Instruções, critérios, materiais..."
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label>Turma *</Label>
                  <Select
                    value={form.turma_id}
                    onValueChange={(v) => setForm({ ...form, turma_id: v })}
                  >
                    <SelectTrigger className="rounded-[5px]">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {turmas.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.nome}
                          {t.turno ? ` — ${t.turno}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="disciplina">Disciplina</Label>
                  <Input
                    id="disciplina"
                    value={form.disciplina}
                    onChange={(e) => setForm({ ...form, disciplina: e.target.value })}
                    placeholder="Opcional"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="prazo">Data de entrega *</Label>
                <Input
                  id="prazo"
                  type="datetime-local"
                  value={form.data_entrega}
                  onChange={(e) => setForm({ ...form, data_entrega: e.target.value })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setOpenNova(false)}
                disabled={criarMut.isPending}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => criarMut.mutate()}
                disabled={
                  criarMut.isPending ||
                  !form.titulo.trim() ||
                  !form.turma_id ||
                  !form.data_entrega
                }
                className="gap-2"
              >
                {criarMut.isPending && <Loader2 className="size-4 animate-spin" />}
                Criar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {atividades.length > 0 && (
        <Card className="mb-6 rounded-[5px]">
          <CardContent className="flex flex-wrap items-center gap-6 py-4">
            <div>
              <p className="text-xs text-muted-foreground">Atividades ativas</p>
              <p className="text-2xl font-bold">{atividades.length}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Entregas totais</p>
              <p className="text-2xl font-bold">
                {resumoGeral.entregues}
                <span className="text-base font-normal text-muted-foreground">
                  {" "}/ {resumoGeral.alunos}
                </span>
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : atividades.length === 0 ? (
        <Card className="rounded-[5px]">
          <CardContent className="py-16 text-center">
            <ClipboardList className="mx-auto mb-3 size-10 text-muted-foreground" />
            <p className="font-medium">Nenhuma atividade cadastrada ainda.</p>
            <p className="text-sm text-muted-foreground">
              Crie sua primeira atividade clicando em <strong>Nova atividade</strong>.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {atividades.map((a) => (
            <AtividadeCard
              key={a.id}
              atividade={a}
              onDelete={() => excluirMut.mutate(a.id)}
              deleting={excluirMut.isPending && excluirMut.variables === a.id}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function AtividadeCard({
  atividade,
  onDelete,
  deleting,
}: {
  atividade: AtividadeComResumo;
  onDelete: () => void;
  deleting: boolean;
}) {
  const status = statusPrazo(atividade.data_entrega);
  const pct = atividade.total_alunos
    ? Math.round((atividade.total_entregues / atividade.total_alunos) * 100)
    : 0;

  return (
    <Card className="rounded-[5px] transition-shadow hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle className="line-clamp-1 text-lg">
              <Link
                to="/painel-atividades/$id"
                params={{ id: atividade.id }}
                className="hover:underline"
              >
                {atividade.titulo}
              </Link>
            </CardTitle>
            <CardDescription className="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="rounded-[5px]">
                {atividade.turma_nome ?? "Turma"}
              </Badge>
              {atividade.disciplina && (
                <Badge variant="outline" className="rounded-[5px]">
                  {atividade.disciplina}
                </Badge>
              )}
              <span
                className={
                  status === "vencido"
                    ? "text-red-600 dark:text-red-400"
                    : status === "hoje"
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-muted-foreground"
                }
              >
                Entrega: {formatDate(atividade.data_entrega)}
              </span>
            </CardDescription>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-[5px] text-muted-foreground hover:text-red-600"
                disabled={deleting}
                aria-label="Excluir atividade"
              >
                {deleting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-[5px]">
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir esta atividade?</AlertDialogTitle>
                <AlertDialogDescription>
                  As marcações de entrega dos alunos também serão removidas. Esta ação
                  não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete}>Excluir</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 text-sm">
            <Users className="size-4 text-muted-foreground" />
            <span className="font-medium">
              {atividade.total_entregues}/{atividade.total_alunos}
            </span>
            <span className="text-muted-foreground">entregaram</span>
          </div>
          <div className="h-2 flex-1 min-w-[120px] overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground">{pct}%</span>
          <Button
            asChild
            size="sm"
            className="ml-auto gap-1 rounded-[5px]"
          >
            <Link to="/painel-atividades/$id" params={{ id: atividade.id }}>
              Ver entregas <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
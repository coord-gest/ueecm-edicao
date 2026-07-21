import { useMemo, useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  ThumbsUp,
  Hand,
  TrendingUp,
  Eye,
  AlertCircle,
  Loader2,
  BookOpen,
  Users,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { supabase } from "@/integrations/supabase/client";
import {
  createRegistro,
  createRegistroLote,
  deleteRegistro,
  listAlunosDaTurma,
  listRegistrosTurma,
  listTurmasDoProfessor,
  type AlunoTurma,
  type DiarioTipo,
} from "@/lib/diario-bordo.functions";
import { TIPO_META } from "@/lib/diario-tipos";

export const Route = createFileRoute("/painel-diario-bordo")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Diário de Bordo | Painel do Professor" }],
  }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: PainelDiarioBordo,
});

function PainelDiarioBordo() {
  const queryClient = useQueryClient();
  const listTurmas = useServerFn(listTurmasDoProfessor);
  const listAlunos = useServerFn(listAlunosDaTurma);
  const listRegs = useServerFn(listRegistrosTurma);
  const criar = useServerFn(createRegistro);
  const criarLote = useServerFn(createRegistroLote);
  const excluir = useServerFn(deleteRegistro);

  const { data: turmas = [] } = useQuery({
    queryKey: ["diario", "turmas"],
    queryFn: () => listTurmas(),
  });

  const [turmaId, setTurmaId] = useState<string>("");
  const activeTurma = turmaId || turmas[0]?.id || "";

  const { data: alunos = [], isLoading: loadingAlunos } = useQuery({
    queryKey: ["diario", "alunos", activeTurma],
    queryFn: () => listAlunos({ data: { turma_id: activeTurma } }),
    enabled: !!activeTurma,
  });

  const { data: historico = [] } = useQuery({
    queryKey: ["diario", "hist", activeTurma],
    queryFn: () => listRegs({ data: { turma_id: activeTurma, dias: 7 } }),
    enabled: !!activeTurma,
  });

  const [busca, setBusca] = useState("");
  const [modo, setModo] = useState<"individual" | "lote">("individual");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  const filteredAlunos = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return alunos;
    return alunos.filter(
      (a) =>
        a.nome_completo.toLowerCase().includes(q) ||
        (a.matricula ?? "").toLowerCase().includes(q),
    );
  }, [alunos, busca]);

  const toggleSel = (id: string) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ================== Modal de registro ==================
  const [modal, setModal] = useState<{
    aluno: AlunoTurma | null;
    lote: boolean;
    tipo: DiarioTipo;
  } | null>(null);
  const [form, setForm] = useState({
    titulo: "",
    descricao: "",
    disciplina: "",
    visivel_pais: true,
  });

  const abrirModal = (tipo: DiarioTipo, aluno: AlunoTurma | null, lote = false) => {
    setModal({ tipo, aluno, lote });
    const meta = TIPO_META[tipo];
    setForm({
      titulo: meta.sugestao,
      descricao: "",
      disciplina: "",
      visivel_pais: true,
    });
  };

  const fecharModal = () => setModal(null);

  const criarMut = useMutation({
    mutationFn: async () => {
      if (!modal) throw new Error("Sem contexto");
      if (modal.lote) {
        return criarLote({
          data: {
            alunos_ids: Array.from(selecionados),
            turma_id: activeTurma,
            tipo: modal.tipo,
            titulo: form.titulo,
            descricao: form.descricao,
            disciplina: form.disciplina,
            visivel_pais: form.visivel_pais,
          },
        });
      }
      return criar({
        data: {
          aluno_id: modal.aluno!.id,
          turma_id: activeTurma,
          tipo: modal.tipo,
          titulo: form.titulo,
          descricao: form.descricao,
          disciplina: form.disciplina,
          visivel_pais: form.visivel_pais,
        },
      });
    },
    onSuccess: (r) => {
      const n = "count" in r ? r.count : 1;
      toast.success(
        modal?.lote ? `Registro criado para ${n} aluno(s)` : "Registro criado",
      );
      queryClient.invalidateQueries({ queryKey: ["diario", "hist"] });
      if (modal?.lote) setSelecionados(new Set());
      fecharModal();
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Erro ao registrar"),
  });

  const excluirMut = useMutation({
    mutationFn: (id: string) => excluir({ data: { id } }),
    onSuccess: () => {
      toast.success("Registro removido");
      queryClient.invalidateQueries({ queryKey: ["diario", "hist"] });
    },
  });

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <Link
        to="/painel-professor"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Painel do Professor
      </Link>
      <div className="mt-2 mb-6">
        <h1 className="text-2xl font-bold sm:text-3xl">Diário de Bordo</h1>
        <p className="text-sm text-muted-foreground">
          Registre em segundos o dia a dia de cada aluno. Os responsáveis
          recebem uma notificação quando o registro é visível.
        </p>
      </div>

      {/* Seletor de turma + modo */}
      <Card className="mb-4 rounded-[5px]">
        <CardContent className="flex flex-wrap items-end gap-3 py-4">
          <div className="min-w-[220px] flex-1">
            <Label className="mb-1 block text-xs">Turma</Label>
            <Select value={activeTurma} onValueChange={setTurmaId}>
              <SelectTrigger className="rounded-[5px]">
                <SelectValue placeholder="Selecione a turma" />
              </SelectTrigger>
              <SelectContent>
                {turmas.length === 0 && (
                  <div className="p-2 text-sm text-muted-foreground">
                    Nenhuma turma vinculada a você.
                  </div>
                )}
                {turmas.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.nome}
                    {t.turno ? ` — ${t.turno}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[220px] flex-1">
            <Label className="mb-1 block text-xs">Buscar aluno</Label>
            <Input
              className="rounded-[5px]"
              placeholder="Nome ou matrícula"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 rounded-[5px] border px-3 py-2">
            <Users className="size-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Modo</span>
            <Button
              size="sm"
              variant={modo === "individual" ? "default" : "outline"}
              className="rounded-[5px]"
              onClick={() => {
                setModo("individual");
                setSelecionados(new Set());
              }}
            >
              Individual
            </Button>
            <Button
              size="sm"
              variant={modo === "lote" ? "default" : "outline"}
              className="rounded-[5px]"
              onClick={() => setModo("lote")}
            >
              Lote
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Ações em lote */}
      {modo === "lote" && (
        <Card className="mb-3 rounded-[5px] border-primary/40 bg-primary/5">
          <CardContent className="flex flex-wrap items-center gap-3 py-3">
            <p className="text-sm">
              <strong>{selecionados.size}</strong> aluno(s) selecionado(s)
            </p>
            <div className="flex flex-wrap gap-2 ml-auto">
              {(Object.keys(TIPO_META) as DiarioTipo[]).map((t) => {
                const m = TIPO_META[t];
                const Icon = m.icon;
                return (
                  <Button
                    key={t}
                    size="sm"
                    variant="outline"
                    className={`rounded-[5px] gap-1 ${m.buttonClass}`}
                    disabled={selecionados.size === 0}
                    onClick={() => abrirModal(t, null, true)}
                  >
                    <Icon className="size-4" /> {m.label}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de alunos */}
      {!activeTurma ? (
        <Card className="rounded-[5px]">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Selecione uma turma para começar.
          </CardContent>
        </Card>
      ) : loadingAlunos ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredAlunos.length === 0 ? (
        <Card className="rounded-[5px]">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {alunos.length === 0
              ? "Esta turma não possui alunos ativos."
              : "Nenhum aluno corresponde à busca."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2">
          {filteredAlunos.map((a) => (
            <Card key={a.id} className="rounded-[5px]">
              <CardContent className="flex flex-wrap items-center gap-3 py-3">
                {modo === "lote" && (
                  <Checkbox
                    checked={selecionados.has(a.id)}
                    onCheckedChange={() => toggleSel(a.id)}
                    aria-label={`Selecionar ${a.nome_completo}`}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{a.nome_completo}</p>
                  {a.matricula && (
                    <p className="text-xs text-muted-foreground">
                      Matrícula: {a.matricula}
                    </p>
                  )}
                </div>
                {modo === "individual" && (
                  <div className="flex flex-wrap gap-1">
                    {(Object.keys(TIPO_META) as DiarioTipo[]).map((t) => {
                      const m = TIPO_META[t];
                      const Icon = m.icon;
                      return (
                        <Button
                          key={t}
                          size="sm"
                          variant="outline"
                          className={`rounded-[5px] gap-1 ${m.buttonClass}`}
                          onClick={() => abrirModal(t, a)}
                          title={m.label}
                        >
                          <Icon className="size-4" />
                          <span className="hidden sm:inline">{m.label}</span>
                        </Button>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Histórico da turma (7 dias) */}
      {activeTurma && historico.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <BookOpen className="size-5 text-muted-foreground" />
            Últimos 7 dias na turma ({historico.length})
          </h2>
          <div className="grid gap-2">
            {historico.slice(0, 30).map((r) => {
              const m = TIPO_META[r.tipo];
              const Icon = m.icon;
              return (
                <Card key={r.id} className={`rounded-[5px] ${m.cardClass}`}>
                  <CardContent className="flex flex-wrap items-start gap-3 py-3">
                    <div
                      className={`flex size-9 items-center justify-center rounded-[5px] ${m.iconBgClass}`}
                      aria-hidden
                    >
                      <Icon className={`size-5 ${m.iconClass}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="rounded-[5px]">
                          {m.label}
                        </Badge>
                        <span className="text-sm font-medium">
                          {r.aluno_nome ?? "Aluno"}
                        </span>
                        {!r.visivel_pais && (
                          <Badge variant="secondary" className="rounded-[5px] text-[10px]">
                            Interno
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-sm">{r.titulo}</p>
                      {r.descricao && (
                        <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                          {r.descricao}
                        </p>
                      )}
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {new Date(r.created_at).toLocaleString("pt-BR")}
                        {r.disciplina ? ` · ${r.disciplina}` : ""}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-red-600"
                      onClick={() => {
                        if (confirm("Remover este registro?"))
                          excluirMut.mutate(r.id);
                      }}
                      aria-label="Excluir registro"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* Modal criação */}
      <Dialog open={!!modal} onOpenChange={(v) => !v && fecharModal()}>
        <DialogContent className="rounded-[5px] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {modal &&
                (modal.lote
                  ? `${TIPO_META[modal.tipo].label} — ${selecionados.size} aluno(s)`
                  : `${TIPO_META[modal.tipo].label} — ${modal.aluno?.nome_completo ?? ""}`)}
            </DialogTitle>
            <DialogDescription>
              Um clique registra e (se visível) notifica os responsáveis.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="titulo">Título</Label>
              <Input
                id="titulo"
                value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                maxLength={200}
              />
            </div>
            <div>
              <Label htmlFor="desc">Descrição (opcional)</Label>
              <Textarea
                id="desc"
                rows={3}
                maxLength={2000}
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                placeholder="Contexto, disciplina, comportamento observado..."
              />
            </div>
            <div>
              <Label htmlFor="disc">Disciplina (opcional)</Label>
              <Input
                id="disc"
                value={form.disciplina}
                onChange={(e) =>
                  setForm({ ...form, disciplina: e.target.value })
                }
                maxLength={80}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.visivel_pais}
                onCheckedChange={(v) =>
                  setForm({ ...form, visivel_pais: v !== false })
                }
              />
              Visível para os responsáveis (envia notificação)
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={fecharModal} disabled={criarMut.isPending}>
              Cancelar
            </Button>
            <Button
              onClick={() => criarMut.mutate()}
              disabled={criarMut.isPending || !form.titulo.trim()}
              className="gap-2"
            >
              {criarMut.isPending && <Loader2 className="size-4 animate-spin" />}
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

// avoid unused import lint on icons re-exported through TIPO_META
void ThumbsUp;
void Hand;
void TrendingUp;
void Eye;
void AlertCircle;
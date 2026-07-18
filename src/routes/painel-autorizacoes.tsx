import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, Plus, Check, X, Loader2, Users } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { PainelLayout } from "@/components/PainelLayout";
import { EscolaShell } from "@/components/escola/EscolaShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useRolePainelGuard } from "@/lib/use-role-guard";
import { useAdminAccessAudit } from "@/lib/use-admin-access-audit";

export const Route = createFileRoute("/painel-autorizacoes")({
  ssr: false,
  head: () => ({ meta: [{ title: "Autorizações | Painel" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: PainelAutorizacoes,
});

type Autorizacao = {
  id: string;
  titulo: string;
  descricao: string;
  data_evento: string | null;
  prazo_resposta: string | null;
  turma_ids: string[];
  aluno_ids: string[];
  ativo: boolean;
  created_at: string;
};

function PainelAutorizacoes() {
  useRolePainelGuard(["diretor", "coordenador", "desenvolvedor"]);
  useAdminAccessAudit("/painel-autorizacoes");
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: autorizacoes, isLoading } = useQuery({
    queryKey: ["painel-autorizacoes"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("autorizacoes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Autorizacao[];
    },
  });

  const { data: turmas } = useQuery({
    queryKey: ["turmas-escolares-todas"],
    queryFn: async () => {
      const { data } = await supabase
        .from("turmas_escolares")
        .select("id, nome, ano_serie, turno")
        .order("nome");
      return data ?? [];
    },
  });

  const criar = useMutation({
    mutationFn: async (payload: {
      titulo: string;
      descricao: string;
      data_evento: string | null;
      prazo_resposta: string | null;
      turma_ids: string[];
    }) => {
      const { error } = await (supabase as any).from("autorizacoes").insert({
        ...payload,
        criado_por: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Autorização criada e enviada aos responsáveis.");
      qc.invalidateQueries({ queryKey: ["painel-autorizacoes"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const toggleAtivo = useMutation({
    mutationFn: async (a: Autorizacao) => {
      const { error } = await (supabase as any)
        .from("autorizacoes")
        .update({ ativo: !a.ativo })
        .eq("id", a.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["painel-autorizacoes"] }),
  });

  return (
    <PainelLayout>
      <EscolaShell
        title="Autorizações digitais"
        description="Envie pedidos de autorização (passeios, saídas) para os responsáveis assinarem online."
      >
        <div className="mb-4 flex justify-end">
          <NovaAutorizacaoDialog
            turmas={turmas ?? []}
            onCreate={(v) => criar.mutate(v)}
            criando={criar.isPending}
          />
        </div>

        {isLoading ? (
          <Skeleton className="h-64 rounded-2xl" />
        ) : !autorizacoes || autorizacoes.length === 0 ? (
          <div className="rounded-2xl border p-8 text-center text-sm text-muted-foreground">
            Nenhuma autorização criada ainda.
          </div>
        ) : (
          <div className="grid gap-3">
            {autorizacoes.map((a) => (
              <AutorizacaoRow key={a.id} autorizacao={a} onToggle={() => toggleAtivo.mutate(a)} />
            ))}
          </div>
        )}
      </EscolaShell>
    </PainelLayout>
  );
}

function NovaAutorizacaoDialog({
  turmas,
  onCreate,
  criando,
}: {
  turmas: { id: string; nome: string }[];
  onCreate: (v: {
    titulo: string;
    descricao: string;
    data_evento: string | null;
    prazo_resposta: string | null;
    turma_ids: string[];
  }) => void;
  criando: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [dataEvento, setDataEvento] = useState("");
  const [prazo, setPrazo] = useState("");
  const [turmaIds, setTurmaIds] = useState<string[]>([]);

  function submit() {
    if (titulo.trim().length < 3) return toast.error("Informe um título.");
    if (descricao.trim().length < 10) return toast.error("Descreva a autorização.");
    onCreate({
      titulo: titulo.trim(),
      descricao: descricao.trim(),
      data_evento: dataEvento || null,
      prazo_resposta: prazo ? new Date(prazo).toISOString() : null,
      turma_ids: turmaIds,
    });
    setOpen(false);
    setTitulo("");
    setDescricao("");
    setDataEvento("");
    setPrazo("");
    setTurmaIds([]);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-full">
          <Plus className="size-4" /> Nova autorização
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova autorização digital</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium">Título</label>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Passeio ao Parque Municipal"
              maxLength={140}
            />
          </div>
          <div>
            <label className="text-xs font-medium">Descrição</label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={4}
              placeholder="Detalhes do evento, horários, local, transporte..."
              maxLength={2000}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium">Data do evento</label>
              <Input
                type="date"
                value={dataEvento}
                onChange={(e) => setDataEvento(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium">Prazo p/ resposta</label>
              <Input
                type="datetime-local"
                value={prazo}
                onChange={(e) => setPrazo(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium">Turmas (deixe vazio para toda a escola)</label>
            <div className="mt-1 flex max-h-40 flex-wrap gap-1 overflow-y-auto rounded-lg border p-2">
              {turmas.map((t) => {
                const on = turmaIds.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() =>
                      setTurmaIds((prev) => (on ? prev.filter((x) => x !== t.id) : [...prev, t.id]))
                    }
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      on
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    {t.nome}
                  </button>
                );
              })}
            </div>
          </div>
          <Button onClick={submit} disabled={criando} className="w-full">
            {criando ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ShieldCheck className="size-4" />
            )}
            Enviar aos responsáveis
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AutorizacaoRow({
  autorizacao,
  onToggle,
}: {
  autorizacao: Autorizacao;
  onToggle: () => void;
}) {
  const { data: stats } = useQuery({
    queryKey: ["aut-stats", autorizacao.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("autorizacao_respostas")
        .select("autorizado")
        .eq("autorizacao_id", autorizacao.id);
      const rows = (data ?? []) as { autorizado: boolean }[];
      return {
        total: rows.length,
        sim: rows.filter((r) => r.autorizado).length,
        nao: rows.filter((r) => !r.autorizado).length,
      };
    },
  });

  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{autorizacao.titulo}</h3>
            {autorizacao.ativo ? (
              <Badge className="bg-emerald-600">Ativa</Badge>
            ) : (
              <Badge variant="secondary">Inativa</Badge>
            )}
          </div>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{autorizacao.descricao}</p>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
            {autorizacao.data_evento && (
              <span>
                Evento:{" "}
                {new Date(autorizacao.data_evento + "T00:00:00").toLocaleDateString("pt-BR")}
              </span>
            )}
            {autorizacao.prazo_resposta && (
              <span>Prazo: {new Date(autorizacao.prazo_resposta).toLocaleString("pt-BR")}</span>
            )}
            <span className="flex items-center gap-1">
              <Users className="size-3" />
              {autorizacao.turma_ids.length === 0
                ? "Todas as turmas"
                : `${autorizacao.turma_ids.length} turma(s)`}
            </span>
          </div>
          {stats && (
            <div className="mt-2 flex gap-2 text-xs">
              <Badge variant="outline">
                <Check className="mr-1 size-3 text-emerald-600" /> {stats.sim} autorizaram
              </Badge>
              <Badge variant="outline">
                <X className="mr-1 size-3 text-destructive" /> {stats.nao} recusaram
              </Badge>
              <Badge variant="outline">Total: {stats.total}</Badge>
            </div>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={onToggle}>
          {autorizacao.ativo ? "Desativar" : "Reativar"}
        </Button>
      </div>
    </div>
  );
}

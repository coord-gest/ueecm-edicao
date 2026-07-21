import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Paperclip, X, ArrowLeft, Send, BookmarkPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  ComunicadoImageCard,
  ComunicadoDownloadImage,
} from "@/components/comunicados/ComunicadoImageCard";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { AccessDenied, EscolaShell } from "@/components/escola/EscolaShell";
import { useServerFn } from "@tanstack/react-start";
import { notifyComunicadoCreated } from "@/lib/comunicado-notify.functions";
import { logger } from "@/lib/logger";

export const Route = createFileRoute("/escola/comunicados/novo")({
  ssr: false,
  head: () => ({ meta: [{ title: "Novo comunicado | Escola" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: NovoComunicadoPage,
});

const MAX_FILE_MB = 15;

type Turma = {
  id: string;
  nome: string;
  ano_letivo: number;
  professor_responsavel_id: string | null;
};
type Aluno = { id: string; nome_completo: string; matricula: string; turma_id: string | null };

function NovoComunicadoPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, hasRole, loading: authLoading } = useAuth();
  const notify = useServerFn(notifyComunicadoCreated);

  const isStaff =
    hasRole("admin") ||
    hasRole("diretor") ||
    hasRole("coordenador") ||
    hasRole("secretario") ||
    hasRole("desenvolvedor");
  const canCreate = isStaff || hasRole("professor");

  const [tipo, setTipo] = useState<"turma" | "individual">("turma");
  const [turmaId, setTurmaId] = useState<string>("");
  const [alunosSelecionados, setAlunosSelecionados] = useState<string[]>([]);
  const [titulo, setTitulo] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [agendarAtivo, setAgendarAtivo] = useState(false);
  const [agendadoPara, setAgendadoPara] = useState<string>("");
  const [lembreteAtivo, setLembreteAtivo] = useState(false);
  const [lembreteHoras, setLembreteHoras] = useState<number>(24);
  const [requerConfirmacao, setRequerConfirmacao] = useState(false);
  const [alertaGestaoHoras, setAlertaGestaoHoras] = useState<number>(48);
  const [submitting, setSubmitting] = useState(false);
  const [templateId, setTemplateId] = useState<string>("");

  const { data: turmas } = useQuery({
    queryKey: ["escola", "turmas-disponiveis", user?.id, isStaff],
    enabled: !!user,
    queryFn: async (): Promise<Turma[]> => {
      let q = supabase
        .from("turmas_escolares")
        .select("id,nome,ano_letivo,professor_responsavel_id")
        .order("nome");
      if (!isStaff && user) q = q.eq("professor_responsavel_id", user.id);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Turma[];
    },
  });

  const { data: alunos } = useQuery({
    queryKey: ["escola", "alunos-da-turma", turmaId],
    enabled: !!turmaId,
    queryFn: async (): Promise<Aluno[]> => {
      const { data, error } = await supabase
        .from("alunos")
        .select("id,nome_completo,matricula,turma_id")
        .eq("turma_id", turmaId)
        .eq("ativo", true)
        .order("nome_completo");
      if (error) throw error;
      return (data ?? []) as Aluno[];
    },
  });

  const templatesQuery = useQuery({
    queryKey: ["escola", "comunicado-templates", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("comunicado_templates")
        .select("id, nome, titulo, mensagem, autor_id, publico")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        nome: string;
        titulo: string;
        mensagem: string;
        autor_id: string;
        publico: boolean;
      }>;
    },
  });

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const t = templatesQuery.data?.find((x) => x.id === id);
    if (t) {
      setTitulo(t.titulo);
      setMensagem(t.mensagem);
    }
  };

  const saveAsTemplate = async () => {
    if (!user) return;
    if (!titulo.trim() || !mensagem.trim()) {
      toast.error("Preencha título e mensagem antes de salvar o modelo.");
      return;
    }
    const nome = window.prompt("Nome do modelo:", titulo.slice(0, 60));
    if (!nome || !nome.trim()) return;
    const { error } = await (supabase as any).from("comunicado_templates").insert({
      autor_id: user.id,
      nome: nome.trim(),
      titulo: titulo.trim(),
      mensagem: mensagem.trim(),
      publico: false,
    });
    if (error) {
      toast.error("Falha ao salvar modelo", { description: error.message });
      return;
    }
    toast.success("Modelo salvo.");
    qc.invalidateQueries({ queryKey: ["escola", "comunicado-templates"] });
  };

  const deleteTemplate = async () => {
    if (!templateId) return;
    if (!window.confirm("Excluir este modelo?")) return;
    const { error } = await (supabase as any)
      .from("comunicado_templates")
      .delete()
      .eq("id", templateId);
    if (error) {
      toast.error("Falha ao excluir", { description: error.message });
      return;
    }
    setTemplateId("");
    toast.success("Modelo excluído.");
    qc.invalidateQueries({ queryKey: ["escola", "comunicado-templates"] });
  };

  const turmaOptions = useMemo(() => turmas ?? [], [turmas]);

  if (authLoading) return null;
  if (!canCreate) return <AccessDenied />;

  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files ?? []);
    const tooLarge = list.find((f) => f.size > MAX_FILE_MB * 1024 * 1024);
    if (tooLarge) {
      toast.error(`Arquivo muito grande: ${tooLarge.name}`, {
        description: `Limite de ${MAX_FILE_MB} MB por anexo.`,
      });
      e.target.value = "";
      return;
    }
    setFiles((cur) => [...cur, ...list]);
    e.target.value = "";
  };

  const removeFile = (idx: number) => setFiles((cur) => cur.filter((_, i) => i !== idx));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!titulo.trim() || !mensagem.trim()) {
      toast.error("Preencha título e mensagem.");
      return;
    }
    if (!turmaId) {
      toast.error("Selecione uma turma.");
      return;
    }
    if (tipo === "individual" && alunosSelecionados.length === 0) {
      toast.error("Selecione ao menos um aluno.");
      return;
    }

    let agendadoIso: string | null = null;
    if (agendarAtivo) {
      if (!agendadoPara) {
        toast.error("Informe a data e hora do agendamento.");
        return;
      }
      const dt = new Date(agendadoPara);
      if (Number.isNaN(dt.getTime())) {
        toast.error("Data de agendamento inválida.");
        return;
      }
      if (dt.getTime() < Date.now() + 30_000) {
        toast.error("Escolha um horário futuro (pelo menos 1 minuto à frente).");
        return;
      }
      agendadoIso = dt.toISOString();
    }

    setSubmitting(true);
    try {
      // Criamos 1 comunicado por destinatário (1 para a turma, ou N para alunos).
      const inserts =
        tipo === "turma"
          ? [{ tipo: "turma" as const, turma_id: turmaId, aluno_id: null }]
          : alunosSelecionados.map((alunoId) => ({
              tipo: "individual" as const,
              turma_id: turmaId,
              aluno_id: alunoId,
            }));

      const created: { id: string }[] = [];
      for (const base of inserts) {
        const { data, error } = await supabase
          .from("comunicados")
          .insert({
            ...base,
            autor_id: user.id,
            titulo: titulo.trim(),
            mensagem: mensagem.trim(),
            anexos: [],
            ...(agendadoIso ? { agendado_para: agendadoIso } : {}),
            ...(lembreteAtivo && lembreteHoras > 0
              ? { lembrete_apos_horas: Math.min(lembreteHoras, 720) }
              : {}),
            ...(requerConfirmacao
              ? {
                  requer_confirmacao: true,
                  alerta_gestao_apos_horas: Math.max(1, Math.min(alertaGestaoHoras, 720)),
                }
              : {}),
          } as never)
          .select("id")
          .single();
        if (error || !data) throw error ?? new Error("Falha ao criar comunicado");
        created.push(data);
      }

      // Upload de anexos para cada comunicado (path: <comunicado_id>/<uuid>-<nome>)
      if (files.length && created.length) {
        for (const c of created) {
          const anexos: { path: string; name: string; size: number; type: string }[] = [];
          for (const f of files) {
            const safeName = f.name.replace(/[^\w.-]+/g, "_");
            const path = `${c.id}/${crypto.randomUUID()}-${safeName}`;
            const { error: upErr } = await supabase.storage
              .from("comunicados-anexos")
              .upload(path, f, { contentType: f.type, upsert: false });
            if (upErr) throw upErr;
            anexos.push({ path, name: f.name, size: f.size, type: f.type });
          }
          const { error: updErr } = await supabase
            .from("comunicados")
            .update({ anexos })
            .eq("id", c.id);
          if (updErr) throw updErr;
        }
      }

      toast.success(
        agendadoIso
          ? `Comunicado agendado para ${new Date(agendadoIso).toLocaleString("pt-BR")}.`
          : created.length === 1
            ? "Comunicado enviado."
            : `${created.length} comunicados enviados.`,
      );

      // Dispara push em segundo plano apenas para envio imediato
      if (!agendadoIso) {
        notify({ data: { titulo: titulo.trim(), count: created.length } }).catch((err) =>
          logger.warn("[comunicado] falha ao notificar:", err),
        );
      }

      navigate({ to: "/escola/comunicados" });
    } catch (err) {
      toast.error("Falha ao enviar comunicado", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <EscolaShell
      title="Novo comunicado"
      description="Envie para uma turma inteira ou para responsáveis específicos"
      actions={
        <Button variant="ghost" onClick={() => navigate({ to: "/escola/comunicados" })}>
          <ArrowLeft className="size-4" /> Voltar
        </Button>
      }
    >
      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-2xl border border-border/70 bg-card p-6 shadow-sm"
      >
        {/* Modelos de comunicado */}
        <div className="rounded-xl border border-dashed border-border bg-secondary/30 p-4 space-y-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Modelos salvos
          </Label>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={templateId} onValueChange={applyTemplate}>
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue placeholder="Usar um modelo…" />
              </SelectTrigger>
              <SelectContent>
                {(templatesQuery.data ?? []).length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    Nenhum modelo salvo ainda.
                  </div>
                ) : (
                  (templatesQuery.data ?? []).map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nome}
                      {t.publico ? " · público" : ""}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={saveAsTemplate}
              aria-label="Salvar como modelo"
            >
              <BookmarkPlus className="size-4" /> Salvar modelo
            </Button>
            {templateId &&
              templatesQuery.data?.find((t) => t.id === templateId)?.autor_id === user?.id && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={deleteTemplate}
                  aria-label="Excluir modelo selecionado"
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
          </div>
        </div>

        <div>
          <Label>Destinatário</Label>
          <RadioGroup
            value={tipo}
            onValueChange={(v) => {
              setTipo(v as "turma" | "individual");
              setAlunosSelecionados([]);
            }}
            className="mt-2 flex gap-6"
          >
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="turma" /> Turma inteira
            </label>
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="individual" /> Pais de alunos específicos
            </label>
          </RadioGroup>
        </div>

        <div className="grid gap-2">
          <Label>Turma</Label>
          <Select
            value={turmaId}
            onValueChange={(v) => {
              setTurmaId(v);
              setAlunosSelecionados([]);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione a turma" />
            </SelectTrigger>
            <SelectContent>
              {turmaOptions.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.nome} — {t.ano_letivo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!turmaOptions.length && (
            <p className="text-xs text-muted-foreground">
              Nenhuma turma disponível {isStaff ? "no sistema." : "sob sua responsabilidade."}
            </p>
          )}
        </div>

        {tipo === "individual" && turmaId && (
          <div className="grid gap-2">
            <Label>Alunos ({alunosSelecionados.length} selecionados)</Label>
            <div className="max-h-56 overflow-y-auto rounded-xl border border-border bg-background p-2">
              {(alunos ?? []).length === 0 ? (
                <p className="p-2 text-xs text-muted-foreground">Nenhum aluno nesta turma.</p>
              ) : (
                (alunos ?? []).map((a) => {
                  const checked = alunosSelecionados.includes(a.id);
                  return (
                    <label
                      key={a.id}
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-accent"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(c) => {
                          setAlunosSelecionados((cur) =>
                            c ? [...cur, a.id] : cur.filter((x) => x !== a.id),
                          );
                        }}
                      />
                      <span>{a.nome_completo}</span>
                      <span className="ml-auto text-xs text-muted-foreground">{a.matricula}</span>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        )}

        <div className="grid gap-2">
          <Label htmlFor="titulo">Título</Label>
          <Input
            id="titulo"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            maxLength={140}
            required
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="mensagem">Mensagem</Label>
          <Textarea
            id="mensagem"
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            rows={6}
            maxLength={4000}
            required
          />
        </div>

        <div className="grid gap-2">
          <Label>Anexos (até {MAX_FILE_MB} MB por arquivo)</Label>
          <div className="flex items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border bg-background px-3 py-2 text-sm hover:bg-accent">
              <Paperclip className="size-4" /> Adicionar arquivos
              <input type="file" multiple className="hidden" onChange={onPickFiles} />
            </label>
            <p className="text-xs text-muted-foreground">{files.length} arquivo(s)</p>
          </div>
          {files.length > 0 && (
            <ul className="space-y-1">
              {files.map((f, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-1.5 text-xs"
                >
                  <span className="truncate">
                    {f.name}{" "}
                    <span className="text-muted-foreground">({Math.round(f.size / 1024)} KB)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-3 rounded-md border p-4">
          <label className="flex items-center gap-2 text-sm font-medium">
            <Checkbox checked={agendarAtivo} onCheckedChange={(v) => setAgendarAtivo(v === true)} />
            Agendar envio para depois
          </label>
          {agendarAtivo && (
            <div className="space-y-1">
              <Label htmlFor="agendado_para">Data e hora do envio</Label>
              <Input
                id="agendado_para"
                type="datetime-local"
                value={agendadoPara}
                min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
                onChange={(e) => setAgendadoPara(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                O push será disparado automaticamente no horário escolhido.
              </p>
            </div>
          )}
        </div>

        <div className="space-y-3 rounded-md border p-4">
          <label className="flex items-center gap-2 text-sm font-medium">
            <Checkbox
              checked={lembreteAtivo}
              onCheckedChange={(v) => setLembreteAtivo(v === true)}
            />
            Reenviar lembrete automático se não for lido
          </label>
          {lembreteAtivo && (
            <div className="space-y-1">
              <Label htmlFor="lembrete_horas">Reenviar após (horas)</Label>
              <Input
                id="lembrete_horas"
                type="number"
                min={1}
                max={720}
                step={1}
                value={lembreteHoras}
                onChange={(e) => setLembreteHoras(Number(e.target.value) || 0)}
                className="max-w-[120px]"
              />
              <p className="text-xs text-muted-foreground">
                Se ninguém abrir o comunicado até esse prazo, um push de lembrete será enviado.
              </p>
            </div>
          )}
        </div>

        {/* Pré-visualização visual do comunicado (como card imagem) */}
        <div className="space-y-3 rounded-xl border border-dashed border-border/70 bg-secondary/30 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Prévia do comunicado
              </Label>
              <p className="text-xs text-muted-foreground">
                Baixe uma imagem pronta para compartilhar em redes sociais.
              </p>
            </div>
            <ComunicadoDownloadImage
              data={{
                titulo: titulo || "Sem título",
                mensagem: mensagem || "Sem mensagem.",
                destino:
                  tipo === "turma"
                    ? `Turma: ${turmas?.find((t) => t.id === turmaId)?.nome ?? "—"}`
                    : `Individual · ${alunosSelecionados.length} aluno(s)`,
                data: new Date(),
              }}
              triggerLabel="Baixar imagem"
              variant="outline"
              size="sm"
              showPreview={false}
            />
          </div>
          <ComunicadoImageCard
            data={{
              titulo: titulo || "Sem título",
              mensagem: mensagem || "Digite sua mensagem para vê-la aqui...",
              destino:
                tipo === "turma"
                  ? `Turma: ${turmas?.find((t) => t.id === turmaId)?.nome ?? "—"}`
                  : `Individual · ${alunosSelecionados.length} aluno(s)`,
              data: new Date(),
            }}
          />
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={submitting}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {agendarAtivo ? "Agendar comunicado" : "Enviar comunicado"}
          </Button>
        </div>
      </form>
    </EscolaShell>
  );
}

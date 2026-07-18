import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Download, Eye, FileUp, Loader2, RefreshCw, Save, User, Users2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
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
import { useAuth } from "@/lib/use-auth";
import { uniqueRealtimeChannelName } from "@/lib/realtime-channel";
import {
  BOLETIM_COLUNAS,
  BOLETIM_DISCIPLINAS,
  type ArquivoTemplate,
} from "@/lib/arquivo-templates";
import {
  updatePreenchimento,
  type AlunoBoletim,
  type ArquivoPreenchimento,
  type ArquivoPreenchimentoDados,
  type NotasBoletimMap,
  isPreenchimentoLegado,
} from "@/lib/arquivo-preenchimentos";
import {
  calcularMediaFinal,
  calcularResultado,
  fmtNota,
  isNotaValida,
} from "@/lib/boletim-calculos";
import { AvaliacaoBimestralPreview } from "./AvaliacaoBimestralPreview";
import { exportBoletimOficial } from "@/lib/arquivo-export.functions";
import { ImportarBoletinsDialog } from "./ImportarBoletinsDialog";
import { syncBoletimToNotasTable } from "@/lib/boletim-sync";

type Props = {
  template: ArquivoTemplate;
  preenchimento: ArquivoPreenchimento;
};

type Presence = { user_id: string; name: string; color: string };

const COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
];

export function AvaliacaoBimestralEditor({ template: _template, preenchimento }: Props) {
  void _template;
  const { user } = useAuth();
  const [titulo, setTitulo] = useState(preenchimento.titulo);
  const [dados, setDados] = useState<ArquivoPreenchimentoDados>(preenchimento.dados);
  const [alunoIdSel, setAlunoIdSel] = useState<string>(
    () => preenchimento.dados.alunos[0]?.id ?? "",
  );
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [presence, setPresence] = useState<Presence[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [showEditAluno, setShowEditAluno] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const applyRemote = useRef(false);
  const saveTimer = useRef<number | null>(null);

  const exportFn = useServerFn(exportBoletimOficial);
  const legado = isPreenchimentoLegado(dados);

  const { data: turma } = useQuery({
    queryKey: ["turma", preenchimento.turma_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("turmas_escolares")
        .select("id, nome, ano_serie, turno, ano_letivo")
        .eq("id", preenchimento.turma_id)
        .maybeSingle();
      return data;
    },
  });

  const myColor = useMemo(() => {
    if (!user) return COLORS[0];
    const n = user.id.charCodeAt(0) + user.id.charCodeAt(1);
    return COLORS[n % COLORS.length];
  }, [user]);

  const scheduleSave = useCallback(
    (nextDados: ArquivoPreenchimentoDados, nextTitulo: string) => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(async () => {
        setSaving(true);
        try {
          await updatePreenchimento(preenchimento.id, {
            dados: nextDados,
            titulo: nextTitulo,
          });
          setSavedAt(new Date());
        } catch (e) {
          console.error(e);
          toast.error("Falha ao salvar. Tente novamente.");
        } finally {
          setSaving(false);
        }
      }, 700);
    },
    [preenchimento.id],
  );

  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel(uniqueRealtimeChannelName(`preenchimento:${preenchimento.id}`), {
      config: { presence: { key: user.id } },
    });

    channel
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "postgres_changes" as any,
        {
          event: "UPDATE",
          schema: "public",
          table: "arquivo_preenchimentos",
          filter: `id=eq.${preenchimento.id}`,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          const row = payload.new;
          if (!row) return;
          if (row.atualizado_por === user.id) return;
          applyRemote.current = true;
          setDados(row.dados);
          setTitulo(row.titulo);
        },
      )
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<Presence>();
        const list = Object.values(state).flatMap((arr) => arr);
        setPresence(list);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: user.id,
            name: user.user_metadata?.display_name || user.email || "Professor(a)",
            color: myColor,
          });
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [preenchimento.id, user, myColor]);

  const alunoSel = useMemo(
    () => dados.alunos.find((a) => a.id === alunoIdSel) ?? dados.alunos[0],
    [dados.alunos, alunoIdSel],
  );

  const notasAluno = useMemo<Record<string, Record<string, string>>>(
    () => (alunoSel ? (dados.notasBoletim?.[alunoSel.id] ?? {}) : {}),
    [dados.notasBoletim, alunoSel],
  );

  function setNota(disciplinaKey: string, coluna: string, valor: string) {
    if (!alunoSel || legado) return;
    // Aceita apenas: vazio, "-", ou número (com , ou .) até 4 chars. Bloqueia letras.
    const limpo = valor.replace(/[^\d.,-]/g, "").slice(0, 4);
    setDados((prev) => {
      const notasAll: NotasBoletimMap = { ...(prev.notasBoletim ?? {}) };
      const noAluno = { ...(notasAll[alunoSel.id] ?? {}) };
      const noDisc = { ...(noAluno[disciplinaKey] ?? {}), [coluna]: limpo };
      noAluno[disciplinaKey] = noDisc;
      notasAll[alunoSel.id] = noAluno;
      const next: ArquivoPreenchimentoDados = { ...prev, notasBoletim: notasAll };
      // Só agenda salvamento se a nota for válida (vazio ou 0–10).
      if (!applyRemote.current && isNotaValida(limpo)) scheduleSave(next, titulo);
      applyRemote.current = false;
      return next;
    });
  }

  // Conta quantas células estão preenchidas com valores fora da faixa 0–10.
  const invalidCount = useMemo(() => {
    let n = 0;
    for (const notasAluno of Object.values(dados.notasBoletim ?? {})) {
      for (const notasDisc of Object.values(notasAluno)) {
        for (const v of Object.values(notasDisc)) {
          if (!isNotaValida(v)) n++;
        }
      }
    }
    return n;
  }, [dados.notasBoletim]);

  function updateAluno(patch: Partial<AlunoBoletim>) {
    if (!alunoSel) return;
    setDados((prev) => {
      const alunos = prev.alunos.map((a) => (a.id === alunoSel.id ? { ...a, ...patch } : a));
      const next = { ...prev, alunos };
      scheduleSave(next, titulo);
      return next;
    });
  }

  async function applyImportedBoletins(
    novasNotas: NotasBoletimMap,
    novosDados: Record<string, Partial<AlunoBoletim>>,
  ) {
    // Constrói o próximo estado de forma síncrona e persiste imediatamente,
    // sem depender do debounce — assim a importação em lote só finaliza quando
    // TUDO estiver no banco e o Relatório Acadêmico já espelha as notas novas.
    const notasAll: NotasBoletimMap = { ...(dados.notasBoletim ?? {}) };
    for (const [alunoId, disciplinas] of Object.entries(novasNotas)) {
      notasAll[alunoId] = { ...(notasAll[alunoId] ?? {}), ...disciplinas };
    }
    const alunos = dados.alunos.map((a) => (novosDados[a.id] ? { ...a, ...novosDados[a.id] } : a));
    const next: ArquivoPreenchimentoDados = { ...dados, notasBoletim: notasAll, alunos };
    setDados(next);
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    setSaving(true);
    try {
      await updatePreenchimento(preenchimento.id, { dados: next, titulo });
      setSavedAt(new Date());
      const alunoIds = next.alunos.map((a) => a.id);
      await syncBoletimToNotasTable(alunoIds, next.notasBoletim ?? {});
    } finally {
      setSaving(false);
    }
  }

  const [resyncing, setResyncing] = useState(false);
  async function resincronizarRelatorio() {
    setResyncing(true);
    try {
      const alunoIds = dados.alunos.map((a) => a.id);
      const r = await syncBoletimToNotasTable(alunoIds, dados.notasBoletim ?? {});
      toast.success(
        `Relatório Acadêmico re-sincronizado: ${r.inseridas} nota(s) gravada(s) para ${alunoIds.length} aluno(s).`,
      );
    } catch (e) {
      console.error(e);
      toast.error("Falha ao re-sincronizar. Tente novamente.");
    } finally {
      setResyncing(false);
    }
  }

  async function saveNow() {
    if (invalidCount > 0) {
      toast.error(`Corrija ${invalidCount} nota(s) fora da faixa 0–10 antes de salvar.`);
      return;
    }
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    setSaving(true);
    try {
      await updatePreenchimento(preenchimento.id, { dados, titulo });
      setSavedAt(new Date());
      // Sincroniza notas do boletim para a tabela `notas` (alimenta relatórios).
      try {
        const alunoIds = dados.alunos.map((a) => a.id);
        await syncBoletimToNotasTable(alunoIds, dados.notasBoletim ?? {});
      } catch (syncErr) {
        console.error("[boletim-sync] falhou:", syncErr);
        toast.warning("Salvo, mas houve falha ao atualizar o relatório acadêmico.");
      }
      toast.success("Alterações salvas.");
    } catch (e) {
      console.error(e);
      toast.error("Falha ao salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  function setObservacoes(v: string) {
    setDados((prev) => {
      const next = { ...prev, observacoes: v };
      scheduleSave(next, titulo);
      return next;
    });
  }

  async function handleExport(todos: boolean) {
    if (!alunoSel && !todos) return;
    if (invalidCount > 0) {
      toast.error(`Corrija ${invalidCount} nota(s) fora da faixa 0–10 antes de exportar.`);
      return;
    }
    setExporting(true);
    try {
      const result = await exportFn({
        data: {
          turmaNome: turma?.nome ?? "",
          anoSerie: turma?.ano_serie ?? "",
          turno: turma?.turno ?? "",
          anoLetivo: turma?.ano_letivo ?? new Date().getFullYear(),
          alunos: todos ? dados.alunos : [alunoSel!],
          notasBoletim: dados.notasBoletim ?? {},
          observacoes: dados.observacoes,
        },
      });
      const bin = atob(result.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Boletim exportado!");
    } catch (e) {
      console.error(e);
      toast.error("Falha ao exportar.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card p-4">
        <div className="min-w-0 flex-1">
          <Label htmlFor="titulo" className="text-xs text-muted-foreground">
            Título
          </Label>
          <Input
            id="titulo"
            value={titulo}
            onChange={(e) => {
              setTitulo(e.target.value);
              scheduleSave(dados, e.target.value);
            }}
            className="mt-1 font-semibold"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {turma?.nome ?? "Turma"} • {turma?.ano_serie ?? ""} • {turma?.turno ?? ""} •{" "}
            {turma?.ano_letivo ?? ""}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            {saving
              ? "Salvando…"
              : savedAt
                ? `Salvo ${savedAt.toLocaleTimeString()}`
                : "Auto-salvamento ativo"}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={resincronizarRelatorio}
            disabled={resyncing || saving}
            title="Reenvia todas as notas do boletim para a tabela usada no Relatório Acadêmico"
          >
            {resyncing ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 size-3.5" />
            )}
            Re-sincronizar Relatório
          </Button>
        </div>
      </div>

      {invalidCount > 0 && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {invalidCount} nota(s) fora da faixa <strong>0–10</strong>. Corrija os campos destacados
          em vermelho — cálculos e exportação estão bloqueados até lá.
        </div>
      )}

      {/* Importação em destaque — 4 bimestres de uma vez */}
      {!legado && dados.alunos.length > 0 && (
        <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                <FileUp className="size-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-foreground sm:text-base">
                  Importar boletins em PDF
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
                  Envie os PDFs dos alunos e a IA preenche{" "}
                  <strong>os 4 bimestres de uma vez</strong> — incluindo recuperações, prova final e
                  dados do aluno (INEP, filiação, nascimento).
                </p>
              </div>
            </div>
            <Button
              onClick={() => setShowImport(true)}
              className="shrink-0 shadow-sm sm:min-w-[180px]"
            >
              <FileUp className="size-4" /> Importar boletins
            </Button>
          </div>
        </div>
      )}

      {presence.length > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
          <Users2 className="size-4 text-primary" />
          <div className="flex -space-x-1.5">
            {presence.slice(0, 6).map((p) => (
              <span
                key={p.user_id}
                title={p.name}
                className="grid size-7 place-items-center rounded-full border-2 border-background text-[11px] font-bold text-white"
                style={{ background: p.color }}
              >
                {(p.name?.[0] ?? "?").toUpperCase()}
              </span>
            ))}
          </div>
          <span className="font-medium text-primary">
            {presence.length === 1 ? "Você está editando" : `${presence.length} pessoas editando`}
          </span>
        </div>
      )}

      {legado && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
          Este preenchimento usa o <strong>modelo antigo</strong> (por área do conhecimento) e está
          em modo somente-leitura. Crie um novo preenchimento para usar o Boletim Oficial.
        </div>
      )}

      {/* Seletor de aluno */}
      {!legado && dados.alunos.length > 0 && (
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/70 bg-card p-4">
          <div className="min-w-[240px] flex-1">
            <Label className="text-xs text-muted-foreground">Aluno(a)</Label>
            <Select value={alunoSel?.id ?? ""} onValueChange={setAlunoIdSel}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {dados.alunos.map((a, i) => (
                  <SelectItem key={a.id} value={a.id}>
                    {i + 1}. {a.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {alunoSel ? (
              <p className="mt-1 text-[11px] text-muted-foreground">
                INEP: {alunoSel.inep || "—"} • Nasc.: {alunoSel.nascimento || "—"} • Mãe:{" "}
                {alunoSel.mae || "—"}
              </p>
            ) : null}
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowEditAluno(true)}>
            <User className="size-4" /> Editar dados do aluno
          </Button>
        </div>
      )}

      {/* Tabela do boletim */}
      {!legado && alunoSel && (
        <div className="overflow-x-auto rounded-2xl border border-border/70 bg-card">
          <table className="w-full min-w-[1100px] border-collapse text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th rowSpan={2} className="border-b border-border/60 p-2 text-left">
                  Disciplina
                </th>
                <th
                  colSpan={BOLETIM_COLUNAS.length}
                  className="border-b border-l border-border/60 p-2"
                >
                  Avaliações
                </th>
                <th rowSpan={2} className="border-b border-l border-border/60 p-2 text-primary">
                  Média Final
                </th>
                <th rowSpan={2} className="border-b border-l border-border/60 p-2 text-primary">
                  Resultado
                </th>
              </tr>
              <tr>
                {BOLETIM_COLUNAS.map((c) => (
                  <th
                    key={c.key}
                    className="w-16 border-b border-l border-border/60 p-1 text-[10px]"
                    title={c.label}
                  >
                    {c.short}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {BOLETIM_DISCIPLINAS.map((d) => {
                const n = notasAluno[d.key] ?? {};
                const linhaInvalida = BOLETIM_COLUNAS.some((c) => !isNotaValida(n[c.key]));
                const mf = linhaInvalida ? null : calcularMediaFinal(n);
                const res = linhaInvalida ? "—" : calcularResultado(n);
                return (
                  <tr key={d.key} className="odd:bg-muted/20">
                    <td className="border-b border-border/40 p-2 font-medium">{d.label}</td>
                    {BOLETIM_COLUNAS.map((c) => {
                      const v = n[c.key] ?? "";
                      const invalido = !isNotaValida(v);
                      return (
                        <td key={c.key} className="border-b border-l border-border/40 p-1">
                          <Input
                            value={v}
                            onChange={(e) => setNota(d.key, c.key, e.target.value)}
                            className={
                              "h-9 text-center " +
                              (invalido
                                ? "border-destructive bg-destructive/10 text-destructive focus-visible:ring-destructive"
                                : "")
                            }
                            inputMode="decimal"
                            placeholder="—"
                            aria-invalid={invalido}
                            title={invalido ? "Nota deve estar entre 0 e 10" : undefined}
                          />
                        </td>
                      );
                    })}
                    <td className="border-b border-l border-border/40 p-2 text-center font-semibold text-primary">
                      {fmtNota(mf) || "—"}
                    </td>
                    <td className="border-b border-l border-border/40 p-2 text-center text-[11px] font-medium text-primary">
                      {res}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Observações */}
      <div>
        <Label htmlFor="obs" className="text-sm">
          Observações
        </Label>
        <Textarea
          id="obs"
          value={dados.observacoes ?? ""}
          onChange={(e) => setObservacoes(e.target.value)}
          rows={3}
          className="mt-1"
          placeholder="Anotações gerais, recuperação, etc."
          disabled={legado}
        />
      </div>

      {/* Ações */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" onClick={() => setShowPreview(true)}>
          <Eye className="size-4" /> Pré-visualizar
        </Button>
        <Button onClick={saveNow} disabled={saving || legado}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Salvar
        </Button>
        <Button
          variant="secondary"
          onClick={() => handleExport(false)}
          disabled={exporting || !alunoSel}
        >
          {exporting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          Exportar aluno
        </Button>
        <Button
          variant="secondary"
          onClick={() => handleExport(true)}
          disabled={exporting || dados.alunos.length === 0}
        >
          {exporting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          Exportar turma
        </Button>
      </div>

      {/* Dialog: editar dados do aluno */}
      <Dialog open={showEditAluno} onOpenChange={setShowEditAluno}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dados do aluno — {alunoSel?.nome}</DialogTitle>
          </DialogHeader>
          {alunoSel && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Nome</Label>
                <Input
                  value={alunoSel.nome}
                  onChange={(e) => updateAluno({ nome: e.target.value })}
                />
              </div>
              <div>
                <Label>INEP</Label>
                <Input
                  value={alunoSel.inep ?? ""}
                  onChange={(e) => updateAluno({ inep: e.target.value })}
                />
              </div>
              <div>
                <Label>Sexo</Label>
                <Select value={alunoSel.sexo ?? ""} onValueChange={(v) => updateAluno({ sexo: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FEMININO">FEMININO</SelectItem>
                    <SelectItem value="MASCULINO">MASCULINO</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nascimento</Label>
                <Input
                  placeholder="DD/MM/AAAA"
                  value={alunoSel.nascimento ?? ""}
                  onChange={(e) => updateAluno({ nascimento: e.target.value })}
                />
              </div>
              <div>
                <Label>Matrícula</Label>
                <Input
                  value={alunoSel.matricula ?? ""}
                  onChange={(e) => updateAluno({ matricula: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <Label>Nome da mãe</Label>
                <Input
                  value={alunoSel.mae ?? ""}
                  onChange={(e) => updateAluno({ mae: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <Label>Nome do pai</Label>
                <Input
                  value={alunoSel.pai ?? ""}
                  onChange={(e) => updateAluno({ pai: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowEditAluno(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Pré-visualização — {alunoSel?.nome}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-auto">
            <AvaliacaoBimestralPreview
              turmaNome={turma?.nome}
              anoSerie={turma?.ano_serie}
              turno={turma?.turno}
              anoLetivo={turma?.ano_letivo}
              aluno={alunoSel}
              dados={dados}
            />
          </div>
        </DialogContent>
      </Dialog>

      <ImportarBoletinsDialog
        open={showImport}
        onOpenChange={setShowImport}
        preenchimentoId={preenchimento.id}
        alunos={dados.alunos}
        onApply={applyImportedBoletins}
      />
    </div>
  );
}

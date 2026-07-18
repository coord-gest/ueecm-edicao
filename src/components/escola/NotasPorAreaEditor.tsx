import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

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
import { supabase } from "@/integrations/supabase/client";
import { AVALIACAO_BIMESTRAL_COLUNAS, type ArquivoTemplate } from "@/lib/arquivo-templates";
import {
  BIMESTRES,
  getNotasDoBimestre,
  updatePreenchimento,
  type ArquivoPreenchimento,
  type ArquivoPreenchimentoDados,
  type NotasMap,
} from "@/lib/arquivo-preenchimentos";
import { isNotaValida } from "@/lib/boletim-calculos";

type Props = {
  template: ArquivoTemplate;
  preenchimento: ArquivoPreenchimento;
};

export function NotasPorAreaEditor({ template, preenchimento }: Props) {
  const [titulo, setTitulo] = useState(preenchimento.titulo);
  const [dados, setDados] = useState<ArquivoPreenchimentoDados>(preenchimento.dados);
  const [bimestre, setBimestre] = useState<number>(preenchimento.bimestre);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const saveTimer = useRef<number | null>(null);

  const colunas = template.colunas ?? AVALIACAO_BIMESTRAL_COLUNAS;

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

  useEffect(
    () => () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    },
    [],
  );

  const notasBim = useMemo<NotasMap>(
    () => getNotasDoBimestre(dados, bimestre, preenchimento.bimestre),
    [dados, bimestre, preenchimento.bimestre],
  );

  function setNota(alunoId: string, areaKey: string, valor: string) {
    const limpo = valor.replace(/[^\d.,-]/g, "").slice(0, 4);
    setDados((prev) => {
      const key = String(bimestre);
      const porBim = { ...(prev.notasPorBimestre ?? {}) };
      // Garante que o mapa inicial cubra o bimestre original do preenchimento.
      if (!porBim[key] && prev.notas && bimestre === preenchimento.bimestre) {
        porBim[key] = { ...prev.notas };
      }
      const mapa = { ...(porBim[key] ?? {}) };
      const linha = { ...(mapa[alunoId] ?? {}), [areaKey]: limpo };
      mapa[alunoId] = linha;
      porBim[key] = mapa;
      const next: ArquivoPreenchimentoDados = { ...prev, notasPorBimestre: porBim };
      if (isNotaValida(limpo)) scheduleSave(next, titulo);
      return next;
    });
  }

  const invalidCount = useMemo(() => {
    let n = 0;
    for (const mapa of Object.values(dados.notasPorBimestre ?? {})) {
      for (const linha of Object.values(mapa)) {
        for (const v of Object.values(linha)) if (!isNotaValida(v)) n++;
      }
    }
    if (dados.notas) {
      for (const linha of Object.values(dados.notas)) {
        for (const v of Object.values(linha)) if (!isNotaValida(v)) n++;
      }
    }
    return n;
  }, [dados.notasPorBimestre, dados.notas]);

  function setObservacoes(v: string) {
    setDados((prev) => {
      const next = { ...prev, observacoes: v };
      scheduleSave(next, titulo);
      return next;
    });
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
      await updatePreenchimento(preenchimento.id, { dados, titulo, bimestre });
      setSavedAt(new Date());
      toast.success("Alterações salvas.");
    } catch (e) {
      console.error(e);
      toast.error("Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
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
          <button
            type="button"
            onClick={saveNow}
            className="inline-flex h-8 items-center rounded-md border border-border/70 bg-background px-3 text-xs font-medium hover:bg-muted"
          >
            Salvar agora
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/70 bg-card p-4">
        <div>
          <Label className="text-xs text-muted-foreground">Bimestre</Label>
          <Select value={String(bimestre)} onValueChange={(v) => setBimestre(Number(v))}>
            <SelectTrigger className="mt-1 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BIMESTRES.map((b) => (
                <SelectItem key={b.value} value={String(b.value)}>
                  {b.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">
          {dados.alunos.length} aluno(s) • {colunas.length} área(s)
        </p>
      </div>

      {invalidCount > 0 && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {invalidCount} nota(s) fora da faixa <strong>0–10</strong>. Corrija antes de salvar.
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-border/70 bg-card">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="border-b border-border/60 p-2 text-left">#</th>
              <th className="border-b border-border/60 p-2 text-left">Aluno(a)</th>
              {colunas.map((c) => (
                <th
                  key={c.key}
                  className="w-24 border-b border-l border-border/60 p-2 text-center"
                  title={c.label}
                >
                  {c.short}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dados.alunos.map((a, i) => (
              <tr key={a.id} className="odd:bg-background even:bg-muted/20">
                <td className="border-b border-border/50 p-2 text-xs text-muted-foreground">
                  {i + 1}
                </td>
                <td className="border-b border-border/50 p-2 font-medium">{a.nome}</td>
                {colunas.map((c) => {
                  const valor = notasBim[a.id]?.[c.key] ?? "";
                  const invalido = valor !== "" && !isNotaValida(valor);
                  return (
                    <td key={c.key} className="border-b border-l border-border/50 p-1">
                      <input
                        value={valor}
                        onChange={(e) => setNota(a.id, c.key, e.target.value)}
                        className={`h-8 w-full rounded-md border bg-background px-2 text-center text-sm outline-none focus:ring-2 focus:ring-primary/40 ${
                          invalido ? "border-destructive bg-destructive/10" : "border-border/70"
                        }`}
                        inputMode="decimal"
                        placeholder="—"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
            {dados.alunos.length === 0 && (
              <tr>
                <td
                  colSpan={colunas.length + 2}
                  className="p-8 text-center text-sm text-muted-foreground"
                >
                  Nenhum aluno vinculado a esta turma.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-2xl border border-border/70 bg-card p-4">
        <Label className="text-xs text-muted-foreground">Observações</Label>
        <Textarea
          className="mt-1"
          rows={3}
          value={dados.observacoes ?? ""}
          onChange={(e) => setObservacoes(e.target.value)}
          placeholder="Observações do bimestre (opcional)"
        />
      </div>
    </div>
  );
}

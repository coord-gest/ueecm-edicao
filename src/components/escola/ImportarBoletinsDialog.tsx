import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, Check, FileText, Loader2, Save, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import {
  importarBoletinsPdf,
  importarBoletinsTexto,
  type ParsedBoletim,
} from "@/lib/boletim-import.functions";
import type { AlunoBoletim, NotasBoletimMap } from "@/lib/arquivo-preenchimentos";

const BUCKET = "boletins-importados";
const MAX_MB = 8;
const MAX_FILES = 30;

type Match = {
  parsed: ParsedBoletim;
  file: File;
  alunoId: string | null; // null quando não bateu
  selecionado: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  preenchimentoId: string;
  alunos: AlunoBoletim[];
  onApply: (
    novasNotas: NotasBoletimMap,
    novosDadosAluno: Record<string, Partial<AlunoBoletim>>,
  ) => Promise<void> | void;
};

/** "Ana  MARIA  d'Ávila" → "anamariadavila" (comparação tolerante). */
function normalizeNome(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error("Falha ao ler arquivo."));
    r.onload = () => {
      const s = String(r.result ?? "");
      resolve(s.split(",", 2)[1] ?? "");
    };
    r.readAsDataURL(file);
  });
}

export function ImportarBoletinsDialog({
  open,
  onOpenChange,
  preenchimentoId,
  alunos,
  onApply,
}: Props) {
  const importarPdf = useServerFn(importarBoletinsPdf);
  const importarTxt = useServerFn(importarBoletinsTexto);
  const [files, setFiles] = useState<File[]>([]);
  const [importing, setImporting] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [salvarNoStorage, setSalvarNoStorage] = useState(false);
  const [applying, setApplying] = useState(false);

  const alunosIndex = useMemo(() => {
    const m = new Map<string, AlunoBoletim>();
    for (const a of alunos) m.set(normalizeNome(a.nome), a);
    return m;
  }, [alunos]);

  function reset() {
    setFiles([]);
    setMatches([]);
    setSalvarNoStorage(false);
  }

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? []);
    const valid: File[] = [];
    for (const f of list) {
      const nome = f.name.toLowerCase();
      const isPdf = f.type === "application/pdf" || nome.endsWith(".pdf");
      const isDocx =
        f.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        nome.endsWith(".docx");
      if (!isPdf && !isDocx) {
        toast.error(`${f.name}: envie PDF ou Word (.docx).`);
        continue;
      }
      if (f.size > MAX_MB * 1024 * 1024) {
        toast.error(`${f.name}: acima de ${MAX_MB} MB.`);
        continue;
      }
      valid.push(f);
    }
    if (valid.length > MAX_FILES) {
      toast.error(`Máx. ${MAX_FILES} arquivos por importação.`);
      valid.length = MAX_FILES;
    }
    setFiles(valid);
    setMatches([]);
    e.target.value = "";
  }

  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  async function handleExtrair() {
    if (files.length === 0) return;
    setImporting(true);
    setProgress({ done: 0, total: files.length });
    const built: Match[] = [];
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          const nome = file.name.toLowerCase();
          const isDocx =
            file.type ===
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
            nome.endsWith(".docx");

          let results: ParsedBoletim[];
          if (isDocx) {
            // Extrai texto do .docx no cliente (mammoth) e envia só texto — leve e sem 429
            const mammoth = await import("mammoth/mammoth.browser");
            const buffer = await file.arrayBuffer();
            const { value: texto } = await mammoth.extractRawText({ arrayBuffer: buffer });
            if (!texto || texto.trim().length < 20) {
              throw new Error("Documento Word vazio ou sem texto legível.");
            }
            const resp = await importarTxt({
              data: { arquivos: [{ filename: file.name, texto: texto.slice(0, 60000) }] },
            });
            results = resp.results;
          } else {
            const base64 = await readAsBase64(file);
            const resp = await importarPdf({
              data: { arquivos: [{ filename: file.name, base64 }] },
            });
            results = resp.results;
          }
          const parsed = results[0] ?? {
            ok: false,
            filename: file.name,
            erro: "resposta vazia",
          };
          const nomeNorm = parsed.nome_completo ? normalizeNome(parsed.nome_completo) : "";
          const aluno = nomeNorm ? alunosIndex.get(nomeNorm) : undefined;
          built.push({
            parsed,
            file,
            alunoId: aluno?.id ?? null,
            selecionado: parsed.ok && !!aluno,
          });
        } catch (e) {
          console.error("[import] falha em", file.name, e);
          built.push({
            parsed: { ok: false, filename: file.name, erro: "falha de rede/timeout" },
            file,
            alunoId: null,
            selecionado: false,
          });
        }
        setProgress({ done: i + 1, total: files.length });
        setMatches([...built]);
      }
      const ok = built.filter((m) => m.selecionado).length;
      const naoBateu = built.filter((m) => m.parsed.ok && !m.alunoId).length;
      const falhou = built.filter((m) => !m.parsed.ok).length;
      toast.success(
        `${ok} boletim(ns) reconhecido(s). ${naoBateu} sem aluno correspondente. ${falhou} com falha.`,
      );
    } finally {
      setImporting(false);
      setProgress(null);
    }
  }

  function toggleSel(idx: number) {
    setMatches((prev) =>
      prev.map((m, i) =>
        i === idx && m.parsed.ok && m.alunoId ? { ...m, selecionado: !m.selecionado } : m,
      ),
    );
  }

  async function uploadPdf(match: Match) {
    const path = `${preenchimentoId}/${match.alunoId ?? "sem-vinculo"}-${Date.now()}-${match.file.name}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, match.file, {
      contentType: match.file.type || "application/octet-stream",
      upsert: false,
    });
    if (error) throw error;
    return path;
  }

  async function handleAplicar() {
    const selecionados = matches.filter((m) => m.selecionado && m.alunoId && m.parsed.notas);
    if (selecionados.length === 0) {
      toast.error("Nenhum boletim válido selecionado.");
      return;
    }
    setApplying(true);
    try {
      const novasNotas: NotasBoletimMap = {};
      const novosDados: Record<string, Partial<AlunoBoletim>> = {};
      for (const m of selecionados) {
        if (!m.alunoId || !m.parsed.notas) continue;
        novasNotas[m.alunoId] = m.parsed.notas;
        const patch: Partial<AlunoBoletim> = {};
        if (m.parsed.inep) patch.inep = m.parsed.inep;
        if (m.parsed.sexo) patch.sexo = m.parsed.sexo;
        if (m.parsed.nascimento) patch.nascimento = m.parsed.nascimento;
        if (m.parsed.mae) patch.mae = m.parsed.mae;
        if (m.parsed.pai) patch.pai = m.parsed.pai;
        if (Object.keys(patch).length > 0) novosDados[m.alunoId] = patch;
      }

      if (salvarNoStorage) {
        let uploadOk = 0;
        for (const m of selecionados) {
          try {
            await uploadPdf(m);
            uploadOk++;
          } catch (e) {
            console.error("upload falhou:", m.file.name, e);
          }
        }
        toast.success(`${uploadOk} PDF(s) salvo(s) no sistema.`);
      }

      await onApply(novasNotas, novosDados);
      toast.success(
        `${selecionados.length} boletim(ns) aplicado(s), notas persistidas e Relatório Acadêmico atualizado.`,
      );
      onOpenChange(false);
      reset();
    } catch (e) {
      console.error(e);
      toast.error("Falha ao aplicar os boletins.");
    } finally {
      setApplying(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar boletins (PDF ou Word)</DialogTitle>
          <DialogDescription>
            Envie um ou mais boletins oficiais em <strong>PDF</strong> ou{" "}
            <strong>Word (.docx)</strong>. O Titinho extrai as notas por disciplina e vincula
            automaticamente aos alunos desta turma pelo nome. Você revisa antes de aplicar.{" "}
            <span className="text-emerald-600 dark:text-emerald-400">
              Dica: arquivos <code>.docx</code> são mais rápidos e não consomem cota do Gemini.
            </span>
          </DialogDescription>
        </DialogHeader>

        {matches.length === 0 && (
          <div className="space-y-3">
            <label
              htmlFor="pdfs"
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border/70 bg-muted/30 p-8 text-center hover:bg-muted/50"
            >
              <Upload className="size-8 text-muted-foreground" />
              <div className="text-sm font-medium">
                Clique para selecionar PDFs / Word ou arraste aqui
              </div>
              <div className="text-xs text-muted-foreground">
                Aceita .pdf e .docx • até {MAX_FILES} arquivos • máx. {MAX_MB} MB cada
              </div>
              <input
                id="pdfs"
                type="file"
                accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx"
                multiple
                className="hidden"
                onChange={onFileInput}
              />
            </label>

            {files.length > 0 && (
              <div className="rounded-xl border border-border/60 bg-card">
                <div className="border-b border-border/60 px-3 py-2 text-xs font-semibold text-muted-foreground">
                  {files.length} arquivo(s) selecionado(s)
                </div>
                <ul className="max-h-52 divide-y divide-border/60 overflow-y-auto">
                  {files.map((f, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                    >
                      <span className="flex items-center gap-2 truncate">
                        <FileText className="size-4 text-primary" />
                        <span className="truncate">{f.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {(f.size / 1024).toFixed(0)} KB
                        </span>
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                        title="Remover"
                        aria-label="Remover arquivo"
                      >
                        <X className="size-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {matches.length > 0 && (
          <div className="space-y-3">
            {(() => {
              const okCount = matches.filter((m) => m.parsed.ok && m.alunoId).length;
              const semVinculo = matches.filter((m) => m.parsed.ok && !m.alunoId).length;
              const falharam = matches.filter((m) => !m.parsed.ok);
              const semVinculoList = matches.filter((m) => m.parsed.ok && !m.alunoId);
              return (
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3">
                    <div className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                      Processados com sucesso
                    </div>
                    <div className="mt-0.5 text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                      {okCount}
                      <span className="ml-1 text-sm font-normal opacity-70">
                        / {matches.length}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
                    <div className="text-xs font-medium text-amber-700 dark:text-amber-300">
                      Sem aluno correspondente
                    </div>
                    <div className="mt-0.5 text-2xl font-bold text-amber-700 dark:text-amber-300">
                      {semVinculo}
                    </div>
                    {semVinculoList.length > 0 && (
                      <ul className="mt-1 max-h-16 overflow-auto text-[10px] leading-snug text-amber-800 dark:text-amber-200">
                        {semVinculoList.slice(0, 6).map((m, i) => (
                          <li key={i} className="truncate">
                            • {m.parsed.nome_completo ?? m.file.name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3">
                    <div className="text-xs font-medium text-destructive">Falhas na extração</div>
                    <div className="mt-0.5 text-2xl font-bold text-destructive">
                      {falharam.length}
                    </div>
                    {falharam.length > 0 && (
                      <ul className="mt-1 max-h-16 overflow-auto text-[10px] leading-snug text-destructive/90">
                        {falharam.slice(0, 6).map((m, i) => (
                          <li
                            key={i}
                            className="truncate"
                            title={`${m.file.name}: ${m.parsed.erro ?? "erro"}`}
                          >
                            • {m.file.name}: {m.parsed.erro ?? "erro"}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              );
            })()}

            <div className="rounded-xl border border-border/60 bg-card">
              <div className="border-b border-border/60 px-3 py-2 text-xs font-semibold text-muted-foreground">
                Revisão — marque os boletins que deseja aplicar
              </div>
              <ul className="divide-y divide-border/60">
                {matches.map((m, i) => {
                  const alunoNome = m.alunoId ? alunos.find((a) => a.id === m.alunoId)?.nome : null;
                  return (
                    <li key={i} className="flex items-start gap-3 p-3 text-sm">
                      <Checkbox
                        checked={m.selecionado}
                        disabled={!m.parsed.ok || !m.alunoId}
                        onCheckedChange={() => toggleSel(i)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <FileText className="size-4 shrink-0 text-primary" />
                          <span className="truncate font-medium">{m.file.name}</span>
                        </div>
                        {m.parsed.ok ? (
                          <div className="mt-1 space-y-0.5 text-xs">
                            <div>
                              <span className="text-muted-foreground">Aluno extraído:</span>{" "}
                              <strong>{m.parsed.nome_completo}</strong>
                            </div>
                            {m.alunoId ? (
                              <div className="text-emerald-600 dark:text-emerald-400">
                                <Check className="mr-1 inline size-3.5" />
                                Vinculado a <strong>{alunoNome}</strong>
                              </div>
                            ) : (
                              <div className="text-amber-600 dark:text-amber-400">
                                <AlertCircle className="mr-1 inline size-3.5" />
                                Nenhum aluno da turma bate com esse nome — será ignorado.
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="mt-1 text-xs text-destructive">
                            <AlertCircle className="mr-1 inline size-3.5" />
                            Falha: {m.parsed.erro ?? "não foi possível extrair."}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/30 p-3">
              <Checkbox
                id="salvar-storage"
                checked={salvarNoStorage}
                onCheckedChange={(v) => setSalvarNoStorage(v === true)}
                className="mt-0.5"
              />
              <div className="text-sm">
                <Label htmlFor="salvar-storage" className="cursor-pointer font-medium">
                  Salvar os arquivos originais no sistema
                </Label>
                <p className="text-xs text-muted-foreground">
                  Marque para arquivar os boletins (PDF ou Word) em <code>{BUCKET}</code> (privado).
                  Se desmarcado, os arquivos são descartados após a extração — apenas as notas ficam
                  no preenchimento.
                </p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {matches.length === 0 ? (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleExtrair} disabled={files.length === 0 || importing}>
                {importing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                {progress
                  ? `Extraindo ${progress.done}/${progress.total}…`
                  : "Extrair notas dos arquivos"}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                onClick={() => {
                  setMatches([]);
                  setFiles([]);
                }}
              >
                <Trash2 className="size-4" /> Recomeçar
              </Button>
              <Button
                onClick={handleAplicar}
                disabled={applying || matches.every((m) => !m.selecionado)}
              >
                {applying ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Aplicar ao preenchimento
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

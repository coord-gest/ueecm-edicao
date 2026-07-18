import { useState } from "react";
import { Loader2, Upload, Download, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  parseFile,
  validateRows,
  downloadCsvTemplate,
  type ParsedRow,
  type ValidationResult,
} from "@/lib/escola-import";
import type { ZodTypeAny, z } from "zod";

type Props<S extends ZodTypeAny> = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  schema: S;
  templateName: string;
  templateHeaders: string[];
  templateExample: string[][];
  onCommit: (rows: z.output<S>[]) => Promise<{ inserted: number; errors: string[] }>;
  /** Campo usado para deduplicação (ex.: "matricula"). */
  dedupeKey?: string;
  /** Função custom que extrai a chave de dedupe (sobrepõe dedupeKey). */
  keyOf?: (row: z.output<S>) => string | null | undefined;
  /** Carrega as chaves já existentes para sinalizar duplicatas antes do commit. */
  loadExistingKeys?: () => Promise<Set<string>>;
};

export function ImportDialog<S extends ZodTypeAny>({
  open,
  onOpenChange,
  title,
  schema,
  templateName,
  templateHeaders,
  templateExample,
  onCommit,
  dedupeKey,
  keyOf,
  loadExistingKeys,
}: Props<S>) {
  const [parsing, setParsing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [validation, setValidation] = useState<ValidationResult<z.output<S>> | null>(null);
  const [rawRows, setRawRows] = useState<ParsedRow[]>([]);

  function reset() {
    setValidation(null);
    setRawRows([]);
  }

  async function handleFile(file: File) {
    setParsing(true);
    try {
      const rows = await parseFile(file);
      if (rows.length === 0) {
        toast.error("Arquivo vazio ou sem linhas válidas.");
        return;
      }
      const existingKeys = loadExistingKeys ? await loadExistingKeys() : undefined;
      const result = validateRows<z.output<S>>(rows, schema, {
        dedupeKey,
        keyOf,
        existingKeys,
      });
      setRawRows(rows);
      setValidation(result);
      if (result.invalid.length > 0) {
        toast.warning(`${result.invalid.length} linha(s) com erro. Corrija antes de importar.`);
      }
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível ler o arquivo.");
    } finally {
      setParsing(false);
    }
  }

  async function handleCommit() {
    if (!validation || validation.valid.length === 0) return;
    setCommitting(true);
    try {
      const result = await onCommit(validation.valid.map((v) => v.row));
      if (result.errors.length > 0) {
        toast.warning(`${result.inserted} importado(s). ${result.errors.length} falha(s).`, {
          description: result.errors.slice(0, 3).join(" • "),
        });
      } else {
        toast.success(`${result.inserted} registro(s) importado(s).`);
      }
      reset();
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Falha ao importar.");
    } finally {
      setCommitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Aceita CSV (.csv) e Excel (.xlsx). Cabeçalhos esperados:{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
              {templateHeaders.join(", ")}
            </code>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => downloadCsvTemplate(templateName, templateHeaders, templateExample)}
          >
            <Download className="size-4" /> Baixar template CSV
          </Button>
          <label className="inline-flex items-center">
            <Input
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="max-w-xs"
              disabled={parsing || committing}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
                e.target.value = "";
              }}
            />
          </label>
          {parsing && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        </div>

        {validation && (
          <div className="space-y-3">
            <div className="flex items-center gap-4 text-sm">
              <span className="inline-flex items-center gap-1 text-emerald-600">
                <CheckCircle2 className="size-4" /> Válidas: {validation.valid.length}
              </span>
              <span className="inline-flex items-center gap-1 text-destructive">
                <AlertTriangle className="size-4" /> Inválidas: {validation.invalid.length}
              </span>
              <span className="text-muted-foreground">Total: {rawRows.length}</span>
            </div>

            {validation.invalid.length > 0 && (
              <div className="max-h-48 overflow-auto rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs">
                <p className="mb-2 font-medium text-destructive">Linhas com erro:</p>
                <ul className="space-y-1">
                  {validation.invalid.slice(0, 50).map((r) => (
                    <li key={r.index}>
                      <strong>Linha {r.index + 2}:</strong> {r.errors.join(" • ")}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {validation.valid.length > 0 && (
              <div className="max-h-48 overflow-auto rounded-md border bg-card p-3 text-xs">
                <p className="mb-2 font-medium">Pré-visualização (primeiras 10):</p>
                <pre className="whitespace-pre-wrap break-words text-[11px]">
                  {JSON.stringify(
                    validation.valid.slice(0, 10).map((v) => v.row),
                    null,
                    2,
                  )}
                </pre>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={committing}>
            Cancelar
          </Button>
          <Button
            onClick={handleCommit}
            disabled={!validation || validation.valid.length === 0 || committing}
          >
            {committing && <Loader2 className="size-4 animate-spin" />}
            <Upload className="size-4" /> Importar {validation?.valid.length ?? 0} registro(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

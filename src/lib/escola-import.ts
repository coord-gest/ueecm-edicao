import Papa from "papaparse";
import { z } from "zod";

export type ParsedRow = Record<string, string | number | null | undefined>;

export async function parseFile(file: File): Promise<ParsedRow[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || name.endsWith(".txt") || file.type === "text/csv") {
    return new Promise<ParsedRow[]>((resolve, reject) => {
      Papa.parse<ParsedRow>(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim().toLowerCase(),
        complete: (result) => resolve(result.data),
        error: (err) => reject(err),
      });
    });
  }
  // Excel — carregado sob demanda para não inflar o bundle inicial.
  // Usamos ExcelJS (mantido, sem CVE de Prototype Pollution como xlsx@0.18.5).
  const ExcelJS = (await import("exceljs")).default;
  const buf = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const sheet = wb.worksheets[0];
  if (!sheet) return [];
  // Cabeçalhos: primeira linha da planilha, normalizados (trim + lowercase).
  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber - 1] = String(cell.value ?? "")
      .trim()
      .toLowerCase();
  });
  const out: ParsedRow[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return; // pula cabeçalho
    const rec: ParsedRow = {};
    let hasAny = false;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const key = headers[colNumber - 1];
      if (!key) return;
      let v = cell.value;
      // Normaliza formatos comuns do ExcelJS (Date, {richText}, {result}, {text}, hyperlink).
      if (v instanceof Date) {
        const y = v.getUTCFullYear();
        const m = String(v.getUTCMonth() + 1).padStart(2, "0");
        const d = String(v.getUTCDate()).padStart(2, "0");
        v = `${y}-${m}-${d}`;
      } else if (v && typeof v === "object") {
        const obj = v as {
          richText?: { text: string }[];
          result?: unknown;
          text?: string;
          hyperlink?: string;
        };
        if (Array.isArray(obj.richText)) v = obj.richText.map((p) => p.text).join("");
        else if (obj.result !== undefined) v = obj.result as string | number;
        else if (typeof obj.text === "string") v = obj.text;
        else if (typeof obj.hyperlink === "string") v = obj.hyperlink;
      }
      const str = v == null ? "" : String(v);
      rec[key] = str;
      if (str !== "") hasAny = true;
    });
    if (hasAny) out.push(rec);
  });
  return out;
}

// ----------- Schemas -----------

const TURNO = ["manha", "tarde", "noite", "integral"] as const;

function normTurno(v: unknown): string {
  const s = String(v ?? "")
    .trim()
    .toLowerCase();
  if (!s) return "manha";
  const noAcc = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (noAcc.startsWith("man")) return "manha";
  if (noAcc.startsWith("tar")) return "tarde";
  if (noAcc.startsWith("noi") || noAcc.startsWith("not")) return "noite";
  if (noAcc.startsWith("int")) return "integral";
  return noAcc;
}

export const turmaRowSchema = z.object({
  nome: z.string().trim().min(1, "Nome obrigatório").max(120),
  ano_serie: z.string().trim().min(1, "Ano/série obrigatório").max(40),
  turno: z.preprocess(
    normTurno,
    z.enum(TURNO, { errorMap: () => ({ message: "Turno inválido" }) }),
  ),
  ano_letivo: z.preprocess((v) => {
    if (v === undefined || v === null || v === "") return new Date().getFullYear();
    const n = Number(v);
    return Number.isFinite(n) ? n : v;
  }, z.number().int().min(2000).max(2100)),
});
export type TurmaRow = z.infer<typeof turmaRowSchema>;

export const alunoRowSchema = z.object({
  matricula: z.string().trim().min(1, "Matrícula obrigatória").max(40),
  nome_completo: z.string().trim().min(1, "Nome obrigatório").max(200),
  turma: z.string().trim().min(1, "Turma obrigatória").max(120),
  data_nascimento: z
    .preprocess(
      (v) => {
        const s = String(v ?? "").trim();
        if (!s) return null;
        // Aceita yyyy-mm-dd ou dd/mm/yyyy
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (m) return `${m[3]}-${m[2]}-${m[1]}`;
        return s;
      },
      z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (use dd/mm/aaaa)")
        .nullable(),
    )
    .optional()
    .nullable(),
});
export type AlunoRow = z.infer<typeof alunoRowSchema>;

// ----------- Validação em lote -----------

export type ValidationResult<T> = {
  ok: boolean;
  valid: { index: number; row: T }[];
  invalid: { index: number; raw: ParsedRow; errors: string[] }[];
};

export function validateRows<T>(
  rows: ParsedRow[],
  schema: z.ZodTypeAny,
  opts?: {
    /** Campo usado para deduplicação (ex.: "matricula", "nome"). */
    dedupeKey?: string;
    /** Chaves já existentes no banco (em minúsculas) para marcar como duplicadas. */
    existingKeys?: Set<string>;
    /** Função custom que extrai a chave de dedupe da linha. */
    keyOf?: (row: T) => string | null | undefined;
  },
): ValidationResult<T> {
  const valid: { index: number; row: T }[] = [];
  const invalid: { index: number; raw: ParsedRow; errors: string[] }[] = [];
  const seen = new Map<string, number>(); // key -> first row index (após cabeçalho)
  rows.forEach((raw, index) => {
    const result = schema.safeParse(raw);
    if (result.success) {
      const row = result.data as T;
      const rawKey = opts?.keyOf
        ? opts.keyOf(row)
        : opts?.dedupeKey
          ? (row as Record<string, unknown>)[opts.dedupeKey]
          : undefined;
      const key = rawKey == null ? "" : String(rawKey).trim().toLowerCase();
      if (key) {
        if (seen.has(key)) {
          invalid.push({
            index,
            raw,
            errors: [`duplicada no arquivo (linha ${(seen.get(key) ?? 0) + 2})`],
          });
          return;
        }
        if (opts?.existingKeys?.has(key)) {
          invalid.push({ index, raw, errors: ["já existe no sistema"] });
          return;
        }
        seen.set(key, index);
      }
      valid.push({ index, row });
    } else {
      invalid.push({
        index,
        raw,
        errors: result.error.errors.map((e) => `${e.path.join(".") || "linha"}: ${e.message}`),
      });
    }
  });
  return { ok: invalid.length === 0, valid, invalid };
}

// ----------- Templates -----------

export function downloadCsvTemplate(filename: string, headers: string[], example: string[][]) {
  const csv = Papa.unparse([headers, ...example]);
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const TURMA_TEMPLATE = {
  headers: ["nome", "ano_serie", "turno", "ano_letivo"],
  example: [
    ["6º A", "6º ano", "manha", String(new Date().getFullYear())],
    ["7º B", "7º ano", "tarde", String(new Date().getFullYear())],
  ],
};

export const ALUNO_TEMPLATE = {
  headers: ["matricula", "nome_completo", "turma", "data_nascimento"],
  example: [
    ["2026001", "Maria da Silva", "6º A", "15/03/2014"],
    ["2026002", "João Souza", "6º A", "22/07/2014"],
  ],
};

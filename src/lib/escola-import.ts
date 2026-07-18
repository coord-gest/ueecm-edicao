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
  // Excel — carregado sob demanda para não inflar o bundle inicial
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });
  return rows.map((r) => {
    const out: ParsedRow = {};
    for (const [k, v] of Object.entries(r)) {
      out[k.trim().toLowerCase()] = (v as string | number | null | undefined) ?? "";
    }
    return out;
  });
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

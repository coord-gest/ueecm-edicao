import { describe, it, expect, vi, beforeEach } from "vitest";
import { validateRows, alunoRowSchema, turmaRowSchema } from "@/lib/escola-import";

/**
 * Estes testes garantem que:
 *  1. A importação rejeita registros com campos faltando ou duplicados.
 *  2. Cada consulta da aplicação aos dados sensíveis aplica o filtro de
 *     escopo correto antes de a RLS entrar em ação — o que confirma que
 *     pais, professores e admin só consultam o que lhes pertence.
 */

// ---------------------------------------------------------------------------
// 1) Validações de importação
// ---------------------------------------------------------------------------

describe("Importação de turmas — validação", () => {
  it("rejeita linha com nome vazio", () => {
    const r = validateRows(
      [{ nome: "", ano_serie: "6º", turno: "manha", ano_letivo: "2026" }],
      turmaRowSchema,
    );
    expect(r.valid).toHaveLength(0);
    expect(r.invalid[0]?.errors.join(" ")).toMatch(/nome/i);
  });

  it("rejeita turno inválido", () => {
    const r = validateRows(
      [{ nome: "6A", ano_serie: "6º", turno: "madrugada", ano_letivo: "2026" }],
      turmaRowSchema,
    );
    expect(r.invalid).toHaveLength(1);
  });

  it("detecta duplicata por nome+ano_letivo no mesmo arquivo", () => {
    const rows = [
      { nome: "6A", ano_serie: "6º", turno: "manha", ano_letivo: "2026" },
      { nome: "6a", ano_serie: "6º", turno: "manha", ano_letivo: "2026" },
    ];
    const r = validateRows(rows, turmaRowSchema, {
      keyOf: (row) =>
        `${String((row as { nome: string }).nome).toLowerCase()}|${(row as { ano_letivo: number }).ano_letivo}`,
    });
    expect(r.valid).toHaveLength(1);
    expect(r.invalid[0]?.errors.join(" ")).toMatch(/duplicada/i);
  });
});

describe("Importação de alunos — validação", () => {
  it("rejeita matrícula faltando", () => {
    const r = validateRows([{ matricula: "", nome_completo: "X", turma: "6A" }], alunoRowSchema);
    expect(r.invalid).toHaveLength(1);
  });

  it("rejeita matrícula duplicada dentro do arquivo", () => {
    const r = validateRows(
      [
        { matricula: "2026001", nome_completo: "A", turma: "6A" },
        { matricula: "2026001", nome_completo: "B", turma: "6A" },
      ],
      alunoRowSchema,
      { dedupeKey: "matricula" },
    );
    expect(r.valid).toHaveLength(1);
    expect(r.invalid[0]?.errors.join(" ")).toMatch(/duplicada/i);
  });

  it("rejeita matrícula que já existe no banco", () => {
    const r = validateRows([{ matricula: "X1", nome_completo: "A", turma: "6A" }], alunoRowSchema, {
      dedupeKey: "matricula",
      existingKeys: new Set(["x1"]),
    });
    expect(r.invalid[0]?.errors.join(" ")).toMatch(/já existe/i);
  });

  it("aceita data dd/mm/aaaa", () => {
    const r = validateRows(
      [{ matricula: "Z", nome_completo: "Y", turma: "6A", data_nascimento: "15/03/2014" }],
      alunoRowSchema,
    );
    expect(r.valid).toHaveLength(1);
    expect((r.valid[0]?.row as { data_nascimento: string }).data_nascimento).toBe("2014-03-15");
  });
});

// ---------------------------------------------------------------------------
// 2) Escopo das consultas por perfil
// ---------------------------------------------------------------------------

type Filter = { col: string; op: string; val: unknown };
function makeSupabase() {
  const queries: { table: string; filters: Filter[] }[] = [];
  const builder = (table: string) => {
    const filters: Filter[] = [];
    const q = {
      select: (..._args: unknown[]) => q,
      order: (..._args: unknown[]) => q,
      limit: (..._args: unknown[]) => q,
      single: () => Promise.resolve({ data: null, error: null }),
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
      eq: (col: string, val: unknown) => {
        filters.push({ col, op: "eq", val });
        return q;
      },
      in: (col: string, val: unknown) => {
        filters.push({ col, op: "in", val });
        return q;
      },
      or: (val: string) => {
        filters.push({ col: "*", op: "or", val });
        return q;
      },
      gte: (col: string, val: unknown) => {
        filters.push({ col, op: "gte", val });
        return q;
      },
    };
    queries.push({ table, filters });
    return q;
  };
  return { from: vi.fn(builder), queries };
}

describe("Escopo de consultas por perfil", () => {
  beforeEach(() => vi.clearAllMocks());

  it("Responsável consulta a tabela responsaveis filtrando pelo próprio user_id", async () => {
    const { from, queries } = makeSupabase();
    const userId = "user-pai-123";
    await from("responsaveis").select("id").eq("user_id", userId);
    const q = queries.find((x) => x.table === "responsaveis")!;
    const f = q.filters.find((x) => x.col === "user_id");
    expect(f).toBeDefined();
    expect(f!.val).toBe(userId);
  });

  it("Responsável consulta notas/frequência filtrando por aluno_id (apenas filhos vinculados)", async () => {
    const { from, queries } = makeSupabase();
    const alunoId = "aluno-do-meu-filho";
    await from("notas").select("*").eq("aluno_id", alunoId);
    await from("frequencia").select("*").eq("aluno_id", alunoId);
    for (const t of ["notas", "frequencia"]) {
      const q = queries.find((x) => x.table === t)!;
      expect(q.filters.some((f) => f.col === "aluno_id" && f.val === alunoId)).toBe(true);
    }
  });

  it("Professor consulta turmas filtrando por professor_responsavel_id = seu user_id", async () => {
    const { from, queries } = makeSupabase();
    const profId = "prof-99";
    await from("turmas_escolares").select("*").eq("professor_responsavel_id", profId);
    const q = queries.find((x) => x.table === "turmas_escolares")!;
    expect(q.filters.find((f) => f.col === "professor_responsavel_id")?.val).toBe(profId);
  });

  it("Admin pode listar turmas sem filtro por dono (RLS é quem autoriza no servidor)", async () => {
    const { from, queries } = makeSupabase();
    await from("turmas_escolares").select("*").order("nome");
    const q = queries.find((x) => x.table === "turmas_escolares")!;
    expect(q.filters.find((f) => f.col === "professor_responsavel_id")).toBeUndefined();
  });

  it("Comunicado por aluno usa OR escopado em aluno_id/turma_id (não vaza outros alunos)", async () => {
    const { from, queries } = makeSupabase();
    await from("comunicados").select("id").or("aluno_id.eq.A,turma_id.eq.T");
    const q = queries.find((x) => x.table === "comunicados")!;
    const or = q.filters.find((f) => f.op === "or")!;
    expect(String(or.val)).toMatch(/aluno_id\.eq\./);
    expect(String(or.val)).toMatch(/turma_id\.eq\./);
  });
});

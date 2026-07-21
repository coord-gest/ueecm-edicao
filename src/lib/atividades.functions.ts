import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Atividade = {
  id: string;
  titulo: string;
  descricao: string | null;
  turma_id: string;
  disciplina: string | null;
  data_entrega: string;
  professor_id: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

export type AtividadeComResumo = Atividade & {
  turma_nome: string | null;
  total_alunos: number;
  total_entregues: number;
};

export type EntregaAluno = {
  aluno_id: string;
  aluno_nome: string;
  aluno_matricula: string | null;
  entregue: boolean;
  entregue_em: string | null;
  observacao: string | null;
};

function ensureId(raw: unknown, field = "id"): string {
  const v = String((raw as Record<string, unknown> | null)?.[field] ?? "").trim();
  if (!v) throw new Error(`Campo ${field} obrigatório`);
  return v;
}

// ==================== LIST ==================== //
export const listAtividades = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AtividadeComResumo[]> => {
    const { data: rows, error } = await context.supabase
      .from("atividades")
      .select("*")
      .eq("ativo", true)
      .order("data_entrega", { ascending: false });
    if (error) throw error;
    const atividades = (rows ?? []) as Atividade[];
    if (atividades.length === 0) return [];

    const turmaIds = Array.from(new Set(atividades.map((a) => a.turma_id)));
    const atividadeIds = atividades.map((a) => a.id);

    const [{ data: turmas }, { data: alunos }, { data: entregas }] = await Promise.all([
      context.supabase.from("turmas_escolares").select("id, nome").in("id", turmaIds),
      context.supabase
        .from("alunos")
        .select("turma_id")
        .in("turma_id", turmaIds)
        .eq("ativo", true),
      context.supabase
        .from("atividade_entregas")
        .select("atividade_id, entregue")
        .in("atividade_id", atividadeIds)
        .eq("entregue", true),
    ]);

    const turmaNome = new Map<string, string>();
    (turmas ?? []).forEach((t) => turmaNome.set(t.id as string, t.nome as string));

    const alunosPorTurma = new Map<string, number>();
    (alunos ?? []).forEach((a) => {
      const k = a.turma_id as string;
      alunosPorTurma.set(k, (alunosPorTurma.get(k) ?? 0) + 1);
    });

    const entreguesPorAtividade = new Map<string, number>();
    (entregas ?? []).forEach((e) => {
      const k = e.atividade_id as string;
      entreguesPorAtividade.set(k, (entreguesPorAtividade.get(k) ?? 0) + 1);
    });

    return atividades.map((a) => ({
      ...a,
      turma_nome: turmaNome.get(a.turma_id) ?? null,
      total_alunos: alunosPorTurma.get(a.turma_id) ?? 0,
      total_entregues: entreguesPorAtividade.get(a.id) ?? 0,
    }));
  });

// ==================== GET ==================== //
export const getAtividade = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => ({ id: ensureId(raw) }))
  .handler(async ({ data, context }): Promise<{ atividade: Atividade; turma_nome: string | null }> => {
    const { data: row, error } = await context.supabase
      .from("atividades")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    if (!row) throw new Error("Atividade não encontrada");
    const { data: turma } = await context.supabase
      .from("turmas_escolares")
      .select("nome")
      .eq("id", (row as Atividade).turma_id)
      .maybeSingle();
    return { atividade: row as Atividade, turma_nome: (turma?.nome as string) ?? null };
  });

// ==================== CREATE ==================== //
type CreateInput = {
  titulo: string;
  descricao: string | null;
  turma_id: string;
  disciplina: string | null;
  data_entrega: string;
};

export const createAtividade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown): CreateInput => {
    if (typeof raw !== "object" || raw === null) throw new Error("Payload inválido");
    const d = raw as Record<string, unknown>;
    const titulo = String(d.titulo ?? "").trim();
    if (titulo.length < 3) throw new Error("Título obrigatório (mín. 3 caracteres)");
    const turma_id = String(d.turma_id ?? "").trim();
    if (!turma_id) throw new Error("Selecione a turma");
    const data_entrega = String(d.data_entrega ?? "").trim();
    if (!data_entrega) throw new Error("Informe a data de entrega");
    return {
      titulo,
      descricao: (d.descricao as string)?.trim() || null,
      turma_id,
      disciplina: (d.disciplina as string)?.trim() || null,
      data_entrega,
    };
  })
  .handler(async ({ data, context }) => {
    const { data: inserted, error } = await context.supabase
      .from("atividades")
      .insert({
        titulo: data.titulo,
        descricao: data.descricao,
        turma_id: data.turma_id,
        disciplina: data.disciplina,
        data_entrega: data.data_entrega,
        professor_id: context.userId,
      })
      .select("*")
      .single();
    if (error) throw error;
    return inserted as Atividade;
  });

// ==================== UPDATE ==================== //
export const updateAtividade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => {
    if (typeof raw !== "object" || raw === null) throw new Error("Payload inválido");
    const d = raw as Record<string, unknown>;
    const id = String(d.id ?? "").trim();
    if (!id) throw new Error("ID obrigatório");
    return {
      id,
      titulo: (d.titulo as string)?.trim() || null,
      descricao: (d.descricao as string)?.trim() ?? null,
      disciplina: (d.disciplina as string)?.trim() ?? null,
      data_entrega: (d.data_entrega as string) || null,
    };
  })
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {};
    if (data.titulo) patch.titulo = data.titulo;
    if (data.descricao !== null) patch.descricao = data.descricao || null;
    if (data.disciplina !== null) patch.disciplina = data.disciplina || null;
    if (data.data_entrega) patch.data_entrega = data.data_entrega;
    const { error } = await context.supabase.from("atividades").update(patch).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ==================== DELETE ==================== //
export const deleteAtividade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => ({ id: ensureId(raw) }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("atividades").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ==================== LIST ENTREGAS ==================== //
export const listEntregas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => ({ atividade_id: ensureId(raw, "atividade_id") }))
  .handler(async ({ data, context }): Promise<EntregaAluno[]> => {
    const { data: atividade, error: aErr } = await context.supabase
      .from("atividades")
      .select("turma_id")
      .eq("id", data.atividade_id)
      .maybeSingle();
    if (aErr) throw aErr;
    if (!atividade) throw new Error("Atividade não encontrada");

    const [{ data: alunos, error: alunosErr }, { data: entregas, error: entErr }] =
      await Promise.all([
        context.supabase
          .from("alunos")
          .select("id, nome_completo, matricula")
          .eq("turma_id", (atividade as { turma_id: string }).turma_id)
          .eq("ativo", true)
          .order("nome_completo"),
        context.supabase
          .from("atividade_entregas")
          .select("aluno_id, entregue, entregue_em, observacao")
          .eq("atividade_id", data.atividade_id),
      ]);
    if (alunosErr) throw alunosErr;
    if (entErr) throw entErr;

    const entregasPorAluno = new Map<
      string,
      { entregue: boolean; entregue_em: string | null; observacao: string | null }
    >();
    (entregas ?? []).forEach((e) =>
      entregasPorAluno.set(e.aluno_id as string, {
        entregue: Boolean(e.entregue),
        entregue_em: (e.entregue_em as string) ?? null,
        observacao: (e.observacao as string) ?? null,
      }),
    );

    return (alunos ?? []).map((a) => {
      const e = entregasPorAluno.get(a.id as string);
      return {
        aluno_id: a.id as string,
        aluno_nome: a.nome_completo as string,
        aluno_matricula: (a.matricula as string) ?? null,
        entregue: e?.entregue ?? false,
        entregue_em: e?.entregue_em ?? null,
        observacao: e?.observacao ?? null,
      };
    });
  });

// ==================== UPSERT ENTREGA ==================== //
export const upsertEntrega = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => {
    if (typeof raw !== "object" || raw === null) throw new Error("Payload inválido");
    const d = raw as Record<string, unknown>;
    return {
      atividade_id: String(d.atividade_id ?? "").trim(),
      aluno_id: String(d.aluno_id ?? "").trim(),
      entregue: Boolean(d.entregue),
      observacao: (d.observacao as string)?.trim() || null,
    };
  })
  .handler(async ({ data, context }) => {
    if (!data.atividade_id || !data.aluno_id) throw new Error("IDs obrigatórios");
    if (!data.entregue) {
      const { error } = await context.supabase
        .from("atividade_entregas")
        .delete()
        .eq("atividade_id", data.atividade_id)
        .eq("aluno_id", data.aluno_id);
      if (error) throw error;
      return { ok: true, entregue: false };
    }
    const { error } = await context.supabase.from("atividade_entregas").upsert(
      {
        atividade_id: data.atividade_id,
        aluno_id: data.aluno_id,
        entregue: true,
        entregue_em: new Date().toISOString(),
        observacao: data.observacao,
        marcado_por: context.userId,
      },
      { onConflict: "atividade_id,aluno_id" },
    );
    if (error) throw error;
    return { ok: true, entregue: true };
  });

// ==================== AÇÕES EM LOTE ==================== //
export const marcarTodosEntregues = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => ({ atividade_id: ensureId(raw, "atividade_id") }))
  .handler(async ({ data, context }) => {
    const { data: atividade, error: aErr } = await context.supabase
      .from("atividades")
      .select("turma_id")
      .eq("id", data.atividade_id)
      .maybeSingle();
    if (aErr) throw aErr;
    if (!atividade) throw new Error("Atividade não encontrada");

    const { data: alunos, error: alunosErr } = await context.supabase
      .from("alunos")
      .select("id")
      .eq("turma_id", (atividade as { turma_id: string }).turma_id)
      .eq("ativo", true);
    if (alunosErr) throw alunosErr;

    const rows = (alunos ?? []).map((a) => ({
      atividade_id: data.atividade_id,
      aluno_id: a.id as string,
      entregue: true,
      entregue_em: new Date().toISOString(),
      marcado_por: context.userId,
    }));
    if (rows.length === 0) return { ok: true, count: 0 };
    const { error } = await context.supabase
      .from("atividade_entregas")
      .upsert(rows, { onConflict: "atividade_id,aluno_id" });
    if (error) throw error;
    return { ok: true, count: rows.length };
  });

export const limparEntregas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => ({ atividade_id: ensureId(raw, "atividade_id") }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("atividade_entregas")
      .delete()
      .eq("atividade_id", data.atividade_id);
    if (error) throw error;
    return { ok: true };
  });

// ==================== TURMAS DO PROFESSOR (para o form) ==================== //
export const listTurmasParaAtividade = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("turmas_escolares")
      .select("id, nome, ano_serie, turno")
      .order("nome");
    if (error) throw error;
    return (data ?? []) as Array<{
      id: string;
      nome: string;
      ano_serie: string | null;
      turno: string | null;
    }>;
  });
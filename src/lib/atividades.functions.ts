import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { hasAnyRole, normalizeRoles } from "@/lib/roles";

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
  .validator((raw: unknown) => ({ id: ensureId(raw) }))
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
  .validator((raw: unknown): CreateInput => {
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
  .validator((raw: unknown) => {
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
    const patch: {
      titulo?: string;
      descricao?: string | null;
      disciplina?: string | null;
      data_entrega?: string;
    } = {};
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
  .validator((raw: unknown) => ({ id: ensureId(raw) }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("atividades").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ==================== LIST ENTREGAS ==================== //
export const listEntregas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) => ({ atividade_id: ensureId(raw, "atividade_id") }))
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
  .validator((raw: unknown) => {
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
  .validator((raw: unknown) => ({ atividade_id: ensureId(raw, "atividade_id") }))
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
  .validator((raw: unknown) => ({ atividade_id: ensureId(raw, "atividade_id") }))
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

// ==================== RESPONSÁVEIS: atividades dos filhos ==================== //
export type AtividadeFilho = {
  atividade_id: string;
  titulo: string;
  descricao: string | null;
  disciplina: string | null;
  data_entrega: string;
  turma_id: string;
  turma_nome: string | null;
  aluno_id: string;
  aluno_nome: string;
  entregue: boolean;
  entregue_em: string | null;
  observacao: string | null;
};

export const listAtividadesDoResponsavel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AtividadeFilho[]> => {
    // 1. Descobre os alunos vinculados ao responsável logado
    const { data: resp, error: respErr } = await context.supabase
      .from("responsaveis")
      .select("id")
      .eq("user_id", context.userId);
    if (respErr) throw respErr;
    const responsavelIds = (resp ?? []).map((r) => r.id as string);
    if (responsavelIds.length === 0) return [];

    const { data: vinculos, error: vErr } = await context.supabase
      .from("aluno_responsavel")
      .select("aluno_id")
      .in("responsavel_id", responsavelIds);
    if (vErr) throw vErr;
    const alunoIds = Array.from(new Set((vinculos ?? []).map((v) => v.aluno_id as string)));
    if (alunoIds.length === 0) return [];

    const { data: alunos, error: alunosErr } = await context.supabase
      .from("alunos")
      .select("id, nome_completo, turma_id, ativo")
      .in("id", alunoIds)
      .eq("ativo", true);
    if (alunosErr) throw alunosErr;
    const alunosAtivos = alunos ?? [];
    if (alunosAtivos.length === 0) return [];

    const turmaIds = Array.from(new Set(alunosAtivos.map((a) => a.turma_id as string).filter(Boolean)));
    if (turmaIds.length === 0) return [];

    // 2. Busca atividades e turmas em paralelo
    const [{ data: atividades, error: atErr }, { data: turmas }] = await Promise.all([
      context.supabase
        .from("atividades")
        .select("id, titulo, descricao, disciplina, data_entrega, turma_id")
        .in("turma_id", turmaIds)
        .eq("ativo", true)
        .order("data_entrega", { ascending: false }),
      context.supabase.from("turmas_escolares").select("id, nome").in("id", turmaIds),
    ]);
    if (atErr) throw atErr;
    const listaAtividades = atividades ?? [];
    if (listaAtividades.length === 0) return [];

    // 3. Busca entregas dos filhos para essas atividades
    const atividadeIds = listaAtividades.map((a) => a.id as string);
    const { data: entregas, error: entErr } = await context.supabase
      .from("atividade_entregas")
      .select("atividade_id, aluno_id, entregue, entregue_em, observacao")
      .in("atividade_id", atividadeIds)
      .in("aluno_id", alunosAtivos.map((a) => a.id as string));
    if (entErr) throw entErr;

    const turmaNome = new Map<string, string>();
    (turmas ?? []).forEach((t) => turmaNome.set(t.id as string, t.nome as string));

    const entregaKey = (atId: string, alId: string) => `${atId}|${alId}`;
    const entregasMap = new Map<string, { entregue: boolean; entregue_em: string | null; observacao: string | null }>();
    (entregas ?? []).forEach((e) => {
      entregasMap.set(entregaKey(e.atividade_id as string, e.aluno_id as string), {
        entregue: Boolean(e.entregue),
        entregue_em: (e.entregue_em as string) ?? null,
        observacao: (e.observacao as string) ?? null,
      });
    });

    // 4. Cross-join filho × atividade da sua turma
    const result: AtividadeFilho[] = [];
    for (const aluno of alunosAtivos) {
      for (const at of listaAtividades) {
        if (at.turma_id !== aluno.turma_id) continue;
        const e = entregasMap.get(entregaKey(at.id as string, aluno.id as string));
        result.push({
          atividade_id: at.id as string,
          titulo: at.titulo as string,
          descricao: (at.descricao as string) ?? null,
          disciplina: (at.disciplina as string) ?? null,
          data_entrega: at.data_entrega as string,
          turma_id: at.turma_id as string,
          turma_nome: turmaNome.get(at.turma_id as string) ?? null,
          aluno_id: aluno.id as string,
          aluno_nome: aluno.nome_completo as string,
          entregue: e?.entregue ?? false,
          entregue_em: e?.entregue_em ?? null,
          observacao: e?.observacao ?? null,
        });
      }
    }
    return result;
  });
// ==================== GESTÃO ESCOLAR: RANKING DE ALUNOS ==================== //
export type RankingAluno = {
  aluno_id: string;
  aluno_nome: string;
  matricula: string | null;
  turma_id: string | null;
  turma_nome: string | null;
  total_atribuidas: number;
  total_entregues: number;
  taxa: number; // 0..1
};

export type RankingTurma = {
  turma_id: string;
  turma_nome: string;
  total_alunos: number;
  total_atribuidas: number; // atividades ativas x alunos
  total_entregues: number;
  taxa: number; // 0..1
};

export type RankingGeral = {
  totais: {
    atividades: number;
    entregas: number;
    alunos: number;
    turmas: number;
    taxa: number;
  };
  alunos: RankingAluno[];
  turmas: RankingTurma[];
};

export const rankingAtividades = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RankingGeral> => {
    // 1) Verifica papel (gestão escolar)
    const { data: roleRows, error: roleErr } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (roleErr) throw roleErr;
    const roles = normalizeRoles((roleRows ?? []).map((r) => r.role as string));
    if (
      !hasAnyRole(roles, [
        "desenvolvedor",
        "admin",
        "diretor",
        "coordenador",
        "secretario",
      ])
    ) {
      throw new Error("Acesso restrito à gestão escolar.");
    }

    // 2) Carrega atividades ativas, alunos ativos, turmas e entregas
    const [{ data: ativs, error: aErr }, { data: alunos, error: alErr }, { data: turmas }] =
      await Promise.all([
        context.supabase.from("atividades").select("id, turma_id").eq("ativo", true),
        context.supabase
          .from("alunos")
          .select("id, nome_completo, matricula, turma_id")
          .eq("ativo", true),
        context.supabase.from("turmas_escolares").select("id, nome"),
      ]);
    if (aErr) throw aErr;
    if (alErr) throw alErr;

    const atividades = ativs ?? [];
    const alunosAtivos = alunos ?? [];
    const turmasRows = turmas ?? [];

    const atividadeIds = atividades.map((a) => a.id as string);
    const { data: entregas, error: entErr } = atividadeIds.length
      ? await context.supabase
          .from("atividade_entregas")
          .select("atividade_id, aluno_id, entregue")
          .in("atividade_id", atividadeIds)
          .eq("entregue", true)
      : { data: [] as Array<{ atividade_id: string; aluno_id: string; entregue: boolean }>, error: null };
    if (entErr) throw entErr;

    // 3) Mapas auxiliares
    const turmaNome = new Map<string, string>();
    turmasRows.forEach((t) => turmaNome.set(t.id as string, (t.nome as string) ?? ""));

    // atividades por turma
    const ativsPorTurma = new Map<string, number>();
    atividades.forEach((a) => {
      const k = a.turma_id as string;
      ativsPorTurma.set(k, (ativsPorTurma.get(k) ?? 0) + 1);
    });

    // entregas por aluno
    const entregasPorAluno = new Map<string, number>();
    (entregas ?? []).forEach((e) => {
      const k = e.aluno_id as string;
      entregasPorAluno.set(k, (entregasPorAluno.get(k) ?? 0) + 1);
    });

    // 4) Ranking por aluno
    const alunosRanking: RankingAluno[] = alunosAtivos.map((al) => {
      const turmaId = (al.turma_id as string) ?? null;
      const atribuidas = turmaId ? ativsPorTurma.get(turmaId) ?? 0 : 0;
      const entreguesN = entregasPorAluno.get(al.id as string) ?? 0;
      return {
        aluno_id: al.id as string,
        aluno_nome: (al.nome_completo as string) ?? "",
        matricula: (al.matricula as string) ?? null,
        turma_id: turmaId,
        turma_nome: turmaId ? turmaNome.get(turmaId) ?? null : null,
        total_atribuidas: atribuidas,
        total_entregues: entreguesN,
        taxa: atribuidas > 0 ? entreguesN / atribuidas : 0,
      };
    });

    alunosRanking.sort((a, b) => {
      if (b.total_entregues !== a.total_entregues) return b.total_entregues - a.total_entregues;
      if (b.taxa !== a.taxa) return b.taxa - a.taxa;
      return a.aluno_nome.localeCompare(b.aluno_nome, "pt-BR");
    });

    // 5) Ranking por turma
    const alunosPorTurmaCount = new Map<string, number>();
    const entreguesPorTurma = new Map<string, number>();
    alunosAtivos.forEach((al) => {
      const k = (al.turma_id as string) ?? "";
      if (!k) return;
      alunosPorTurmaCount.set(k, (alunosPorTurmaCount.get(k) ?? 0) + 1);
      entreguesPorTurma.set(
        k,
        (entreguesPorTurma.get(k) ?? 0) + (entregasPorAluno.get(al.id as string) ?? 0),
      );
    });

    const turmasRanking: RankingTurma[] = Array.from(alunosPorTurmaCount.keys()).map((tid) => {
      const alunosN = alunosPorTurmaCount.get(tid) ?? 0;
      const ativsN = ativsPorTurma.get(tid) ?? 0;
      const atribuidas = alunosN * ativsN;
      const entreguesN = entreguesPorTurma.get(tid) ?? 0;
      return {
        turma_id: tid,
        turma_nome: turmaNome.get(tid) ?? "",
        total_alunos: alunosN,
        total_atribuidas: atribuidas,
        total_entregues: entreguesN,
        taxa: atribuidas > 0 ? entreguesN / atribuidas : 0,
      };
    });

    turmasRanking.sort((a, b) => {
      if (b.taxa !== a.taxa) return b.taxa - a.taxa;
      if (b.total_entregues !== a.total_entregues) return b.total_entregues - a.total_entregues;
      return a.turma_nome.localeCompare(b.turma_nome, "pt-BR");
    });

    const totalAtribuidas = alunosRanking.reduce((s, r) => s + r.total_atribuidas, 0);
    const totalEntregues = alunosRanking.reduce((s, r) => s + r.total_entregues, 0);

    return {
      totais: {
        atividades: atividades.length,
        entregas: totalEntregues,
        alunos: alunosAtivos.length,
        turmas: alunosPorTurmaCount.size,
        taxa: totalAtribuidas > 0 ? totalEntregues / totalAtribuidas : 0,
      },
      alunos: alunosRanking,
      turmas: turmasRanking,
    };
  });

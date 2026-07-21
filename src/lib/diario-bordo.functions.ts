import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DiarioTipo =
  | "elogio"
  | "participacao"
  | "avanco"
  | "observacao"
  | "atencao";

export type DiarioRegistro = {
  id: string;
  aluno_id: string;
  aluno_nome?: string | null;
  turma_id: string;
  turma_nome?: string | null;
  autor_id: string;
  autor_nome: string | null;
  data_registro: string;
  tipo: DiarioTipo;
  titulo: string;
  descricao: string | null;
  disciplina: string | null;
  visivel_pais: boolean;
  created_at: string;
};

export type AlunoTurma = {
  id: string;
  nome_completo: string;
  matricula: string | null;
};

export type TurmaProfessor = {
  id: string;
  nome: string;
  turno: string | null;
};

export type FilhoResumo = {
  aluno_id: string;
  aluno_nome: string;
  turma_nome: string | null;
  nao_lidos: number;
};

function s(raw: unknown, field: string): string {
  const v = String((raw as Record<string, unknown> | null)?.[field] ?? "").trim();
  if (!v) throw new Error(`Campo ${field} obrigatório`);
  return v;
}

function optStr(raw: unknown, field: string): string | null {
  const v = (raw as Record<string, unknown> | null)?.[field];
  if (v === null || v === undefined) return null;
  const t = String(v).trim();
  return t.length ? t : null;
}

const TIPOS: readonly DiarioTipo[] = [
  "elogio",
  "participacao",
  "avanco",
  "observacao",
  "atencao",
] as const;

function ensureTipo(raw: unknown): DiarioTipo {
  const v = String((raw as Record<string, unknown> | null)?.tipo ?? "").trim();
  if (!TIPOS.includes(v as DiarioTipo)) throw new Error("Tipo inválido");
  return v as DiarioTipo;
}

// ==================== TURMAS DO PROFESSOR ==================== //
export const listTurmasDoProfessor = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TurmaProfessor[]> => {
    const { data, error } = await context.supabase
      .from("turmas_escolares")
      .select("id, nome, turno")
      .eq("professor_responsavel_id", context.userId)
      .order("nome");
    if (error) throw error;
    return (data ?? []) as TurmaProfessor[];
  });

// ==================== ALUNOS DA TURMA ==================== //
export const listAlunosDaTurma = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) => ({ turma_id: s(raw, "turma_id") }))
  .handler(async ({ data, context }): Promise<AlunoTurma[]> => {
    const { data: alunos, error } = await context.supabase
      .from("alunos")
      .select("id, nome_completo, matricula")
      .eq("turma_id", data.turma_id)
      .eq("ativo", true)
      .order("nome_completo");
    if (error) throw error;
    return (alunos ?? []) as AlunoTurma[];
  });

// ==================== CREATE REGISTRO ==================== //
export const createRegistro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) => ({
    aluno_id: s(raw, "aluno_id"),
    turma_id: s(raw, "turma_id"),
    tipo: ensureTipo(raw),
    titulo: s(raw, "titulo").slice(0, 200),
    descricao: optStr(raw, "descricao")?.slice(0, 2000) ?? null,
    disciplina: optStr(raw, "disciplina")?.slice(0, 80) ?? null,
    visivel_pais: (raw as { visivel_pais?: boolean })?.visivel_pais !== false,
  }))
  .handler(async ({ data, context }) => {
    // nome do autor (fallback ao email)
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("display_name, email")
      .eq("id", context.userId)
      .maybeSingle();
    const autor_nome =
      (profile?.display_name as string) ||
      (profile?.email as string) ||
      null;

    const { data: row, error } = await context.supabase
      .from("diario_bordo")
      .insert({
        aluno_id: data.aluno_id,
        turma_id: data.turma_id,
        autor_id: context.userId,
        autor_nome,
        tipo: data.tipo,
        titulo: data.titulo,
        descricao: data.descricao,
        disciplina: data.disciplina,
        visivel_pais: data.visivel_pais,
      })
      .select()
      .single();
    if (error) throw error;
    return row as DiarioRegistro;
  });

// ==================== CREATE EM LOTE ==================== //
export const createRegistroLote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) => {
    const alunos_ids = (raw as { alunos_ids?: unknown })?.alunos_ids;
    if (!Array.isArray(alunos_ids) || alunos_ids.length === 0) {
      throw new Error("Selecione ao menos um aluno");
    }
    if (alunos_ids.length > 60) throw new Error("Máximo 60 alunos por lote");
    const ids = alunos_ids.map((v) => String(v).trim()).filter(Boolean);
    return {
      alunos_ids: ids,
      turma_id: s(raw, "turma_id"),
      tipo: ensureTipo(raw),
      titulo: s(raw, "titulo").slice(0, 200),
      descricao: optStr(raw, "descricao")?.slice(0, 2000) ?? null,
      disciplina: optStr(raw, "disciplina")?.slice(0, 80) ?? null,
      visivel_pais: (raw as { visivel_pais?: boolean })?.visivel_pais !== false,
    };
  })
  .handler(async ({ data, context }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("display_name, email")
      .eq("id", context.userId)
      .maybeSingle();
    const autor_nome =
      (profile?.display_name as string) ||
      (profile?.email as string) ||
      null;

    const rows = data.alunos_ids.map((aluno_id) => ({
      aluno_id,
      turma_id: data.turma_id,
      autor_id: context.userId,
      autor_nome,
      tipo: data.tipo,
      titulo: data.titulo,
      descricao: data.descricao,
      disciplina: data.disciplina,
      visivel_pais: data.visivel_pais,
    }));

    const { error, count } = await context.supabase
      .from("diario_bordo")
      .insert(rows, { count: "exact" });
    if (error) throw error;
    return { ok: true, count: count ?? rows.length };
  });

// ==================== LIST DA TURMA (professor) ==================== //
export const listRegistrosTurma = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) => ({
    turma_id: s(raw, "turma_id"),
    dias: Number((raw as { dias?: unknown })?.dias ?? 7) || 7,
  }))
  .handler(async ({ data, context }): Promise<DiarioRegistro[]> => {
    const since = new Date();
    since.setDate(since.getDate() - Math.max(1, Math.min(365, data.dias)));

    const { data: registros, error } = await context.supabase
      .from("diario_bordo")
      .select("*")
      .eq("turma_id", data.turma_id)
      .gte("data_registro", since.toISOString().slice(0, 10))
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;

    const alunoIds = Array.from(
      new Set((registros ?? []).map((r) => r.aluno_id as string)),
    );
    const { data: alunos } = alunoIds.length
      ? await context.supabase
          .from("alunos")
          .select("id, nome_completo")
          .in("id", alunoIds)
      : { data: [] };
    const nomes = new Map<string, string>();
    (alunos ?? []).forEach((a) =>
      nomes.set(a.id as string, a.nome_completo as string),
    );

    return (registros ?? []).map((r) => ({
      ...(r as DiarioRegistro),
      aluno_nome: nomes.get(r.aluno_id as string) ?? null,
    }));
  });

// ==================== FILHOS DO RESPONSÁVEL ==================== //
export const listFilhosDoResponsavel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FilhoResumo[]> => {
    // Descobre o responsavel_id vinculado ao user logado
    const { data: resp, error: rErr } = await context.supabase
      .from("responsaveis")
      .select("id")
      .eq("user_id", context.userId);
    if (rErr) throw rErr;
    const respIds = (resp ?? []).map((r) => r.id as string);
    if (respIds.length === 0) return [];

    const { data: vinculos, error: vErr } = await context.supabase
      .from("aluno_responsavel")
      .select("aluno_id")
      .in("responsavel_id", respIds);
    if (vErr) throw vErr;

    const alunoIds = Array.from(
      new Set((vinculos ?? []).map((v) => v.aluno_id as string)),
    );
    if (alunoIds.length === 0) return [];

    const { data: alunos, error: aErr } = await context.supabase
      .from("alunos")
      .select("id, nome_completo, turma_id")
      .in("id", alunoIds)
      .eq("ativo", true)
      .order("nome_completo");
    if (aErr) throw aErr;

    const turmaIds = Array.from(
      new Set((alunos ?? []).map((a) => a.turma_id as string).filter(Boolean)),
    );
    const { data: turmas } = turmaIds.length
      ? await context.supabase
          .from("turmas_escolares")
          .select("id, nome")
          .in("id", turmaIds)
      : { data: [] };
    const turmaNome = new Map<string, string>();
    (turmas ?? []).forEach((t) =>
      turmaNome.set(t.id as string, t.nome as string),
    );

    const { data: naoLidos } = await context.supabase.rpc(
      "contar_diario_nao_lidos",
    );
    const naoLidosMap = new Map<string, number>();
    (naoLidos ?? []).forEach((r: { aluno_id: string; nao_lidos: number }) =>
      naoLidosMap.set(r.aluno_id, Number(r.nao_lidos) || 0),
    );

    return (alunos ?? []).map((a) => ({
      aluno_id: a.id as string,
      aluno_nome: a.nome_completo as string,
      turma_nome: turmaNome.get(a.turma_id as string) ?? null,
      nao_lidos: naoLidosMap.get(a.id as string) ?? 0,
    }));
  });

// ==================== FEED DE UM FILHO ==================== //
export const listRegistrosDoFilho = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) => ({
    aluno_id: s(raw, "aluno_id"),
    dias: Number((raw as { dias?: unknown })?.dias ?? 30) || 30,
  }))
  .handler(async ({ data, context }): Promise<DiarioRegistro[]> => {
    const since = new Date();
    since.setDate(since.getDate() - Math.max(1, Math.min(365, data.dias)));

    const { data: registros, error } = await context.supabase
      .from("diario_bordo")
      .select("*")
      .eq("aluno_id", data.aluno_id)
      .eq("visivel_pais", true)
      .gte("data_registro", since.toISOString().slice(0, 10))
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw error;
    return (registros ?? []) as DiarioRegistro[];
  });

// ==================== MARCAR REGISTRO(S) COMO LIDO ==================== //
export const marcarRegistrosLidos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) => {
    const ids = (raw as { ids?: unknown })?.ids;
    if (!Array.isArray(ids) || ids.length === 0)
      throw new Error("ids obrigatório");
    return { ids: ids.map((v) => String(v).trim()).filter(Boolean) };
  })
  .handler(async ({ data, context }) => {
    const rows = data.ids.map((registro_id) => ({
      registro_id,
      user_id: context.userId,
    }));
    const { error } = await context.supabase
      .from("diario_bordo_leituras")
      .upsert(rows, { onConflict: "registro_id,user_id", ignoreDuplicates: true });
    if (error) throw error;
    return { ok: true, count: rows.length };
  });

// ==================== DELETE ==================== //
export const deleteRegistro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) => ({ id: s(raw, "id") }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("diario_bordo")
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ==================== SUPERVISÃO (gestão) ==================== //
export type SupervisaoFiltros = {
  turma_id: string | null;
  desde: string; // ISO date
  ate: string; // ISO date
};

export type SupervisaoAluno = {
  aluno_id: string;
  aluno_nome: string;
  turma_nome: string | null;
  total: number;
  elogios: number;
  participacoes: number;
  avancos: number;
  observacoes: number;
  atencoes: number;
  ultimo_registro: string | null;
};

export const listSupervisao = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) => {
    const r = raw as Record<string, unknown> | null;
    const desde =
      String(r?.desde ?? "").trim() ||
      new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const ate =
      String(r?.ate ?? "").trim() || new Date().toISOString().slice(0, 10);
    const turma_id = String(r?.turma_id ?? "").trim() || null;
    return { turma_id, desde, ate } satisfies SupervisaoFiltros;
  })
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("diario_bordo")
      .select("id, aluno_id, turma_id, tipo, data_registro, created_at")
      .gte("data_registro", data.desde)
      .lte("data_registro", data.ate)
      .order("created_at", { ascending: false })
      .limit(5000);
    if (data.turma_id) q = q.eq("turma_id", data.turma_id);
    const { data: regs, error } = await q;
    if (error) throw error;

    const alunoIds = Array.from(
      new Set((regs ?? []).map((r) => r.aluno_id as string)),
    );
    if (alunoIds.length === 0)
      return { alunos: [] as SupervisaoAluno[], total_registros: 0 };

    const { data: alunos } = await context.supabase
      .from("alunos")
      .select("id, nome_completo, turma_id")
      .in("id", alunoIds);
    const turmaIds = Array.from(
      new Set((alunos ?? []).map((a) => a.turma_id as string).filter(Boolean)),
    );
    const { data: turmas } = turmaIds.length
      ? await context.supabase
          .from("turmas_escolares")
          .select("id, nome")
          .in("id", turmaIds)
      : { data: [] };
    const turmaNome = new Map<string, string>();
    (turmas ?? []).forEach((t) =>
      turmaNome.set(t.id as string, t.nome as string),
    );
    const nome = new Map<string, string>();
    const alunoTurma = new Map<string, string | null>();
    (alunos ?? []).forEach((a) => {
      nome.set(a.id as string, a.nome_completo as string);
      alunoTurma.set(a.id as string, (a.turma_id as string) ?? null);
    });

    const map = new Map<string, SupervisaoAluno>();
    for (const r of regs ?? []) {
      const id = r.aluno_id as string;
      const cur =
        map.get(id) ??
        {
          aluno_id: id,
          aluno_nome: nome.get(id) ?? "Aluno",
          turma_nome: turmaNome.get(alunoTurma.get(id) ?? "") ?? null,
          total: 0,
          elogios: 0,
          participacoes: 0,
          avancos: 0,
          observacoes: 0,
          atencoes: 0,
          ultimo_registro: null,
        };
      cur.total += 1;
      const t = r.tipo as DiarioTipo;
      if (t === "elogio") cur.elogios += 1;
      else if (t === "participacao") cur.participacoes += 1;
      else if (t === "avanco") cur.avancos += 1;
      else if (t === "observacao") cur.observacoes += 1;
      else if (t === "atencao") cur.atencoes += 1;
      const c = r.created_at as string;
      if (!cur.ultimo_registro || c > cur.ultimo_registro)
        cur.ultimo_registro = c;
      map.set(id, cur);
    }

    const arr = Array.from(map.values()).sort(
      (a, b) => b.total - a.total || a.aluno_nome.localeCompare(b.aluno_nome),
    );
    return { alunos: arr, total_registros: regs?.length ?? 0 };
  });

export const listTurmasSupervisao = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("turmas_escolares")
      .select("id, nome, turno")
      .order("nome");
    if (error) throw error;
    return (data ?? []) as TurmaProfessor[];
  });
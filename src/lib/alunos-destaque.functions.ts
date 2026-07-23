import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { logger } from "@/lib/logger";

// ---------- Server publishable client (para leituras públicas) ----------
function getServerPublicClient() {
  const url = process.env.SUPABASE_URL || process.env.PROJECT_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.PROJECT_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase env não configurado no servidor.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

// ---------- Types ----------
export type DestaquePublico = {
  id: string;
  mes: string;
  posicao: number;
  motivo: string;
  foto_url: string | null;
  exibir_foto: boolean;
  aluno_id: string;
  aluno_nome: string;
  turma_id: string;
  turma_nome: string;
  turma_ano_serie: string | null;
  disciplina_id: string | null;
  disciplina_nome: string | null;
  disciplina_cor: string | null;
};

export type DestaqueAdmin = DestaquePublico & {
  status: "indicado" | "aprovado" | "rejeitado";
  indicado_por: string | null;
  aprovado_por: string | null;
  aprovado_em: string | null;
  motivo_rejeicao: string | null;
  created_at: string;
};

// ---------- Helpers ----------
async function assertGestor(context: {
  supabase: ReturnType<typeof createClient>;
  userId: string;
}) {
  const allowed = [
    "desenvolvedor",
    "developer",
    "diretor",
    "director",
    "coordenador",
    "coordinator",
    "admin",
  ];
  const client = context.supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (
          k: string,
          v: string,
        ) => {
          in: (k: string, v: string[]) => { limit: (n: number) => Promise<{ data: unknown }> };
        };
      };
    };
  };
  const { data } = await client
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .in("role", allowed)
    .limit(1);
  if (Array.isArray(data) && data.length > 0) return true;
  throw new Error("Acesso restrito a diretor, coordenador ou administrador.");
}

function firstOfMonth(input?: string | null): string {
  const d = input ? new Date(input) : new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

// ---------- Público (com filtros + paginação + busca) ----------
export const listDestaquesPublicos = createServerFn({ method: "GET" })
  .validator((data) =>
    z
      .object({
        mes: z.string().optional().nullable(),
        turma_nome: z.string().optional().nullable(),
        disciplina_nome: z.string().optional().nullable(),
        q: z.string().optional().nullable(),
        page: z.number().int().min(1).default(1),
        page_size: z.number().int().min(1).max(60).default(20),
      })
      .parse(data ?? {}),
  )
  .handler(
    async ({
      data,
    }): Promise<{ rows: DestaquePublico[]; total: number; page: number; page_size: number }> => {
      const supabase = getServerPublicClient();
      const mes = firstOfMonth(data.mes);
      const from = (data.page - 1) * data.page_size;
      const to = from + data.page_size - 1;

      let query = supabase
        .from("alunos_destaque_publicos")
        .select("*", { count: "exact" })
        .eq("mes", mes);

      if (data.turma_nome && data.turma_nome !== "todas") {
        query = query.eq("turma_nome", data.turma_nome);
      }
      if (data.disciplina_nome && data.disciplina_nome !== "todas") {
        query = query.eq("disciplina_nome", data.disciplina_nome);
      }
      if (data.q && data.q.trim().length > 0) {
        const like = `%${data.q.trim()}%`;
        query = query.or(`aluno_nome.ilike.${like},turma_nome.ilike.${like}`);
      }

      const {
        data: rows,
        error,
        count,
      } = await query
        .order("turma_nome", { ascending: true })
        .order("posicao", { ascending: true })
        .range(from, to);

      if (error) {
        logger.error("[alunos-destaque] público:", error.message);
        return { rows: [], total: 0, page: data.page, page_size: data.page_size };
      }
      return {
        rows: (rows ?? []) as unknown as DestaquePublico[],
        total: count ?? 0,
        page: data.page,
        page_size: data.page_size,
      };
    },
  );

// Lista distinct de turmas do mês para popular filtros públicos
export const listTurmasComDestaques = createServerFn({ method: "GET" })
  .validator((data) => z.object({ mes: z.string().optional().nullable() }).parse(data ?? {}))
  .handler(async ({ data }): Promise<string[]> => {
    const supabase = getServerPublicClient();
    const mes = firstOfMonth(data.mes);
    const { data: rows } = await supabase
      .from("alunos_destaque_publicos")
      .select("turma_nome")
      .eq("mes", mes)
      .order("turma_nome", { ascending: true });
    const set = new Set<string>();
    for (const r of (rows ?? []) as Array<{ turma_nome: string | null }>) {
      if (r.turma_nome) set.add(r.turma_nome);
    }
    return Array.from(set);
  });

// Lista distinct de disciplinas do mês para filtro público
export const listDisciplinasComDestaques = createServerFn({ method: "GET" })
  .validator((data) => z.object({ mes: z.string().optional().nullable() }).parse(data ?? {}))
  .handler(async ({ data }): Promise<string[]> => {
    const supabase = getServerPublicClient();
    const mes = firstOfMonth(data.mes);
    const { data: rows } = await supabase
      .from("alunos_destaque_publicos")
      .select("disciplina_nome")
      .eq("mes", mes);
    const set = new Set<string>();
    for (const r of (rows ?? []) as Array<{ disciplina_nome: string | null }>) {
      if (r.disciplina_nome) set.add(r.disciplina_nome);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  });

// ---------- Admin (com filtros por turma/mês) ----------
export const listDestaquesAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])

  .validator((data) =>
    z
      .object({
        mes: z.string().optional().nullable(),
        turma_id: z.string().uuid().optional().nullable(),
        status: z.enum(["indicado", "aprovado", "rejeitado"]).optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as never as { supabase: ReturnType<typeof createClient> };
    let query = ctx.supabase
      .from("alunos_destaque")
      .select(
        `id, mes, posicao, motivo, foto_url, exibir_foto, status, indicado_por, aprovado_por, aprovado_em, motivo_rejeicao, created_at,
         aluno:aluno_id ( id, nome_completo ),
         turma:turma_id ( id, nome, ano_serie ),
         disciplina:disciplina_id ( id, nome, cor )`,
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.status) query = query.eq("status", data.status);
    if (data.mes) query = query.eq("mes", firstOfMonth(data.mes));
    if (data.turma_id) query = query.eq("turma_id", data.turma_id);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    type Row = {
      id: string;
      mes: string;
      posicao: number;
      motivo: string;
      foto_url: string | null;
      exibir_foto: boolean;
      status: "indicado" | "aprovado" | "rejeitado";
      indicado_por: string | null;
      aprovado_por: string | null;
      aprovado_em: string | null;
      motivo_rejeicao: string | null;
      created_at: string;
      aluno: { id: string; nome_completo: string } | null;
      turma: { id: string; nome: string; ano_serie: string | null } | null;
      disciplina: { id: string; nome: string; cor: string | null } | null;
    };
    return ((rows ?? []) as unknown as Row[]).map((r): DestaqueAdmin => ({
      id: r.id,
      mes: r.mes,
      posicao: r.posicao,
      motivo: r.motivo,
      foto_url: r.foto_url,
      exibir_foto: r.exibir_foto,
      status: r.status,
      indicado_por: r.indicado_por,
      aprovado_por: r.aprovado_por,
      aprovado_em: r.aprovado_em,
      motivo_rejeicao: r.motivo_rejeicao,
      created_at: r.created_at,
      aluno_id: r.aluno?.id ?? "",
      aluno_nome: r.aluno?.nome_completo ?? "Aluno removido",
      turma_id: r.turma?.id ?? "",
      turma_nome: r.turma?.nome ?? "—",
      turma_ano_serie: r.turma?.ano_serie ?? null,
      disciplina_id: r.disciplina?.id ?? null,
      disciplina_nome: r.disciplina?.nome ?? null,
      disciplina_cor: r.disciplina?.cor ?? null,
    }));
  });

// ---------- Indicar ----------
const indicarSchema = z.object({
  aluno_id: z.string().uuid({ message: "Aluno é obrigatório" }),
  turma_id: z.string().uuid({ message: "Turma é obrigatória" }),
  disciplina_id: z.string().uuid({ message: "Disciplina é obrigatória" }),
  mes: z.string().min(4, { message: "Mês é obrigatório" }),
  motivo: z
    .string()
    .trim()
    .min(5, { message: "Motivo precisa ter ao menos 5 caracteres" })
    .max(500),
  posicao: z
    .number({ message: "Posição é obrigatória" })
    .int()
    .min(1, { message: "Posição deve estar entre 1 e 5" })
    .max(5, { message: "Posição deve estar entre 1 e 5" }),
  exibir_foto: z.boolean().default(false),
  foto_url: z.string().url().optional().nullable(),
  // LGPD Art. 14 — consentimento parental
  consentimento_responsavel: z.literal(true, {
    message: "É necessário o consentimento do responsável legal (Art. 14 da LGPD).",
  }),
  responsavel_nome: z
    .string()
    .trim()
    .min(3, { message: "Informe o nome do responsável legal." })
    .max(120),
  responsavel_vinculo: z
    .string()
    .trim()
    .min(2, { message: "Informe o vínculo (mãe, pai, tutor...)." })
    .max(60),
});

export const indicarDestaque = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => indicarSchema.parse(data))
  .handler(async ({ data, context }) => {
    const ctx = context as never as {
      supabase: ReturnType<typeof createClient>;
      userId: string;
    };
    const payload = {
      aluno_id: data.aluno_id,
      turma_id: data.turma_id,
      disciplina_id: data.disciplina_id,
      mes: firstOfMonth(data.mes),
      motivo: data.motivo,
      posicao: data.posicao,
      exibir_foto: data.exibir_foto,
      foto_url: data.exibir_foto && data.foto_url ? data.foto_url : null,
      indicado_por: ctx.userId,
      status: "indicado" as const,
      consentimento_responsavel: true,
      consentimento_versao: "v1",
      consentimento_em: new Date().toISOString(),
      responsavel_nome: data.responsavel_nome,
      responsavel_vinculo: data.responsavel_vinculo,
    };
    const { data: inserted, error } = await ctx.supabase
      .from("alunos_destaque")
      .insert(payload as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await ctx.supabase.from("alunos_destaque_historico").insert({
      destaque_id: (inserted as { id: string }).id,
      acao: "indicado",
      autor_id: ctx.userId,
      before: null,
      after: payload,
    } as never);
    return { ok: true } as const;
  });

// ---------- Editar (autor enquanto indicado / admin sempre) ----------
const editarSchema = z.object({
  id: z.string().uuid(),
  aluno_id: z.string().uuid(),
  turma_id: z.string().uuid(),
  disciplina_id: z.string().uuid(),
  mes: z.string(),
  motivo: z.string().trim().min(5).max(500),
  posicao: z.number().int().min(1).max(5),
  exibir_foto: z.boolean().default(false),
  foto_url: z.string().url().optional().nullable(),
});

export const editarDestaque = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => editarSchema.parse(data))
  .handler(async ({ data, context }) => {
    const ctx = context as never as {
      supabase: ReturnType<typeof createClient>;
      userId: string;
    };
    const { data: before, error: err0 } = await ctx.supabase
      .from("alunos_destaque")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (err0) throw new Error(err0.message);

    const patch = {
      aluno_id: data.aluno_id,
      turma_id: data.turma_id,
      disciplina_id: data.disciplina_id,
      mes: firstOfMonth(data.mes),
      motivo: data.motivo,
      posicao: data.posicao,
      exibir_foto: data.exibir_foto,
      foto_url: data.exibir_foto && data.foto_url ? data.foto_url : null,
    };
    const { error } = await ctx.supabase
      .from("alunos_destaque")
      .update(patch as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    await ctx.supabase.from("alunos_destaque_historico").insert({
      destaque_id: data.id,
      acao: "editado",
      autor_id: ctx.userId,
      before,
      after: patch,
    } as never);
    return { ok: true } as const;
  });

// ---------- Cancelar (autor enquanto indicado) ----------
export const cancelarDestaque = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) =>
    z
      .object({
        id: z.string().uuid(),
        motivo: z.string().trim().max(300).optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as never as {
      supabase: ReturnType<typeof createClient>;
      userId: string;
    };
    const { data: before } = await ctx.supabase
      .from("alunos_destaque")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await ctx.supabase.from("alunos_destaque").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await ctx.supabase.from("alunos_destaque_historico").insert({
      destaque_id: data.id,
      acao: "cancelado",
      autor_id: ctx.userId,
      before,
      after: null,
      observacao: data.motivo ?? null,
    } as never);
    return { ok: true } as const;
  });

// ---------- Histórico ----------
export type HistoricoRow = {
  id: string;
  destaque_id: string;
  acao: string;
  autor_id: string | null;
  before: string | null;
  after: string | null;

  observacao: string | null;
  created_at: string;
};

export const listHistoricoDestaque = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ destaque_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<HistoricoRow[]> => {
    const ctx = context as never as { supabase: ReturnType<typeof createClient> };
    const { data: rows, error } = await ctx.supabase
      .from("alunos_destaque_historico")
      .select("*")
      .eq("destaque_id", data.destaque_id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (rows ?? []) as unknown as HistoricoRow[];
  });

// ---------- Moderar ----------
export const aprovarDestaque = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertGestor(context as never);
    const ctx = context as never as {
      supabase: ReturnType<typeof createClient>;
      userId: string;
    };
    const { error } = await ctx.supabase
      .from("alunos_destaque")
      .update({
        status: "aprovado",
        aprovado_por: ctx.userId,
        aprovado_em: new Date().toISOString(),
        motivo_rejeicao: null,
      } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await ctx.supabase.from("alunos_destaque_historico").insert({
      destaque_id: data.id,
      acao: "aprovado",
      autor_id: ctx.userId,
    } as never);
    return { ok: true } as const;
  });

export const rejeitarDestaque = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) =>
    z
      .object({
        id: z.string().uuid(),
        motivo_rejeicao: z.string().trim().max(300).optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertGestor(context as never);
    const ctx = context as never as {
      supabase: ReturnType<typeof createClient>;
      userId: string;
    };
    const { error } = await ctx.supabase
      .from("alunos_destaque")
      .update({
        status: "rejeitado",
        motivo_rejeicao: data.motivo_rejeicao ?? null,
        aprovado_por: ctx.userId,
        aprovado_em: new Date().toISOString(),
      } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await ctx.supabase.from("alunos_destaque_historico").insert({
      destaque_id: data.id,
      acao: "rejeitado",
      autor_id: ctx.userId,
      observacao: data.motivo_rejeicao ?? null,
    } as never);
    return { ok: true } as const;
  });

export const excluirDestaque = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertGestor(context as never);
    const ctx = context as never as {
      supabase: ReturnType<typeof createClient>;
      userId: string;
    };
    const { data: before } = await ctx.supabase
      .from("alunos_destaque")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await ctx.supabase.from("alunos_destaque").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await ctx.supabase.from("alunos_destaque_historico").insert({
      destaque_id: data.id,
      acao: "excluido",
      autor_id: ctx.userId,
      before,
    } as never);
    return { ok: true } as const;
  });

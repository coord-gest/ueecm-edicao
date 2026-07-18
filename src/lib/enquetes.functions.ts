import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------- Server publishable client (leituras públicas) ----------
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

// ---------- Tipos ----------
export type Enquete = {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: "unica" | "multipla";
  publico: "todos" | "autenticados" | "staff";
  permite_anonimo: boolean;
  mostrar_resultados_antes: boolean;
  ativo: boolean;
  encerra_em: string | null;
  criado_por: string | null;
  created_at: string;
  updated_at: string;
};

export type EnqueteOpcao = {
  id: string;
  enquete_id: string;
  texto: string;
  ordem: number;
};

export type EnqueteResultado = {
  enquete_id: string;
  opcao_id: string;
  texto: string;
  ordem: number;
  votos: number;
};

// ---------- PÚBLICO ----------
export const listEnquetesPublicas = createServerFn({ method: "GET" }).handler(
  async (): Promise<Enquete[]> => {
    const sb = getServerPublicClient();
    const { data } = await sb
      .from("enquetes")
      .select("*")
      .eq("ativo", true)
      .order("created_at", { ascending: false });
    return (data ?? []) as Enquete[];
  },
);

export const getEnquetePublica = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(
    async ({
      data,
    }): Promise<{
      enquete: Enquete | null;
      opcoes: EnqueteOpcao[];
      resultados: EnqueteResultado[];
    }> => {
      const sb = getServerPublicClient();
      const { data: enq } = await sb.from("enquetes").select("*").eq("id", data.id).maybeSingle();
      if (!enq) return { enquete: null, opcoes: [], resultados: [] };
      const { data: opcoes } = await sb
        .from("enquete_opcoes")
        .select("*")
        .eq("enquete_id", data.id)
        .order("ordem", { ascending: true });
      const { data: resultados } = await sb
        .from("enquete_resultados")
        .select("*")
        .eq("enquete_id", data.id);
      return {
        enquete: enq as Enquete,
        opcoes: (opcoes ?? []) as EnqueteOpcao[],
        resultados: (resultados ?? []) as EnqueteResultado[],
      };
    },
  );

// ---------- Votar ----------
const votarSchema = z.object({
  enquete_id: z.string().uuid(),
  opcao_ids: z.array(z.string().uuid()).min(1).max(50),
});

export const votarEnquete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => votarSchema.parse(data))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as {
      supabase: ReturnType<typeof createClient>;
      userId: string;
    };
    const client = ctx.supabase as any;
    // Buscar enquete para validar tipo
    const { data: enq, error: e0 } = await client
      .from("enquetes")
      .select("id, tipo, ativo")
      .eq("id", data.enquete_id)
      .maybeSingle();
    if (e0) throw new Error(e0.message);
    if (!enq) throw new Error("Enquete não encontrada");
    const opcoes = enq.tipo === "unica" ? data.opcao_ids.slice(0, 1) : data.opcao_ids;

    const rows = opcoes.map((opcao_id) => ({
      enquete_id: data.enquete_id,
      opcao_id,
      user_id: ctx.userId,
    }));
    const { error } = await client.from("enquete_respostas").insert(rows);
    if (error) throw new Error(error.message);
    return { ok: true, count: rows.length };
  });

export const getMeuVoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ enquete_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<{ opcao_ids: string[] }> => {
    const ctx = context as unknown as {
      supabase: ReturnType<typeof createClient>;
      userId: string;
    };
    const { data: rows, error } = await (ctx.supabase as any)
      .from("enquete_respostas")
      .select("opcao_id")
      .eq("enquete_id", data.enquete_id)
      .eq("user_id", ctx.userId);
    if (error) throw new Error(error.message);
    return { opcao_ids: ((rows ?? []) as Array<{ opcao_id: string }>).map((r) => r.opcao_id) };
  });

// ---------- ADMIN ----------
async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId)
    .in("role", ["desenvolvedor", "developer", "diretor", "director", "coordenador", "coordinator", "admin"])
    .limit(1);
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("Acesso restrito a administradores.");
  }
}

export const listEnquetesAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Enquete[]> => {
    const ctx = context as unknown as { supabase: any; userId: string };
    await assertAdmin(ctx);
    const { data, error } = await ctx.supabase
      .from("enquetes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as Enquete[];
  });

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  titulo: z.string().min(3).max(240),
  descricao: z.string().max(2000).nullable().optional(),
  tipo: z.enum(["unica", "multipla"]).default("unica"),
  publico: z.enum(["todos", "autenticados", "staff"]).default("todos"),
  permite_anonimo: z.boolean().default(true),
  mostrar_resultados_antes: z.boolean().default(false),
  ativo: z.boolean().default(true),
  encerra_em: z.string().nullable().optional(),
  opcoes: z.array(z.string().min(1).max(240)).min(2).max(50),
});

export const upsertEnquete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => upsertSchema.parse(data))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as { supabase: any; userId: string };
    await assertAdmin(ctx);
    const payload = {
      titulo: data.titulo.trim(),
      descricao: data.descricao?.trim() || null,
      tipo: data.tipo,
      publico: data.publico,
      permite_anonimo: data.permite_anonimo,
      mostrar_resultados_antes: data.mostrar_resultados_antes,
      ativo: data.ativo,
      encerra_em: data.encerra_em || null,
      criado_por: ctx.userId,
    };
    let id = data.id;
    if (id) {
      const { error } = await ctx.supabase.from("enquetes").update(payload).eq("id", id);
      if (error) throw new Error(error.message);
      // Substitui opções (apaga e recria) — só se houver mudanças
      await ctx.supabase.from("enquete_opcoes").delete().eq("enquete_id", id);
    } else {
      const { data: row, error } = await ctx.supabase
        .from("enquetes")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      id = (row as { id: string }).id;
    }
    const opRows = data.opcoes.map((texto, idx) => ({
      enquete_id: id!,
      texto: texto.trim(),
      ordem: idx,
    }));
    const { error: eo } = await ctx.supabase.from("enquete_opcoes").insert(opRows);
    if (eo) throw new Error(eo.message);
    return { id: id! };
  });

export const toggleEnqueteAtivo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid(), ativo: z.boolean() }).parse(data))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as { supabase: any; userId: string };
    await assertAdmin(ctx);
    const { error } = await ctx.supabase
      .from("enquetes")
      .update({ ativo: data.ativo })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteEnquete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as { supabase: any; userId: string };
    await assertAdmin(ctx);
    const { error } = await ctx.supabase.from("enquetes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getEnqueteAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(
    async ({
      data,
      context,
    }): Promise<{ enquete: Enquete | null; opcoes: EnqueteOpcao[] }> => {
      const ctx = context as unknown as { supabase: any; userId: string };
      await assertAdmin(ctx);
      const { data: enq } = await ctx.supabase
        .from("enquetes")
        .select("*")
        .eq("id", data.id)
        .maybeSingle();
      const { data: opcoes } = await ctx.supabase
        .from("enquete_opcoes")
        .select("*")
        .eq("enquete_id", data.id)
        .order("ordem", { ascending: true });
      return {
        enquete: (enq ?? null) as Enquete | null,
        opcoes: (opcoes ?? []) as EnqueteOpcao[],
      };
    },
  );

import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  sanitize,
  getServerPublicClient,
  hashIpFromRequest,
  assertModerador,
} from "./familias-depoimentos.server";
import { logger } from "@/lib/logger";

// ---------- Schemas ----------
const tipoEnum = z.enum(["comentario", "sugestao", "elogio"]);
const vinculoEnum = z.enum([
  "mae",
  "pai",
  "responsavel",
  "aluno",
  "professor",
  "ex_aluno",
  "comunidade",
]);
const statusEnum = z.enum(["pendente", "aprovado", "rejeitado"]);

// ---------- Envio público ----------
const enviarSchema = z.object({
  mensagem: z.string().trim().min(20, "Mensagem muito curta").max(800, "Mensagem muito longa"),
  tipo: tipoEnum.default("comentario"),
  vinculo: vinculoEnum.default("comunidade"),
  autor_nome: z.string().trim().max(120).optional().nullable(),
  autor_idade: z.number().int().min(3).max(120).optional().nullable(),
  turma_ano: z.string().trim().max(60).optional().nullable(),
  email_contato: z.string().trim().email().max(180).optional().nullable().or(z.literal("")),
  consentimento_lgpd: z.literal(true, {
    errorMap: () => ({ message: "Consentimento LGPD é obrigatório." }),
  }),
  autor_maior_idade: z.boolean().default(false),
  consentimento_versao: z.string().trim().max(40).optional().nullable(),
});

export const enviarDepoimento = createServerFn({ method: "POST" })
  .validator((data) => enviarSchema.parse(data))
  .handler(async ({ data }) => {
    const supabase = getServerPublicClient();
    const ipHash = hashIpFromRequest();

    const payload = {
      mensagem: sanitize(data.mensagem, 800)!,
      tipo: data.tipo,
      vinculo: data.vinculo,
      autor_nome: sanitize(data.autor_nome ?? null, 120),
      autor_idade: data.autor_idade ?? null,
      turma_ano: sanitize(data.turma_ano ?? null, 60),
      email_contato: data.email_contato ? sanitize(data.email_contato, 180) : null,
      ip_hash: ipHash,
      consentimento_lgpd: true,
      consentimento_em: new Date().toISOString(),
      consentimento_versao: sanitize(data.consentimento_versao ?? "v1", 40),
      autor_maior_idade: data.autor_maior_idade === true,
    };

    const { error } = await supabase.from("familias_depoimentos").insert(payload as never);
    if (error) {
      // Mensagem de rate-limit vem da trigger com ERRCODE P0001
      const msg = error.message || "Não foi possível enviar seu depoimento.";
      throw new Error(msg);
    }
    return { ok: true } as const;
  });

// ---------- Listagem pública ----------
export type DepoimentoPublico = {
  id: string;
  mensagem: string;
  tipo: "comentario" | "sugestao" | "elogio";
  autor_nome: string | null;
  autor_idade: number | null;
  vinculo: "mae" | "pai" | "responsavel" | "aluno" | "professor" | "ex_aluno" | "comunidade";
  turma_ano: string | null;
  created_at: string;
};

export const listarDepoimentosAprovados = createServerFn({ method: "GET" }).handler(
  async (): Promise<DepoimentoPublico[]> => {
    const supabase = getServerPublicClient();
    const { data, error } = await supabase
      .from("familias_depoimentos_publicos")
      .select("id, mensagem, tipo, autor_nome, autor_idade, vinculo, turma_ano, created_at")
      .order("created_at", { ascending: false })
      .limit(120);
    if (error) {
      logger.error("[familias] listar aprovados:", error.message);
      return [];
    }
    return (data ?? []) as unknown as DepoimentoPublico[];
  },
);

// ---------- Moderação ----------
export type DepoimentoAdmin = DepoimentoPublico & {
  status: "pendente" | "aprovado" | "rejeitado";
  email_contato: string | null;
  motivo_rejeicao: string | null;
  moderado_por: string | null;
  moderado_em: string | null;
};

export const listarDepoimentosAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ status: statusEnum.optional() }).parse(data ?? {}))
  .handler(async ({ data, context }) => {
    await assertModerador(context as never);
    let query = (context as never as { supabase: ReturnType<typeof createClient> }).supabase
      .from("familias_depoimentos")
      .select(
        "id, mensagem, tipo, autor_nome, autor_idade, vinculo, turma_ano, email_contato, status, motivo_rejeicao, moderado_por, moderado_em, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.status) query = query.eq("status", data.status);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return (rows ?? []) as unknown as DepoimentoAdmin[];
  });

export const moderarDepoimento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["aprovado", "rejeitado"]),
        motivo_rejeicao: z.string().trim().max(300).optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertModerador(context as never);
    const ctx = context as never as {
      supabase: ReturnType<typeof createClient>;
      userId: string;
    };
    const { error } = await ctx.supabase
      .from("familias_depoimentos")
      .update({
        status: data.status,
        motivo_rejeicao: data.status === "rejeitado" ? (data.motivo_rejeicao ?? null) : null,
        moderado_por: ctx.userId,
        moderado_em: new Date().toISOString(),
      } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true } as const;
  });

export const excluirDepoimento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertModerador(context as never);
    const ctx = context as never as { supabase: ReturnType<typeof createClient> };
    const { error } = await ctx.supabase.from("familias_depoimentos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true } as const;
  });

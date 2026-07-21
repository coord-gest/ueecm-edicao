import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ContratoStatus =
  | "rascunho"
  | "aguardando_assinaturas"
  | "ativo"
  | "concluido"
  | "cancelado";

export type Objetivo = { texto: string };

export type Contrato = {
  id: string;
  aluno_id: string;
  aluno_nome?: string;
  turma_id: string | null;
  turma_nome?: string | null;
  autor_id: string;
  autor_nome?: string;
  titulo: string;
  motivo: string | null;
  objetivos: Objetivo[];
  prazo: string | null;
  status: ContratoStatus;
  assinado_professor_em: string | null;
  assinado_responsavel_id: string | null;
  assinado_responsavel_em: string | null;
  assinado_aluno_em: string | null;
  observacoes: string | null;
  created_at: string;
};

const objetivoSchema = z.object({ texto: z.string().min(3).max(280) });

export const criarContrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    alunoId: string;
    turmaId?: string | null;
    titulo: string;
    motivo?: string;
    objetivos: Objetivo[];
    prazo?: string | null;
    assinarAgora?: boolean;
  }) =>
    z
      .object({
        alunoId: z.string().uuid(),
        turmaId: z.string().uuid().nullish(),
        titulo: z.string().min(3).max(200),
        motivo: z.string().max(2000).optional(),
        objetivos: z.array(objetivoSchema).min(1).max(10),
        prazo: z.string().nullish(),
        assinarAgora: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const now = new Date().toISOString();
    const { data: row, error } = await context.supabase
      .from("contratos_compromisso")
      .insert({
        aluno_id: data.alunoId,
        turma_id: data.turmaId ?? null,
        autor_id: context.userId,
        titulo: data.titulo,
        motivo: data.motivo ?? null,
        objetivos: data.objetivos,
        prazo: data.prazo ?? null,
        assinado_professor_em: data.assinarAgora ? now : null,
        status: data.assinarAgora ? "aguardando_assinaturas" : "rascunho",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const assinarContratoProfessor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { contratoId: string }) =>
    z.object({ contratoId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: c, error: errRead } = await context.supabase
      .from("contratos_compromisso")
      .select("assinado_responsavel_em")
      .eq("id", data.contratoId)
      .single();
    if (errRead) throw new Error(errRead.message);
    const novoStatus = c?.assinado_responsavel_em ? "ativo" : "aguardando_assinaturas";
    const { error } = await context.supabase
      .from("contratos_compromisso")
      .update({ assinado_professor_em: new Date().toISOString(), status: novoStatus })
      .eq("id", data.contratoId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const assinarContratoResponsavel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { contratoId: string }) =>
    z.object({ contratoId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("assinar_contrato_responsavel", {
      _contrato_id: data.contratoId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const encerrarContrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { contratoId: string; status: "concluido" | "cancelado" }) =>
    z
      .object({ contratoId: z.string().uuid(), status: z.enum(["concluido", "cancelado"]) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("contratos_compromisso")
      .update({ status: data.status })
      .eq("id", data.contratoId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listarContratosProfessor = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("contratos_compromisso")
      .select("*, alunos:aluno_id(nome), turmas:turma_id(nome)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      ...r,
      aluno_nome: r.alunos?.nome,
      turma_nome: r.turmas?.nome,
    })) as Contrato[];
  });

export const listarContratosResponsavel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("contratos_compromisso")
      .select("*, alunos:aluno_id(nome), turmas:turma_id(nome)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      ...r,
      aluno_nome: r.alunos?.nome,
      turma_nome: r.turmas?.nome,
    })) as Contrato[];
  });

export const addCheckpoint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    contratoId: string;
    status: "cumprido" | "parcial" | "nao_cumprido";
    observacao?: string;
  }) =>
    z
      .object({
        contratoId: z.string().uuid(),
        status: z.enum(["cumprido", "parcial", "nao_cumprido"]),
        observacao: z.string().max(1000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("contrato_checkpoints").insert({
      contrato_id: data.contratoId,
      autor_id: context.userId,
      status: data.status,
      observacao: data.observacao ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export function rotuloStatus(s: ContratoStatus): string {
  return {
    rascunho: "Rascunho",
    aguardando_assinaturas: "Aguardando assinaturas",
    ativo: "Ativo",
    concluido: "Concluído",
    cancelado: "Cancelado",
  }[s];
}

export function corStatus(s: ContratoStatus): string {
  return {
    rascunho: "bg-muted text-muted-foreground",
    aguardando_assinaturas: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    ativo: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    concluido: "bg-primary/15 text-primary",
    cancelado: "bg-red-500/15 text-red-700 dark:text-red-300",
  }[s];
}
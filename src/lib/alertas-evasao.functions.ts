import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type FatorRisco = {
  tipo: "frequencia" | "notas" | "atividades" | "comportamento";
  peso: number;
  descricao: string;
};

export type RiscoEvasao = {
  aluno_id: string;
  nome: string;
  turma_id: string | null;
  turma_nome: string | null;
  score: number;
  nivel: "ok" | "baixo" | "medio" | "alto";
  fatores: FatorRisco[];
  frequencia_pct: number | null;
  media_notas: number | null;
  ativ_atrasadas: number;
  ativ_pendentes: number;
  meritos_atencao: number;
  meritos_ocorrencia: number;
  calculado_em: string;
};

export type AlunoEmRisco = {
  aluno_id: string;
  nome: string;
  turma_id: string | null;
  turma_nome: string | null;
  score: number;
  nivel: "baixo" | "medio" | "alto";
  frequencia_pct: number | null;
  media_notas: number | null;
  ativ_atrasadas: number;
  meritos_atencao: number;
};

export const listarAlunosEmRisco = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { nivelMin?: "baixo" | "medio" | "alto" }) =>
    z.object({ nivelMin: z.enum(["baixo", "medio", "alto"]).default("medio") }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc("listar_alunos_em_risco", {
      _nivel_min: data.nivelMin,
    });
    if (error) throw new Error(error.message);
    return (rows ?? []) as AlunoEmRisco[];
  });

export const getRiscoEvasao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { alunoId: string }) =>
    z.object({ alunoId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc("calcular_risco_evasao", {
      _aluno_id: data.alunoId,
    });
    if (error) throw new Error(error.message);
    return result as RiscoEvasao;
  });

export function corNivel(nivel: string): string {
  switch (nivel) {
    case "alto":
      return "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30";
    case "medio":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30";
    case "baixo":
      return "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/30";
    default:
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
  }
}

export function rotuloNivel(nivel: string): string {
  return nivel === "alto"
    ? "Alto risco"
    : nivel === "medio"
      ? "Risco médio"
      : nivel === "baixo"
        ? "Baixo risco"
        : "OK";
}
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type RadarAluno = {
  aluno: { id: string; nome: string; turma_id: string | null; turma_nome: string | null };
  frequencia: { total: number; presentes: number; percentual: number | null };
  notas: { media_geral: number | null; media_ultimas: number | null; total_lancamentos: number };
  atividades: { total: number; entregues: number; atrasadas: number; percentual: number | null };
  comportamento: { elogios: number; avancos: number; atencao: number; saldo: number };
  calculado_em: string;
};

export type FilhoRadarItem = { aluno_id: string; nome: string; turma_nome: string };

export const listarMeusFilhosRadar = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("listar_meus_filhos_radar");
    if (error) throw new Error(error.message);
    return (data ?? []) as FilhoRadarItem[];
  });

export const getRadarFilho = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { alunoId: string }) => z.object({ alunoId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc("calcular_radar_aluno", {
      _aluno_id: data.alunoId,
    });
    if (error) throw new Error(error.message);
    return result as RadarAluno;
  });

// ─── Thresholds e semáforos ─────────────────────────────────────────
export type Semaforo = "verde" | "amarelo" | "vermelho" | "neutro";

export function corFrequencia(pct: number | null): Semaforo {
  if (pct === null) return "neutro";
  if (pct >= 85) return "verde";
  if (pct >= 70) return "amarelo";
  return "vermelho";
}

export function corNotas(media: number | null): Semaforo {
  if (media === null) return "neutro";
  if (media >= 7) return "verde";
  if (media >= 5) return "amarelo";
  return "vermelho";
}

export function corAtividades(pct: number | null): Semaforo {
  if (pct === null) return "neutro";
  if (pct >= 80) return "verde";
  if (pct >= 60) return "amarelo";
  return "vermelho";
}

export function corComportamento(saldo: number, atencao: number): Semaforo {
  if (atencao >= 3 && saldo < 0) return "vermelho";
  if (atencao >= 2 || saldo < 0) return "amarelo";
  return "verde";
}

export function sugestaoFrequencia(sem: Semaforo, pct: number | null): string | null {
  if (sem === "vermelho") return `Frequência baixa (${pct ?? 0}%). Converse com a coordenação sobre as faltas.`;
  if (sem === "amarelo") return `Atenção à frequência (${pct ?? 0}%). Reforce a rotina escolar em casa.`;
  return null;
}

export function sugestaoNotas(sem: Semaforo, media: number | null): string | null {
  if (sem === "vermelho") return `Média baixa (${media ?? 0}). Combine reforço com o professor.`;
  if (sem === "amarelo") return `Média em atenção (${media ?? 0}). Vale conversar sobre estudo em casa.`;
  return null;
}

export function sugestaoAtividades(sem: Semaforo, atrasadas: number): string | null {
  if (sem === "vermelho" || atrasadas >= 3) return `${atrasadas} atividade(s) em atraso. Ajude seu filho a colocar em dia.`;
  if (sem === "amarelo") return `Algumas atividades pendentes. Confira a agenda semanal.`;
  return null;
}

export function sugestaoComportamento(sem: Semaforo, atencao: number): string | null {
  if (sem === "vermelho") return `${atencao} registro(s) de atenção no diário. Fale com o professor da turma.`;
  if (sem === "amarelo") return `Atenção ao comportamento — acompanhe o diário de bordo esta semana.`;
  return null;
}
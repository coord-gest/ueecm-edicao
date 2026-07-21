import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PresencaResumo = {
  periodo_dias: number;
  pontos: number;
  comunicados_lidos: number;
  comunicados_total: number;
  taxa_leitura: number;
  autorizacoes_respondidas: number;
  autorizacoes_rapidas: number;
  dias_ativos: number;
  calculado_em: string;
};

export type BadgeId = "presente" | "atento" | "parceiro" | "guardiao" | "reacao_rapida" | "leitor_ativo";

export type BadgeDef = {
  id: BadgeId;
  nome: string;
  descricao: string;
  icone: string;
  cor: string;
};

export const BADGES: BadgeDef[] = [
  { id: "presente", nome: "Presente", descricao: "Leu 5 comunicados", icone: "🥉", cor: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200" },
  { id: "atento", nome: "Atento", descricao: "Leu 15 comunicados + 3 autorizações", icone: "🥈", cor: "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-100" },
  { id: "parceiro", nome: "Parceiro", descricao: "30 comunicados + 10 autorizações + 20 dias ativos", icone: "🥇", cor: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200" },
  { id: "guardiao", nome: "Guardião", descricao: "50 comunicados + 20 autorizações + 60 dias ativos", icone: "🌟", cor: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200" },
  { id: "reacao_rapida", nome: "Reação Rápida", descricao: "5+ respostas em menos de 24h", icone: "⚡", cor: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200" },
  { id: "leitor_ativo", nome: "Leitor Ativo", descricao: "90%+ de taxa de leitura", icone: "📚", cor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" },
];

export function calcularBadges(r: PresencaResumo): BadgeId[] {
  const b: BadgeId[] = [];
  if (r.comunicados_lidos >= 5) b.push("presente");
  if (r.comunicados_lidos >= 15 && r.autorizacoes_respondidas >= 3) b.push("atento");
  if (r.comunicados_lidos >= 30 && r.autorizacoes_respondidas >= 10 && r.dias_ativos >= 20) b.push("parceiro");
  if (r.comunicados_lidos >= 50 && r.autorizacoes_respondidas >= 20 && r.dias_ativos >= 60) b.push("guardiao");
  if (r.autorizacoes_rapidas >= 5) b.push("reacao_rapida");
  if (r.taxa_leitura >= 90 && r.comunicados_total >= 5) b.push("leitor_ativo");
  return b;
}

export function nivel(pontos: number): { nome: string; proximo: number | null; progresso: number } {
  const niveis = [
    { nome: "Iniciante", min: 0 },
    { nome: "Presente", min: 50 },
    { nome: "Engajado", min: 150 },
    { nome: "Parceiro", min: 350 },
    { nome: "Guardião", min: 700 },
    { nome: "Embaixador", min: 1200 },
  ];
  let atual = niveis[0];
  let prox: { nome: string; min: number } | null = null;
  for (let i = 0; i < niveis.length; i++) {
    if (pontos >= niveis[i].min) atual = niveis[i];
    else { prox = niveis[i]; break; }
  }
  const progresso = prox ? Math.round(((pontos - atual.min) / (prox.min - atual.min)) * 100) : 100;
  return { nome: atual.nome, proximo: prox?.min ?? null, progresso: Math.max(0, Math.min(100, progresso)) };
}

export const getMinhaPresencaParental = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { dias?: number }) => ({ dias: d?.dias ?? 90 }))
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.supabase.rpc("calcular_presenca_parental", {
      _user_id: context.userId,
      _dias: data.dias,
    });
    if (error) throw new Error(error.message);
    return r as PresencaResumo;
  });

export const getRankingPresencaParental = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { limite?: number; dias?: number }) => ({ limite: d?.limite ?? 10, dias: d?.dias ?? 90 }))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc("ranking_presenca_parental", {
      _limite: data.limite,
      _dias: data.dias,
    });
    if (error) throw new Error(error.message);
    return (rows ?? []) as Array<{ posicao: number; iniciais: string; pontos: number; is_you: boolean }>;
  });
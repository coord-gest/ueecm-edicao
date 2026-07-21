import { supabase } from "@/integrations/supabase/client";

export type StatusVaquinha = "rascunho" | "ativa" | "pausada" | "concluida" | "cancelada";

export type Vaquinha = {
  id: string;
  criado_por: string;
  titulo: string;
  descricao: string;
  beneficiario: string;
  meta_centavos: number;
  arrecadado_centavos: number;
  chave_pix: string | null;
  foto_url: string | null;
  prazo: string | null;
  status: StatusVaquinha;
  destaque: boolean;
  created_at: string;
};

export type Contribuicao = {
  id: string;
  vaquinha_id: string;
  contribuinte_user_id: string | null;
  contribuinte_nome: string | null;
  valor_centavos: number;
  mensagem: string | null;
  anonimo: boolean;
  comprovante_url: string | null;
  confirmado: boolean;
  confirmado_em: string | null;
  created_at: string;
};

export function formatBRL(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export async function listarVaquinhas(incluirTodas = false): Promise<Vaquinha[]> {
  let q = supabase
    .from("vaquinhas")
    .select("*")
    .order("destaque", { ascending: false })
    .order("created_at", { ascending: false });
  if (!incluirTodas) q = q.in("status", ["ativa", "pausada", "concluida"]);
  const { data, error } = await q.limit(200);
  if (error) throw error;
  return (data ?? []) as Vaquinha[];
}

export async function getVaquinha(id: string): Promise<Vaquinha | null> {
  const { data, error } = await supabase.from("vaquinhas").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as Vaquinha | null) ?? null;
}

export async function listarContribuicoes(vaquinha_id: string): Promise<Contribuicao[]> {
  const { data, error } = await supabase
    .from("vaquinha_contribuicoes")
    .select("*")
    .eq("vaquinha_id", vaquinha_id)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as Contribuicao[];
}

export async function criarVaquinha(input: {
  titulo: string;
  descricao: string;
  beneficiario: string;
  meta_reais: number;
  chave_pix?: string;
  foto_url?: string;
  prazo?: string;
  status?: StatusVaquinha;
  destaque?: boolean;
}) {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) throw new Error("Faça login.");
  const { data, error } = await supabase
    .from("vaquinhas")
    .insert({
      criado_por: uid,
      titulo: input.titulo.trim(),
      descricao: input.descricao.trim(),
      beneficiario: input.beneficiario.trim(),
      meta_centavos: Math.round(input.meta_reais * 100),
      chave_pix: input.chave_pix?.trim() || null,
      foto_url: input.foto_url?.trim() || null,
      prazo: input.prazo || null,
      status: input.status ?? "ativa",
      destaque: input.destaque ?? false,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function atualizarVaquinha(id: string, patch: Partial<Vaquinha>) {
  const { error } = await supabase.from("vaquinhas").update(patch).eq("id", id);
  if (error) throw error;
}

export async function registrarContribuicao(input: {
  vaquinha_id: string;
  valor_reais: number;
  mensagem?: string;
  anonimo: boolean;
  contribuinte_nome?: string;
  comprovante_url?: string;
}) {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id ?? null;
  const { error } = await supabase.from("vaquinha_contribuicoes").insert({
    vaquinha_id: input.vaquinha_id,
    contribuinte_user_id: uid,
    contribuinte_nome: input.anonimo ? null : input.contribuinte_nome?.trim() || null,
    valor_centavos: Math.round(input.valor_reais * 100),
    mensagem: input.mensagem?.trim() || null,
    anonimo: input.anonimo,
    comprovante_url: input.comprovante_url?.trim() || null,
    confirmado: false,
  });
  if (error) throw error;
}

export async function confirmarContribuicao(id: string, confirmado: boolean) {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  const { error } = await supabase
    .from("vaquinha_contribuicoes")
    .update({
      confirmado,
      confirmado_por: confirmado ? uid ?? null : null,
      confirmado_em: confirmado ? new Date().toISOString() : null,
    })
    .eq("id", id);
  if (error) throw error;
}
import { supabase } from "@/integrations/supabase/client";

export const CATEGORIAS = [
  { id: "transporte", label: "Transporte", emoji: "🚌" },
  { id: "reforco", label: "Reforço Escolar", emoji: "📚" },
  { id: "material", label: "Material Escolar", emoji: "✏️" },
  { id: "alimentacao", label: "Alimentação", emoji: "🍎" },
  { id: "vestuario", label: "Vestuário/Uniforme", emoji: "👕" },
  { id: "saude", label: "Saúde/Bem-estar", emoji: "❤️" },
  { id: "outro", label: "Outro", emoji: "🤝" },
] as const;
export type CategoriaApoio = (typeof CATEGORIAS)[number]["id"];

export type Urgencia = "baixa" | "normal" | "alta";
export type StatusOferta = "pendente" | "aprovado" | "rejeitado" | "concluido" | "arquivado";
export type StatusPedido = "pendente" | "aprovado" | "rejeitado" | "atendido" | "arquivado";

export type Oferta = {
  id: string;
  autor_user_id: string;
  categoria: CategoriaApoio;
  titulo: string;
  descricao: string;
  contato: string | null;
  bairro: string | null;
  disponibilidade: string | null;
  status: StatusOferta;
  created_at: string;
};

export type Pedido = {
  id: string;
  autor_user_id: string;
  categoria: CategoriaApoio;
  titulo: string;
  descricao: string;
  urgencia: Urgencia;
  anonimo: boolean;
  contato_reserva: string | null;
  status: StatusPedido;
  created_at: string;
};

export async function listarOfertas(status: StatusOferta = "aprovado"): Promise<Oferta[]> {
  const { data, error } = await supabase
    .from("rede_apoio_ofertas")
    .select("*")
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as Oferta[];
}

export async function listarPedidos(status: StatusPedido = "aprovado"): Promise<Pedido[]> {
  const { data, error } = await supabase
    .from("rede_apoio_pedidos")
    .select("*")
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as Pedido[];
}

export async function criarOferta(input: {
  categoria: CategoriaApoio;
  titulo: string;
  descricao: string;
  contato?: string;
  bairro?: string;
  disponibilidade?: string;
}) {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) throw new Error("Faça login para enviar.");
  const { error } = await supabase.from("rede_apoio_ofertas").insert({
    autor_user_id: uid,
    categoria: input.categoria,
    titulo: input.titulo.trim(),
    descricao: input.descricao.trim(),
    contato: input.contato?.trim() || null,
    bairro: input.bairro?.trim() || null,
    disponibilidade: input.disponibilidade?.trim() || null,
  });
  if (error) throw error;
}

export async function criarPedido(input: {
  categoria: CategoriaApoio;
  titulo: string;
  descricao: string;
  urgencia: Urgencia;
  anonimo: boolean;
  contato_reserva?: string;
}) {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) throw new Error("Faça login para enviar.");
  const { error } = await supabase.from("rede_apoio_pedidos").insert({
    autor_user_id: uid,
    categoria: input.categoria,
    titulo: input.titulo.trim(),
    descricao: input.descricao.trim(),
    urgencia: input.urgencia,
    anonimo: input.anonimo,
    contato_reserva: input.contato_reserva?.trim() || null,
  });
  if (error) throw error;
}

export async function moderarOferta(id: string, status: StatusOferta, motivo?: string) {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  const { error } = await supabase
    .from("rede_apoio_ofertas")
    .update({
      status,
      moderado_por: uid ?? null,
      moderado_em: new Date().toISOString(),
      motivo_moderacao: motivo ?? null,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function moderarPedido(id: string, status: StatusPedido, motivo?: string) {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  const { error } = await supabase
    .from("rede_apoio_pedidos")
    .update({
      status,
      moderado_por: uid ?? null,
      moderado_em: new Date().toISOString(),
      motivo_moderacao: motivo ?? null,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function iniciarMatch(input: { oferta_id?: string; pedido_id?: string; observacoes?: string }) {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) throw new Error("Faça login.");
  if (!input.oferta_id && !input.pedido_id) throw new Error("Escolha oferta ou pedido.");
  const { error } = await supabase.from("rede_apoio_matches").insert({
    iniciado_por: uid,
    oferta_id: input.oferta_id ?? null,
    pedido_id: input.pedido_id ?? null,
    observacoes: input.observacoes?.trim() || null,
  });
  if (error) throw error;
}
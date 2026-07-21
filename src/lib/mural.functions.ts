import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const MURAL_CATEGORIAS = [
  { id: "conquista", label: "Conquista", emoji: "🏆" },
  { id: "duvida", label: "Dúvida", emoji: "❓" },
  { id: "oferta_ajuda", label: "Oferta de Ajuda", emoji: "🤝" },
  { id: "bastidor", label: "Bastidor da Escola", emoji: "🎬" },
  { id: "aniversario", label: "Aniversário", emoji: "🎂" },
  { id: "receita", label: "Receita/Cantina", emoji: "🍎" },
  { id: "projeto", label: "Projeto", emoji: "🎨" },
] as const;
export type MuralCategoria = (typeof MURAL_CATEGORIAS)[number]["id"];

export const MURAL_REACOES = [
  { tipo: "aplauso", emoji: "👏", label: "Aplausos" },
  { tipo: "coracao", emoji: "❤️", label: "Amei" },
  { tipo: "festa", emoji: "🎉", label: "Festejar" },
  { tipo: "ideia", emoji: "💡", label: "Ideia" },
] as const;
export type MuralReacaoTipo = (typeof MURAL_REACOES)[number]["tipo"];

export type MuralFeedItem = {
  id: string;
  autor_id: string;
  autor_nome: string;
  autor_papel: string;
  categoria: MuralCategoria;
  titulo: string;
  conteudo: string;
  imagem_url: string | null;
  fixado: boolean;
  aprovado: boolean;
  created_at: string;
  total_reacoes: number;
  total_comentarios: number;
  minhas_reacoes: MuralReacaoTipo[];
};

function papelDeRole(roles: string[] | null | undefined): "familia" | "escola" | "professor" {
  if (!roles) return "familia";
  if (roles.includes("professor")) return "professor";
  if (roles.some((r) => ["admin", "diretor", "coordenador", "secretario", "social_media"].includes(r))) return "escola";
  return "familia";
}

export const listarMuralFeed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { limite?: number; offset?: number; categoria?: string | null }) => ({
    limite: Math.min(Math.max(d?.limite ?? 30, 1), 60),
    offset: Math.max(d?.offset ?? 0, 0),
    categoria: d?.categoria ?? undefined,
  }))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc("mural_listar_feed", {
      _limite: data.limite,
      _offset: data.offset,
      _categoria: data.categoria ?? undefined,
    });
    if (error) throw new Error(error.message);
    return (rows ?? []) as MuralFeedItem[];
  });

export const criarMuralPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { categoria: MuralCategoria; titulo: string; conteudo: string; imagem_url?: string | null }) => {
    if (!d.titulo || d.titulo.trim().length < 3) throw new Error("Título muito curto (mínimo 3 caracteres)");
    if (d.titulo.length > 140) throw new Error("Título muito longo (máximo 140 caracteres)");
    if (!d.conteudo || d.conteudo.trim().length < 5) throw new Error("Conteúdo muito curto (mínimo 5 caracteres)");
    if (d.conteudo.length > 4000) throw new Error("Conteúdo muito longo (máximo 4000 caracteres)");
    return {
      categoria: d.categoria,
      titulo: d.titulo.trim(),
      conteudo: d.conteudo.trim(),
      imagem_url: d.imagem_url ?? null,
    };
  })
  .handler(async ({ data, context }) => {
    // Descobre nome e papel do autor
    const { data: rolesData } = await context.supabase
      .from("user_roles").select("role").eq("user_id", context.userId);
    const roles = (rolesData ?? []).map((r: { role: string }) => r.role);
    const papel = papelDeRole(roles);

    const { data: perfil } = await context.supabase
      .from("profiles").select("display_name, full_name").eq("id", context.userId).maybeSingle();
    const autorNome = (perfil?.display_name ?? perfil?.full_name ?? "Membro da Comunidade").toString();

    // Escola/professor postam já aprovados; famílias vão para moderação
    const aprovado = papel !== "familia";

    const { data: post, error } = await context.supabase
      .from("mural_posts")
      .insert({
        autor_id: context.userId,
        autor_nome: autorNome,
        autor_papel: papel,
        categoria: data.categoria,
        titulo: data.titulo,
        conteudo: data.conteudo,
        imagem_url: data.imagem_url,
        aprovado,
        aprovado_por: aprovado ? context.userId : null,
        aprovado_em: aprovado ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return post;
  });

export const alternarReacaoMural = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { postId: string; tipo: MuralReacaoTipo }) => d)
  .handler(async ({ data, context }) => {
    // toggle
    const { data: existing } = await context.supabase
      .from("mural_reacoes").select("id")
      .eq("post_id", data.postId).eq("user_id", context.userId).eq("tipo", data.tipo)
      .maybeSingle();
    if (existing) {
      const { error } = await context.supabase.from("mural_reacoes").delete().eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { added: false };
    }
    const { error } = await context.supabase.from("mural_reacoes").insert({
      post_id: data.postId, user_id: context.userId, tipo: data.tipo,
    });
    if (error) throw new Error(error.message);
    return { added: true };
  });

export const listarMuralComentarios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { postId: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("mural_comentarios")
      .select("id, post_id, user_id, autor_nome, conteudo, oculto, created_at")
      .eq("post_id", data.postId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const comentarMural = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { postId: string; conteudo: string }) => {
    if (!d.conteudo || d.conteudo.trim().length < 1) throw new Error("Comentário vazio");
    if (d.conteudo.length > 1000) throw new Error("Comentário muito longo");
    return { postId: d.postId, conteudo: d.conteudo.trim() };
  })
  .handler(async ({ data, context }) => {
    const { data: perfil } = await context.supabase
      .from("profiles").select("display_name, full_name").eq("id", context.userId).maybeSingle();
    const autor = (perfil?.display_name ?? perfil?.full_name ?? "Usuário").toString();
    const { data: row, error } = await context.supabase.from("mural_comentarios").insert({
      post_id: data.postId, user_id: context.userId, autor_nome: autor, conteudo: data.conteudo,
    }).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listarMuralModeracao = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("mural_posts")
      .select("id, autor_id, autor_nome, autor_papel, categoria, titulo, conteudo, imagem_url, aprovado, created_at")
      .eq("aprovado", false)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const moderarMuralPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { postId: string; acao: "aprovar" | "rejeitar" | "fixar" | "desafixar" }) => d)
  .handler(async ({ data, context }) => {
    if (data.acao === "aprovar") {
      const { error } = await context.supabase.from("mural_posts")
        .update({ aprovado: true, aprovado_por: context.userId, aprovado_em: new Date().toISOString() })
        .eq("id", data.postId);
      if (error) throw new Error(error.message);
    } else if (data.acao === "rejeitar") {
      const { error } = await context.supabase.from("mural_posts").delete().eq("id", data.postId);
      if (error) throw new Error(error.message);
    } else if (data.acao === "fixar" || data.acao === "desafixar") {
      const { error } = await context.supabase.from("mural_posts")
        .update({ fixado: data.acao === "fixar" })
        .eq("id", data.postId);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const excluirMuralPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { postId: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("mural_posts").delete().eq("id", data.postId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
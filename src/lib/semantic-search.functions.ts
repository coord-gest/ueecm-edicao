import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const EMBED_MODEL = "gemini-embedding-001";
const EMBED_DIM = 1536;

async function embedText(text: string, apiKey: string): Promise<number[]> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: { parts: [{ text }] },
        outputDimensionality: EMBED_DIM,
      }),
    },
  );
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Gemini embed ${res.status}: ${err.slice(0, 200)}`);
  }
  const json = (await res.json()) as { embedding?: { values?: number[] } };
  const values = json.embedding?.values;
  if (!Array.isArray(values) || values.length !== EMBED_DIM) {
    throw new Error("Embedding inválido retornado pela Gemini");
  }
  return values;
}

export type SemanticPost = {
  id: string;
  titulo: string;
  resumo: string | null;
  excerpt: string | null;
  categoria: string | null;
  autor_nome: string | null;
  published_at: string | null;
  slug: string | null;
  similarity: number;
};

/** Busca semântica em posts via pgvector + Gemini embeddings. */
export const semanticSearchPosts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const d = (data ?? {}) as Record<string, unknown>;
    const q = typeof d.q === "string" ? d.q.trim() : "";
    if (q.length < 3) throw new Error("Consulta muito curta");
    if (q.length > 300) throw new Error("Consulta muito longa");
    const limit = typeof d.limit === "number" ? Math.min(Math.max(d.limit, 1), 20) : 8;
    return { q, limit };
  })
  .handler(async ({ data }): Promise<SemanticPost[]> => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY não configurada");

    const vector = await embedText(data.q, apiKey);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("match_posts", {
      query_embedding: vector as unknown as string,
      match_count: data.limit,
      min_similarity: 0.45,
    });
    if (error) throw error;
    return (rows ?? []).map((r: Record<string, unknown>) => ({
      id: String(r.id),
      titulo: String(r.titulo ?? ""),
      resumo: (r.resumo as string | null) ?? null,
      excerpt: (r.excerpt as string | null) ?? null,
      categoria: (r.categoria as string | null) ?? null,
      autor_nome: (r.autor_nome as string | null) ?? null,
      published_at: (r.published_at as string | null) ?? null,
      slug: (r.slug as string | null) ?? null,
      similarity: Number(r.similarity ?? 0),
    }));
  });

/** Gera embeddings para posts publicados que ainda não têm (staff only). */
export const backfillPostEmbeddings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const d = (data ?? {}) as Record<string, unknown>;
    const limit = typeof d.limit === "number" ? Math.min(Math.max(d.limit, 1), 50) : 20;
    return { limit };
  })
  .handler(async ({ data, context }): Promise<{ processados: number; erros: number }> => {
    const { data: isStaff } = await context.supabase.rpc("is_professor_or_staff", {
      _user_id: context.userId,
    });
    if (!isStaff) throw new Error("Acesso restrito");

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY não configurada");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: posts, error } = await supabaseAdmin
      .from("posts")
      .select("id, titulo, resumo, excerpt, conteudo, categoria")
      .eq("status", "publicado")
      .is("embedding", null)
      .limit(data.limit);
    if (error) throw error;

    let processados = 0;
    let erros = 0;
    for (const p of posts ?? []) {
      try {
        const texto = [
          p.titulo,
          p.categoria,
          p.resumo,
          p.excerpt,
          String(p.conteudo ?? "").replace(/<[^>]+>/g, " ").slice(0, 4000),
        ]
          .filter(Boolean)
          .join("\n");
        const vec = await embedText(texto, apiKey);
        await supabaseAdmin
          .from("posts")
          .update({
            embedding: vec as unknown as string,
            embedding_updated_at: new Date().toISOString(),
          })
          .eq("id", p.id);
        processados++;
      } catch {
        erros++;
      }
    }
    return { processados, erros };
  });

import { createServerFn } from "@tanstack/react-start";

const GEMINI_TIMEOUT_MS = 15_000;
const MODEL = "gemini-flash-latest";

type Decisao = "aprovar" | "revisar" | "bloquear";

export type ModeracaoResultado = {
  decisao: Decisao;
  motivo: string;
  categorias: string[];
};

/**
 * Moderação automática de comentários públicos via Gemini.
 * Chamado pelo cliente logo após inserir o comentário (que entra como 'pendente').
 * A função atualiza o status via supabaseAdmin de acordo com a decisão da IA:
 *  - aprovar  → status='aprovado' (aparece publicamente)
 *  - revisar  → mantém 'pendente' (equipe decide manualmente)
 *  - bloquear → status='rejeitado' com motivo em metadata
 *
 * Não requer autenticação (comentários são públicos), mas valida o id e
 * só atua sobre comentários que ainda estão pendentes.
 */
export const moderarComentarioIA = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    const o = (d ?? {}) as Record<string, unknown>;
    const id = typeof o.comentario_id === "string" ? o.comentario_id : "";
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("comentario_id inválido");
    return { comentario_id: id };
  })
  .handler(async ({ data }): Promise<ModeracaoResultado> => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY não configurada");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: comentario, error: fetchErr } = await supabaseAdmin
      .from("post_comentarios")
      .select("id, conteudo, status, autor_nome")
      .eq("id", data.comentario_id)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!comentario) throw new Error("Comentário não encontrado");
    if (comentario.status !== "pendente") {
      return { decisao: "revisar", motivo: "Já moderado", categorias: [] };
    }

    const prompt = `Você é moderador de comentários de um blog escolar público brasileiro (alunos, responsáveis e equipe). Classifique o comentário abaixo.

Regras:
- APROVAR: comentário respeitoso, construtivo, sem ofensas nem dados pessoais indevidos.
- REVISAR: dúvida legítima, contém dados pessoais (telefone, endereço, e-mail de terceiros), tom rude mas sem ofensa clara, ou fora de contexto.
- BLOQUEAR: xingamento, discurso de ódio, ameaça, conteúdo sexual, spam/propaganda, bullying contra pessoa nomeada, incitação à violência.

Comentário de "${comentario.autor_nome}":
"""
${String(comentario.conteudo ?? "").slice(0, 4000)}
"""

Responda APENAS com JSON:
{
  "decisao": "aprovar" | "revisar" | "bloquear",
  "motivo": "1 frase curta em português",
  "categorias": ["ofensa","spam","dados_pessoais","odio","ameaca","sexual","bullying"]  // vazio se aprovar
}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
    let decisao: Decisao = "revisar";
    let motivo = "Falha na moderação automática";
    let categorias: string[] = [];
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 512,
              responseMimeType: "application/json",
              thinkingConfig: { thinkingBudget: 0 },
            },
          }),
          signal: controller.signal,
        },
      );
      if (r.ok) {
        const j = (await r.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const text = j.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        const cleaned = text.replace(/```json|```/g, "").trim();
        const first = cleaned.indexOf("{");
        const last = cleaned.lastIndexOf("}");
        if (first !== -1 && last > first) {
          const parsed = JSON.parse(cleaned.slice(first, last + 1)) as {
            decisao?: string;
            motivo?: string;
            categorias?: unknown;
          };
          const d = String(parsed.decisao ?? "").toLowerCase();
          if (d === "aprovar" || d === "revisar" || d === "bloquear") decisao = d;
          motivo = String(parsed.motivo ?? motivo).slice(0, 200);
          categorias = Array.isArray(parsed.categorias)
            ? parsed.categorias.map(String).slice(0, 10)
            : [];
        }
      }
    } catch {
      // fallback: mantém revisar
    } finally {
      clearTimeout(timeout);
    }

    const statusFinal: "aprovado" | "rejeitado" | "pendente" =
      decisao === "aprovar" ? "aprovado" : decisao === "bloquear" ? "rejeitado" : "pendente";

    if (statusFinal !== "pendente") {
      await supabaseAdmin
        .from("post_comentarios")
        .update({ status: statusFinal })
        .eq("id", data.comentario_id);
    }

    return { decisao, motivo, categorias };
  });

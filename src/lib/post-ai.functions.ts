import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type GerarInput = {
  tema: string;
  turma?: string | null;
  disciplina?: string | null;
  tom?: string | null;
};

export type GerarOutput = {
  titulo: string;
  resumo: string;
  conteudo: string;
  truncado?: boolean;
};

const GEMINI_TIMEOUT_MS = 25_000;

function extractJson(text: string): unknown {
  const cleaned = text
    .replace(/^\s*```(?:json)?/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");
    if (first === -1) throw new Error("Resposta da IA sem JSON válido");
    const slice = last > first ? cleaned.slice(first, last + 1) : cleaned.slice(first);
    try {
      return JSON.parse(slice);
    } catch {
      // Reparo para respostas truncadas: fecha string e chaves pendentes.
      let repaired = slice;
      const quotes = (repaired.match(/(?<!\\)"/g) ?? []).length;
      if (quotes % 2 === 1) repaired += '"';
      const open = (repaired.match(/\{/g) ?? []).length;
      const close = (repaired.match(/\}/g) ?? []).length;
      if (open > close) repaired += "}".repeat(open - close);
      return JSON.parse(repaired);
    }
  }
}

export const gerarPostComIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown): GerarInput => {
    if (typeof data !== "object" || data === null) throw new Error("Payload inválido");
    const d = data as Record<string, unknown>;
    const tema = typeof d.tema === "string" ? d.tema.trim() : "";
    if (tema.length < 10)
      throw new Error("Conte um pouco mais sobre o que aconteceu (mín. 10 caracteres)");
    if (tema.length > 4000) throw new Error("Relato muito longo (máx. 4000 caracteres)");
    return {
      tema,
      turma: typeof d.turma === "string" ? d.turma : null,
      disciplina: typeof d.disciplina === "string" ? d.disciplina : null,
      tom: typeof d.tom === "string" ? d.tom : null,
    };
  })
  .handler(async ({ data, context }): Promise<GerarOutput> => {
    const { data: isStaff, error: roleError } = await context.supabase.rpc(
      "is_professor_or_staff",
      { _user_id: context.userId },
    );
    if (roleError) throw roleError;
    if (!isStaff) throw new Error("Acesso restrito à equipe da escola.");

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY não configurada no servidor");

    const contexto = [
      data.turma ? `Turma: ${data.turma}` : null,
      data.disciplina ? `Disciplina: ${data.disciplina}` : null,
      data.tom ? `Tom desejado: ${data.tom}` : null,
    ]
      .filter(Boolean)
      .join(" | ");

    const prompt = `Você é redator do blog da U.E. Evaristo Campelo de Matos, uma escola pública. Transforme o relato abaixo em uma publicação para o blog escolar em português do Brasil, com linguagem clara, acolhedora e adequada ao público escolar (alunos, responsáveis e equipe). Mantenha fidelidade aos fatos descritos — não invente datas, nomes, números ou eventos que não estejam no relato. Se faltar algum detalhe, escreva de forma genérica em vez de inventar.

${contexto ? `Contexto: ${contexto}\n` : ""}Relato do autor (o que aconteceu / o que ele quer comunicar):
"""
${data.tema}
"""

Responda APENAS com um JSON válido no formato exato:
{
  "titulo": "título curto e atrativo (máx. 90 caracteres, sem emojis)",
  "resumo": "resumo de 1-2 frases para o card do blog (máx. 200 caracteres)",
  "conteudo": "corpo completo em HTML simples usando apenas <p>, <h2>, <h3>, <ul>, <li>, <strong>, <em>, <a>. Sem <html>, <body>, <head> ou <script>. 3 a 6 parágrafos bem estruturados, expandindo o relato com contexto escolar apropriado."
}

Não inclua comentários, markdown, crases ou texto fora do JSON.`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.85,
              maxOutputTokens: 8192,
              responseMimeType: "application/json",
              thinkingConfig: { thinkingBudget: 0 },
            },
          }),
          signal: controller.signal,
        },
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(`Gemini retornou ${response.status}: ${errText.slice(0, 200)}`);
    }

    const payload = (await response.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
        finishReason?: string;
      }>;
    };
    const cand = payload.candidates?.[0];
    const text = cand?.content?.parts?.[0]?.text ?? "";
    if (!text) throw new Error("Gemini não retornou texto");

    const parsed = extractJson(text) as Partial<GerarOutput>;
    const titulo = String(parsed.titulo ?? "").trim();
    const resumo = String(parsed.resumo ?? "").trim();
    const conteudo = String(parsed.conteudo ?? "").trim();
    if (!titulo || !resumo) throw new Error("Resposta da IA incompleta (título/resumo ausentes)");
    if (conteudo.length < 80) {
      throw new Error(
        "A IA retornou um conteúdo muito curto ou vazio. Tente regerar com mais detalhes no relato.",
      );
    }
    const truncado =
      cand?.finishReason === "MAX_TOKENS" ||
      !/<\/p>|<\/h2>|<\/h3>|<\/ul>\s*$|<\/li>\s*<\/ul>/i.test(conteudo);
    return { titulo, resumo, conteudo, truncado };
  });

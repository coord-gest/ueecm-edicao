import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GEMINI_TIMEOUT_MS = 25_000;
const MODEL = "gemini-2.5-flash";

async function callGemini(prompt: string, opts?: { json?: boolean; maxTokens?: number }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY não configurada no servidor");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: opts?.maxTokens ?? 4096,
            responseMimeType: opts?.json ? "application/json" : "text/plain",
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
        signal: controller.signal,
      },
    );
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      throw new Error(`Gemini ${r.status}: ${t.slice(0, 200)}`);
    }
    const j = (await r.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    return j.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  } finally {
    clearTimeout(timeout);
  }
}

function parseJson<T>(text: string): T {
  const cleaned = text.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/i, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");
    if (first === -1) throw new Error("Resposta da IA sem JSON");
    return JSON.parse(cleaned.slice(first, last + 1)) as T;
  }
}

async function assertStaff(supabase: SupabaseCtx, userId: string) {
  const { data, error } = await supabase.rpc("is_professor_or_staff", { _user_id: userId });
  if (error) throw error;
  if (!data) throw new Error("Acesso restrito à equipe da escola.");
}

type SupabaseCtx = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
};

// ============ 1. Gerar rascunho de comunicado ============
export type ComunicadoIAOutput = { titulo: string; mensagem: string };

export const gerarComunicadoIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const o = (d ?? {}) as Record<string, unknown>;
    const tema = typeof o.tema === "string" ? o.tema.trim() : "";
    if (tema.length < 10) throw new Error("Descreva o assunto (mín. 10 caracteres)");
    return {
      tema,
      publico: typeof o.publico === "string" ? o.publico : "responsáveis e alunos",
      urgencia: typeof o.urgencia === "string" ? o.urgencia : "normal",
      turma: typeof o.turma === "string" ? o.turma : null,
    };
  })
  .handler(async ({ data, context }): Promise<ComunicadoIAOutput> => {
    await assertStaff(context.supabase as unknown as SupabaseCtx, context.userId);
    const ctx = [
      `Público: ${data.publico}`,
      `Urgência: ${data.urgencia}`,
      data.turma ? `Turma: ${data.turma}` : null,
    ]
      .filter(Boolean)
      .join(" | ");
    const prompt = `Você redige comunicados oficiais da U.E. Evaristo Campelo de Matos (escola pública, Fortaleza-CE). Gere um comunicado curto, claro e cordial em português do Brasil.

${ctx}

Assunto/detalhes: """${data.tema}"""

Regras:
- Título objetivo, sem emojis, máx. 80 caracteres.
- Mensagem em texto simples (sem HTML), 2 a 4 parágrafos curtos.
- Tom institucional, acolhedor. Não invente datas, nomes ou valores.
- Se faltar detalhe, fale de forma genérica em vez de inventar.

Responda APENAS com JSON: {"titulo":"...","mensagem":"..."}`;
    const raw = await callGemini(prompt, { json: true, maxTokens: 2048 });
    const parsed = parseJson<Partial<ComunicadoIAOutput>>(raw);
    const titulo = String(parsed.titulo ?? "").trim();
    const mensagem = String(parsed.mensagem ?? "").trim();
    if (!titulo || mensagem.length < 40) throw new Error("Resposta da IA incompleta");
    return { titulo, mensagem };
  });

// ============ 2. Sugerir feedback pedagógico para aluno ============
export type FeedbackIAOutput = {
  feedback: string;
  pontos_fortes: string[];
  sugestoes: string[];
};

export const sugerirFeedbackAluno = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const o = (d ?? {}) as Record<string, unknown>;
    const aluno_id = typeof o.aluno_id === "string" ? o.aluno_id : "";
    if (!aluno_id) throw new Error("aluno_id obrigatório");
    return {
      aluno_id,
      contexto: typeof o.contexto === "string" ? o.contexto.slice(0, 1500) : "",
    };
  })
  .handler(async ({ data, context }): Promise<FeedbackIAOutput> => {
    await assertStaff(context.supabase as unknown as SupabaseCtx, context.userId);
    const supabase = context.supabase;

    // Buscar dados do aluno + notas + frequência recente (RLS aplica)
    const { data: aluno } = await supabase
      .from("alunos")
      .select("nome_completo, turma_id")
      .eq("id", data.aluno_id)
      .maybeSingle();
    if (!aluno) throw new Error("Aluno não encontrado ou sem permissão");

    const { data: notas } = await supabase
      .from("notas")
      .select("disciplina, nota, bimestre, observacao")
      .eq("aluno_id", data.aluno_id)
      .order("created_at", { ascending: false })
      .limit(20);

    const { data: freq } = await supabase
      .from("frequencia")
      .select("data, presente")
      .eq("aluno_id", data.aluno_id)
      .gte("data", new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10))
      .order("data", { ascending: false })
      .limit(60);

    const totalFreq = freq?.length ?? 0;
    const presencas = freq?.filter((f) => f.presente).length ?? 0;
    const percentFreq = totalFreq ? Math.round((presencas / totalFreq) * 100) : null;

    const prompt = `Você é assistente pedagógico. Redija um feedback construtivo e cordial (português-BR) para um aluno da escola pública U.E. Evaristo Campelo de Matos, considerando os dados abaixo. Nunca invente notas ou eventos.

Aluno: ${aluno.nome_completo}
Frequência últimos 60 dias: ${percentFreq !== null ? `${percentFreq}% (${presencas}/${totalFreq})` : "sem registros"}
Notas recentes: ${JSON.stringify(notas ?? [])}
Contexto adicional do professor: ${data.contexto || "(nenhum)"}

Responda APENAS com JSON:
{
  "feedback": "parágrafo único, 3-5 frases, tom acolhedor",
  "pontos_fortes": ["...", "..."],
  "sugestoes": ["...", "..."]
}`;
    const raw = await callGemini(prompt, { json: true, maxTokens: 2048 });
    const parsed = parseJson<Partial<FeedbackIAOutput>>(raw);
    return {
      feedback: String(parsed.feedback ?? "").trim(),
      pontos_fortes: Array.isArray(parsed.pontos_fortes)
        ? parsed.pontos_fortes.map(String).slice(0, 5)
        : [],
      sugestoes: Array.isArray(parsed.sugestoes) ? parsed.sugestoes.map(String).slice(0, 5) : [],
    };
  });

// ============ 3. Resumir thread/ata ============
export type ResumoIAOutput = { resumo: string; acoes: string[]; participantes: string[] };

export const resumirConversa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const o = (d ?? {}) as Record<string, unknown>;
    const mensagens = Array.isArray(o.mensagens) ? o.mensagens : [];
    if (mensagens.length === 0) throw new Error("Nenhuma mensagem para resumir");
    const norm = mensagens
      .slice(0, 200)
      .map((m) => {
        const mm = (m ?? {}) as Record<string, unknown>;
        return {
          autor: String(mm.autor ?? "Anônimo").slice(0, 80),
          texto: String(mm.texto ?? "").slice(0, 2000),
        };
      })
      .filter((m) => m.texto);
    if (norm.length === 0) throw new Error("Mensagens vazias");
    return { mensagens: norm, titulo: typeof o.titulo === "string" ? o.titulo : "" };
  })
  .handler(async ({ data, context }): Promise<ResumoIAOutput> => {
    await assertStaff(context.supabase as unknown as SupabaseCtx, context.userId);
    const transcript = data.mensagens.map((m) => `[${m.autor}] ${m.texto}`).join("\n");
    const prompt = `Resuma a conversa/ata abaixo em português do Brasil, de forma neutra e profissional. Extraia decisões, encaminhamentos e responsáveis.

${data.titulo ? `Título: ${data.titulo}\n` : ""}Transcrição:
"""
${transcript.slice(0, 30000)}
"""

Responda APENAS com JSON:
{
  "resumo": "3-6 frases objetivas",
  "acoes": ["ação 1 — responsável (se citado)", "..."],
  "participantes": ["nome 1", "nome 2"]
}`;
    const raw = await callGemini(prompt, { json: true, maxTokens: 3072 });
    const parsed = parseJson<Partial<ResumoIAOutput>>(raw);
    return {
      resumo: String(parsed.resumo ?? "").trim(),
      acoes: Array.isArray(parsed.acoes) ? parsed.acoes.map(String).slice(0, 15) : [],
      participantes: Array.isArray(parsed.participantes)
        ? parsed.participantes.map(String).slice(0, 30)
        : [],
    };
  });

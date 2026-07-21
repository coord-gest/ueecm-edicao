import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MeritoTipo = "elogio" | "avanco" | "atencao" | "ocorrencia";

export type MeritoItem = {
  id: string;
  aluno_id: string;
  aluno_nome?: string | null;
  turma_id: string | null;
  turma_nome?: string | null;
  autor_id: string;
  autor_nome: string | null;
  tipo: MeritoTipo;
  disciplina: string | null;
  nota_original: string;
  nota_construtiva: string | null;
  ia_reescreveu: boolean;
  visivel_pais: boolean;
  created_at: string;
};

const GEMINI_TIMEOUT_MS = 20_000;
const MODEL = "gemini-flash-latest";

async function reescreverConstrutiva(tipo: MeritoTipo, notaOriginal: string, alunoNome: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null; // fallback: usa o texto original

  const tipoLabel = {
    elogio: "elogio positivo",
    avanco: "reconhecimento de avanço/progresso",
    atencao: "chamada de atenção construtiva",
    ocorrencia: "registro de ocorrência",
  }[tipo];

  const prompt = `Você é assistente pedagógico da U.E. Evaristo Campelo de Matos (escola pública de Fortaleza-CE). Reescreva a nota abaixo de um(a) professor(a) para um(a) responsável do aluno, em linguagem construtiva, cordial e clara — sem julgamentos duros, sem rótulos ao aluno, focando em comportamento e próximos passos. Português-BR.

Aluno: ${alunoNome}
Tipo: ${tipoLabel}
Nota original do professor: """${notaOriginal}"""

Regras:
- Comece cumprimentando a família (ex: "Olá, família de ${alunoNome.split(" ")[0]}!").
- 2 a 4 frases curtas.
- Para elogio/avanço: celebre e reforce.
- Para atenção/ocorrência: descreva o fato objetivamente, sem adjetivos negativos ao aluno, e sugira um caminho ("vamos combinar…", "seria bom conversar sobre…").
- Nunca invente detalhes que não estão na nota original.
- Não use markdown, emojis moderadamente (no máx 1).
- Retorne APENAS o texto reescrito, sem aspas, sem prefixo.`;

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
          generationConfig: { temperature: 0.6, maxOutputTokens: 512, thinkingConfig: { thinkingBudget: 0 } },
        }),
        signal: controller.signal,
      },
    );
    if (!r.ok) return null;
    const j = (await r.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const txt = (j.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
    return txt || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// Lista turmas do professor autenticado
export const listMinhasTurmasMeritos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("turmas_escolares")
      .select("id, nome")
      .eq("professor_responsavel_id", context.userId)
      .order("nome");
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{ id: string; nome: string }>;
  });

// Lista alunos de uma turma
export const listAlunosDaTurmaMeritos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { turmaId: string }) => z.object({ turmaId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("alunos")
      .select("id, nome_completo")
      .eq("turma_id", data.turmaId)
      .eq("ativo", true)
      .order("nome_completo");
    if (error) throw new Error(error.message);
    return (rows ?? []) as Array<{ id: string; nome_completo: string }>;
  });

// Cria um mérito/ocorrência (com reescrita da IA)
export const criarMerito = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    alunoId: string;
    tipo: MeritoTipo;
    notaOriginal: string;
    disciplina?: string | null;
    visivelPais?: boolean;
  }) =>
    z
      .object({
        alunoId: z.string().uuid(),
        tipo: z.enum(["elogio", "avanco", "atencao", "ocorrencia"]),
        notaOriginal: z.string().trim().min(3, "Descreva a nota (mín. 3 caracteres)").max(1000),
        disciplina: z.string().max(80).nullable().optional(),
        visivelPais: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // Busca nome do aluno + turma
    const { data: aluno, error: aErr } = await context.supabase
      .from("alunos")
      .select("id, nome_completo, turma_id")
      .eq("id", data.alunoId)
      .maybeSingle();
    if (aErr) throw new Error(aErr.message);
    if (!aluno) throw new Error("Aluno não encontrado ou sem permissão");

    // Nome do autor
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", context.userId)
      .maybeSingle();

    // Reescrita IA
    const construtiva = await reescreverConstrutiva(data.tipo, data.notaOriginal, aluno.nome_completo);

    const { data: inserted, error } = await context.supabase
      .from("meritos_ocorrencias")
      .insert({
        aluno_id: data.alunoId,
        turma_id: aluno.turma_id,
        autor_id: context.userId,
        autor_nome: profile?.display_name ?? null,
        tipo: data.tipo,
        disciplina: data.disciplina ?? null,
        nota_original: data.notaOriginal,
        nota_construtiva: construtiva,
        ia_reescreveu: !!construtiva,
        visivel_pais: data.visivelPais ?? true,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return inserted as MeritoItem;
  });

// Lista méritos por turma (visão professor)
export const listMeritosPorTurma = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { turmaId: string; dias?: number }) =>
    z.object({ turmaId: z.string().uuid(), dias: z.number().int().min(1).max(180).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const cutoff = new Date(Date.now() - (data.dias ?? 30) * 86_400_000).toISOString();
    const { data: rows, error } = await context.supabase
      .from("meritos_ocorrencias")
      .select("*, alunos!inner(nome_completo)")
      .eq("turma_id", data.turmaId)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => {
      const rec = r as Record<string, unknown> & { alunos?: { nome_completo?: string } };
      return { ...rec, aluno_nome: rec.alunos?.nome_completo ?? null } as MeritoItem;
    });
  });

// Lista méritos dos filhos (visão responsável)
export const listMeritosMeusFilhos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rows, error } = await context.supabase
      .from("meritos_ocorrencias")
      .select("id, aluno_id, tipo, disciplina, nota_construtiva, nota_original, autor_nome, created_at, alunos!inner(nome_completo)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => {
      const rec = r as Record<string, unknown> & { alunos?: { nome_completo?: string } };
      return {
        id: rec.id as string,
        aluno_id: rec.aluno_id as string,
        aluno_nome: rec.alunos?.nome_completo ?? null,
        tipo: rec.tipo as MeritoTipo,
        disciplina: (rec.disciplina as string | null) ?? null,
        nota: (rec.nota_construtiva as string | null) ?? (rec.nota_original as string),
        autor_nome: (rec.autor_nome as string | null) ?? null,
        created_at: rec.created_at as string,
      };
    });
  });
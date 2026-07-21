import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PlanejamentoTipo = "semanal" | "quinzenal" | "mensal" | "semestral";

export type Planejamento = {
  id: string;
  professor_id: string;
  professor_nome: string;
  disciplina_id: string | null;
  disciplina_nome: string;
  tipo: PlanejamentoTipo;
  titulo: string;
  descricao: string | null;
  conteudo_ia: string | null;
  periodo_inicio: string | null;
  periodo_fim: string | null;
  arquivo_url: string | null;
  arquivo_nome: string | null;
  arquivo_tamanho: number | null;
  ai_generated: boolean;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
};

const TIPO_VALIDO: PlanejamentoTipo[] = ["semanal", "quinzenal", "mensal", "semestral"];

// ==================== LIST ==================== //
export const listMeusPlanejamentos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Planejamento[]> => {
    const { data, error } = await context.supabase
      .from("planejamentos")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Planejamento[];
  });

// ==================== CREATE (gestão) ==================== //
type CreateInput = {
  professor_id: string;
  disciplina_id?: string | null;
  tipo: PlanejamentoTipo;
  titulo: string;
  descricao?: string | null;
  conteudo_ia?: string | null;
  periodo_inicio?: string | null;
  periodo_fim?: string | null;
  arquivo_url?: string | null;
  arquivo_nome?: string | null;
  arquivo_tamanho?: number | null;
  ai_generated?: boolean;
};

export const criarPlanejamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown): CreateInput => {
    if (typeof raw !== "object" || raw === null) throw new Error("Payload inválido");
    const d = raw as Record<string, unknown>;
    const tipo = String(d.tipo ?? "") as PlanejamentoTipo;
    if (!TIPO_VALIDO.includes(tipo)) throw new Error("Tipo de planejamento inválido");
    const professor_id = String(d.professor_id ?? "").trim();
    if (!professor_id) throw new Error("Selecione o professor");
    const titulo = String(d.titulo ?? "").trim();
    if (titulo.length < 3) throw new Error("Título obrigatório");
    return {
      professor_id,
      disciplina_id: (d.disciplina_id as string) || null,
      tipo,
      titulo,
      descricao: (d.descricao as string) || null,
      conteudo_ia: (d.conteudo_ia as string) || null,
      periodo_inicio: (d.periodo_inicio as string) || null,
      periodo_fim: (d.periodo_fim as string) || null,
      arquivo_url: (d.arquivo_url as string) || null,
      arquivo_nome: (d.arquivo_nome as string) || null,
      arquivo_tamanho: typeof d.arquivo_tamanho === "number" ? d.arquivo_tamanho : null,
      ai_generated: Boolean(d.ai_generated),
    };
  })
  .handler(async ({ data, context }) => {
    // busca dados do professor
    const { data: prof, error: pErr } = await context.supabase
      .from("profissionais")
      .select("id, nome")
      .eq("id", data.professor_id)
      .maybeSingle();
    if (pErr) throw pErr;
    if (!prof) throw new Error("Professor não encontrado");

    let disciplina_nome = "";
    if (data.disciplina_id) {
      const { data: disc } = await context.supabase
        .from("disciplinas")
        .select("nome")
        .eq("id", data.disciplina_id)
        .maybeSingle();
      disciplina_nome = disc?.nome ?? "";
    }

    const { data: inserted, error } = await context.supabase
      .from("planejamentos")
      .insert({
        professor_id: data.professor_id,
        professor_nome: prof.nome,
        disciplina_id: data.disciplina_id,
        disciplina_nome: disciplina_nome || "Geral",
        tipo: data.tipo,
        titulo: data.titulo,
        descricao: data.descricao,
        conteudo_ia: data.conteudo_ia,
        periodo_inicio: data.periodo_inicio,
        periodo_fim: data.periodo_fim,
        arquivo_url: data.arquivo_url,
        arquivo_nome: data.arquivo_nome,
        arquivo_tamanho: data.arquivo_tamanho,
        ai_generated: data.ai_generated ?? false,
        uploaded_by: context.userId,
      })
      .select("*")
      .single();
    if (error) throw error;
    return inserted as Planejamento;
  });

// ==================== DELETE (gestão) ==================== //
export const excluirPlanejamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown): { id: string } => {
    if (typeof raw !== "object" || raw === null) throw new Error("Payload inválido");
    const id = String((raw as { id?: unknown }).id ?? "").trim();
    if (!id) throw new Error("ID obrigatório");
    return { id };
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("planejamentos").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ==================== GERAR COM GEMINI ==================== //
type GerarPlanejamentoInput = {
  tipo: PlanejamentoTipo;
  disciplina: string;
  turma?: string | null;
  serie?: string | null;
  tema: string;
  objetivos?: string | null;
  bncc?: string | null;
};

const GEMINI_TIMEOUT_MS = 30_000;

export const gerarPlanejamentoIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown): GerarPlanejamentoInput => {
    if (typeof raw !== "object" || raw === null) throw new Error("Payload inválido");
    const d = raw as Record<string, unknown>;
    const tipo = String(d.tipo ?? "") as PlanejamentoTipo;
    if (!TIPO_VALIDO.includes(tipo)) throw new Error("Tipo inválido");
    const disciplina = String(d.disciplina ?? "").trim();
    if (!disciplina) throw new Error("Informe a disciplina");
    const tema = String(d.tema ?? "").trim();
    if (tema.length < 5) throw new Error("Descreva o tema (mín. 5 caracteres)");
    if (tema.length > 3000) throw new Error("Tema muito longo (máx. 3000 caracteres)");
    return {
      tipo,
      disciplina,
      turma: (d.turma as string) || null,
      serie: (d.serie as string) || null,
      tema,
      objetivos: (d.objetivos as string) || null,
      bncc: (d.bncc as string) || null,
    };
  })
  .handler(async ({ data, context }): Promise<{ conteudo: string; titulo: string }> => {
    const { data: isStaff } = await context.supabase.rpc("is_professor_or_staff", {
      _user_id: context.userId,
    });
    if (!isStaff) throw new Error("Acesso restrito à equipe pedagógica.");

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY não configurada no servidor.");

    const escopoLabel: Record<PlanejamentoTipo, string> = {
      semanal: "1 semana (5 dias letivos)",
      quinzenal: "2 semanas (10 dias letivos)",
      mensal: "1 mês (4 semanas)",
      semestral: "6 meses / 1 semestre letivo",
    };

    const prompt = `Você é um especialista em planejamento pedagógico da Educação Básica brasileira, alinhado à BNCC. Elabore um PLANEJAMENTO ${data.tipo.toUpperCase()} completo cobrindo ${escopoLabel[data.tipo]}.

Dados do planejamento:
- Disciplina: ${data.disciplina}
${data.turma ? `- Turma: ${data.turma}` : ""}
${data.serie ? `- Série/Ano: ${data.serie}` : ""}
- Tema/Conteúdo principal: ${data.tema}
${data.objetivos ? `- Objetivos indicados pelo(a) professor(a): ${data.objetivos}` : ""}
${data.bncc ? `- Habilidades BNCC de referência: ${data.bncc}` : ""}

Estruture o plano em Markdown com as seções:
1. **Título** (linha única iniciando com "# ")
2. **Objetivos de Aprendizagem** (bullets, verbos no infinitivo)
3. **Habilidades BNCC** (códigos + descrição resumida)
4. **Conteúdos** (bullets)
5. **Metodologia / Sequência Didática** — dividida por ${data.tipo === "semanal" ? "dias da semana" : data.tipo === "quinzenal" ? "semana e dia" : data.tipo === "mensal" ? "semanas" : "meses/quinzenas"}, cada bloco com: aula, objetivo, atividades, recursos, tempo estimado.
6. **Recursos Didáticos**
7. **Avaliação** (instrumentos + critérios)
8. **Referências**

Use linguagem profissional, acolhedora e prática. Português do Brasil. Não invente códigos BNCC — se não tiver certeza, escreva "(a confirmar)". Não use HTML. Não use crases ou blocos de código.`;

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
              temperature: 0.7,
              maxOutputTokens: 8192,
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
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    if (!text) throw new Error("Gemini não retornou texto");

    const firstLine = text.split("\n").find((l) => l.trim().startsWith("#"));
    const titulo = firstLine ? firstLine.replace(/^#+\s*/, "").trim().slice(0, 200) : `Planejamento ${data.tipo} - ${data.disciplina}`;

    return { conteudo: text.trim(), titulo };
  });

// ==================== LISTA DE PROFESSORES (p/ gestão) ==================== //
export const listProfessoresParaPlanejamento = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_school_admin", {
      _user_id: context.userId,
    });
    if (!isAdmin) throw new Error("Acesso restrito à gestão.");
    const { data, error } = await context.supabase
      .from("profissionais")
      .select("id, nome, disciplinas, cargo")
      .eq("ativo", true)
      .in("cargo", ["professor", "coordenador"])
      .order("nome");
    if (error) throw error;
    return (data ?? []) as Array<{
      id: string;
      nome: string;
      disciplinas: string[] | null;
      cargo: string;
    }>;
  });

export const listDisciplinasParaPlanejamento = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("disciplinas")
      .select("id, nome")
      .eq("ativo", true)
      .order("nome");
    if (error) throw error;
    return (data ?? []) as Array<{ id: string; nome: string }>;
  });
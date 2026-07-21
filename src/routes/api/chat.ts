import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import {
  buildSystemPrompt,
  DEFAULT_DEVELOPER_FAQ,
  DEFAULT_DEVELOPER_PROFILE,
  type DeveloperFaqItem,
  type DeveloperProfile,
} from "@/lib/developer-faq";
import type { Database } from "@/integrations/supabase/types";
import { logSystemError } from "@/lib/system-errors.server";
import { logger } from "@/lib/logger";

type ChatRequest = {
  sessionId: string;
  conversationId?: string | null;
  message: string;
};

type RuntimeEnv = Record<string, string | undefined>;

type RequiredChatEnv = {
  GEMINI_API_KEY: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
};

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

const CHAT_FALLBACK_REPLY =
  "Desculpe, o assistente está temporariamente instável. Por favor, tente novamente em alguns instantes.";

// 45s cobre latências de cauda longa sob carga; menor que isso gerava
// timeouts frequentes que eram registrados como erros em system_errors.
const AI_TIMEOUT_MS = 45_000;
// Google Generative Language (Gemini) — API direta com GEMINI_API_KEY.
// `gemini-2.0-flash` entrega baixa latência e boa qualidade em PT-BR.
// `gemini-flash-latest` (alias estável do Flash mais recente) é o fallback.
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const AI_MODEL = "gemini-3.1-flash-lite";
const AI_MODEL_FALLBACK = "gemini-flash-latest";

// Rate limit em memória em dois níveis (best-effort; reseta a cada cold start do Worker).
// - Por (IP+session): 12/min → uso legítimo.
// - Global por IP:    30/min → freio contra rotação de sessionId para burlar o limite.
// - Global por IP:   200/hora → cap de custo diário mesmo em ataque distribuído lento.
const RATE_LIMIT_MAX = 12;
const RATE_LIMIT_WINDOW_MS = 60_000;
const IP_MINUTE_MAX = 30;
const IP_MINUTE_WINDOW_MS = 60_000;
const IP_HOUR_MAX = 200;
const IP_HOUR_WINDOW_MS = 60 * 60_000;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function hitBucket(
  key: string,
  max: number,
  windowMs: number,
): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  if (bucket.count >= max) {
    return { ok: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  bucket.count += 1;
  return { ok: true, retryAfter: 0 };
}

function checkRateLimit(key: string, ip: string): { ok: boolean; retryAfter: number } {
  const perSession = hitBucket(`s:${key}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
  if (!perSession.ok) return perSession;
  const perIpMin = hitBucket(`ipm:${ip}`, IP_MINUTE_MAX, IP_MINUTE_WINDOW_MS);
  if (!perIpMin.ok) return perIpMin;
  const perIpHour = hitBucket(`iph:${ip}`, IP_HOUR_MAX, IP_HOUR_WINDOW_MS);
  if (!perIpHour.ok) return perIpHour;
  return { ok: true, retryAfter: 0 };
}

function getClientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function getClientKey(request: Request, sessionId: string | undefined): string {
  const ip =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  return `${ip}:${sessionId ?? "anon"}`;
}

function jsonResponse(payload: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");

  return new Response(JSON.stringify(payload), {
    ...init,
    headers,
  });
}

async function persistAssistantReply(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any,
  conversationId: string | null | undefined,
  content: string,
) {
  if (!conversationId) return;

  try {
    const { error: assistantMessageError } = await supabaseAdmin.from("chat_messages").insert({
      conversation_id: conversationId,
      role: "assistant",
      content,
    });
    if (assistantMessageError) {
      logger.warn("[api/chat] Falha ao salvar resposta do assistente:", assistantMessageError);
    }

    const { error: conversationUpdateError } = await supabaseAdmin
      .from("chat_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);
    if (conversationUpdateError) {
      logger.warn("[api/chat] Falha ao atualizar conversa:", conversationUpdateError);
    }
  } catch (err) {
    logger.warn("[api/chat] Falha inesperada ao persistir resposta do assistente:", err);
  }
}

async function fallbackChatResponse(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any | null,
  conversationId: string | null | undefined,
  error: string,
  details?: unknown,
) {
  logger.error("[api/chat] " + error, details ?? "");
  // Registra de forma não-bloqueante. Timeout do Gemini é operacional
  // (rede/modelo lento) e não deve disparar alerta crítico — grava como warning.
  const isTimeout = /Timeout|aborted|AbortError/i.test(error);
  void logSystemError({
    source: "api:chat",
    severity: isTimeout ? "warning" : "error",
    message: error,
    error: details,
    context: { conversationId: conversationId ?? null },
  });
  if (supabaseAdmin) {
    await persistAssistantReply(supabaseAdmin, conversationId, CHAT_FALLBACK_REPLY);
  }

  return jsonResponse(
    {
      conversationId,
      reply: CHAT_FALLBACK_REPLY,
      fallback: true,
      error,
    },
    { status: 200 },
  );
}

function getRuntimeEnv(request: Request, names: string[]): string | undefined {
  const requestEnv = (
    request as Request & {
      runtime?: { cloudflare?: { env?: RuntimeEnv } };
    }
  ).runtime?.cloudflare?.env;
  const globalEnv = (globalThis as typeof globalThis & { __env__?: RuntimeEnv }).__env__;
  const processEnv = typeof process !== "undefined" ? process.env : undefined;
  const sources = [requestEnv, globalEnv, processEnv];

  for (const name of names) {
    for (const source of sources) {
      const value = source?.[name];
      if (typeof value === "string" && value.trim() !== "") return value;
    }
  }
}

function createSupabaseAdminForChat(
  env: Pick<RequiredChatEnv, "SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY">,
) {
  return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function callGemini(
  apiKey: string,
  systemPrompt: string,
  history: ChatMessage[],
  signal: AbortSignal,
): Promise<{ ok: true; text: string } | { ok: false; status: number; error: string }> {
  const contents = history.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  async function callWithModel(model: string) {
    const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { role: "system", parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 800,
        },
      }),
      signal,
    });
  }

  let res = await callWithModel(AI_MODEL);
  if (res.status === 429 || res.status === 503 || res.status === 500) {
    try {
      res = await callWithModel(AI_MODEL_FALLBACK);
    } catch {
      /* mantém a resposta original */
    }
  }

  if (!res.ok) {
    let errText = "";
    try {
      errText = await res.text();
    } catch {
      /* noop */
    }
    return { ok: false, status: res.status, error: errText || res.statusText };
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text =
    data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  return { ok: true, text };
}

async function loadDeveloperContext(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any,
): Promise<{ profile: DeveloperProfile; faq: DeveloperFaqItem[] }> {
  try {
    const [{ data: profileRow }, { data: faqRows }] = await Promise.all([
      supabaseAdmin
        .from("developer_profile")
        .select("nome, cargo, instituicao, descricao, localizacao, contato, fallback_message")
        .maybeSingle(),
      supabaseAdmin
        .from("developer_faq")
        .select("question, answer, sort_order")
        .order("sort_order", { ascending: true }),
    ]);

    const profile: DeveloperProfile = profileRow
      ? { ...DEFAULT_DEVELOPER_PROFILE, ...profileRow }
      : DEFAULT_DEVELOPER_PROFILE;

    const faq: DeveloperFaqItem[] =
      faqRows && faqRows.length > 0
        ? faqRows.map((r: { question: string; answer: string }) => ({
            question: r.question,
            answer: r.answer,
          }))
        : DEFAULT_DEVELOPER_FAQ;

    return { profile, faq };
  } catch (err) {
    logger.warn("Falha ao carregar contexto do desenvolvedor, usando defaults:", err);
    return { profile: DEFAULT_DEVELOPER_PROFILE, faq: DEFAULT_DEVELOPER_FAQ };
  }
}

function fmtDate(value: string | null | undefined): string {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return String(value);
  }
}

const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const SCHOOL_HISTORY_INFO = `HISTÓRIA, MISSÃO, VISÃO E VALORES DA ESCOLA (use quando perguntarem sobre a origem da escola, quando foi fundada, quem foi Evaristo Campelo, história, missão, visão, valores, identidade, tempo de existência ou "sobre a escola"):

- Fundação: 1982, com apenas duas salas de aula, durante a administração de Nilo Campelo de Matos, então gestor de São Miguel do Tapuio (município ao qual Assunção do Piauí pertencia antes de sua emancipação).
- Ampliação: pouco tempo depois, sob o prefeito Paulo Frota, a escola ganhou mais duas salas de aula.
- Origem do nome: homenagem a Evaristo Campelo, irmão de Nilo Campelo, ex-vereador cujo curral, em tempos passados, ocupava o terreno onde a escola foi erguida.
- Reconstrução: já como escola do recém-criado município de Assunção do Piauí, foi reconstruída no mandato do primeiro prefeito da cidade, José Alves dos Reis. Primeira diretora: professora Rosaura Fernandes de Macedo.
- Idade atual: 44 anos de atuação (fundada em 1982; atualize o cálculo com base no ano vigente informado em DATA E HORA ATUAL).
- Etapas oferecidas: Educação Infantil, Anos Iniciais e Anos Finais do Ensino Fundamental, com projetos pedagógicos, culturais, esportivos e de leitura ao longo do ano.
- Missão: oferecer educação pública gratuita, inclusiva e de qualidade, promovendo o desenvolvimento intelectual, social e emocional dos estudantes em parceria com famílias e comunidade.
- Visão: ser reconhecida como referência de excelência no ensino público de Assunção do Piauí, formando estudantes protagonistas, éticos e preparados para os desafios do século XXI.
- Valores: respeito, responsabilidade, empatia, disciplina, valorização do saber, cuidado com o outro e compromisso com a transformação social pela educação.
- Página institucional completa: [/sobre](/sobre).`;

const STATIC_SCHOOL_INFO = `INFORMAÇÕES INSTITUCIONAIS FIXAS DA ESCOLA (use sempre que perguntarem sobre contatos, endereço, localização, telefones ou e-mail):

- Nome: U.E. Evaristo Campelo de Matos (escola pública estadual)
- Endereço: Rua Av. Sebastião Alves dos Reis, 127 — Assunção do Piauí - PI, CEP 64333-000

CONTATOS OFICIAIS (ATENÇÃO: NÃO CONFUNDA CARGOS — cada pessoa tem seu próprio telefone. A escola tem 2 Diretores e 2 Coordenadores):

DIREÇÃO (Direção da escola) — 2 diretores:
- Diretor: Val de Sousa — WhatsApp: [(86) 98130-5051](https://wa.me/5586981305051) — Telefone: [(86) 98130-5051](tel:+5586981305051)
- Diretora: Hellen — WhatsApp: [(86) 98837-1613](https://wa.me/5586988371613) — Telefone: [(86) 98837-1613](tel:+5586988371613)
- E-mail institucional da direção: [ueecmevaristo2018@gmail.com](mailto:ueecmevaristo2018@gmail.com)

COORDENAÇÃO (Coordenação pedagógica) — 2 coordenadores:
- Coordenadora dos Anos Iniciais: Gonçala Alves — WhatsApp: [(86) 98114-8393](https://wa.me/5586981148393) — Telefone: [(86) 98114-8393](tel:+5586981148393)
- Coordenador dos Anos Finais: Francisco Douglas — WhatsApp: [(86) 98817-5046](https://wa.me/5586988175046) — Telefone: [(86) 98817-5046](tel:+5586988175046)
- E-mail institucional da coordenação: [coordenacao.ueecm@outlook.com](mailto:coordenacao.ueecm@outlook.com)

Regras ao responder:
- SÓ forneça telefone, WhatsApp (link wa.me) ou e-mail quando o usuário PEDIR EXPLICITAMENTE contato, telefone, WhatsApp, número, e-mail ou "como falar com". Nunca inclua contatos de forma proativa quando a pergunta for apenas "quem é/quem são" — nesse caso responda apenas com o(s) nome(s) e cargo(s).
- Se perguntarem "quem é o diretor?" ou "quem são os diretores?", liste apenas os nomes dos DOIS diretores (Val de Sousa e Hellen) e seus cargos, sem telefones nem links.
- Se perguntarem "quem é o coordenador?" ou "quem são os coordenadores?", liste apenas os nomes dos DOIS coordenadores identificando o segmento (Anos Iniciais = Gonçala Alves; Anos Finais = Francisco Douglas), sem telefones nem links.
- Quando o usuário pedir contato de uma pessoa específica, forneça APENAS o contato dela — não liste todos os contatos da escola.
- Nunca misture telefone/e-mail entre diretores e coordenadores, nem entre pessoas diferentes.

LINKS INTERNOS DO BLOG (sempre forneça o link quando o usuário pedir para "ver", "acessar" ou "abrir" uma seção):
- Início: [/](/)
- Notícias / Publicações: [/posts](/posts)
- Calendário de eventos e provas: [/calendario](/calendario)
- Equipe / Profissionais: [/equipe](/equipe)
- Horários de aula: [/horarios](/horarios)
- **Agendar reunião ou visita: [/agendar](/agendar)** — página onde qualquer pessoa (visitante, aluno, responsável ou professor) pode solicitar reunião com Direção, Coordenação ou Professor. NÃO exige cadastro.
- Meus agendamentos (usuário logado): [/meus-agendamentos](/meus-agendamentos)
- Política de Privacidade (LGPD): [/privacidade](/privacidade)
- Termos de Uso: [/termos-de-uso](/termos-de-uso)
- Uso de Imagem: [/uso-de-imagem](/uso-de-imagem)
- Login / Painel: [/login](/login)

PROTEÇÃO DE DADOS / LGPD (Lei nº 13.709/2018):
- O blog respeita integralmente a LGPD. Dados pessoais coletados (e-mail, nome em comentários, fotos institucionais) são tratados apenas para finalidades pedagógicas, administrativas e de comunicação escolar.
- Base legal: cumprimento de obrigação legal/regulatória, execução de políticas públicas e consentimento (para uso de imagem de estudantes, coletado via termo).
- Direitos do titular: confirmação, acesso, correção, anonimização, eliminação e portabilidade — podem ser exercidos pelo e-mail coordenacao.ueecm@outlook.com.
- Detalhes completos em /privacidade e /uso-de-imagem.
- Encarregado (DPO): a Coordenação Escolar — coordenacao.ueecm@outlook.com.

REGRAS DE RESPOSTA:
- SEMPRE formate qualquer link como Markdown clicável — nunca cole a URL crua no texto. Padrões obrigatórios:
  • Página interna do site: [Texto amigável](/caminho) — ex.: [Ver calendário](/calendario), [Agendar reunião](/agendar).
  • WhatsApp: [(DDD) NÚMERO](https://wa.me/55DDDNUMERO) — ex.: [(86) 98817-5046](https://wa.me/5586988175046).
  • Telefone: [(DDD) NÚMERO](tel:+55DDDNUMERO).
  • E-mail: [endereco@dominio](mailto:endereco@dominio).
- SÓ inclua links internos do site quando o usuário pedir para "ver", "acessar", "abrir", "onde encontro" ou "qual o link" da seção. Em perguntas informativas, responda o conteúdo e, se fizer sentido, ofereça o link no fim.
- SÓ inclua telefone, WhatsApp ou e-mail quando o usuário pedir contato explicitamente. Em respostas gerais, mencione apenas o nome e o cargo da pessoa.
- Não liste múltiplos contatos/links de uma vez a menos que o usuário peça "todos os contatos", "lista de contatos" ou equivalente.
- Se a pergunta for sobre "dia das provas", "quando é a prova", "próxima avaliação", procure em CALENDÁRIO — PRÓXIMOS EVENTOS itens cujo título/descrição/categoria mencionem "prova", "avaliação", "simulado" ou "exame" e liste com data, turma e local.
- Se a pergunta for sobre "hoje", "data atual" ou "que dia é hoje", responda com a data informada em DATA E HORA ATUAL.
- Nunca invente telefones, e-mails, datas ou nomes. Se o usuário pedir uma informação que você não tem, oriente-o a falar com a Coordenação — só então inclua o contato: [(86) 98817-5046](https://wa.me/5586988175046).`;

function buildCurrentDateBlock(): string {
  const now = new Date();
  const dataExtenso = now.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Fortaleza",
  });
  const hora = now.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Fortaleza",
  });
  return `DATA E HORA ATUAL (fuso horário do Piauí, America/Fortaleza):\n- Hoje é ${dataExtenso}\n- Hora atual: ${hora}`;
}

async function loadSchoolContext(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any,
): Promise<string> {
  try {
    const nowIso = new Date().toISOString();
    const todayDate = nowIso.slice(0, 10);
    const pastCutoff = new Date();
    pastCutoff.setDate(pastCutoff.getDate() - 15);
    const pastCutoffDate = pastCutoff.toISOString().slice(0, 10);

    const [
      postsRes,
      eventosRes,
      eventosPassadosRes,
      equipeRes,
      horariosRes,
      destaquesRes,
      depoimentosRes,
      patrocinadoresRes,
    ] = await Promise.all([
      supabaseAdmin
        .from("posts")
        .select("titulo, resumo, excerpt, categoria, autor_nome, published_at, slug")
        .eq("status", "publicado")
        .order("published_at", { ascending: false })
        .limit(8),
      supabaseAdmin
        .from("eventos")
        .select("titulo, descricao, data, horario, local, categoria, turma")
        .eq("ativo", true)
        .gte("data", todayDate)
        .order("data", { ascending: true })
        .limit(100),
      supabaseAdmin
        .from("eventos")
        .select("titulo, descricao, data, horario, local, categoria, turma")
        .eq("ativo", true)
        .gte("data", pastCutoffDate)
        .lt("data", todayDate)
        .order("data", { ascending: false })
        .limit(15),
      supabaseAdmin
        .from("profissionais")
        .select("nome, cargo, disciplinas, email")
        .eq("ativo", true)
        .order("ordem", { ascending: true })
        .limit(60),
      supabaseAdmin
        .from("horarios")
        .select(
          "turma, disciplina, professor, dia_semana, hora_inicio, hora_fim, turno, local, ordem",
        )
        .eq("ativo", true)
        .order("turma", { ascending: true })
        .order("dia_semana", { ascending: true })
        .order("turno", { ascending: true })
        .order("ordem", { ascending: true })
        .limit(500),
      supabaseAdmin
        .from("alunos_destaque_publicos")
        .select("aluno_nome, turma_nome, disciplina_nome, posicao, mes")
        .order("mes", { ascending: false })
        .order("turma_nome", { ascending: true })
        .order("posicao", { ascending: true })
        .limit(60),
      supabaseAdmin
        .from("familias_depoimentos_publicos")
        .select("mensagem, autor_nome, vinculo, turma_ano, tipo, created_at")
        .order("created_at", { ascending: false })
        .limit(10),
      supabaseAdmin
        .from("patrocinadores")
        .select("nome, tipo_apoio, descricao, link_url, vigencia_inicio, vigencia_fim, ativo")
        .eq("ativo", true)
        .order("ordem", { ascending: true })
        .limit(30),
    ]);

    const sections: string[] = [];

    const posts = postsRes?.data ?? [];
    if (posts.length > 0) {
      sections.push(
        "ÚLTIMAS NOTÍCIAS / PUBLICAÇÕES DO BLOG (mais recentes primeiro):\n" +
          posts
            .map(
              (
                p: {
                  titulo: string;
                  resumo?: string;
                  excerpt?: string;
                  categoria?: string;
                  autor_nome?: string;
                  published_at?: string;
                  slug?: string;
                },
                i: number,
              ) => {
                const data = fmtDate(p.published_at);
                const resumo = (p.resumo || p.excerpt || "").trim();
                return `${i + 1}. "${p.titulo}"${data ? ` (${data})` : ""}${p.categoria ? ` [${p.categoria}]` : ""}${p.autor_nome ? ` — por ${p.autor_nome}` : ""}${resumo ? `\n   Resumo: ${resumo}` : ""}${p.slug ? `\n   Link: /posts/${p.slug}` : ""}`;
              },
            )
            .join("\n"),
      );
    }

    const eventos = eventosRes?.data ?? [];
    if (eventos.length > 0) {
      sections.push(
        `CALENDÁRIO — PRÓXIMOS EVENTOS (${eventos.length} eventos futuros, ordenados por data crescente):\n` +
          eventos
            .map(
              (e: {
                titulo: string;
                descricao?: string;
                data?: string;
                horario?: string;
                local?: string;
                categoria?: string;
                turma?: string;
              }) => {
                const data = fmtDate(e.data);
                return `- ${data}${e.horario ? ` ${e.horario}` : ""} — ${e.titulo}${e.local ? ` @ ${e.local}` : ""}${e.turma ? ` (turma: ${e.turma})` : ""}${e.categoria ? ` [${e.categoria}]` : ""}${e.descricao ? `\n  ${e.descricao}` : ""}`;
              },
            )
            .join("\n"),
      );
    }

    const eventosPassados = eventosPassadosRes?.data ?? [];
    if (eventosPassados.length > 0) {
      sections.push(
        "CALENDÁRIO — EVENTOS RECENTES (últimos 15 dias, para contexto histórico):\n" +
          eventosPassados
            .map(
              (e: {
                titulo: string;
                descricao?: string;
                data?: string;
                horario?: string;
                local?: string;
                categoria?: string;
                turma?: string;
              }) => {
                const data = fmtDate(e.data);
                return `- ${data}${e.horario ? ` ${e.horario}` : ""} — ${e.titulo}${e.local ? ` @ ${e.local}` : ""}${e.turma ? ` (turma: ${e.turma})` : ""}${e.categoria ? ` [${e.categoria}]` : ""}`;
              },
            )
            .join("\n"),
      );
    }

    const equipe = equipeRes?.data ?? [];
    if (equipe.length > 0) {
      sections.push(
        "EQUIPE / PROFISSIONAIS DA ESCOLA:\n" +
          equipe
            .map(
              (p: {
                nome: string;
                cargo?: string;
                disciplinas?: string[] | string;
                email?: string;
              }) => {
                const disc = Array.isArray(p.disciplinas)
                  ? p.disciplinas.join(", ")
                  : p.disciplinas || "";
                return `- ${p.nome}${p.cargo ? ` — ${p.cargo}` : ""}${disc ? ` (${disc})` : ""}${p.email ? ` · ${p.email}` : ""}`;
              },
            )
            .join("\n"),
      );
    }

    const horarios = horariosRes?.data ?? [];
    if (horarios.length > 0) {
      type HorarioRow = {
        turma?: string;
        disciplina?: string;
        professor?: string;
        dia_semana?: number;
        hora_inicio?: string;
        hora_fim?: string;
        turno?: string;
        local?: string;
        ordem?: number;
      };
      // Agrupar horários por turma para facilitar leitura do modelo
      const porTurma = new Map<string, HorarioRow[]>();
      for (const h of horarios as HorarioRow[]) {
        const t = h.turma ?? "(sem turma)";
        if (!porTurma.has(t)) porTurma.set(t, []);
        porTurma.get(t)!.push(h);
      }
      const turmasOrdenadas = Array.from(porTurma.keys()).sort();
      const blocos = turmasOrdenadas.map((turma) => {
        const linhas = porTurma
          .get(turma)!
          .map((h) => {
            const dia =
              typeof h.dia_semana === "number"
                ? (DIAS_SEMANA[h.dia_semana] ?? `Dia ${h.dia_semana}`)
                : "";
            const hi = (h.hora_inicio || "").slice(0, 5);
            const hf = (h.hora_fim || "").slice(0, 5);
            const faixa = hi && hf ? `${hi}-${hf}` : hi;
            const aula = typeof h.ordem === "number" ? `${h.ordem}ª aula` : "";
            const tempo = faixa || aula;
            return `  • ${dia}${tempo ? ` — ${tempo}` : ""}${h.turno ? ` (${h.turno})` : ""} — ${h.disciplina ?? ""}${h.professor ? ` — Prof. ${h.professor}` : ""}${h.local ? ` @ ${h.local}` : ""}`;
          })
          .join("\n");
        return `Turma ${turma}:\n${linhas}`;
      });
      sections.push(
        `HORÁRIOS DE AULA (${horarios.length} aulas ativas, ${turmasOrdenadas.length} turmas — agrupado por turma. O campo "Nª aula" indica a ordem da aula no turno quando não há horário em minutos cadastrado):\n` +
          blocos.join("\n\n"),
      );
    }

    const destaques = destaquesRes?.data ?? [];
    if (destaques.length > 0) {
      type DestaqueRow = {
        aluno_nome?: string;
        turma_nome?: string;
        disciplina_nome?: string;
        posicao?: number;
        mes?: string;
      };
      const porMes = new Map<string, DestaqueRow[]>();
      for (const d of destaques as DestaqueRow[]) {
        const m = d.mes ?? "";
        if (!porMes.has(m)) porMes.set(m, []);
        porMes.get(m)!.push(d);
      }
      const blocos: string[] = [];
      for (const [mes, rows] of porMes) {
        const mesLabel = mes
          ? new Date(mes).toLocaleDateString("pt-BR", {
              month: "long",
              year: "numeric",
              timeZone: "America/Fortaleza",
            })
          : "";
        const linhas = rows
          .map(
            (r) =>
              `  • ${r.posicao ? `${r.posicao}º ` : ""}${r.aluno_nome ?? ""}${r.turma_nome ? ` — ${r.turma_nome}` : ""}${r.disciplina_nome ? ` (${r.disciplina_nome})` : ""}`,
          )
          .join("\n");
        blocos.push(`Mês ${mesLabel}:\n${linhas}`);
      }
      sections.push(
        `ALUNOS EM DESTAQUE (reconhecimento mensal por desempenho — página pública: /alunos-destaque):\n${blocos.join("\n\n")}`,
      );
    }

    const depoimentos = depoimentosRes?.data ?? [];
    if (depoimentos.length > 0) {
      const linhas = (
        depoimentos as Array<{
          mensagem?: string;
          autor_nome?: string;
          vinculo?: string;
          turma_ano?: string;
          tipo?: string;
        }>
      )
        .map((d) => {
          const msg = (d.mensagem ?? "").replace(/\s+/g, " ").trim();
          const trecho = msg.length > 220 ? msg.slice(0, 220) + "…" : msg;
          return `- "${trecho}" — ${d.autor_nome ?? "Autor(a)"}${d.vinculo ? ` (${d.vinculo})` : ""}${d.turma_ano ? `, ${d.turma_ano}` : ""}${d.tipo ? ` [${d.tipo}]` : ""}`;
        })
        .join("\n");
      sections.push(
        `DEPOIMENTOS DAS FAMÍLIAS UEECM (mensagens aprovadas publicadas em /familias — use para responder "o que as famílias dizem", "depoimentos", "opiniões dos pais"):\n${linhas}`,
      );
    }

    const patrocinadores = patrocinadoresRes?.data ?? [];
    if (patrocinadores.length > 0) {
      const hoje = new Date().toISOString().slice(0, 10);
      const ativos = (
        patrocinadores as Array<{
          nome: string;
          tipo_apoio?: string;
          descricao?: string;
          link_url?: string;
          vigencia_inicio?: string;
          vigencia_fim?: string;
        }>
      ).filter((p) => {
        const ini = p.vigencia_inicio ? p.vigencia_inicio.slice(0, 10) : null;
        const fim = p.vigencia_fim ? p.vigencia_fim.slice(0, 10) : null;
        if (ini && ini > hoje) return false;
        if (fim && fim < hoje) return false;
        return true;
      });
      if (ativos.length > 0) {
        const linhas = ativos
          .map(
            (p) =>
              `- ${p.nome}${p.tipo_apoio ? ` — ${p.tipo_apoio}` : ""}${p.descricao ? ` · ${p.descricao}` : ""}`,
          )
          .join("\n");
        sections.push(
          `NOSSOS PATROCINADORES / APOIADORES ATUAIS (empresas e pessoas que apoiam a escola — visível na página inicial):\n${linhas}`,
        );
      }
    }

    if (sections.length === 0) return "";

    return `\n\n---\n\nDADOS ATUAIS DA ESCOLA (use SEMPRE estas informações ao responder sobre notícias, calendário, eventos, equipe, professores e horários. Se o usuário pedir "a última notícia", entregue um resumo do primeiro item de ÚLTIMAS NOTÍCIAS. Ao responder sobre horários, use SEMPRE os dados abaixo agrupados por turma — se o usuário perguntar "qual o horário da turma X na segunda?", filtre apenas as linhas da turma X com dia = Segunda e apresente na ordem 1ª, 2ª, 3ª, 4ª aula. Se não houver horário em minutos, apresente pela ordem da aula (ex.: "1ª aula: Matemática com Prof. Cícero"). Ao responder sobre eventos/provas, use as datas exatas do CALENDÁRIO. Não invente dados que não estejam aqui.):\n\n${sections.join("\n\n")}`;
  } catch (err) {
    logger.warn("Falha ao carregar contexto da escola:", err);
    return "";
  }
}

const SITE_PAGES: Array<{ path: string; title: string; description: string; keywords: string[] }> =
  [
    {
      path: "/",
      title: "Início",
      description: "Página inicial do blog com destaques e últimas notícias.",
      keywords: ["inicio", "home", "principal", "destaques"],
    },
    {
      path: "/posts",
      title: "Notícias / Publicações",
      description: "Todas as notícias, comunicados e publicações do blog.",
      keywords: [
        "noticia",
        "noticias",
        "publicacao",
        "publicacoes",
        "blog",
        "post",
        "posts",
        "comunicado",
      ],
    },
    {
      path: "/calendario",
      title: "Calendário",
      description: "Calendário escolar com eventos, provas, feriados e datas importantes.",
      keywords: [
        "calendario",
        "evento",
        "eventos",
        "prova",
        "provas",
        "avaliacao",
        "simulado",
        "feriado",
        "data",
        "agenda",
      ],
    },
    {
      path: "/equipe",
      title: "Equipe / Profissionais",
      description: "Lista de professores, coordenação, direção e demais profissionais.",
      keywords: [
        "equipe",
        "professor",
        "professores",
        "profissional",
        "profissionais",
        "coordenacao",
        "direcao",
        "funcionario",
      ],
    },
    {
      path: "/horarios",
      title: "Horários",
      description: "Horários de aula por turma, disciplina e turno.",
      keywords: ["horario", "horarios", "aula", "turma", "turno", "disciplina"],
    },
    {
      path: "/agendar",
      title: "Agendar reunião",
      description: "Solicitar reunião ou visita com Direção, Coordenação ou Professor.",
      keywords: [
        "agendar",
        "agendamento",
        "reuniao",
        "reunião",
        "visita",
        "marcar",
        "marcaçao",
        "horario",
      ],
    },
    {
      path: "/meus-agendamentos",
      title: "Meus agendamentos",
      description: "Acompanhar reuniões solicitadas (requer login).",
      keywords: ["meus", "agendamentos", "minhas", "reunioes"],
    },
    {
      path: "/privacidade",
      title: "Política de Privacidade (LGPD)",
      description: "Política de privacidade, LGPD e proteção de dados.",
      keywords: ["privacidade", "lgpd", "dados", "protecao", "politica"],
    },
    {
      path: "/termos-de-uso",
      title: "Termos de Uso",
      description: "Termos e condições de uso do blog.",
      keywords: ["termos", "uso", "condicoes"],
    },
    {
      path: "/uso-de-imagem",
      title: "Uso de Imagem",
      description: "Termo de autorização e política de uso de imagem.",
      keywords: ["imagem", "foto", "autorizacao"],
    },
    {
      path: "/sobre",
      title: "Sobre a escola",
      description: "História, missão, visão e valores da U.E. Evaristo Campelo de Matos.",
      keywords: [
        "sobre",
        "historia",
        "história",
        "missao",
        "missão",
        "visao",
        "visão",
        "valores",
        "fundacao",
        "fundação",
        "identidade",
      ],
    },
    {
      path: "/alunos-destaque",
      title: "Alunos em destaque",
      description: "Reconhecimento mensal aos alunos com melhor desempenho.",
      keywords: [
        "destaque",
        "destaques",
        "alunos",
        "melhores",
        "premio",
        "prêmio",
        "reconhecimento",
        "medalha",
      ],
    },
    {
      path: "/familias",
      title: "Famílias UEECM",
      description: "Depoimentos e opiniões das famílias, alunos e comunidade.",
      keywords: [
        "familias",
        "famílias",
        "depoimento",
        "depoimentos",
        "opinioes",
        "opiniões",
        "pais",
        "responsaveis",
        "responsáveis",
      ],
    },
    {
      path: "/login",
      title: "Login",
      description: "Acesso ao painel para colaboradores.",
      keywords: ["login", "entrar", "acesso", "painel"],
    },
  ];

const STOPWORDS = new Set([
  "a",
  "o",
  "as",
  "os",
  "um",
  "uma",
  "de",
  "do",
  "da",
  "dos",
  "das",
  "e",
  "ou",
  "que",
  "qual",
  "quais",
  "quando",
  "onde",
  "como",
  "porque",
  "por",
  "para",
  "com",
  "sem",
  "em",
  "no",
  "na",
  "nos",
  "nas",
  "ao",
  "aos",
  "à",
  "às",
  "se",
  "sua",
  "seu",
  "suas",
  "seus",
  "me",
  "te",
  "nos",
  "vos",
  "lhe",
  "lhes",
  "ser",
  "estar",
  "ter",
  "haver",
  "foi",
  "foram",
  "sao",
  "é",
  "eh",
  "tem",
  "temos",
  "ha",
  "há",
  "hoje",
  "ontem",
  "amanha",
  "amanhã",
  "mais",
  "menos",
  "muito",
  "pouco",
  "tudo",
  "nada",
  "algo",
  "isso",
  "esse",
  "essa",
  "este",
  "esta",
  "aquele",
  "aquela",
  "ele",
  "ela",
  "eles",
  "elas",
  "voce",
  "você",
  "voces",
  "vocês",
  "eu",
  "nos",
  "nós",
  "sobre",
  "entre",
  "ate",
  "até",
  "ja",
  "já",
  "mas",
  "tambem",
  "também",
  "nao",
  "não",
  "sim",
  "qual",
  "quem",
  "favor",
  "pode",
  "poderia",
  "quero",
  "gostaria",
  "saber",
  "me",
  "diga",
  "fale",
  "explique",
  "mostre",
  "blog",
  "escola",
  "aqui",
]);

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractKeywords(message: string, max = 6): string[] {
  const tokens = normalize(message)
    .split(" ")
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tokens) {
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

function suggestPages(message: string): typeof SITE_PAGES {
  const norm = normalize(message);
  const scored = SITE_PAGES.map((p) => {
    let score = 0;
    for (const k of p.keywords) if (norm.includes(k)) score += 1;
    return { p, score };
  }).filter((x) => x.score > 0);
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 4).map((x) => x.p);
}

type RagSource = { index: number; title: string; link: string };

type RagResult = { block: string; sources: RagSource[]; allowedLinks: Set<string> };

const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIMS = 1536;

async function embedText(text: string, geminiApiKey: string): Promise<number[] | null> {
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 10_000);
    // SEGURANÇA: chave no header, nunca na URL (evita vazamento em logs
    // caso o fetch lance um erro que inclua a URL da requisição).
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": geminiApiKey,
      },
      body: JSON.stringify({
        content: { parts: [{ text: text.slice(0, 6000) }] },
        outputDimensionality: EMBEDDING_DIMS,
      }),
      signal: ctrl.signal,
    });
    clearTimeout(to);
    if (!res.ok) {
      // Loga apenas status — o corpo da resposta do Gemini nunca inclui a
      // chave, mas mantemos a política de logar o mínimo necessário.
      logger.warn("[embedText] gemini falhou:", res.status);
      return null;
    }
    const data = (await res.json()) as { embedding?: { values?: number[] } };
    const emb = data?.embedding?.values;
    return Array.isArray(emb) && emb.length === EMBEDDING_DIMS ? emb : null;
  } catch (err) {
    // Loga só o nome/mensagem sanitizada — nunca o objeto de erro cru
    // do fetch, que em alguns runtimes carrega a URL original.
    const msg = err instanceof Error ? err.message : "erro desconhecido";
    logger.warn("[embedText] erro:", msg);
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function backfillPostEmbeddings(supabaseAdmin: any, geminiApiKey: string): Promise<void> {
  try {
    const { data } = await supabaseAdmin
      .from("posts")
      .select("id, titulo, resumo, excerpt, conteudo, categoria")
      .eq("status", "publicado")
      .is("embedding", null)
      .limit(3);
    if (!data || data.length === 0) return;
    for (const p of data as Array<{
      id: string;
      titulo: string;
      resumo?: string;
      excerpt?: string;
      conteudo?: string;
      categoria?: string;
    }>) {
      const text = [
        p.titulo,
        p.categoria,
        p.resumo || p.excerpt,
        (p.conteudo || "").replace(/<[^>]+>/g, " "),
      ]
        .filter(Boolean)
        .join("\n\n")
        .slice(0, 6000);
      if (!text.trim()) continue;
      const emb = await embedText(text, geminiApiKey);
      if (!emb) continue;
      await supabaseAdmin
        .from("posts")
        .update({
          embedding: emb as unknown as string,
          embedding_updated_at: new Date().toISOString(),
        })
        .eq("id", p.id);
    }
  } catch (err) {
    logger.warn("[backfillPostEmbeddings] erro:", err);
  }
}

type PostHit = {
  id: string;
  titulo: string;
  resumo?: string;
  excerpt?: string;
  conteudo?: string;
  categoria?: string;
  autor_nome?: string;
  published_at?: string;
  slug?: string;
  tags?: string[];
  score: number;
};

async function semanticSearchPosts(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any,
  queryEmbedding: number[],
): Promise<PostHit[]> {
  try {
    const { data, error } = await supabaseAdmin.rpc("match_posts", {
      query_embedding: queryEmbedding as unknown as string,
      match_count: 5,
      min_similarity: 0.55,
    });
    if (error || !data) return [];
    return (data as Array<PostHit & { similarity: number }>).map((p) => ({
      ...p,
      score: 10 + p.similarity * 10, // boost semantic matches
    }));
  } catch (err) {
    logger.warn("[semanticSearchPosts] erro:", err);
    return [];
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function keywordSearchPosts(supabaseAdmin: any, message: string): Promise<PostHit[]> {
  const keywords = extractKeywords(message);
  if (keywords.length === 0) return [];
  try {
    const orClauses: string[] = [];
    for (const k of keywords) {
      const safe = k.replace(/[,%()]/g, "");
      if (!safe) continue;
      orClauses.push(
        `titulo.ilike.%${safe}%`,
        `resumo.ilike.%${safe}%`,
        `excerpt.ilike.%${safe}%`,
        `conteudo.ilike.%${safe}%`,
        `categoria.ilike.%${safe}%`,
      );
    }
    if (orClauses.length === 0) return [];
    const { data, error } = await supabaseAdmin
      .from("posts")
      .select(
        "id, titulo, resumo, excerpt, conteudo, categoria, autor_nome, published_at, slug, tags",
      )
      .eq("status", "publicado")
      .or(orClauses.join(","))
      .order("published_at", { ascending: false })
      .limit(20);
    if (error || !data) return [];
    return (data as PostHit[])
      .map((p) => {
        const hay = normalize(
          [p.titulo, p.resumo, p.excerpt, p.conteudo, p.categoria, (p.tags ?? []).join(" ")]
            .filter(Boolean)
            .join(" "),
        );
        let score = 0;
        for (const k of keywords) {
          const m = hay.split(k).length - 1;
          if (m > 0) score += m + (p.titulo && normalize(p.titulo).includes(k) ? 3 : 0);
        }
        return { ...p, score };
      })
      .filter((p) => p.score > 0);
  } catch (err) {
    logger.warn("[keywordSearchPosts] erro:", err);
    return [];
  }
}

async function ragHybridSearch(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any,
  message: string,
  geminiApiKey: string | undefined,
): Promise<RagResult> {
  let queryEmbedding: number[] | null = null;
  if (geminiApiKey) {
    queryEmbedding = await embedText(message, geminiApiKey);
    // best-effort backfill em background (não bloqueia resposta)
    void backfillPostEmbeddings(supabaseAdmin, geminiApiKey);
  }

  const [semantic, keyword] = await Promise.all([
    queryEmbedding
      ? semanticSearchPosts(supabaseAdmin, queryEmbedding)
      : Promise.resolve([] as PostHit[]),
    keywordSearchPosts(supabaseAdmin, message),
  ]);

  // Merge unique por id, somando scores
  const merged = new Map<string, PostHit>();
  for (const p of [...semantic, ...keyword]) {
    const prev = merged.get(p.id);
    if (prev) prev.score += p.score;
    else merged.set(p.id, { ...p });
  }
  const top = Array.from(merged.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  if (top.length === 0) return { block: "", sources: [], allowedLinks: new Set() };

  const sources: RagSource[] = [];
  const allowedLinks = new Set<string>();
  const lines = top.map((p, i) => {
    const link = `/posts/${p.slug ?? p.id}`;
    allowedLinks.add(link);
    const data = fmtDate(p.published_at);
    const snippetSrc = (p.resumo || p.excerpt || p.conteudo || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const snippet = snippetSrc.length > 320 ? snippetSrc.slice(0, 320) + "…" : snippetSrc;
    sources.push({ index: i + 1, title: p.titulo, link });
    return `[${i + 1}] "${p.titulo}"${data ? ` (${data})` : ""}${p.categoria ? ` [${p.categoria}]` : ""}\n    Link: ${link}\n    Trecho: ${snippet}`;
  });

  const mode = queryEmbedding ? "híbrido: semântico + palavras-chave" : "apenas palavras-chave";
  return {
    block: `\n\nRESULTADOS DE BUSCA NO BLOG (RAG ${mode}; SEMPRE cite usando [1], [2]... e inclua os links na seção "Fontes:"):\n${lines.join("\n")}`,
    sources,
    allowedLinks,
  };
}

function buildPagesBlock(message: string): { block: string; allowedLinks: Set<string> } {
  const pages = suggestPages(message);
  const allowedLinks = new Set<string>();
  for (const p of SITE_PAGES) allowedLinks.add(p.path); // todas as páginas conhecidas são sempre válidas
  if (pages.length === 0) return { block: "", allowedLinks };
  const lines = pages.map((p) => `- ${p.title} — ${p.path} · ${p.description}`);
  return {
    block: `\n\nPÁGINAS DO SITE RELEVANTES PARA ESTA PERGUNTA (cite o link correspondente):\n${lines.join("\n")}`,
    allowedLinks,
  };
}

// Sanitiza a resposta: remove URLs que não estejam na lista permitida e
// citações [N] que não correspondem a nenhuma fonte real.
function sanitizeAssistantReply(
  text: string,
  sources: RagSource[],
  allowedInternal: Set<string>,
): string {
  let out = text;
  const validIndexes = new Set(sources.map((s) => s.index));

  // 1) Remove citações [N] inválidas
  out = out.replace(/\[(\d{1,2})\]/g, (m, n) => (validIndexes.has(Number(n)) ? m : ""));

  // 2) Whitelist de domínios externos seguros (wa.me oficiais da escola, mailto)
  const EXTERNAL_ALLOW = [
    // WhatsApp — Direção
    "https://wa.me/5586981305051", // Val de Sousa
    "https://wa.me/5586988371613", // Hellen
    // WhatsApp — Coordenação
    "https://wa.me/5586981148393", // Gonçala Alves (Anos Iniciais)
    "https://wa.me/5586988175046", // Francisco Douglas (Anos Finais)
    // E-mails institucionais
    "mailto:coordenacao.ueecm@outlook.com",
    "mailto:ueecmevaristo2018@gmail.com",
  ];

  // 3) Substitui URLs absolutas não permitidas
  out = out.replace(/https?:\/\/[^\s)\]]+/g, (url) => {
    const clean = url.replace(/[.,;:!?]+$/, "");
    if (EXTERNAL_ALLOW.some((u) => clean.startsWith(u))) return url;
    logger.warn("[sanitize] URL externa removida:", clean);
    return "(link removido)";
  });

  // 4) Valida caminhos internos apenas dentro de links markdown [texto](/xxx)
  //    para evitar destruir datas (ex.: 25/06/2026) ou frações no texto livre.
  out = out.replace(/\]\((\/[a-z0-9][a-z0-9/_-]*)\)/gi, (full, path: string) => {
    const base = path.split(/[?#]/)[0];
    const ok =
      allowedInternal.has(base) ||
      Array.from(allowedInternal).some((a) => base === a || base.startsWith(a + "/"));
    return ok ? full : "](/)";
  });

  return out;
}

// (buildClarifyingReply removido: causava respostas incoerentes ao substituir
// saudações e agradecimentos válidos por um texto genérico de esclarecimento.)

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let supabaseAdmin: any | null = null;
        let conversationId: string | null | undefined = null;

        try {
          // Validação de variáveis de ambiente obrigatórias no servidor
          const requiredEnv = {
            GEMINI_API_KEY: getRuntimeEnv(request, ["GEMINI_API_KEY"]),
            SUPABASE_URL: getRuntimeEnv(request, [
              "SUPABASE_URL",
              "PROJECT_SUPABASE_URL",
              "VITE_SUPABASE_URL",
            ]),
            SUPABASE_SERVICE_ROLE_KEY: getRuntimeEnv(request, [
              "SUPABASE_SERVICE_ROLE_KEY",
              "SERVICE_ROLE_KEY",
            ]),
          };
          const missing = Object.entries(requiredEnv)
            .filter(([, v]) => !v || String(v).trim() === "")
            .map(([k]) => k);
          if (missing.length > 0) {
            const message = `⚠️ Configuração do servidor incompleta no deploy. Variáveis ausentes: ${missing.join(", ")}. Cadastre-as como secrets no Cloudflare Workers (Settings → Variables and Secrets, ou \`wrangler secret put <NOME>\`) e refaça o deploy.`;
            logger.error("[api/chat] Missing env vars:", missing);
            return jsonResponse(
              {
                conversationId: null,
                reply: message,
                fallback: true,
                error: "missing_env",
                missing,
              },
              { status: 200 },
            );
          }
          const env: RequiredChatEnv = {
            GEMINI_API_KEY: requiredEnv.GEMINI_API_KEY!,
            SUPABASE_URL: requiredEnv.SUPABASE_URL!,
            SUPABASE_SERVICE_ROLE_KEY: requiredEnv.SUPABASE_SERVICE_ROLE_KEY!,
          };
          const apiKey = env.GEMINI_API_KEY;

          const body = (await request.json()) as ChatRequest;
          const { sessionId, message } = body;
          conversationId = body.conversationId;

          if (!sessionId || !message || typeof message !== "string") {
            return jsonResponse(
              { error: "Parâmetros inválidos" },
              {
                status: 400,
              },
            );
          }

          // Rate limit em dois níveis: (IP+sessão) + global por IP (minuto/hora)
          const rl = checkRateLimit(getClientKey(request, sessionId), getClientIp(request));
          if (!rl.ok) {
            return jsonResponse(
              {
                conversationId,
                reply: `Você atingiu o limite de mensagens. Aguarde ${rl.retryAfter}s e tente de novo.`,
                fallback: true,
                error: "rate_limited",
              },
              { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
            );
          }

          // Limite de tamanho da mensagem para evitar abuso
          if (message.length > 4000) {
            return jsonResponse(
              { error: "Mensagem muito longa (máx. 4000 caracteres)." },
              { status: 413 },
            );
          }

          supabaseAdmin = createSupabaseAdminForChat(env);
          const [{ profile, faq }, schoolContext, ragResult] = await Promise.all([
            loadDeveloperContext(supabaseAdmin),
            loadSchoolContext(supabaseAdmin),
            ragHybridSearch(supabaseAdmin, message, undefined),
          ]);
          const pagesResult = buildPagesBlock(message);
          const hasSources = ragResult.sources.length > 0;
          const allowedInternal = new Set<string>([
            ...ragResult.allowedLinks,
            ...pagesResult.allowedLinks,
          ]);

          const ragInstructions =
            "\n\n---\n\nINSTRUÇÕES DE CITAÇÃO E ANTI-ALUCINAÇÃO (RAG):\n" +
            "- Cite RESULTADOS DE BUSCA NO BLOG no texto com marcadores [1], [2]... e termine com uma seção 'Fontes:' listando '[n] Título — /posts/slug'.\n" +
            "- NUNCA invente títulos, datas, telefones, e-mails ou URLs que não estejam neste contexto. Use apenas caminhos internos listados em PÁGINAS DO SITE ou em RESULTADOS DE BUSCA.\n" +
            "- Se a busca não trouxer resultados E o usuário fez uma pergunta vaga, NÃO chute uma resposta: faça 1-3 perguntas curtas de esclarecimento (assunto, data, turma, seção do site) antes de prosseguir.\n" +
            "- Se tiver certeza parcial, responda o que sabe a partir do contexto e diga explicitamente o que não encontrou, sugerindo a seção mais provável (/posts, /calendario, /equipe, /horarios).\n" +
            (hasSources
              ? `- Fontes disponíveis nesta resposta: ${ragResult.sources.map((s) => `[${s.index}] ${s.link}`).join(" | ")}.`
              : "- ATENÇÃO: a busca não retornou fontes relevantes. NÃO use marcadores [N] nem invente uma seção 'Fontes:'. Em vez disso, faça perguntas de esclarecimento como descrito acima.");

          let systemPrompt =
            buildSystemPrompt(profile, faq) +
            "\n\n---\n\n" +
            buildCurrentDateBlock() +
            "\n\n---\n\n" +
            STATIC_SCHOOL_INFO +
            "\n\n---\n\n" +
            SCHOOL_HISTORY_INFO +
            schoolContext +
            pagesResult.block +
            ragResult.block +
            ragInstructions;

          // Groq free tier limita TPM (12000 para o modelo primário). ~4 chars por token.
          // Deixamos ~8000 tokens (32000 chars) para o system prompt; sobra folga para histórico + resposta.
          const SYSTEM_PROMPT_MAX_CHARS = 22000;
          if (systemPrompt.length > SYSTEM_PROMPT_MAX_CHARS) {
            systemPrompt =
              systemPrompt.slice(0, SYSTEM_PROMPT_MAX_CHARS) +
              "\n\n[...contexto truncado para caber no limite do modelo...]";
          }

          if (conversationId) {
            const { data: existingConversation, error: existingConversationError } =
              await supabaseAdmin
                .from("chat_conversations")
                .select("id")
                .eq("id", conversationId)
                .eq("session_id", sessionId)
                .maybeSingle();

            if (existingConversationError) throw existingConversationError;
            if (!existingConversation) conversationId = null;
          }

          // Cria conversa se necessário
          if (!conversationId) {
            const { data, error } = await supabaseAdmin
              .from("chat_conversations")
              .insert({ session_id: sessionId, title: message.slice(0, 60) })
              .select("id")
              .single();
            if (error) throw error;
            conversationId = data.id;
          }

          // Salva mensagem do usuário
          const { error: userMessageError } = await supabaseAdmin.from("chat_messages").insert({
            conversation_id: conversationId,
            role: "user",
            content: message,
          });
          if (userMessageError) throw userMessageError;

          // Busca histórico (últimas 20 mensagens) para contexto
          const { data: history, error: historyError } = await supabaseAdmin
            .from("chat_messages")
            .select("role, content")
            .eq("conversation_id", conversationId)
            .order("created_at", { ascending: true })
            .limit(10);
          if (historyError) throw historyError;

          let contents: ChatMessage[] = (
            (history ?? []) as Array<{ role: string; content: string }>
          )
            .filter((m) => m.role === "user" || m.role === "assistant")
            .map((m) => ({
              role: m.role === "assistant" ? "assistant" : "user",
              content: m.content,
            }));

          if (contents.length === 0) {
            contents = [{ role: "user", content: message }];
          }

          async function callGeminiWithRetry(): Promise<string> {
            const attempt = async () => {
              const ctrl = new AbortController();
              const to = setTimeout(() => ctrl.abort(), AI_TIMEOUT_MS);
              try {
                return await callGemini(apiKey, systemPrompt, contents, ctrl.signal);
              } finally {
                clearTimeout(to);
              }
            };
            let result = await attempt();
            if (!result.ok && (result.status === 429 || result.status === 503)) {
              await new Promise((r) => setTimeout(r, 800));
              result = await attempt();
            }
            if (!result.ok) {
              throw new Error(`Gemini ${result.status}: ${result.error}`);
            }
            return result.text;
          }

          let rawAssistantText = "";
          try {
            rawAssistantText = await callGeminiWithRetry();
          } catch (err) {
            const errMsg = (err as Error)?.message ?? "";
            const isAbort = (err as Error)?.name === "AbortError";
            const isQuota = /429|RESOURCE_EXHAUSTED|quota/i.test(errMsg);
              return fallbackChatResponse(
              supabaseAdmin,
              conversationId,
              isAbort
                  ? `Timeout (>${AI_TIMEOUT_MS}ms) ao chamar Gemini`
                : isQuota
                    ? "Cota do Gemini esgotada — verifique o plano da API Key."
                    : "Falha ao chamar Gemini",
              err,
            );
          }

          // Se a IA realmente não retornou texto, cai no fallback padrão.
          if (!rawAssistantText.trim()) {
            return fallbackChatResponse(
              supabaseAdmin,
              conversationId,
              "Groq retornou resposta vazia",
              null,
            );
          }

          // Validação automática de citações e URLs (anti-alucinação).
          // NÃO substituímos mais respostas curtas por um "clarifying reply" —
          // isso destruía saudações e agradecimentos legítimos ("oi", "obrigado").
          const assistantText = sanitizeAssistantReply(
            rawAssistantText,
            ragResult.sources,
            allowedInternal,
          );

          await persistAssistantReply(supabaseAdmin, conversationId, assistantText);

          return jsonResponse(
            {
              conversationId,
              reply: assistantText,
              sources: ragResult.sources,
              ragMode: "keyword",
            },
            { status: 200 },
          );
        } catch (err) {
          return fallbackChatResponse(supabaseAdmin, conversationId, "Erro interno no chat", err);
        }
      },
    },
  },
});

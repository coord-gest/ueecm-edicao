import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// -------- Prompt / schema -------- //
const DISCIPLINAS = [
  "lingua_portuguesa",
  "matematica",
  "historia",
  "geografia",
  "ciencias",
  "artes",
  "ensino_religioso",
  "educacao_fisica",
  "ingles",
  "leitura_producao",
];
const COLUNAS = ["aq1", "ae1", "aq2", "ae2", "rec2", "aq3", "ae3", "aq4", "ae4", "rec4", "pf"];

const PROMPT = `Você recebe UM boletim escolar em PDF (SEMED — Assunção do Piauí).
Extraia os dados do aluno e as notas de cada disciplina/avaliação.

Regras rígidas:
- Retorne APENAS um JSON no formato pedido, sem texto extra.
- Notas devem ser strings com uma casa decimal, usando vírgula ("8,5"). Para nota ausente use "-".
- Se não identificar o boletim ou não houver notas legíveis, retorne { "ok": false, "erro": "motivo curto" }.

Disciplinas esperadas (10 chaves): ${DISCIPLINAS.join(", ")}.
Cada disciplina tem 11 avaliações (chaves): ${COLUNAS.join(", ")}.
  - aq1/ae1  → 1º bimestre (Avaliação Qualitativa / Avaliação Escrita)
  - aq2/ae2/rec2 → 2º bimestre (com Recuperação)
  - aq3/ae3  → 3º bimestre
  - aq4/ae4/rec4 → 4º bimestre (com Recuperação)
  - pf → Prova Final

Formato de saída:
{
  "ok": true,
  "nome_completo": "...",
  "matricula": "...",
  "inep": "...",
  "sexo": "MASCULINO" | "FEMININO" | "",
  "nascimento": "DD/MM/AAAA",
  "mae": "...",
  "pai": "...",
  "notas": {
    "lingua_portuguesa": { "aq1": "8,0", "ae1": "-", ... "pf": "-" },
    ...
  }
}`;

const InputSchema = z.object({
  arquivos: z
    .array(
      z.object({
        filename: z.string().min(1).max(255),
        base64: z.string().min(100),
      }),
    )
    .min(1)
    .max(50),
});

type ParsedBoletim = {
  ok: boolean;
  filename: string;
  erro?: string;
  nome_completo?: string;
  matricula?: string;
  inep?: string;
  sexo?: string;
  nascimento?: string;
  mae?: string;
  pai?: string;
  notas?: Record<string, Record<string, string>>;
};

function sanitizeNota(v: unknown): string {
  if (v == null) return "-";
  const s = String(v).trim().replace(".", ",");
  if (!s || s === "-") return "-";
  // aceita apenas dígitos e vírgula, no máx 4 chars
  const clean = s.replace(/[^\d,]/g, "").slice(0, 4);
  if (!clean) return "-";
  const num = Number(clean.replace(",", "."));
  if (!Number.isFinite(num) || num < 0 || num > 10) return "-";
  return clean;
}

function normalizeParsed(raw: unknown, filename: string): ParsedBoletim {
  if (!raw || typeof raw !== "object")
    return { ok: false, filename, erro: "Resposta inválida do modelo" };
  const r = raw as Record<string, unknown>;
  if (r.ok === false) {
    return { ok: false, filename, erro: String(r.erro ?? "Não foi possível extrair.") };
  }
  const notasIn = (r.notas ?? {}) as Record<string, Record<string, unknown>>;
  const notas: Record<string, Record<string, string>> = {};
  for (const d of DISCIPLINAS) {
    const src = notasIn[d] ?? {};
    const dst: Record<string, string> = {};
    for (const c of COLUNAS) dst[c] = sanitizeNota(src?.[c]);
    notas[d] = dst;
  }
  const nome = String(r.nome_completo ?? "").trim();
  if (!nome) return { ok: false, filename, erro: "Nome do aluno não encontrado no PDF." };
  return {
    ok: true,
    filename,
    nome_completo: nome,
    matricula: r.matricula ? String(r.matricula) : "",
    inep: r.inep ? String(r.inep) : "",
    sexo: r.sexo ? String(r.sexo).toUpperCase() : "",
    nascimento: r.nascimento ? String(r.nascimento) : "",
    mae: r.mae ? String(r.mae) : "",
    pai: r.pai ? String(r.pai) : "",
    notas,
  };
}

export const importarBoletinsPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ results: ParsedBoletim[] }> => {
    const { data: isStaff, error: roleError } = await context.supabase.rpc(
      "is_professor_or_staff",
      { _user_id: context.userId },
    );
    if (roleError) throw roleError;
    if (!isStaff) throw new Error("Acesso restrito à equipe da escola.");

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY não configurada no servidor.");

    const results: ParsedBoletim[] = [];
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    // Modelos em ordem de preferência — se um estourar cota, tentamos o próximo
    const MODELS = ["gemini-flash-latest"];

    async function callGemini(model: string, base64: string): Promise<Response> {
      return fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey!)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: PROMPT },
                  { inline_data: { mime_type: "application/pdf", data: base64 } },
                ],
              },
            ],
            generationConfig: {
              temperature: 0,
              maxOutputTokens: 8192,
              responseMimeType: "application/json",
            },
          }),
        },
      );
    }

    // Sequencial + retry com backoff + fallback de modelo (free-tier do Gemini)
    for (const arq of data.arquivos) {
      try {
        let resp: Response | null = null;
        let lastBody = "";
        let lastStatus: number | undefined;

        outer: for (const model of MODELS) {
          const maxAttempts = 3;
          for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            resp = await callGemini(model, arq.base64);
            lastStatus = resp.status;
            if (resp.ok) break outer;
            lastBody = await resp.text();
            const retryAfter = Number(resp.headers.get("retry-after") ?? "0");

            if (resp.status === 429 || resp.status === 503) {
              if (attempt >= maxAttempts) break; // pula pro próximo modelo
              const waitMs = retryAfter > 0 ? retryAfter * 1000 : 1500 * Math.pow(2, attempt - 1);
              logger.warn(
                `[importarBoletinsPdf] ${resp.status} em ${arq.filename} (${model}) tentativa ${attempt}/${maxAttempts}, aguardando ${waitMs}ms`,
              );
              await sleep(waitMs);
              continue;
            }
            if (resp.status === 404) break; // modelo inexistente/deprecado: tenta o próximo
            break outer; // outros erros: não adianta trocar de modelo
          }
          logger.warn(`[importarBoletinsPdf] modelo ${model} indisponível, tentando próximo`);
        }

        if (!resp || !resp.ok) {
          logger.error("[importarBoletinsPdf] Gemini erro", lastStatus, lastBody.slice(0, 500));
          const erro =
            lastStatus === 429
              ? "Cota do Gemini esgotada em todos os modelos gratuitos. Aguarde alguns minutos e envie menos PDFs por vez."
              : `Gemini ${lastStatus ?? "sem resposta"}`;
          results.push({ ok: false, filename: arq.filename, erro });
          if (lastStatus === 429) await sleep(3000);
          continue;
        }

        // Espaçamento leve entre requisições bem-sucedidas para não estourar cota
        await sleep(400);

        const json = (await resp.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
        let parsedRaw: unknown;
        try {
          parsedRaw = JSON.parse(text);
        } catch {
          results.push({ ok: false, filename: arq.filename, erro: "JSON inválido do modelo" });
          continue;
        }
        results.push(normalizeParsed(parsedRaw, arq.filename));
      } catch (e) {
        logger.error("[importarBoletinsPdf] erro", arq.filename, e);
        results.push({
          ok: false,
          filename: arq.filename,
          erro: e instanceof Error ? e.message : "Falha desconhecida",
        });
      }
    }

    return { results };
  });

export type { ParsedBoletim };

// ---------- Importação por TEXTO (Word/DOCX extraído no cliente) ---------- //
// Muito mais leve que PDF: sem OCR, sem inline_data binário, poucos tokens.
// Reduz drasticamente a chance de 429 e é praticamente instantâneo.

const InputTextoSchema = z.object({
  arquivos: z
    .array(
      z.object({
        filename: z.string().min(1).max(255),
        texto: z.string().min(20).max(60000),
      }),
    )
    .min(1)
    .max(50),
});

export const importarBoletinsTexto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => InputTextoSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ results: ParsedBoletim[] }> => {
    const { data: isStaff, error: roleError } = await context.supabase.rpc(
      "is_professor_or_staff",
      { _user_id: context.userId },
    );
    if (roleError) throw roleError;
    if (!isStaff) throw new Error("Acesso restrito à equipe da escola.");

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY não configurada no servidor.");

    const results: ParsedBoletim[] = [];
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const MODELS = ["gemini-flash-latest"];

    async function callGemini(model: string, texto: string): Promise<Response> {
      return fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey!)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text:
                      PROMPT +
                      `\n\nO conteúdo abaixo é o TEXTO extraído de um boletim (Word/.docx). Analise-o e devolva o JSON pedido.\n\n--- INÍCIO DO BOLETIM ---\n${texto}\n--- FIM DO BOLETIM ---`,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0,
              maxOutputTokens: 4096,
              responseMimeType: "application/json",
            },
          }),
        },
      );
    }

    for (const arq of data.arquivos) {
      try {
        let resp: Response | null = null;
        let lastBody = "";
        let lastStatus: number | undefined;

        outer: for (const model of MODELS) {
          for (let attempt = 1; attempt <= 3; attempt++) {
            resp = await callGemini(model, arq.texto);
            lastStatus = resp.status;
            if (resp.ok) break outer;
            lastBody = await resp.text();
            const retryAfter = Number(resp.headers.get("retry-after") ?? "0");
            if (resp.status === 429 || resp.status === 503) {
              if (attempt >= 3) break;
              await sleep(retryAfter > 0 ? retryAfter * 1000 : 1500 * Math.pow(2, attempt - 1));
              continue;
            }
            if (resp.status === 404) break; // modelo indisponível: tenta o próximo
            break outer;
          }
        }

        if (!resp || !resp.ok) {
          logger.error("[importarBoletinsTexto] Gemini erro", lastStatus, lastBody.slice(0, 500));
          results.push({
            ok: false,
            filename: arq.filename,
            erro:
              lastStatus === 429
                ? "Cota do Gemini esgotada. Aguarde alguns minutos e envie menos arquivos por vez."
                : `Gemini ${lastStatus ?? "sem resposta"}`,
          });
          continue;
        }

        await sleep(200);

        const json = (await resp.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
        let parsedRaw: unknown;
        try {
          parsedRaw = JSON.parse(text);
        } catch {
          results.push({ ok: false, filename: arq.filename, erro: "JSON inválido do modelo" });
          continue;
        }
        results.push(normalizeParsed(parsedRaw, arq.filename));
      } catch (e) {
        logger.error("[importarBoletinsTexto] erro", arq.filename, e);
        results.push({
          ok: false,
          filename: arq.filename,
          erro: e instanceof Error ? e.message : "Falha desconhecida",
        });
      }
    }

    return { results };
  });

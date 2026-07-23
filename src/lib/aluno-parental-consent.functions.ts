import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { logger, safeError } from "@/lib/logger";
import { PARENTAL_TERM_VERSION } from "@/lib/parental-consent.functions";
import { isValidCpf } from "@/lib/parental-consent";

const cpfRegex = /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/;

/**
 * Zod exportado para reuso em testes de integração. Aplica também a
 * checagem de dígitos verificadores (algoritmo oficial) além do formato.
 */
export const alunoParentalConsentSchema = z.object({
  aluno_id: z.string().uuid(),
  minor_name: z.string().trim().min(2).max(200),
  minor_dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data de nascimento inválida"),
  guardian_name: z.string().trim().min(2).max(200),
  guardian_cpf: z
    .string()
    .trim()
    .regex(cpfRegex, "CPF inválido")
    .refine((v) => !v || isValidCpf(v), "CPF inválido (dígitos verificadores)")
    .optional()
    .nullable()
    .or(z.literal("")),
  guardian_email: z.string().trim().email().max(255),
  guardian_phone: z.string().trim().max(40).optional().nullable(),
});
const schema = alunoParentalConsentSchema;

/**
 * Roles autorizados a registrar consentimento em nome do responsável.
 * Exportado para reuso em testes.
 */
export const CONSENT_STAFF_ROLES = new Set([
  "admin",
  "diretor",
  "director",
  "coordenador",
  "coordinator",
  "secretario",
  "desenvolvedor",
  "developer",
]);

function extractIp(headers: Headers): string | null {
  return (
    headers.get("cf-connecting-ip")?.trim() ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip")?.trim() ||
    null
  );
}

/**
 * Registra o consentimento parental (LGPD Art. 14) vinculado a um aluno recém
 * cadastrado. Só pode ser chamado por admins escolares — a autorização é
 * verificada via `requireSupabaseAuth` + role check antes de escalar para
 * `supabaseAdmin` (a tabela `parental_consents` não concede INSERT direto).
 */
export const logAlunoParentalConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) => schema.parse(raw))
  .handler(async ({ data, context }) => {
    // Autorização: apenas equipe escolar pode registrar consentimento em nome
    // do responsável durante a matrícula. Consulta `user_roles` sob a RLS do
    // próprio usuário — não usamos supabaseAdmin para essa checagem.
    const { data: roles, error: roleErr } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (roleErr) {
      logger.error("[logAlunoParentalConsent] role check falhou", safeError(roleErr));
      throw new Error("Não foi possível validar suas permissões.");
    }
    if (!(roles ?? []).some((r) => CONSENT_STAFF_ROLES.has(String(r.role)))) {
      throw new Error("Permissão negada.");
    }

    const request = getRequest();
    const ip = extractIp(request.headers);
    const userAgent = request.headers.get("user-agent")?.slice(0, 500) ?? null;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Confirma que o aluno existe (evita orfãos de consentimento).
    const { data: aluno, error: lookupErr } = await supabaseAdmin
      .from("alunos")
      .select("id")
      .eq("id", data.aluno_id)
      .maybeSingle();
    if (lookupErr) {
      logger.error("[logAlunoParentalConsent] lookup aluno", safeError(lookupErr));
      throw new Error("Não foi possível validar o aluno.");
    }
    if (!aluno) throw new Error("Aluno inexistente.");

    const { error } = await supabaseAdmin.from("parental_consents").insert({
      aluno_id: data.aluno_id,
      minor_name: data.minor_name,
      minor_dob: data.minor_dob,
      guardian_name: data.guardian_name,
      guardian_cpf: data.guardian_cpf ? data.guardian_cpf.replace(/\D/g, "") : null,
      guardian_email: data.guardian_email.trim().toLowerCase(),
      guardian_phone: data.guardian_phone ?? null,
      term_version: PARENTAL_TERM_VERSION,
      ip_address: ip,
      user_agent: userAgent,
    });

    if (error) {
      logger.error("[logAlunoParentalConsent] insert", safeError(error));
      throw new Error("Não foi possível registrar o consentimento.");
    }
    return { ok: true as const };
  });

/**
 * Verifica se um aluno já possui pelo menos um consentimento parental
 * registrado. Usada pela UI para sinalizar pendências no cadastro.
 */
export const hasAlunoParentalConsent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) => z.object({ aluno_id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { count, error } = await context.supabase
      .from("parental_consents")
      .select("id", { count: "exact", head: true })
      .eq("aluno_id", data.aluno_id);
    if (error) throw new Error(error.message);
    return { hasConsent: (count ?? 0) > 0 };
  });
/**
 * Lista registros de `parental_consents` para auditoria no painel escolar.
 * Restrito a staff (via role check). Retorna colunas sensíveis (CPF, IP,
 * user-agent) por auditoria — a rota é gate-adaquada apenas para admins.
 */
export const listAlunoConsents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) =>
    z
      .object({
        search: z.string().trim().max(120).optional().nullable(),
        limit: z.number().int().min(1).max(500).optional(),
      })
      .parse(raw ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (!(roles ?? []).some((r) => CONSENT_STAFF_ROLES.has(String(r.role)))) {
      throw new Error("Permissão negada.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("parental_consents")
      .select(
        "id, aluno_id, protocolo, minor_name, minor_dob, guardian_name, guardian_cpf, guardian_email, guardian_phone, term_version, ip_address, user_agent, consented_at",
      )
      .order("consented_at", { ascending: false })
      .limit(data.limit ?? 200);
    if (data.search) {
      const needle = `%${data.search.replace(/[%_]/g, "")}%`;
      q = q.or(
        `minor_name.ilike.${needle},guardian_name.ilike.${needle},guardian_email.ilike.${needle},protocolo.ilike.${needle}`,
      );
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

/**
 * Retorna, em uma única chamada, o status de consentimento parental para
 * uma lista de alunos. Alimenta o badge visual na listagem — evita
 * disparar N queries. Só devolve os campos mínimos para tooltip.
 */
export const listAlunoConsentBadges = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) =>
    z.object({ aluno_ids: z.array(z.string().uuid()).max(500) }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    if (data.aluno_ids.length === 0) return { byAluno: {} as Record<string, ConsentBadge> };
    // Usa o próprio contexto do usuário (RLS aplicada). Staff enxerga tudo,
    // responsáveis enxergam só seus vínculos — o badge fica coerente com o
    // que a pessoa já pode ler.
    const { data: rows, error } = await context.supabase
      .from("parental_consents")
      .select("aluno_id, guardian_name, consented_at")
      .in("aluno_id", data.aluno_ids)
      .order("consented_at", { ascending: false });
    if (error) throw new Error(error.message);
    const byAluno: Record<string, ConsentBadge> = {};
    for (const r of rows ?? []) {
      if (!r.aluno_id) continue;
      // primeiro (mais recente) vence
      if (byAluno[r.aluno_id]) continue;
      byAluno[r.aluno_id] = {
        guardian_name: r.guardian_name,
        consented_at: r.consented_at,
      };
    }
    return { byAluno };
  });

export type ConsentBadge = {
  guardian_name: string;
  consented_at: string;
};

/**
 * Notifica o responsável, por e-mail, que o consentimento parental foi
 * registrado. Requer domínio de e-mail configurado no projeto — enquanto
 * não estiver, a função responde `{ sent: false, reason: 'no_email_domain' }`
 * de forma silenciosa (não interrompe o fluxo de cadastro).
 *
 * Quando o domínio estiver ativo, chame `sendTemplateEmail` de um helper
 * dedicado de e-mail transacional com um template próprio.
 */
export const notifyGuardianConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) =>
    z
      .object({
        guardian_email: z.string().email(),
        guardian_name: z.string().min(1).max(200),
        minor_name: z.string().min(1).max(200),
        term_version: z.string().min(1).max(64),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    // Só staff pode disparar (mesma regra do log).
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (!(roles ?? []).some((r) => CONSENT_STAFF_ROLES.has(String(r.role)))) {
      throw new Error("Permissão negada.");
    }
    try {
      // Domínio de e-mail ainda não scaffoldado; a notificação é um no-op
      // controlado até o módulo de envio transacional existir.
      logger.warn(
        "[notifyGuardianConsent] domínio de e-mail não configurado — notificação pulada",
        { guardian: data.guardian_email, minor: data.minor_name, term: data.term_version },
      );
      return { sent: false as const, reason: "no_email_domain" as const };
    } catch (err) {
      logger.error("[notifyGuardianConsent] falha ao enviar", safeError(err));
      return { sent: false as const, reason: "send_failed" as const };
    }
  });

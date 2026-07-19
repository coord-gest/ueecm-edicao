import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { logger, safeError } from "@/lib/logger";
import { PARENTAL_TERM_VERSION } from "@/lib/parental-consent.functions";

const cpfRegex = /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/;

const schema = z.object({
  aluno_id: z.string().uuid(),
  minor_name: z.string().trim().min(2).max(200),
  minor_dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data de nascimento inválida"),
  guardian_name: z.string().trim().min(2).max(200),
  guardian_cpf: z
    .string()
    .trim()
    .regex(cpfRegex, "CPF inválido")
    .optional()
    .nullable()
    .or(z.literal("")),
  guardian_email: z.string().trim().email().max(255),
  guardian_phone: z.string().trim().max(40).optional().nullable(),
});

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
  .inputValidator((raw: unknown) => schema.parse(raw))
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
    const allowed = new Set([
      "admin",
      "diretor",
      "director",
      "coordenador",
      "coordinator",
      "secretario",
      "desenvolvedor",
      "developer",
    ]);
    if (!(roles ?? []).some((r) => allowed.has(String(r.role)))) {
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
  .inputValidator((raw: unknown) => z.object({ aluno_id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { count, error } = await context.supabase
      .from("parental_consents")
      .select("id", { count: "exact", head: true })
      .eq("aluno_id", data.aluno_id);
    if (error) throw new Error(error.message);
    return { hasConsent: (count ?? 0) > 0 };
  });
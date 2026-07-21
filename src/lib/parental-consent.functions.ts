import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { logger, safeError } from "@/lib/logger";

// Versão atual do termo de consentimento parental (Art. 14 da LGPD).
// Atualize sempre que o texto exibido na UI mudar — o valor é armazenado
// junto com cada registro para rastreabilidade histórica.
export const PARENTAL_TERM_VERSION = "1.0-2026-07-11";

const cpfRegex = /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/;

const parentalConsentSchema = z.object({
  protocolo: z.string().trim().min(3).max(64),
  minor_name: z.string().trim().min(2).max(200),
  minor_dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data de nascimento inválida (yyyy-mm-dd)"),
  guardian_name: z.string().trim().min(2).max(200),
  // CPF é OPCIONAL — respeita a autonomia do responsável em decidir se fornece
  // esse dado sensível. Quando fornecido, precisa ter formato válido.
  guardian_cpf: z
    .string()
    .trim()
    .regex(cpfRegex, "CPF inválido")
    .optional()
    .nullable()
    .or(z.literal("")),
  guardian_email: z.string().trim().email("E-mail inválido").max(255),
  guardian_phone: z.string().trim().max(40).optional().nullable(),
  term_version: z.string().trim().min(1).max(64),
  /**
   * Honeypot: campo escondido no formulário que humanos nunca preenchem.
   * Se vier com qualquer valor, é bot — descartamos silenciosamente.
   */
  website: z.string().max(0).optional().nullable().or(z.literal("")),
});

/**
 * Extrai o IP do cliente respeitando os headers que o Cloudflare Workers
 * (runtime do server entry) coloca à frente. Preferimos `cf-connecting-ip`
 * quando disponível; caímos para `x-forwarded-for` em ambientes de proxy
 * genérico. Retorna `null` quando nenhum header confiável está presente
 * (não fazemos lookup TCP; a coluna aceita NULL).
 */
function extractClientIp(headers: Headers): string | null {
  const cf = headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return null;
}

/**
 * Registra o consentimento do responsável legal para um agendamento de
 * menor de idade. Chamada exclusivamente pelo formulário público
 * `/agendar` após a criação bem-sucedida do agendamento — o `protocolo`
 * comprova que o agendamento existe.
 *
 * O log inclui IP e user-agent capturados server-side (não confiáveis se
 * enviados pelo cliente), além da versão do termo aceito para atender ao
 * Art. 14 e Art. 7º da LGPD.
 */
export const logParentalConsent = createServerFn({ method: "POST" })
  .validator((raw: unknown) => parentalConsentSchema.parse(raw))
  .handler(async ({ data }) => {
    // Honeypot preenchido → responde OK sem gravar (não sinaliza ao bot).
    if (data.website && data.website.length > 0) {
      return { ok: true as const };
    }

    const request = getRequest();
    const ip = extractClientIp(request.headers);
    const userAgent = request.headers.get("user-agent")?.slice(0, 500) ?? null;

    // service_role é obrigatório aqui: a tabela `parental_consents` não
    // concede INSERT a anon/authenticated (log auditável só via servidor).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // ANTI-SPAM (S1): valida que o `protocolo` corresponde a um agendamento
    // real antes de gravar. Isso ancora o consentimento a um recurso já
    // criado pelo trigger de rate-limit de `agendamentos` — atacantes que
    // enviam protocolos aleatórios recebem 400 sem gravar linha.
    const { data: agendamento, error: lookupErr } = await supabaseAdmin
      .from("agendamentos")
      .select("id")
      .eq("protocolo", data.protocolo)
      .maybeSingle();

    if (lookupErr) {
      logger.error("[logParentalConsent] falha ao validar protocolo", safeError(lookupErr));
      throw new Error("Não foi possível validar o protocolo. Tente novamente.");
    }
    if (!agendamento) {
      throw new Error("Protocolo inválido.");
    }

    const { error } = await supabaseAdmin.from("parental_consents").insert({
      protocolo: data.protocolo,
      minor_name: data.minor_name,
      minor_dob: data.minor_dob,
      guardian_name: data.guardian_name,
      guardian_cpf: data.guardian_cpf ? data.guardian_cpf.replace(/\D/g, "") : null,
      guardian_email: data.guardian_email.trim().toLowerCase(),
      guardian_phone: data.guardian_phone ?? null,
      term_version: data.term_version,
      ip_address: ip,
      user_agent: userAgent,
    });

    if (error) {
      // Não logar o objeto completo (pode conter payload rejeitado com PII).
      logger.error("[logParentalConsent] falha ao inserir", safeError(error));
      throw new Error("Não foi possível registrar o consentimento. Tente novamente.");
    }

    return { ok: true as const };
  });

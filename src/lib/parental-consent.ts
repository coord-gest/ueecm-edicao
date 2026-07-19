// Helpers puros de consentimento parental (LGPD Art. 14).
// Isolados aqui para permitir testes unitários (equivalentes a E2E de validação)
// sem depender de router/DOM.

/**
 * Calcula idade em anos a partir de uma string yyyy-mm-dd.
 * Retorna null quando a data está vazia, mal formatada ou inválida.
 * Ancorada no fuso local (T00:00:00) para evitar off-by-one perto da meia-noite UTC.
 */
export function calcularIdade(dobIso: string, refDate: Date = new Date()): number | null {
  if (!dobIso || !/^\d{4}-\d{2}-\d{2}$/.test(dobIso)) return null;
  const dob = new Date(`${dobIso}T00:00:00`);
  if (Number.isNaN(dob.getTime())) return null;
  if (dob.getTime() > refDate.getTime()) return null; // futuro
  let age = refDate.getFullYear() - dob.getFullYear();
  const m = refDate.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && refDate.getDate() < dob.getDate())) age -= 1;
  return age;
}

/**
 * Aplica máscara visual ###.###.###-## conforme o usuário digita.
 * Aceita entrada com pontuação parcial e ignora não-dígitos; nunca gera
 * mais de 14 caracteres. O valor persistido no banco é sempre normalizado
 * (apenas dígitos) pelo server function.
 */
export function formatCpf(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  const p1 = digits.slice(0, 3);
  const p2 = digits.slice(3, 6);
  const p3 = digits.slice(6, 9);
  const p4 = digits.slice(9, 11);
  let out = p1;
  if (digits.length >= 4) out += `.${p2}`;
  if (digits.length >= 7) out += `.${p3}`;
  if (digits.length >= 10) out += `-${p4}`;
  return out;
}

/**
 * Extrai os 11 dígitos do CPF a partir de uma string mascarada.
 * Retorna a string vazia quando não há 11 dígitos.
 */
export function cpfDigits(raw: string): string {
  const d = raw.replace(/\D/g, "");
  return d.length === 11 ? d : "";
}

/**
 * Valida um CPF pelo algoritmo oficial (dois dígitos verificadores mod 11).
 * Aceita string com ou sem máscara; rejeita sequências repetidas (000..., 111..., etc.),
 * que passam nos dois dígitos mas são inválidas na prática.
 */
export function isValidCpf(raw: string): boolean {
  const d = raw.replace(/\D/g, "");
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;
  const calc = (slice: string, factor: number) => {
    let sum = 0;
    for (let i = 0; i < slice.length; i++) sum += Number(slice[i]) * (factor - i);
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };
  const dv1 = calc(d.slice(0, 9), 10);
  const dv2 = calc(d.slice(0, 10), 11);
  return dv1 === Number(d[9]) && dv2 === Number(d[10]);
}

export type ParentalFormInput = {
  nome: string;
  dataNascimento: string;
  respNome: string;
  respCpf: string;
  respEmail: string;
  aceiteParental: boolean;
  aceiteLgpd: boolean;
};

export type ValidationResult = { ok: true } | { ok: false; error: string };

/**
 * Valida — do lado do cliente — o bloco de consentimento parental.
 * Segue as MESMAS regras aplicadas em `/agendar` e em `logParentalConsent`
 * (Zod no server). Retorna a primeira violação encontrada.
 */
export function validateParentalConsent(
  input: ParentalFormInput,
  refDate: Date = new Date(),
): ValidationResult {
  if (!input.dataNascimento) return { ok: false, error: "Informe sua data de nascimento." };
  const idade = calcularIdade(input.dataNascimento, refDate);
  if (idade === null || idade < 0 || idade > 120)
    return { ok: false, error: "Data de nascimento inválida." };
  if (!input.aceiteLgpd)
    return {
      ok: false,
      error: "É necessário concordar com o uso dos dados conforme a Política de Privacidade.",
    };
  if (idade >= 18) return { ok: true };

  // Menor de 18: regras do Art. 14 aplicam.
  if (!input.respNome.trim() || input.respNome.trim().length < 2)
    return { ok: false, error: "Informe o nome completo do responsável legal." };
  if (!cpfDigits(input.respCpf))
    return { ok: false, error: "Informe um CPF válido do responsável legal (11 dígitos)." };
  if (!isValidCpf(input.respCpf))
    return {
      ok: false,
      error: "O CPF do responsável é inválido — verifique os dígitos verificadores.",
    };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.respEmail.trim()))
    return { ok: false, error: "Informe um e-mail válido do responsável legal." };
  if (!input.aceiteParental)
    return {
      ok: false,
      error: "O responsável legal deve autorizar expressamente o tratamento dos dados do menor.",
    };
  return { ok: true };
}

/** Cabeçalhos de exportação CSV — ordem fixa para auditoria previsível. */
export const PARENTAL_CSV_HEADERS = [
  { key: "protocolo", label: "Protocolo" },
  { key: "minor_name", label: "Nome do menor" },
  { key: "minor_dob", label: "Data de nascimento do menor" },
  { key: "guardian_name", label: "Nome do responsável" },
  { key: "guardian_cpf", label: "CPF do responsável" },
  { key: "guardian_email", label: "E-mail do responsável" },
  { key: "guardian_phone", label: "Telefone do responsável" },
  { key: "ip_address", label: "IP" },
  { key: "user_agent", label: "User-Agent" },
  { key: "term_version", label: "Versão do termo" },
  { key: "consented_at", label: "Data/hora do consentimento" },
] as const;

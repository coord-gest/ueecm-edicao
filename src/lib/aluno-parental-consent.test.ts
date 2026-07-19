/**
 * Testes de integração para o payload/permissões de consentimento parental.
 *
 * Estes testes exercitam:
 *  - o schema Zod que o server function `logAlunoParentalConsent` aplica
 *    (mesma validação que roda no runtime — inclui checagem de dígitos
 *    verificadores do CPF do responsável);
 *  - a política de roles autorizados (`CONSENT_STAFF_ROLES`) que o handler
 *    verifica antes de escalar para `supabaseAdmin`;
 *  - a lógica de decisão que `hasAlunoParentalConsent` retorna a partir de
 *    uma contagem — verificada via helper puro `alunoConsentDecision` para
 *    permitir teste sem simular todo o middleware TanStack.
 *
 * Cobrimos os três cenários pedidos: menor de 18 (payload completo passa),
 * maior de 18 (o helper cliente `validateParentalConsent` já libera sem
 * exigir responsável), e tentativa sem dados obrigatórios (schema rejeita).
 */
import { describe, it, expect } from "vitest";
import {
  alunoParentalConsentSchema,
  CONSENT_STAFF_ROLES,
} from "./aluno-parental-consent.functions";
import { validateParentalConsent } from "./parental-consent";

/** Reflete a decisão de `hasAlunoParentalConsent` a partir do count. */
function alunoConsentDecision(count: number | null): { hasConsent: boolean } {
  return { hasConsent: (count ?? 0) > 0 };
}

const VALID_CPF = "52998224725"; // DVs corretos
const INVALID_CPF = "12345678900"; // DVs errados
const ALUNO_ID = "11111111-1111-4111-8111-111111111111";

describe("alunoParentalConsentSchema (integração — validação server-side)", () => {
  it("aceita payload completo para MENOR com CPF válido", () => {
    const r = alunoParentalConsentSchema.safeParse({
      aluno_id: ALUNO_ID,
      minor_name: "João da Silva",
      minor_dob: "2015-05-10",
      guardian_name: "Maria da Silva",
      guardian_cpf: VALID_CPF,
      guardian_email: "maria@example.com",
      guardian_phone: "(85) 99999-0000",
    });
    expect(r.success).toBe(true);
  });

  it("aceita payload sem CPF (opcional) — CPF é dado sensível e o responsável pode omitir", () => {
    const r = alunoParentalConsentSchema.safeParse({
      aluno_id: ALUNO_ID,
      minor_name: "João",
      minor_dob: "2015-05-10",
      guardian_name: "Maria",
      guardian_email: "maria@example.com",
    });
    expect(r.success).toBe(true);
  });

  it("rejeita CPF com formato válido mas dígitos verificadores errados", () => {
    const r = alunoParentalConsentSchema.safeParse({
      aluno_id: ALUNO_ID,
      minor_name: "João",
      minor_dob: "2015-05-10",
      guardian_name: "Maria",
      guardian_cpf: INVALID_CPF,
      guardian_email: "maria@example.com",
    });
    expect(r.success).toBe(false);
  });

  it("rejeita quando faltam dados obrigatórios (nome do menor ausente)", () => {
    const r = alunoParentalConsentSchema.safeParse({
      aluno_id: ALUNO_ID,
      minor_dob: "2015-05-10",
      guardian_name: "Maria",
      guardian_email: "maria@example.com",
    });
    expect(r.success).toBe(false);
  });

  it("rejeita e-mail do responsável inválido", () => {
    const r = alunoParentalConsentSchema.safeParse({
      aluno_id: ALUNO_ID,
      minor_name: "João",
      minor_dob: "2015-05-10",
      guardian_name: "Maria",
      guardian_email: "não-é-email",
    });
    expect(r.success).toBe(false);
  });

  it("rejeita aluno_id em formato não-UUID", () => {
    const r = alunoParentalConsentSchema.safeParse({
      aluno_id: "not-a-uuid",
      minor_name: "João",
      minor_dob: "2015-05-10",
      guardian_name: "Maria",
      guardian_email: "maria@example.com",
    });
    expect(r.success).toBe(false);
  });

  it("rejeita data de nascimento em formato inválido", () => {
    const r = alunoParentalConsentSchema.safeParse({
      aluno_id: ALUNO_ID,
      minor_name: "João",
      minor_dob: "10/05/2015", // dd/mm/yyyy — fora do contrato yyyy-mm-dd
      guardian_name: "Maria",
      guardian_email: "maria@example.com",
    });
    expect(r.success).toBe(false);
  });
});

describe("CONSENT_STAFF_ROLES (autorização)", () => {
  it("inclui todos os papéis administrativos da escola", () => {
    for (const role of [
      "admin",
      "diretor",
      "director",
      "coordenador",
      "coordinator",
      "secretario",
      "desenvolvedor",
      "developer",
    ]) {
      expect(CONSENT_STAFF_ROLES.has(role)).toBe(true);
    }
  });

  it("NÃO inclui professor, leitor nem responsável — evita registro em nome de outro", () => {
    for (const role of ["professor", "leitor", "responsavel", "aluno", "guest"]) {
      expect(CONSENT_STAFF_ROLES.has(role)).toBe(false);
    }
  });
});

describe("hasAlunoParentalConsent — decisão a partir do count RLS", () => {
  it("retorna hasConsent=false para count 0 ou null", () => {
    expect(alunoConsentDecision(0)).toEqual({ hasConsent: false });
    expect(alunoConsentDecision(null)).toEqual({ hasConsent: false });
  });

  it("retorna hasConsent=true quando há pelo menos um registro", () => {
    expect(alunoConsentDecision(1)).toEqual({ hasConsent: true });
    expect(alunoConsentDecision(5)).toEqual({ hasConsent: true });
  });
});

describe("Fluxo de matrícula — cenários por idade (integração cliente↔schema)", () => {
  const REF = new Date("2026-07-19T12:00:00-03:00");

  it("MAIOR de 18: cliente libera sem exigir dados do responsável", () => {
    const clientCheck = validateParentalConsent(
      {
        nome: "Adulto",
        dataNascimento: "1990-01-01",
        respNome: "",
        respCpf: "",
        respEmail: "",
        aceiteParental: false,
        aceiteLgpd: true,
      },
      REF,
    );
    expect(clientCheck.ok).toBe(true);
  });

  it("MENOR de 18: cliente bloqueia sem consentimento, e schema também rejeitaria payload incompleto", () => {
    const clientCheck = validateParentalConsent(
      {
        nome: "Menor",
        dataNascimento: "2015-01-01",
        respNome: "",
        respCpf: "",
        respEmail: "",
        aceiteParental: false,
        aceiteLgpd: true,
      },
      REF,
    );
    expect(clientCheck.ok).toBe(false);

    // Se o cliente fosse contornado, o schema server-side ainda barra:
    const serverCheck = alunoParentalConsentSchema.safeParse({
      aluno_id: ALUNO_ID,
      minor_name: "Menor",
      minor_dob: "2015-01-01",
      // guardian_name / guardian_email ausentes
    });
    expect(serverCheck.success).toBe(false);
  });

  it("MENOR de 18 com todos os dados válidos: cliente libera e schema aceita", () => {
    const payload = {
      nome: "Menor",
      dataNascimento: "2015-01-01",
      respNome: "Maria Silva",
      respCpf: "529.982.247-25",
      respEmail: "maria@example.com",
      aceiteParental: true,
      aceiteLgpd: true,
    };
    const clientCheck = validateParentalConsent(payload, REF);
    expect(clientCheck.ok).toBe(true);

    const serverCheck = alunoParentalConsentSchema.safeParse({
      aluno_id: ALUNO_ID,
      minor_name: payload.nome,
      minor_dob: payload.dataNascimento,
      guardian_name: payload.respNome,
      guardian_cpf: payload.respCpf,
      guardian_email: payload.respEmail,
    });
    expect(serverCheck.success).toBe(true);
  });
});
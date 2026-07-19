import { describe, it, expect } from "vitest";
import {
  calcularIdade,
  formatCpf,
  cpfDigits,
  isValidCpf,
  validateParentalConsent,
  type ParentalFormInput,
} from "./parental-consent";

// Referência fixa para determinismo (2026-07-11).
const REF = new Date("2026-07-11T12:00:00-03:00");

function base(overrides: Partial<ParentalFormInput> = {}): ParentalFormInput {
  return {
    nome: "Aluno Teste",
    dataNascimento: "",
    respNome: "",
    respCpf: "",
    respEmail: "",
    aceiteParental: false,
    aceiteLgpd: true,
    ...overrides,
  };
}

describe("calcularIdade", () => {
  it("retorna null para string vazia ou formato inválido", () => {
    expect(calcularIdade("", REF)).toBeNull();
    expect(calcularIdade("2010", REF)).toBeNull();
    expect(calcularIdade("11-07-2010", REF)).toBeNull();
  });

  it("retorna null para data futura", () => {
    expect(calcularIdade("2099-01-01", REF)).toBeNull();
  });

  it("calcula 17 anos para aniversário ainda não completado no ano de referência", () => {
    // Nasceu em 2008-12-31 → em 2026-07-11 tem 17 (aniversário só em dezembro).
    expect(calcularIdade("2008-12-31", REF)).toBe(17);
  });

  it("calcula 18 anos no exato dia do aniversário", () => {
    // Nasceu em 2008-07-11 → em 2026-07-11 completa 18.
    expect(calcularIdade("2008-07-11", REF)).toBe(18);
  });

  it("calcula 17 anos no dia anterior ao aniversário de 18", () => {
    // Nasceu em 2008-07-12 → em 2026-07-11 ainda tem 17.
    expect(calcularIdade("2008-07-12", REF)).toBe(17);
  });
});

describe("formatCpf / cpfDigits", () => {
  it("aplica máscara progressiva conforme dígitos são adicionados", () => {
    expect(formatCpf("1")).toBe("1");
    expect(formatCpf("123")).toBe("123");
    expect(formatCpf("1234")).toBe("123.4");
    expect(formatCpf("1234567")).toBe("123.456.7");
    expect(formatCpf("12345678")).toBe("123.456.78");
    expect(formatCpf("1234567890")).toBe("123.456.789-0");
    expect(formatCpf("12345678901")).toBe("123.456.789-01");
  });

  it("descarta caracteres não numéricos e limita a 11 dígitos", () => {
    expect(formatCpf("abc123.456.789-01xxx99")).toBe("123.456.789-01");
    expect(formatCpf("999.888.777-66-55")).toBe("999.888.777-66");
  });

  it("cpfDigits extrai 11 dígitos ou vazio", () => {
    expect(cpfDigits("123.456.789-01")).toBe("12345678901");
    expect(cpfDigits("123.456.789")).toBe("");
    expect(cpfDigits("abc")).toBe("");
  });
});

describe("isValidCpf", () => {
  it("rejeita string vazia, tamanho errado e não-numéricos", () => {
    expect(isValidCpf("")).toBe(false);
    expect(isValidCpf("123")).toBe(false);
    expect(isValidCpf("abcdefghijk")).toBe(false);
  });

  it("rejeita sequências repetidas (000..., 111..., 999...)", () => {
    expect(isValidCpf("00000000000")).toBe(false);
    expect(isValidCpf("11111111111")).toBe(false);
    expect(isValidCpf("99999999999")).toBe(false);
  });

  it("rejeita CPF com dígitos verificadores incorretos", () => {
    // 123.456.789-00 falha nos DVs (corretos seriam 09)
    expect(isValidCpf("12345678900")).toBe(false);
    expect(isValidCpf("123.456.789-01")).toBe(false);
  });

  it("aceita CPFs matematicamente válidos, com ou sem máscara", () => {
    // CPFs de teste com DVs corretos (calculados pelo algoritmo oficial).
    expect(isValidCpf("52998224725")).toBe(true);
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("11144477735")).toBe(true);
    expect(isValidCpf("111.444.777-35")).toBe(true);
  });
});

describe("validateParentalConsent — submissão em /agendar", () => {
  it("bloqueia quando falta data de nascimento", () => {
    const r = validateParentalConsent(base(), REF);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/data de nascimento/i);
  });

  it("permite adulto (≥ 18) sem qualquer campo de responsável", () => {
    const r = validateParentalConsent(
      base({ dataNascimento: "1990-01-01", aceiteLgpd: true }),
      REF,
    );
    expect(r.ok).toBe(true);
  });

  it("BLOQUEIA menor de 18 sem consentimento parental marcado", () => {
    const r = validateParentalConsent(
      base({
        dataNascimento: "2015-01-01", // 11 anos
        respNome: "Maria Silva",
        respCpf: "123.456.789-01",
        respEmail: "maria@example.com",
        aceiteParental: false, // ← ponto crítico
      }),
      REF,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/responsável legal deve autorizar/i);
  });

  it("bloqueia menor com CPF do responsável incompleto", () => {
    const r = validateParentalConsent(
      base({
        dataNascimento: "2015-01-01",
        respNome: "Maria Silva",
        respCpf: "123.456.789", // 9 dígitos
        respEmail: "maria@example.com",
        aceiteParental: true,
      }),
      REF,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/CPF/i);
  });

  it("bloqueia menor com CPF de 11 dígitos mas DV inválido", () => {
    const r = validateParentalConsent(
      base({
        dataNascimento: "2015-01-01",
        respNome: "Maria Silva",
        respCpf: "123.456.789-00", // formato ok, DV errado
        respEmail: "maria@example.com",
        aceiteParental: true,
      }),
      REF,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/dígitos verificadores/i);
  });

  it("bloqueia menor com e-mail do responsável inválido", () => {
    const r = validateParentalConsent(
      base({
        dataNascimento: "2015-01-01",
        respNome: "Maria Silva",
        respCpf: "123.456.789-01",
        respEmail: "não-é-email",
        aceiteParental: true,
      }),
      REF,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/e-mail/i);
  });

  it("aprova menor com TODOS os campos preenchidos e consentimento marcado", () => {
    const r = validateParentalConsent(
      base({
        dataNascimento: "2015-01-01",
        respNome: "Maria Silva",
        respCpf: "529.982.247-25",
        respEmail: "maria@example.com",
        aceiteParental: true,
      }),
      REF,
    );
    expect(r.ok).toBe(true);
  });

  it("aceita menor com CPF sem máscara (só dígitos)", () => {
    const r = validateParentalConsent(
      base({
        dataNascimento: "2015-01-01",
        respNome: "Maria Silva",
        respCpf: "52998224725",
        respEmail: "maria@example.com",
        aceiteParental: true,
      }),
      REF,
    );
    expect(r.ok).toBe(true);
  });

  it("bloqueia quando aceite geral da LGPD não está marcado", () => {
    const r = validateParentalConsent(
      base({
        dataNascimento: "1990-01-01",
        aceiteLgpd: false,
      }),
      REF,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Política de Privacidade/i);
  });
});

import { describe, expect, it } from "vitest";
import {
  buildSystemPrompt,
  DEFAULT_DEVELOPER_FAQ,
  DEFAULT_DEVELOPER_PROFILE,
} from "./developer-faq";

describe("buildSystemPrompt", () => {
  const prompt = buildSystemPrompt(DEFAULT_DEVELOPER_PROFILE, DEFAULT_DEVELOPER_FAQ);

  it("inclui o cargo de Coordenador Escolar", () => {
    expect(prompt).toContain("Coordenador Escolar");
  });

  it("inclui a instituição U.E. Evaristo Campelo de Matos", () => {
    expect(prompt).toContain("U.E. Evaristo Campelo de Matos");
  });

  it("inclui o nome Francisco Douglas", () => {
    expect(prompt).toContain("Francisco Douglas");
  });

  it("inclui todas as perguntas e respostas do FAQ padrão", () => {
    for (const item of DEFAULT_DEVELOPER_FAQ) {
      expect(prompt).toContain(item.question);
      expect(prompt).toContain(item.answer);
    }
  });

  it("inclui a regra de fallback com a frase exata configurada", () => {
    expect(prompt).toContain("REGRA DE FALLBACK OBRIGATÓRIA");
    expect(prompt).toContain(DEFAULT_DEVELOPER_PROFILE.fallback_message);
  });

  it("respeita um perfil customizado", () => {
    const custom = buildSystemPrompt(
      { ...DEFAULT_DEVELOPER_PROFILE, cargo: "Diretor", instituicao: "Escola X" },
      [{ question: "Cargo?", answer: "Diretor da Escola X." }],
    );
    expect(custom).toContain("Cargo: Diretor");
    expect(custom).toContain("Instituição: Escola X");
    expect(custom).toContain("Cargo?");
    expect(custom).toContain("Diretor da Escola X.");
    expect(custom).not.toContain("React, TypeScript, Node.js, Supabase");
  });

  it("respeita uma mensagem de fallback customizada", () => {
    const custom = buildSystemPrompt(
      { ...DEFAULT_DEVELOPER_PROFILE, fallback_message: "Fale direto com ele." },
      DEFAULT_DEVELOPER_FAQ,
    );
    expect(custom).toContain('"Fale direto com ele."');
  });
});

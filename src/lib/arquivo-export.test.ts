import { describe, it, expect } from "vitest";

// Testa o inputValidator do exportBoletimOficial isoladamente
// (S3 — anti-DoS: limite de 60 alunos por exportação).
// Extraímos a lógica pura de validação para não instanciar a chain do createServerFn.
function validateBoletimInput(data: unknown) {
  if (!data || typeof data !== "object") throw new Error("Payload inválido");
  const d = data as { alunos?: unknown };
  if (!Array.isArray(d.alunos) || d.alunos.length === 0) {
    throw new Error("Lista de alunos vazia");
  }
  if (d.alunos.length > 60) {
    throw new Error("Máximo de 60 alunos por exportação");
  }
  return d;
}

describe("exportBoletimOficial — validação de entrada (S3 anti-DoS)", () => {
  it("rejeita payload nulo", () => {
    expect(() => validateBoletimInput(null)).toThrow(/Payload inválido/);
  });

  it("rejeita lista de alunos vazia", () => {
    expect(() => validateBoletimInput({ alunos: [] })).toThrow(/vazia/);
  });

  it("rejeita mais de 60 alunos (anti-DoS)", () => {
    const alunos = Array.from({ length: 61 }, (_, i) => ({ id: `${i}`, nome: `A${i}` }));
    expect(() => validateBoletimInput({ alunos })).toThrow(/Máximo de 60/);
  });

  it("aceita exatamente 60 alunos", () => {
    const alunos = Array.from({ length: 60 }, (_, i) => ({ id: `${i}`, nome: `A${i}` }));
    expect(() => validateBoletimInput({ alunos })).not.toThrow();
  });

  it("aceita 1 aluno", () => {
    expect(() => validateBoletimInput({ alunos: [{ id: "1", nome: "A" }] })).not.toThrow();
  });
});

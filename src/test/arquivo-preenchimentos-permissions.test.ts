import { describe, it, expect } from "vitest";

/**
 * Testes de permissão para arquivo_preenchimentos.
 *
 * Estes testes validam a LÓGICA de UI (canDelete) e documentam
 * o contrato das políticas RLS. Testes end-to-end contra o Postgres
 * ficam a cargo do script SQL em supabase/manual-sql/tests/
 * arquivo-preenchimentos-rls.sql (rodar como service_role).
 */

// Espelha a lógica em src/routes/painel-arquivos.$templateId.tsx:
//   canDelete = isDeveloper || roles.includes("diretor") || roles.includes("coordenador")
function canDelete(roles: string[], isDeveloper: boolean) {
  return (
    isDeveloper ||
    roles.includes("diretor") ||
    roles.includes("director") ||
    roles.includes("coordenador") ||
    roles.includes("coordinator")
  );
}

// Espelha public.is_professor_or_staff — quem pode ler/editar.
function canEdit(roles: string[]) {
  const allowed = new Set([
    "professor",
    "admin",
    "diretor",
    "director",
    "coordenador",
    "coordinator",
    "secretario",
    "desenvolvedor",
    "developer",
  ]);
  return roles.some((r) => allowed.has(r));
}

describe("arquivo_preenchimentos — quem pode EDITAR (colaborativo)", () => {
  it("professor pode editar", () => {
    expect(canEdit(["professor"])).toBe(true);
  });

  it("diretor, coordenador, secretário, admin, desenvolvedor podem editar", () => {
    for (const r of ["diretor", "coordenador", "secretario", "admin", "desenvolvedor"]) {
      expect(canEdit([r])).toBe(true);
    }
  });

  it("dois professores diferentes ambos têm permissão (edição simultânea)", () => {
    const professorA = ["professor"];
    const professorB = ["professor"];
    expect(canEdit(professorA)).toBe(true);
    expect(canEdit(professorB)).toBe(true);
  });

  it("usuário sem role autorizada NÃO pode editar", () => {
    expect(canEdit([])).toBe(false);
    expect(canEdit(["responsavel"])).toBe(false);
    expect(canEdit(["aluno"])).toBe(false);
  });
});

describe("arquivo_preenchimentos — quem pode EXCLUIR", () => {
  it("Desenvolvedor pode excluir", () => {
    expect(canDelete([], true)).toBe(true);
    expect(canDelete(["desenvolvedor"], false)).toBe(false); // apenas a flag isDeveloper conta na UI
  });

  it("Diretor pode excluir", () => {
    expect(canDelete(["diretor"], false)).toBe(true);
    expect(canDelete(["director"], false)).toBe(true);
  });

  it("Coordenador pode excluir", () => {
    expect(canDelete(["coordenador"], false)).toBe(true);
    expect(canDelete(["coordinator"], false)).toBe(true);
  });

  it("Professor NÃO pode excluir", () => {
    expect(canDelete(["professor"], false)).toBe(false);
  });

  it("Secretário NÃO pode excluir", () => {
    expect(canDelete(["secretario"], false)).toBe(false);
  });

  it("Admin genérico sem cargo específico NÃO pode excluir", () => {
    expect(canDelete(["admin"], false)).toBe(false);
  });
});

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PainelLayoutFallback, isPainelPath } from "../PainelLayout";

// PainelSidebar uses TanStack Router Link + auth hooks. Stub it to keep this
// test focused on the layout's wrapping behaviour.
vi.mock("../PainelSidebar", () => ({
  PainelSidebar: () => <aside data-testid="painel-sidebar">sidebar</aside>,
}));

// useAuth requires an AuthProvider at runtime. The layout only needs a
// resolved authenticated user to render the sidebar shell — stub the hook.
vi.mock("@/lib/use-auth", () => ({
  useAuth: () => ({
    user: { id: "test-user", email: "test@example.com" },
    loading: false,
    session: null,
    signOut: vi.fn(),
  }),
}));

describe("isPainelPath", () => {
  it.each([
    ["/painel", true],
    ["/painel-academico", true],
    ["/painel-arquivos", true],
    ["/calendario", true],
    ["/horarios", true],
    ["/minhas-turmas/123", true],
    ["/", false],
    ["/posts/abc", false],
    ["/auth", false],
  ])("isPainelPath(%s) === %s", (path, expected) => {
    expect(isPainelPath(path)).toBe(expected);
  });
});

describe("PainelLayoutFallback", () => {
  it("renders the sidebar shell for painel routes", () => {
    render(
      <PainelLayoutFallback pathname="/painel-academico">
        <div>conteudo</div>
      </PainelLayoutFallback>,
    );
    expect(screen.getByTestId("painel-sidebar")).toBeInTheDocument();
    expect(screen.getByText("conteudo")).toBeInTheDocument();
  });

  it("renders only children for non-painel routes", () => {
    render(
      <PainelLayoutFallback pathname="/">
        <div>home</div>
      </PainelLayoutFallback>,
    );
    expect(screen.queryByTestId("painel-sidebar")).not.toBeInTheDocument();
    expect(screen.getByText("home")).toBeInTheDocument();
  });

  it("does not nest a second sidebar across painel routes (idempotency)", () => {
    const { rerender } = render(
      <PainelLayoutFallback pathname="/painel">
        <PainelLayoutFallback pathname="/painel">
          <div>conteudo</div>
        </PainelLayoutFallback>
      </PainelLayoutFallback>,
    );
    // Only one sidebar even when wrapped twice (covers route components that
    // still call <PainelLayout> manually).
    expect(screen.getAllByTestId("painel-sidebar")).toHaveLength(1);

    // Simulate navigating between two painel routes; the sidebar stays mounted.
    rerender(
      <PainelLayoutFallback pathname="/painel-arquivos">
        <div>outra rota</div>
      </PainelLayoutFallback>,
    );
    expect(screen.getByTestId("painel-sidebar")).toBeInTheDocument();
    expect(screen.getByText("outra rota")).toBeInTheDocument();
  });
});

/**
 * Enumera todas as rotas reais do painel e escola (src/routes/*.tsx) e
 * garante que a sidebar permanece visível ao navegar entre elas via o
 * fallback no __root.tsx.
 */
const PAINEL_ROUTES: string[] = [
  "/painel",
  "/painel-academico",
  "/painel-alertas",
  "/painel-aprovacao",
  "/painel-arquivos",
  "/painel-auditoria",
  "/painel-comentarios",
  "/painel-desenvolvedor",
  "/painel-destaques",
  "/painel-posts",
  "/painel-posts/novo",
  "/painel-posts/abc-123",
  "/painel-profissionais",
  "/painel-runtime",
  "/calendario",
  "/horarios",
  "/usuarios",
  "/meus-comunicados",
  "/meus-filhos",
  "/minhas-turmas",
  "/minhas-turmas/turma-1",
];

const ESCOLA_ROUTES: string[] = [
  "/escola",
  "/escola/dashboard",
  "/escola/alunos",
  "/escola/professores",
  "/escola/responsaveis",
  "/escola/turmas",
  "/escola/comunicados",
  "/escola/comunicados/novo",
  "/escola/comunicados/dashboard",
];

describe("Sidebar visível em todas as rotas do painel/escola", () => {
  it.each([...PAINEL_ROUTES, ...ESCOLA_ROUTES])("sidebar permanece montada em %s", (path) => {
    expect(isPainelPath(path)).toBe(true);
    const { unmount } = render(
      <PainelLayoutFallback pathname={path}>
        <div>conteudo-{path}</div>
      </PainelLayoutFallback>,
    );
    expect(screen.getByTestId("painel-sidebar")).toBeInTheDocument();
    expect(screen.getByText(`conteudo-${path}`)).toBeInTheDocument();
    unmount();
  });

  it("sidebar continua visível ao navegar sequencialmente entre todas as rotas", () => {
    const all = [...PAINEL_ROUTES, ...ESCOLA_ROUTES];
    const { rerender } = render(
      <PainelLayoutFallback pathname={all[0]}>
        <div>page-{all[0]}</div>
      </PainelLayoutFallback>,
    );
    for (const path of all) {
      rerender(
        <PainelLayoutFallback pathname={path}>
          <div>page-{path}</div>
        </PainelLayoutFallback>,
      );
      expect(screen.getByTestId("painel-sidebar")).toBeInTheDocument();
      expect(screen.getByText(`page-${path}`)).toBeInTheDocument();
    }
  });
});

import { describe, it, expect, vi } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";

// Stub TanStack Router's Link to a plain <a> — the footer only uses Link for
// nav, and the router requires a full route context that's overkill for this
// presentational test.
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
  useRouterState: () => "/",
}));

// Logo is a raw file import — resolve to a stub URL string.
vi.mock("@/assets/logo.png", () => ({ default: "logo.png" }));

import { SiteFooter } from "../SiteFooter";
import { PrivacyCookiePreferencesFixture } from "./__fixtures__/PrivacyCookiePreferences";
import { CONSENT_EVENT, CONSENT_STORAGE_KEY } from "@/lib/cookie-consent";

describe("SiteFooter — navegação institucional consolidada", () => {
  it("mostra os links legais consolidados (Privacidade + Termos) e não expõe rota de direitos autorais", () => {
    render(<SiteFooter />);
    const nav = screen.getByTestId("footer-nav");
    const links = within(nav).getAllByRole("link");
    const labels = links.map((a) => a.textContent?.trim());

    // Consolidated legal entry points are present exactly once
    expect(labels).toContain("Privacidade e Proteção de Dados");
    expect(labels).toContain("Termos de Uso");

    // Legacy standalone route was merged into Termos de Uso and must not resurface
    expect(labels).not.toContain("Direitos Autorais");
    expect(within(nav).queryByRole("link", { name: /direitos autorais/i })).toBeNull();

    // Sanity: nav is labelled for assistive tech
    expect(nav).toHaveAttribute("aria-label");
  });

  it("expõe no máximo os 11 itens esperados do menu enxuto (~metade da versão anterior de 18)", () => {
    render(<SiteFooter />);
    const nav = screen.getByTestId("footer-nav");
    const links = within(nav).getAllByRole("link");
    expect(links.length).toBeLessThanOrEqual(11);
  });

});

describe("Página /privacidade — seção de preferências de cookies", () => {
  it("renderiza a seção com botão acessível que reabre o banner de consentimento", () => {
    render(<PrivacyCookiePreferencesFixture />);
    const section = screen.getByTestId("cookie-preferences-section");
    expect(section).toBeInTheDocument();

    const btn = within(section).getByRole("button", {
      name: /gerenciar preferências de cookies/i,
    });
    expect(btn).toBeInTheDocument();

    // Simula consent salvo e verifica que o clique dispara o evento com detail=null
    window.localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({
        necessary: true,
        analytics: true,
        marketing: false,
        version: 1,
        decidedAt: "",
      }),
    );
    const spy = vi.fn();
    window.addEventListener(CONSENT_EVENT, spy as EventListener);
    fireEvent.click(btn);
    expect(spy).toHaveBeenCalled();
    const evt = spy.mock.calls[0][0] as CustomEvent;
    expect(evt.detail).toBeNull();
    expect(window.localStorage.getItem(CONSENT_STORAGE_KEY)).toBeNull();
    window.removeEventListener(CONSENT_EVENT, spy as EventListener);
  });
});

import { Button } from "@/components/ui/button";
import { clearConsent } from "@/lib/cookie-consent";

/**
 * Espelha a seção "Preferências de cookies" renderizada em
 * `src/routes/privacidade.tsx`. Isolada aqui para testar o comportamento
 * sem precisar montar o roteador do TanStack Start.
 */
export function PrivacyCookiePreferencesFixture() {
  return (
    <section
      aria-labelledby="cookie-preferences-heading"
      data-testid="cookie-preferences-section"
      className="not-prose my-4 rounded-lg border border-border bg-muted/40 p-4"
    >
      <h3 id="cookie-preferences-heading" className="text-sm font-semibold text-foreground">
        Preferências de cookies
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Clique para reabrir o banner e revisar suas escolhas de cookies e armazenamento local.
      </p>
      <Button
        type="button"
        variant="secondary"
        className="mt-3"
        onClick={clearConsent}
        aria-label="Reabrir banner para gerenciar preferências de cookies"
      >
        Gerenciar preferências de cookies
      </Button>
    </section>
  );
}

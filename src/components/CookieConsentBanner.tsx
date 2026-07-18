import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Cookie, Settings2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  CONSENT_ACCEPT_ALL,
  CONSENT_EVENT,
  CONSENT_REJECT_ALL,
  getStoredConsent,
  saveConsent,
  type CookieConsent,
} from "@/lib/cookie-consent";

/**
 * Banner de consentimento LGPD/GDPR.
 *
 * - Só aparece quando não há decisão salva.
 * - Ações: "Aceitar todos", "Rejeitar não-essenciais", "Personalizar".
 * - Painel de personalização permite opt-in granular por categoria.
 * - Reabre-se ao disparar o evento `cookie-consent-change` com detail=null
 *   (usado pelo link "Preferências de cookies" no rodapé).
 */
export function CookieConsentBanner() {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [analyticsOn, setAnalyticsOn] = useState(false);
  const [marketingOn, setMarketingOn] = useState(false);

  useEffect(() => {
    setMounted(true);
    setVisible(getStoredConsent() === null);

    const handler = (event: Event) => {
      const detail = (event as CustomEvent<CookieConsent | null>).detail;
      setVisible(detail === null);
    };
    window.addEventListener(CONSENT_EVENT, handler);
    return () => window.removeEventListener(CONSENT_EVENT, handler);
  }, []);

  if (!mounted || !visible) return null;

  const acceptAll = () => {
    saveConsent(CONSENT_ACCEPT_ALL);
    setVisible(false);
  };

  const rejectAll = () => {
    saveConsent(CONSENT_REJECT_ALL);
    setVisible(false);
  };

  const saveCustom = () => {
    saveConsent({
      necessary: true,
      analytics: analyticsOn,
      marketing: marketingOn,
      decidedAt: "",
      version: 1,
    });
    setCustomizeOpen(false);
    setVisible(false);
  };

  return (
    <>
      <div
        role="dialog"
        aria-label="Aviso de cookies"
        aria-live="polite"
        className="fixed inset-x-2 bottom-2 z-[70] mx-auto max-w-3xl rounded-xl border border-border bg-background/95 p-4 shadow-2xl backdrop-blur-md sm:inset-x-auto sm:right-4 sm:bottom-4 sm:left-4 md:p-5"
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:gap-4">
          <div className="flex items-start gap-3">
            <div
              aria-hidden
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
            >
              <Cookie className="h-5 w-5" />
            </div>
            <div className="text-sm">
              <p className="font-semibold text-foreground">
                Este site usa cookies e dados de navegação
              </p>
              <p className="mt-1 text-muted-foreground">
                Utilizamos cookies essenciais para o funcionamento da plataforma escolar
                (autenticação, preferências) e, com sua permissão, cookies opcionais de análise de
                uso. Você pode aceitar todos, rejeitar os opcionais ou personalizar suas escolhas.{" "}
                <Link
                  to="/privacidade"
                  className="font-medium text-primary underline-offset-2 hover:underline"
                >
                  Política de Privacidade
                </Link>
                .
              </p>
            </div>
          </div>
          <div className="flex flex-col items-stretch gap-2 md:ml-auto md:flex-row md:items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCustomizeOpen(true)}
              className="gap-2"
            >
              <Settings2 className="h-4 w-4" />
              Personalizar
            </Button>
            <Button variant="outline" size="sm" onClick={rejectAll}>
              Rejeitar opcionais
            </Button>
            <Button size="sm" onClick={acceptAll}>
              Aceitar todos
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={customizeOpen} onOpenChange={setCustomizeOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Preferências de cookies</DialogTitle>
            <DialogDescription>
              Escolha quais categorias de cookies você autoriza. Você pode alterar essas opções a
              qualquer momento no rodapé do site.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-muted/40 p-3">
              <div>
                <Label className="text-sm font-semibold">Essenciais</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Necessários para login, sessão, segurança e preferências básicas. Não podem ser
                  desativados.
                </p>
              </div>
              <Switch checked disabled aria-label="Cookies essenciais (sempre ativos)" />
            </div>

            <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
              <div>
                <Label htmlFor="consent-analytics" className="text-sm font-semibold">
                  Análise de uso
                </Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Métricas agregadas sobre páginas visitadas para melhorarmos a experiência. Nenhum
                  dado é vendido a terceiros.
                </p>
              </div>
              <Switch
                id="consent-analytics"
                checked={analyticsOn}
                onCheckedChange={setAnalyticsOn}
                aria-label="Ativar cookies de análise de uso"
              />
            </div>

            <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
              <div>
                <Label htmlFor="consent-marketing" className="text-sm font-semibold">
                  Marketing
                </Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Reservado para futuras campanhas institucionais. Atualmente nenhum cookie de
                  marketing é utilizado.
                </p>
              </div>
              <Switch
                id="consent-marketing"
                checked={marketingOn}
                onCheckedChange={setMarketingOn}
                aria-label="Ativar cookies de marketing"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCustomizeOpen(false)}
              className="gap-1"
            >
              <X className="h-4 w-4" />
              Fechar
            </Button>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" size="sm" onClick={rejectAll}>
                Rejeitar opcionais
              </Button>
              <Button size="sm" onClick={saveCustom}>
                Salvar preferências
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

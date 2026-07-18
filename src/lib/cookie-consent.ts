/**
 * Consentimento de cookies (LGPD Art. 8º / GDPR Art. 7º).
 *
 * Categorias:
 * - necessary: sempre ativo (auth, sessão, preferências de tema). Base legal:
 *   execução de contrato / interesse legítimo — não requer opt-in.
 * - analytics: métricas de uso agregadas (page views). Requer opt-in explícito.
 * - marketing: reservado para futuras integrações (nenhum tracker ativo hoje).
 *
 * Persistência: `localStorage` no domínio do próprio site. Nenhum cookie de
 * terceiros é setado antes do opt-in.
 */

export const CONSENT_STORAGE_KEY = "syspulse.cookie-consent.v1";
export const CONSENT_EVENT = "cookie-consent-change";

export type ConsentCategory = "necessary" | "analytics" | "marketing";

export interface CookieConsent {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  /** ISO timestamp da decisão. */
  decidedAt: string;
  /** Versão do texto de consentimento — bump para forçar re-opt-in. */
  version: 1;
}

export const CONSENT_ACCEPT_ALL: CookieConsent = {
  necessary: true,
  analytics: true,
  marketing: true,
  decidedAt: "",
  version: 1,
};

export const CONSENT_REJECT_ALL: CookieConsent = {
  necessary: true,
  analytics: false,
  marketing: false,
  decidedAt: "",
  version: 1,
};

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getStoredConsent(): CookieConsent | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CookieConsent>;
    if (parsed.version !== 1) return null;
    return {
      necessary: true,
      analytics: Boolean(parsed.analytics),
      marketing: Boolean(parsed.marketing),
      decidedAt: typeof parsed.decidedAt === "string" ? parsed.decidedAt : "",
      version: 1,
    };
  } catch {
    return null;
  }
}

export function saveConsent(consent: CookieConsent): void {
  if (!isBrowser()) return;
  const payload: CookieConsent = {
    ...consent,
    necessary: true,
    version: 1,
    decidedAt: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: payload }));
  } catch {
    // storage cheio ou bloqueado — segue sem persistir; usuário verá o banner de novo.
  }
}

export function clearConsent(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(CONSENT_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: null }));
  } catch {
    /* ignora */
  }
}

export function hasConsentedTo(category: ConsentCategory): boolean {
  if (category === "necessary") return true;
  const stored = getStoredConsent();
  if (!stored) return false;
  return Boolean(stored[category]);
}

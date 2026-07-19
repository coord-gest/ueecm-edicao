/**
 * Sentry (APM) — inicialização client-side.
 *
 * O DSN é público por design (safe no bundle). Se `VITE_SENTRY_DSN` não
 * estiver definida, o módulo vira no-op — nenhum request é enviado.
 *
 * Uso:
 *   import { installSentry, captureException } from "@/lib/sentry";
 *   installSentry();                     // uma vez, no bootstrap do cliente
 *   captureException(err, { extra });    // captura manual
 */
import * as Sentry from "@sentry/react";

let installed = false;

function readEnv(name: string): string | undefined {
  try {
    const v = (import.meta as { env?: Record<string, string | undefined> }).env?.[name];
    return v && v.length > 0 ? v : undefined;
  } catch {
    return undefined;
  }
}

export function installSentry() {
  if (installed || typeof window === "undefined") return;
  const dsn = readEnv("VITE_SENTRY_DSN");
  if (!dsn) return; // no-op quando o projeto ainda não configurou o Sentry

  const environment = readEnv("VITE_SENTRY_ENV") ?? readEnv("MODE") ?? "production";
  const release = readEnv("VITE_APP_VERSION");

  Sentry.init({
    dsn,
    environment,
    release,
    // Amostragem econômica: 20% das transações, 100% dos erros.
    tracesSampleRate: 0.2,
    // Session Replay só ao ocorrer erro (privacidade + custo).
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    // Não enviar erros irrelevantes (extensões, ruído de rede transitório).
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications",
      "Non-Error promise rejection captured",
      /Failed to fetch/i,
      /Load failed/i,
      /NetworkError/i,
    ],
    denyUrls: [
      /extensions\//i,
      /^chrome:\/\//i,
      /^moz-extension:\/\//i,
      /static\.cloudflareinsights\.com/i,
    ],
    beforeSend(event) {
      // Scrubbing extra: nunca enviar campos com aparência de token/senha.
      const scrub = (obj: unknown): unknown => {
        if (!obj || typeof obj !== "object") return obj;
        const out: Record<string, unknown> = { ...(obj as Record<string, unknown>) };
        for (const k of Object.keys(out)) {
          if (/token|password|secret|authorization|cookie/i.test(k)) out[k] = "[Filtered]";
        }
        return out;
      };
      if (event.request?.headers) event.request.headers = scrub(event.request.headers) as never;
      if (event.extra) event.extra = scrub(event.extra) as never;
      return event;
    },
  });

  installed = true;
}

export function setSentryUser(user: { id: string; email?: string; role?: string } | null) {
  if (!installed) return;
  if (!user) {
    Sentry.setUser(null);
    return;
  }
  Sentry.setUser({ id: user.id, email: user.email, segment: user.role });
}

export function captureException(error: unknown, context?: Record<string, unknown>) {
  if (!installed) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

export function addBreadcrumb(message: string, data?: Record<string, unknown>) {
  if (!installed) return;
  Sentry.addBreadcrumb({ message, data, level: "info" });
}
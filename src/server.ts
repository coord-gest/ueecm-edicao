import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

/**
 * Security headers applied to every response.
 *
 * Coverage:
 * - HSTS: força HTTPS por 2 anos (com preload) — mitiga downgrade attacks.
 * - X-Frame-Options + CSP frame-ancestors: bloqueia clickjacking (iframe).
 * - X-Content-Type-Options: impede MIME sniffing.
 * - Referrer-Policy: não vaza URL completa em navegação cross-origin.
 * - Permissions-Policy: desliga APIs sensíveis não usadas.
 * - CSP: bloqueia XSS via script injection. Mantém 'unsafe-inline' e
 *   'unsafe-eval' em script-src porque TanStack Start injeta o payload de
 *   hidratação inline; conforme migrarmos para nonces, apertamos.
 *
 * Não aplicado a respostas que já definem CSP (edge functions específicas
 * podem ter suas próprias regras).
 */
// Allowlist explícita para connect-src — evita que XSS (mesmo com
// 'unsafe-inline' herdado da hidratação do TanStack) consiga exfiltrar
// dados para um servidor arbitrário controlado pelo atacante.
const SUPABASE_ORIGIN = "https://mhmdjjbqbbsgcsjujuhx.supabase.co";
const SUPABASE_WS_ORIGIN = "wss://mhmdjjbqbbsgcsjujuhx.supabase.co";
const FIREBASE_ORIGINS = [
  "https://fcm.googleapis.com",
  "https://fcmregistrations.googleapis.com",
  "https://firebaseinstallations.googleapis.com",
  "https://firebase.googleapis.com",
  "https://identitytoolkit.googleapis.com",
  "https://securetoken.googleapis.com",
].join(" ");

const CSP_DIRECTIVES = [
  "default-src 'self'",
  // 'unsafe-inline' ainda é necessário para o script de hidratação inline do
  // TanStack Start. 'unsafe-eval' foi removido (não é usado em produção).
  "script-src 'self' 'unsafe-inline' https://www.gstatic.com https://static.cloudflareinsights.com https://challenges.cloudflare.com",
  "script-src-elem 'self' 'unsafe-inline' https://www.gstatic.com https://static.cloudflareinsights.com https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob:",
  // Endpoints permitidos: mesma origem, Supabase (REST + Realtime), Firebase e Cloudflare Insights beacon.
  // Sem coringa https:/wss: — bloqueia exfiltração para hosts arbitrários.
  `connect-src 'self' ${SUPABASE_ORIGIN} ${SUPABASE_WS_ORIGIN} ${FIREBASE_ORIGINS} https://cloudflareinsights.com https://challenges.cloudflare.com`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  // Turnstile renderiza um iframe embutido em challenges.cloudflare.com.
  "frame-src https://challenges.cloudflare.com",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS: Record<string, string> = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-site",
  "X-DNS-Prefetch-Control": "on",
  "Content-Security-Policy": CSP_DIRECTIVES,
};

function applySecurityHeaders(response: Response): Response {
  // Response.headers pode ser imutável em alguns runtimes — clonamos.
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    if (!headers.has(name)) headers.set(name, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      const normalized = await normalizeCatastrophicSsrResponse(response);
      return applySecurityHeaders(normalized);
    } catch (error) {
      console.error(error);
      return applySecurityHeaders(
        new Response(renderErrorPage(), {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
      );
    }
  },
};

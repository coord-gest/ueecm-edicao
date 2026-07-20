import { supabase } from "@/integrations/supabase/client";
import { hasConsentedTo } from "@/lib/cookie-consent";

const SESSION_KEY = "analytics_session_id";
// Deduplica eventos idênticos dentro desta janela (ms) para evitar
// dezenas de inserts em navegações rápidas / re-renders.
// Widen a bit — pageviews from client-side navigation don't need to fire
// again for the same session/path within a few minutes.
const DEDUPE_WINDOW_MS = 5 * 60_000;
const recentEvents = new Map<string, number>();

function getSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return "unknown";
  }
}

function shouldSkip(key: string): boolean {
  const now = Date.now();
  const last = recentEvents.get(key);
  if (last && now - last < DEDUPE_WINDOW_MS) return true;
  recentEvents.set(key, now);
  if (recentEvents.size > 200) {
    for (const [k, t] of recentEvents) {
      if (now - t > DEDUPE_WINDOW_MS) recentEvents.delete(k);
    }
  }
  return false;
}

/**
 * Fire-and-forget analytics event tracker.
 * Silently swallows errors — analytics must never break the UI.
 */
export async function trackEvent(
  eventType: string,
  options: {
    path?: string;
    metadata?: Record<string, unknown>;
  } = {},
): Promise<void> {
  if (typeof window === "undefined") return;
  // LGPD Art. 8º: só coletamos telemetria de uso com opt-in explícito.
  if (!hasConsentedTo("analytics")) return;
  const path = options.path ?? window.location.pathname;
  const sessionId = getSessionId();
  if (shouldSkip(`${sessionId}|${eventType}|${path}`)) return;
  // Defer to idle time so the insert never competes with rendering / LCP.
  const schedule =
    (window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void }).requestIdleCallback ??
    ((cb: () => void) => window.setTimeout(cb, 1500));
  schedule(
    async () => {
      try {
        // getSession() reads the cached session (no network round-trip).
        // getUser() forces a `/auth/v1/user` fetch on every pageview.
        const {
          data: { session },
        } = await supabase.auth.getSession();
        await supabase.from("analytics_events").insert({
          event_type: eventType,
          path,
          user_id: session?.user?.id ?? null,
          session_id: sessionId,
          referrer: document.referrer || null,
          user_agent: navigator.userAgent,
          metadata: (options.metadata ?? {}) as never,
        });
      } catch {
        // never throw from analytics
      }
    },
    { timeout: 4000 },
  );
}

export function trackPageView(path: string): void {
  void trackEvent("pageview", { path });
}

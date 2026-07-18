/**
 * Client-side observability: Web Vitals + latency + error forwarding.
 * Inserts directly into public.performance_metrics (anon INSERT allowed,
 * rate-limited via trigger).
 */
import { supabase } from "@/integrations/supabase/client";
import { onCLS, onINP, onLCP, onFCP, onTTFB } from "web-vitals";

const SESSION_KEY = "obs_session_id";

function sessionId(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return "anon";
  }
}

type MetricInput = {
  kind: "server_fn" | "api_route" | "web_vital" | "client_nav" | "custom";
  name: string;
  duration_ms: number;
  status?: string;
  route?: string;
  metadata?: Record<string, unknown>;
};

const queue: MetricInput[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(flush, 4000);
}

async function flush() {
  flushTimer = null;
  if (queue.length === 0) return;
  const batch = queue.splice(0, queue.length);
  const route = typeof window !== "undefined" ? window.location.pathname : null;
  const sid = sessionId();
  const rows = batch.map((m) => ({
    kind: m.kind,
    name: m.name.slice(0, 200),
    duration_ms: Math.max(0, Math.min(600000, m.duration_ms)),
    status: m.status ?? null,
    route: (m.route ?? route)?.slice(0, 500) ?? null,
    session_id: sid,
    metadata: (m.metadata ?? {}) as never,
  }));
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("performance_metrics") as any).insert(rows);
  } catch (err) {
    // Silencia: observabilidade nunca deve quebrar a app.
    console.warn("[observability] flush falhou", err);
  }
}

export function recordMetric(m: MetricInput) {
  queue.push(m);
  if (queue.length >= 20) {
    void flush();
  } else {
    scheduleFlush();
  }
}

let installed = false;
export function installObservability() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  // Web Vitals → performance_metrics (kind='web_vital')
  const send = (name: string) => (metric: { value: number; rating?: string; id: string }) => {
    recordMetric({
      kind: "web_vital",
      name,
      duration_ms: name === "CLS" ? metric.value * 1000 : metric.value,
      status: metric.rating,
      metadata: { id: metric.id, raw: metric.value },
    });
  };
  onLCP(send("LCP"));
  onCLS(send("CLS"));
  onINP(send("INP"));
  onFCP(send("FCP"));
  onTTFB(send("TTFB"));

  // Navegações (soft) — mede tempo entre pushState e próximo paint.
  const origPush = history.pushState;
  history.pushState = function (...args) {
    const start = performance.now();
    const ret = origPush.apply(this, args);
    requestAnimationFrame(() => {
      recordMetric({
        kind: "client_nav",
        name: window.location.pathname,
        duration_ms: performance.now() - start,
      });
    });
    return ret;
  };

  // Flush ao sair
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flush();
  });
  window.addEventListener("pagehide", () => void flush());
}

/** Utilitário para medir qualquer promise no cliente. */
export async function measure<T>(
  name: string,
  fn: () => Promise<T>,
  kind: MetricInput["kind"] = "custom",
): Promise<T> {
  const start = performance.now();
  let status: "ok" | "error" = "ok";
  try {
    return await fn();
  } catch (err) {
    status = "error";
    throw err;
  } finally {
    recordMetric({ kind, name, duration_ms: performance.now() - start, status });
  }
}

/**
 * Client-side error monitor.
 *
 * Captures uncaught errors, unhandled promise rejections, and forwards them
 * to the console with full stack traces and to Lovable's error reporter.
 * Stores the last 50 errors in memory at `window.__errorLog` for quick
 * inspection from devtools (`console.table(window.__errorLog)`).
 */
import { reportLovableError } from "./lovable-error-reporting";
import { reportClientError } from "./observability.functions";

type LoggedError = {
  at: string;
  source: "window.error" | "unhandledrejection" | "manual";
  message: string;
  stack?: string;
  route?: string;
};

declare global {
  interface Window {
    __errorLog?: LoggedError[];
  }
}

const MAX_ENTRIES = 50;

function push(entry: LoggedError) {
  if (typeof window === "undefined") return;
  const log = (window.__errorLog ??= []);
  log.push(entry);
  if (log.length > MAX_ENTRIES) log.splice(0, log.length - MAX_ENTRIES);
}

function toEntry(source: LoggedError["source"], error: unknown): LoggedError {
  const err =
    error instanceof Error
      ? error
      : new Error(typeof error === "string" ? error : JSON.stringify(error));
  return {
    at: new Date().toISOString(),
    source,
    message: err.message,
    stack: err.stack,
    route: typeof window !== "undefined" ? window.location.pathname : undefined,
  };
}

let installed = false;

function forwardToServer(entry: LoggedError, severity: "error" | "critical" = "critical") {
  // fire-and-forget — jamais deve quebrar a app
  void reportClientError({
    data: {
      source: entry.source,
      message: entry.message.slice(0, 2000),
      stack: entry.stack?.slice(0, 8000) ?? null,
      route: entry.route ?? null,
      severity,
    },
  }).catch(() => {
    /* silencioso */
  });
}

export function installClientErrorMonitor() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (event) => {
    const error = event.error ?? new Error(event.message || "window.error");
    const entry = toEntry("window.error", error);
    push(entry);

    console.error("[error-monitor] window.error", entry, error);
    reportLovableError(error, {
      source: "window.error",
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
    forwardToServer(entry, "critical");
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const entry = toEntry("unhandledrejection", reason);
    push(entry);

    console.error("[error-monitor] unhandledrejection", entry, reason);
    reportLovableError(reason, { source: "unhandledrejection" });
    forwardToServer(entry, "critical");
  });
}

export function logManualError(
  error: unknown,
  context?: Record<string, unknown> & { severity?: "info" | "warning" | "error" | "critical" },
) {
  const entry = toEntry("manual", error);
  push(entry);

  console.error("[error-monitor] manual", entry, context, error);
  reportLovableError(error, { source: "manual", ...context });
  const sev = (context?.severity as "error" | "critical") ?? "error";
  forwardToServer(entry, sev);
}

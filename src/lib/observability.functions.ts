/**
 * Server-side observability helpers exposed as TanStack server functions.
 * - reportClientError: encaminha erros do cliente para public.system_errors
 *   (que já dispara push crítico via trigger tg_system_errors_notify).
 * - recordServerMetric: instrumenta latência de operações server-side.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const errorSchema = z.object({
  source: z.string().min(1).max(100),
  message: z.string().min(1).max(2000),
  stack: z.string().max(8000).optional().nullable(),
  route: z.string().max(500).optional().nullable(),
  severity: z.enum(["info", "warning", "error", "critical"]).default("error"),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const reportClientError = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => errorSchema.parse(raw))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("system_errors").insert({
      source: data.source,
      message: data.message,
      stack: data.stack ?? null,
      severity: data.severity,
      request_path: data.route ?? null,
      context: {
        ...(data.metadata ?? {}),
        client: true,
      } as never,
    });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

const metricSchema = z.object({
  kind: z.enum(["server_fn", "api_route", "custom"]),
  name: z.string().min(1).max(200),
  duration_ms: z.number().min(0).max(600000),
  status: z.string().max(40).optional(),
  route: z.string().max(500).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const recordServerMetric = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => metricSchema.parse(raw))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("performance_metrics").insert({
      kind: data.kind,
      name: data.name,
      duration_ms: data.duration_ms,
      status: data.status ?? null,
      route: data.route ?? null,
      metadata: (data.metadata ?? {}) as never,
    });
    return { ok: true as const };
  });

/**
 * Higher-order helper para instrumentar handlers de server functions.
 * Uso:
 *   .handler(withMetrics("getPosts", async ({ data }) => { ... }))
 */
export function withMetrics<Args extends unknown[], R>(
  name: string,
  fn: (...args: Args) => Promise<R>,
) {
  return async (...args: Args): Promise<R> => {
    const start = Date.now();
    let status: "ok" | "error" = "ok";
    try {
      return await fn(...args);
    } catch (err) {
      status = "error";
      // Erro crítico? deixa quem chama decidir; aqui só marca status.
      throw err;
    } finally {
      const duration = Date.now() - start;
      // fire-and-forget
      void (async () => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await supabaseAdmin.from("performance_metrics").insert({
            kind: "server_fn",
            name,
            duration_ms: duration,
            status,
          });
        } catch {
          /* silencioso */
        }
      })();
    }
  };
}

const metricsQuerySchema = z.object({
  hours: z.number().min(1).max(168).default(24),
  kind: z.enum(["server_fn", "api_route", "web_vital", "client_nav", "custom"]).optional(),
});

export const getMetricsPercentiles = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => metricsQuerySchema.parse(raw))
  .handler(async ({ data }) => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data: rows, error } = await supabase.rpc("metrics_percentiles", {
      _hours: data.hours,
      _kind: data.kind,
    });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

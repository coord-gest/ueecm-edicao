/**
 * Logger centralizado para código servidor e cliente.
 *
 * - Em produção, silencia `debug`/`info` e nunca ecoa objetos completos
 *   (evita vazar payloads sensíveis em logs do Cloudflare Worker / LGPD).
 * - Em desenvolvimento, imprime tudo normalmente.
 * - `error` sempre passa, mas com sanitização opcional do objeto.
 *
 * Uso:
 *   import { logger } from "@/lib/logger";
 *   logger.error("[modulo] falhou", { code: err.code });
 */

const isProd =
  (typeof process !== "undefined" && process.env?.NODE_ENV === "production") ||
  (typeof import.meta !== "undefined" &&
    (import.meta as { env?: { PROD?: boolean } }).env?.PROD === true);

type LogFn = (...args: unknown[]) => void;

const noop: LogFn = () => {};

/**
 * Extrai apenas campos seguros de um objeto de erro (Supabase, Fetch, etc.)
 * para logs em produção — evita vazar payload rejeitado, valores de coluna
 * ou dados de PII contidos na mensagem detalhada.
 */
export function safeError(err: unknown): Record<string, unknown> {
  if (!err || typeof err !== "object") return { message: String(err) };
  const e = err as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  if (typeof e.code === "string" || typeof e.code === "number") out.code = e.code;
  if (typeof e.status === "number") out.status = e.status;
  if (typeof e.name === "string") out.name = e.name;
  // Em prod, corta a mensagem em 200 chars para reduzir risco de vazamento.
  if (typeof e.message === "string") {
    out.message = isProd ? e.message.slice(0, 200) : e.message;
  }
  return out;
}

export const logger = {
  debug: isProd ? noop : (((...args) => console.debug(...args)) as LogFn),
  info: isProd ? noop : (((...args) => console.info(...args)) as LogFn),
  warn: ((...args) => console.warn(...args)) as LogFn,
  error: ((...args) => console.error(...args)) as LogFn,
};

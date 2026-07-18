/**
 * Helper unificado para leitura de variáveis de ambiente no servidor.
 * Faz fallback entre:
 *   - request.runtime.cloudflare.env (Nitro / Cloudflare Workers via Request)
 *   - process.env (Node/dev)
 *   - globalThis.__env__ (Cloudflare Workers global)
 *
 * Uso:
 *   readServerEnv("SUPABASE_URL", "PROJECT_SUPABASE_URL")
 *   readServerEnv(request, "DISPATCH_SECRET")
 *
 * Este módulo é puro (sem side effects) e seguro de importar em qualquer
 * módulo servidor — não puxa o cliente admin do Supabase.
 */
type RuntimeEnv = Record<string, string | undefined>;

export function readServerEnv(
  namesOrRequest: string | Request,
  ...rest: string[]
): string | undefined {
  let names: string[];
  let requestEnv: RuntimeEnv | undefined;
  if (typeof namesOrRequest === "string") {
    names = [namesOrRequest, ...rest];
  } else {
    names = rest;
    requestEnv = (namesOrRequest as Request & { runtime?: { cloudflare?: { env?: RuntimeEnv } } })
      .runtime?.cloudflare?.env;
  }
  const cloudflareEnv = (globalThis as typeof globalThis & { __env__?: RuntimeEnv }).__env__;
  const sources = [
    requestEnv,
    typeof process !== "undefined" ? process.env : undefined,
    cloudflareEnv,
  ];
  for (const name of names) {
    for (const source of sources) {
      const value = source?.[name];
      if (typeof value === "string" && value.trim() !== "") return value;
    }
  }
}

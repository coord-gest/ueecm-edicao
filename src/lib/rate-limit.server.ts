import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

/**
 * Rate limiting server-side apoiado pela função Postgres
 * `public.check_rate_limit(key, max, window_seconds)`.
 *
 * Uso típico dentro de um `createServerFn().handler()`:
 *
 *   const ok = await enforceRateLimit({
 *     scope: "contato_publico",
 *     subject: userIdOuIp,
 *     max: 5,
 *     windowSeconds: 3600,
 *   });
 *   if (!ok) throw new Error("Muitas tentativas. Tente novamente em alguns minutos.");
 *
 * Para triggers de INSERT em tabelas específicas, use o padrão SQL
 * (`tg_*_rate_limit`) — é mais robusto que qualquer camada aplicacional.
 */

type EnforceOpts = {
  /** Prefixo lógico do limite (ex: "auth_login", "contato_publico"). */
  scope: string;
  /** Sujeito único (user_id, IP, e-mail hasheado). Vazio = "anon". */
  subject?: string | null;
  /** Máximo de tentativas dentro da janela. */
  max: number;
  /** Janela em segundos. */
  windowSeconds: number;
};

/**
 * Lê o IP do cliente a partir dos headers padrão do Cloudflare Worker.
 * Retorna string vazia se não conseguir determinar.
 */
export function getClientIp(): string {
  try {
    return (
      getRequestHeader("cf-connecting-ip") ||
      getRequestHeader("x-real-ip") ||
      (getRequestHeader("x-forwarded-for") ?? "").split(",")[0]?.trim() ||
      ""
    );
  } catch {
    return "";
  }
}

/**
 * Retorna `true` se ainda pode prosseguir, `false` se estourou o limite.
 * Nunca lança — cabe ao chamador decidir a mensagem de erro.
 */
export async function enforceRateLimit({
  scope,
  subject,
  max,
  windowSeconds,
}: EnforceOpts): Promise<boolean> {
  const key = `${scope}:${subject && subject.length > 0 ? subject : "anon"}`;

  // Carrega o admin client apenas em runtime — este arquivo é importado
  // por *.functions.ts e não pode referenciar client.server em top-level.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data, error } = await supabaseAdmin.rpc("check_rate_limit", {
    _key: key,
    _max_requests: max,
    _window_seconds: windowSeconds,
  });

  if (error) {
    // Em caso de falha da infra, prefira liberar a bloquear (fail-open) e logue.
    console.warn("[rate-limit] falhou, liberando:", error.message);
    return true;
  }
  return data === true;
}

/**
 * Server function utilitária: permite ao cliente consultar o próprio
 * consumo de um limite. Útil para exibir "X tentativas restantes".
 * NÃO registra tentativa — apenas conta.
 */
export const peekRateLimit = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    return {
      scope: String(o.scope ?? ""),
      subject: typeof o.subject === "string" ? o.subject : null,
      windowSeconds: Number(o.windowSeconds ?? 60),
    };
  })
  .handler(async ({ data }) => {
    if (!data.scope) return { count: 0 };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const key = `${data.scope}:${data.subject ?? "anon"}`;
    const since = new Date(Date.now() - data.windowSeconds * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from("rate_limits")
      .select("id", { head: true, count: "exact" })
      .eq("key", key)
      .gte("created_at", since);
    return { count: count ?? 0 };
  });

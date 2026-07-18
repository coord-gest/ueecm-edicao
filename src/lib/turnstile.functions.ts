import { createServerFn } from "@tanstack/react-start";

/**
 * Verifica um token Turnstile emitido pelo widget no cliente.
 * Retorna `{ ok: true }` quando o token é válido; caso contrário lança erro
 * amigável. Use antes de qualquer ação sensível (login, cadastro,
 * comentário público, voto anônimo, agendamento, etc).
 */
export const verifyCaptchaToken = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    return {
      token: typeof o.token === "string" ? o.token : "",
      action: typeof o.action === "string" ? o.action : null,
    };
  })
  .handler(async ({ data }) => {
    const { verifyTurnstile } = await import("@/lib/turnstile.server");
    const { getRequestHeader } = await import("@tanstack/react-start/server");

    let ip: string | null = null;
    try {
      ip =
        getRequestHeader("cf-connecting-ip") ||
        getRequestHeader("x-real-ip") ||
        (getRequestHeader("x-forwarded-for") ?? "").split(",")[0]?.trim() ||
        null;
    } catch {
      ip = null;
    }

    const result = await verifyTurnstile(data.token, ip);
    if (!result.success) {
      throw new Error("Verificação anti-bot falhou. Recarregue a página e tente novamente.");
    }
    return { ok: true, action: result.action ?? data.action };
  });

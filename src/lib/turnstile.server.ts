/**
 * Verificação server-side do token Cloudflare Turnstile.
 * Chamar dentro de `.handler()` de server functions/routes, nunca no client.
 */

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileVerifyResult = {
  success: boolean;
  errorCodes?: string[];
  action?: string;
  hostname?: string;
};

export async function verifyTurnstile(
  token: string | null | undefined,
  remoteIp?: string | null,
): Promise<TurnstileVerifyResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.warn("[turnstile] TURNSTILE_SECRET_KEY ausente — pulando verificação");
    return { success: true };
  }
  if (!token || typeof token !== "string") {
    return { success: false, errorCodes: ["missing-input-response"] };
  }

  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (remoteIp) form.append("remoteip", remoteIp);

  try {
    const res = await fetch(SITEVERIFY_URL, { method: "POST", body: form });
    const data = (await res.json()) as {
      success: boolean;
      "error-codes"?: string[];
      action?: string;
      hostname?: string;
    };
    return {
      success: data.success === true,
      errorCodes: data["error-codes"],
      action: data.action,
      hostname: data.hostname,
    };
  } catch (err) {
    console.error("[turnstile] falha ao chamar siteverify", err);
    return { success: false, errorCodes: ["internal-error"] };
  }
}

export function assertTurnstileOk(result: TurnstileVerifyResult): void {
  if (!result.success) {
    throw new Error("Falha na verificação anti-bot. Recarregue a página e tente novamente.");
  }
}

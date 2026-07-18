import { useEffect, useId, useRef } from "react";

/**
 * Cloudflare Turnstile widget.
 * Carrega o script oficial uma única vez e renderiza um widget "managed"
 * que devolve o token via callback `onToken`. O token é de uso único
 * (~5 min) e deve ser validado no servidor via `verifyTurnstile`.
 */

type TurnstileRenderOptions = {
  sitekey: string;
  callback?: (token: string) => void;
  "error-callback"?: () => void;
  "expired-callback"?: () => void;
  "timeout-callback"?: () => void;
  theme?: "light" | "dark" | "auto";
  size?: "normal" | "compact" | "flexible";
  action?: string;
};

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement | string, opts: TurnstileRenderOptions) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
    __turnstileScriptLoading?: Promise<void>;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (window.__turnstileScriptLoading) return window.__turnstileScriptLoading;

  window.__turnstileScriptLoading = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Falha ao carregar Turnstile"));
    document.head.appendChild(s);
  });
  return window.__turnstileScriptLoading;
}

export type TurnstileWidgetProps = {
  onToken: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
  action?: string;
  theme?: "light" | "dark" | "auto";
  size?: "normal" | "compact" | "flexible";
  className?: string;
};

export function TurnstileWidget({
  onToken,
  onExpire,
  onError,
  action,
  theme = "auto",
  size = "flexible",
  className,
}: TurnstileWidgetProps) {
  const id = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;
    let cancelled = false;

    loadScript()
      .then(() => {
        if (cancelled || !window.turnstile || !containerRef.current) return;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme,
          size,
          action,
          callback: (token) => onToken(token),
          "expired-callback": () => onExpire?.(),
          "error-callback": () => onError?.(),
          "timeout-callback": () => onExpire?.(),
        });
      })
      .catch(() => onError?.());

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          /* noop */
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey]);

  if (!siteKey) {
    return (
      <div className="text-xs text-muted-foreground">
        Verificação anti-bot indisponível (configuração ausente).
      </div>
    );
  }

  return <div id={id} ref={containerRef} className={className} />;
}

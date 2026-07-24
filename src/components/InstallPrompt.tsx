import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { safeLocalStorage } from "@/lib/safe-storage";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "pwa-install-dismissed-at";
const DISMISS_DAYS = 3;
const FALLBACK_DELAY_MS = 12000;

function detectPlatform(): "ios" | "android" | "desktop" | "other" {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  if (/Windows|Mac|Linux/i.test(ua)) return "desktop";
  return "other";
}

function wasRecentlyDismissed(): boolean {
  const v = safeLocalStorage.getItem(DISMISS_KEY);
  if (!v) return false;
  const ts = parseInt(v, 10);
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts < DISMISS_DAYS * 24 * 60 * 60 * 1000;
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android" | "desktop" | "other">("other");

  useEffect(() => {
    if (typeof window === "undefined") return;
    // already installed
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;
    if (wasRecentlyDismissed()) return;

    const plat = detectPlatform();
    setPlatform(plat);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    const onInstalled = () => {
      setVisible(false);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    // Fallback: se o navegador ainda não disparou beforeinstallprompt
    // (iOS Safari, Firefox, ou Chrome antes dos heuristics), esperamos
    // um tempo maior para dar chance do evento nativo chegar primeiro
    // (assim o botão aparece como "Instalar" e não "Como instalar").
    const fallbackTimer = window.setTimeout(() => {
      setVisible((v) => v || true);
    }, FALLBACK_DELAY_MS);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.clearTimeout(fallbackTimer);
    };
  }, []);

  const dismiss = () => {
    safeLocalStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  const install = async () => {
    if (!deferred) {
      // Sem prompt nativo: manda para a página com instruções por plataforma.
      window.location.href = "/instalar";
      return;
    }
    try {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === "accepted") {
        setVisible(false);
      } else {
        dismiss();
      }
    } catch {
      dismiss();
    }
    setDeferred(null);
  };

  if (!visible) return null;

  const subtitle = deferred
    ? "Acesso rápido offline na tela inicial"
    : platform === "ios"
      ? "Toque em Compartilhar › Adicionar à Tela de Início"
      : platform === "android"
        ? "Menu ⋮ do navegador › Instalar aplicativo"
        : "Veja como instalar em qualquer dispositivo";
  const ctaLabel = deferred ? "Instalar" : "Como instalar";

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex justify-center px-4 sm:bottom-6">
      <div className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl border border-border/70 bg-card/95 p-3 shadow-xl backdrop-blur-md">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Download className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm font-semibold text-foreground">
            Instalar aplicativo
          </p>
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <Button size="sm" onClick={install} className="rounded-lg">
          {ctaLabel}
        </Button>
        <button
          onClick={dismiss}
          aria-label="Dispensar"
          className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}

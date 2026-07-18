import { useEffect, useState } from "react";
import { Bell, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { safeLocalStorage } from "@/lib/safe-storage";
import { isPushSupported, getCurrentSubscription, subscribeToPush } from "@/lib/push";

const SEEN_KEY = "permissions-onboarding-seen-v1";
const DISMISS_KEY = "permissions-onboarding-dismissed-at";
const DISMISS_DAYS = 7;

/** App instalado (PWA/TWA/APK) — standalone / fullscreen / iOS home-screen / TWA referrer. */
function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  // TWA (APK gerado pelo PWABuilder / Bubblewrap) chega com referrer "android-app://..."
  // e nem sempre casa com display-mode: standalone no primeiro frame.
  const isTwa =
    typeof document !== "undefined" &&
    typeof document.referrer === "string" &&
    document.referrer.startsWith("android-app://");
  return (
    isTwa ||
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}


function wasRecentlyDismissed(): boolean {
  const v = safeLocalStorage.getItem(DISMISS_KEY);
  if (!v) return false;
  const ts = parseInt(v, 10);
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts < DISMISS_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Onboarding de permissões — aparece uma vez após o usuário instalar o app.
 * Mostra um card explicando os benefícios das notificações antes de
 * disparar o pedido real do sistema (que só pode ser chamado em resposta
 * a um clique — Android/iOS bloqueiam prompts automáticos).
 */
export function PermissionsOnboarding() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Timer curto para deixar o app carregar antes de intervir
    const timer = setTimeout(async () => {
      if (typeof window === "undefined") return;
      if (!isStandalone()) return; // só no app instalado
      if (!isPushSupported()) return;
      if (safeLocalStorage.getItem(SEEN_KEY)) return; // já respondeu
      if (wasRecentlyDismissed()) return;
      if (Notification.permission === "granted") {
        // Já concedeu antes — verifica se falta inscrever
        const sub = await getCurrentSubscription().catch(() => null);
        if (sub) {
          safeLocalStorage.setItem(SEEN_KEY, "1");
          return;
        }
      }
      if (Notification.permission === "denied") {
        safeLocalStorage.setItem(SEEN_KEY, "1");
        return;
      }
      setVisible(true);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    safeLocalStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  const enable = async () => {
    setBusy(true);
    try {
      const r = await subscribeToPush();
      if (r.ok) {
        safeLocalStorage.setItem(SEEN_KEY, "1");
        toast.success("Notificações ativadas!", {
          description: "Você receberá avisos importantes da escola.",
        });
        setVisible(false);
      } else {
        const denied =
          r.reason.toLowerCase().includes("negada") ||
          r.reason.toLowerCase().includes("permission") ||
          Notification.permission === "denied";
        toast.error(denied ? "Permissão bloqueada" : "Não foi possível ativar", {
          description: denied
            ? "Abra as Configurações do Android → Apps → U.E. Evaristo → Notificações → Permitir. Depois volte ao app e toque em Ativar novamente."
            : r.reason,
          duration: 10000,
        });
        if (denied) safeLocalStorage.setItem(SEEN_KEY, "1");
      }
    } finally {
      setBusy(false);
    }
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="perm-onboarding-title"
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <button
          onClick={dismiss}
          aria-label="Agora não"
          className="absolute right-3 top-3 z-10 rounded-full p-1.5 text-muted-foreground hover:bg-secondary"
        >
          <X className="size-4" />
        </button>

        <div className="bg-gradient-to-br from-primary/15 via-primary/5 to-transparent px-6 pb-4 pt-8 text-center">
          <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <Bell className="size-7" />
          </div>
          <h2 id="perm-onboarding-title" className="font-display text-xl font-bold text-foreground">
            Ative os avisos da escola
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Receba comunicados, alertas e novidades diretamente no seu celular.
          </p>
        </div>

        <div className="space-y-3 px-6 py-4">
          <Benefit
            icon={<Bell className="size-4" />}
            title="Comunicados urgentes"
            text="Suspensão de aula, reuniões, avisos do diretor."
          />
          <Benefit
            icon={<Sparkles className="size-4" />}
            title="Novas publicações"
            text="Fique por dentro do que acontece na escola."
          />
        </div>

        <div className="flex flex-col gap-2 border-t border-border bg-secondary/30 px-6 py-4">
          <Button onClick={enable} disabled={busy} size="lg" className="w-full rounded-xl">
            {busy ? "Ativando..." : "Ativar notificações"}
          </Button>
          <Button
            onClick={dismiss}
            variant="ghost"
            size="sm"
            className="w-full text-muted-foreground"
          >
            Agora não
          </Button>
          <p className="mt-1 text-center text-[11px] leading-tight text-muted-foreground">
            Você pode desativar a qualquer momento nas configurações do app.
          </p>
        </div>
      </div>
    </div>
  );
}

function Benefit({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}

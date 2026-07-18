import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { FcmErrorDialog } from "@/components/FcmErrorDialog";
import {
  isPushSupported,
  getCurrentSubscription,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push";

/** Detecta PWA instalado (standalone/fullscreen). */
function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/** Detecta iOS — notificações só funcionam no PWA instalado. */
function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window);
}

export function PushSubscribeButton({ className }: { className?: string }) {
  const [mounted, setMounted] = useState(false);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorReason, setErrorReason] = useState("");

  // Evita hydration mismatch: só renderiza após montar no cliente
  useEffect(() => {
    setMounted(true);
  }, []);

  // Verifica se já está inscrito ao montar
  useEffect(() => {
    if (!mounted) return;
    if (!isPushSupported()) {
      setEnabled(false);
      return;
    }
    getCurrentSubscription()
      .then((s) => setEnabled(!!s))
      .catch(() => setEnabled(false));
  }, [mounted]);

  // Não renderiza nada no SSR para evitar mismatch
  if (!mounted) return null;

  // iOS fora do modo standalone: push não funciona — mostra instrução
  if (isIOS() && !isStandalone()) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={className}
        onClick={() =>
          toast.info("Instale o aplicativo", {
            description:
              'No iPhone/iPad, adicione à Tela Inicial pelo Safari (botão Compartilhar → "Adicionar à Tela de Início") para ativar notificações.',
            duration: 8000,
          })
        }
        aria-label="Notificações: instale o app primeiro"
      >
        <BellOff className="size-4" />
        <span className="hidden 2xl:inline">Ativar avisos</span>
      </Button>
    );
  }

  // Navegador sem suporte à Push API (Firefox antigo, navegadores de TV, etc.)
  if (!isPushSupported()) return null;

  const handle = async () => {
    setBusy(true);
    try {
      if (enabled) {
        await unsubscribeFromPush();
        setEnabled(false);
        toast.success("Notificações desativadas.");
      } else {
        const r = await subscribeToPush();
        if (r.ok) {
          setEnabled(true);
          toast.success("Notificações ativadas!", {
            description: "Você receberá alertas e novas publicações mesmo com o app fechado.",
          });
        } else {
          // Mostra diálogo detalhado em vez de toast
          setErrorReason(r.reason);
          setErrorDialogOpen(true);
        }
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      type="button"
      variant={enabled ? "secondary" : "outline"}
      size="sm"
      onClick={handle}
      // null = ainda verificando — desabilita para evitar clique duplo
      disabled={busy || enabled === null}
      className={className}
      aria-label={enabled ? "Desativar notificações" : "Ativar notificações"}
    >
      {enabled ? <BellRing className="size-4" /> : <BellOff className="size-4" />}
      <span className="hidden 2xl:inline">
        {busy ? "Aguarde..." : enabled ? "Notificações" : "Ativar avisos"}
      </span>

      {/* Diálogo de Erro Detalhado */}
      <FcmErrorDialog
        open={errorDialogOpen}
        reason={errorReason}
        onClose={() => setErrorDialogOpen(false)}
        onRetry={() => {
          setErrorDialogOpen(false);
          handle();
        }}
        isLoading={busy}
      />
    </Button>
  );
}

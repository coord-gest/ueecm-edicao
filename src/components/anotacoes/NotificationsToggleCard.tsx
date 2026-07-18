import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
  getCurrentSubscription,
} from "@/lib/push";

/**
 * Card com switch elegante para ligar/desligar notificações push neste dispositivo.
 * Toda a lógica de FCM já vive em src/lib/push.ts — aqui é só UI.
 */
export function NotificationsToggleCard() {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    const sup = isPushSupported();
    setSupported(sup);
    if (!sup) return;
    setPermission(Notification.permission);
    (async () => {
      const sub = await getCurrentSubscription().catch(() => null);
      setEnabled(!!sub);
    })();
  }, []);

  const handleToggle = async (next: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      if (next) {
        const res = await subscribeToPush();
        if (!res.ok) throw new Error(res.reason);
        setEnabled(true);
        setPermission(Notification.permission);
        toast.success("Notificações ativadas neste dispositivo.");
      } else {
        await unsubscribeFromPush();
        setEnabled(false);
        toast.success("Notificações desativadas.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível alterar as notificações.");
    } finally {
      setBusy(false);
    }
  };

  if (!supported) {
    return (
      <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <BellOff className="size-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Notificações não suportadas</p>
            <p className="text-xs text-muted-foreground">
              Este navegador não permite notificações push.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const blocked = permission === "denied";

  const canTest = enabled && !blocked && "Notification" in window;

  async function handleTest() {
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      if (reg) {
        await reg.showNotification("Conecta UEECM · Teste", {
          body: "As notificações estão funcionando neste dispositivo.",
          icon: "/icon-192.png",
          badge: "/badge-96.png",
          tag: "test-notification",
        });
      } else {
        new Notification("Conecta UEECM · Teste", {
          body: "As notificações estão funcionando neste dispositivo.",
          icon: "/icon-192.png",
        });
      }
      toast.success("Notificação de teste enviada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível testar.");
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
          {busy ? (
            <Loader2 className="size-5 animate-spin" />
          ) : enabled ? (
            <Bell className="size-5" />
          ) : (
            <BellOff className="size-5" />
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            Notificações neste dispositivo
          </p>
          <p className="text-xs text-muted-foreground">
            {blocked
              ? "Permissão bloqueada — libere nas configurações do navegador."
              : enabled
                ? "Você receberá lembretes na hora agendada, mesmo com o app fechado."
                : "Ative para receber lembretes mesmo com o app fechado."}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 self-end sm:self-auto">
        {canTest ? (
          <button
            type="button"
            onClick={handleTest}
            className="text-xs font-medium text-primary underline-offset-4 hover:underline"
          >
            Enviar teste
          </button>
        ) : null}
        <Switch
          checked={enabled}
          onCheckedChange={handleToggle}
          disabled={busy || blocked}
          aria-label="Ativar notificações"
        />
      </div>
    </div>
  );
}

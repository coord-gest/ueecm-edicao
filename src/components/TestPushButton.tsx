import { useState } from "react";
import { Send } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { sendTestPush } from "@/lib/push.functions";
import { getCurrentSubscription, isPushSupported } from "@/lib/push";

export function TestPushButton() {
  const [busy, setBusy] = useState(false);
  const run = useServerFn(sendTestPush);

  const handle = async () => {
    if (!isPushSupported()) {
      toast.error("Navegador não suporta notificações.");
      return;
    }
    const sub = await getCurrentSubscription();
    if (!sub) {
      toast.error("Ative as notificações primeiro", {
        description: "Use o botão 'Ativar avisos' no topo da página (no celular, instale o PWA).",
      });
      return;
    }
    setBusy(true);
    try {
      const r = await run();
      if (r.sent > 0) {
        toast.success(`Push enviado para ${r.sent}/${r.total} dispositivo(s)`, {
          description: "Deve aparecer em segundos. Se não chegar, verifique permissões no SO.",
        });
      } else {
        toast.error("Nenhum push entregue", {
          description: r.errors[0] ?? `Inscrições: ${r.total}, removidas: ${r.pruned}`,
        });
      }
    } catch (e) {
      toast.error("Falha ao enviar", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button onClick={handle} disabled={busy} variant="outline" className="rounded-full">
      <Send className="size-4" /> {busy ? "Enviando..." : "Enviar push de teste"}
    </Button>
  );
}

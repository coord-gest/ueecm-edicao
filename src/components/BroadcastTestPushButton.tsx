import { useState } from "react";
import { Megaphone } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { broadcastTestPush } from "@/lib/push.functions";

export function BroadcastTestPushButton() {
  const [busy, setBusy] = useState(false);
  const run = useServerFn(broadcastTestPush);

  const handle = async () => {
    if (
      !window.confirm(
        "Enviar push de teste para TODOS os dispositivos inscritos (incluindo visitantes)?",
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const r = await run();
      if (r.sent > 0) {
        toast.success(`Push enviado para ${r.sent}/${r.total} dispositivo(s)`, {
          description:
            r.pruned > 0 ? `${r.pruned} inscrição(ões) inválida(s) removida(s).` : undefined,
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
    <Button onClick={handle} disabled={busy} variant="secondary" className="rounded-full">
      <Megaphone className="size-4" /> {busy ? "Enviando..." : "Push de teste para todos"}
    </Button>
  );
}

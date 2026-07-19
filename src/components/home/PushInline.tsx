import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useReveal } from "@/hooks/use-reveal";
import { isPushSupported, subscribeToPush, getCurrentSubscription } from "@/lib/push";
import { toast } from "sonner";

/**
 * Card inline convidando o usuário a ativar notificações push da escola.
 * Reaproveita o mesmo fluxo do painel de configurações.
 */
export function PushInline() {
  const ref = useReveal<HTMLDivElement>();
  const [supported, setSupported] = useState(false);
  const [ativo, setAtivo] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSupported(isPushSupported());
    if (isPushSupported()) {
      getCurrentSubscription().then((sub) => setAtivo(Boolean(sub)));
    }
  }, []);

  async function ativar() {
    setLoading(true);
    try {
      const res = await subscribeToPush();
      if (res.ok) {
        setAtivo(true);
        toast.success("Notificações ativadas! Você receberá avisos da escola.");
      } else {
        toast.error("Não foi possível ativar as notificações.");
      }
    } catch {
      toast.error("Erro ao ativar notificações.");
    } finally {
      setLoading(false);
    }
  }

  if (!supported) return null;

  return (
    <section className="mb-16">
      <div
        ref={ref}
        className="reveal flex flex-col items-start gap-5 border border-accent/20 bg-linear-to-br from-accent/10 via-card to-card p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-8"
      >
        <div className="flex items-center gap-4">
          <div className="grid size-12 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
            {ativo ? <BellOff className="size-6" /> : <Bell className="size-6" />}
          </div>
          <div>
            <p className="font-display text-lg text-primary sm:text-xl">
              {ativo
                ? "Notificações ativas neste dispositivo"
                : "Receba avisos da escola no seu celular"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {ativo
                ? "Você já vai receber comunicados urgentes e eventos importantes."
                : "Comunicados urgentes, eventos e novidades diretamente para você."}
            </p>
          </div>
        </div>
        {!ativo && (
          <Button onClick={ativar} disabled={loading} size="lg" className="shrink-0">
            {loading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Ativando…
              </>
            ) : (
              <>
                <Bell className="mr-2 size-4" />
                Ativar notificações
              </>
            )}
          </Button>
        )}
      </div>
    </section>
  );
}

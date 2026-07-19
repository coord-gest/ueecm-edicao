import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, Loader2, StopCircle, Timer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { scheduleAlertBurst, cancelAlertBurst } from "@/lib/alert-management.functions";

type AlertOption = { id: string; message: string; variant: string | null; active: boolean | null };

export function BurstScheduler({ alertOptions }: { alertOptions: AlertOption[] }) {
  const qc = useQueryClient();
  const schedule = useServerFn(scheduleAlertBurst);
  const cancel = useServerFn(cancelAlertBurst);

  const [alertId, setAlertId] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [repeatCount, setRepeatCount] = useState(5);
  const [intervalMinutes, setIntervalMinutes] = useState(2);
  const [submitting, setSubmitting] = useState(false);

  const { data: bursts, isLoading } = useQuery({
    queryKey: ["alert-bursts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alert_burst_schedules")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30_000,
  });

  const active = alertOptions.filter((a) => a.active);
  const alertLabel = (id: string) => {
    const a = alertOptions.find((x) => x.id === id);
    if (!a) return "(alerta removido)";
    return a.message.length > 70 ? `${a.message.slice(0, 70)}…` : a.message;
  };

  const submit = async () => {
    if (!alertId) return toast.error("Selecione um alerta");
    if (!startsAt) return toast.error("Informe data/hora de início");
    const iso = new Date(startsAt).toISOString();
    if (new Date(iso).getTime() < Date.now()) {
      return toast.error("A data de início precisa estar no futuro.");
    }
    setSubmitting(true);
    try {
      await schedule({
        data: { alertId, startsAt: iso, intervalMinutes, repeatCount },
      });
      toast.success("Rajada agendada", {
        description: `${repeatCount} envios a cada ${intervalMinutes} min a partir de ${new Date(iso).toLocaleString("pt-BR")}`,
      });
      setAlertId("");
      setStartsAt("");
      qc.invalidateQueries({ queryKey: ["alert-bursts"] });
    } catch (e) {
      toast.error("Falha ao agendar rajada", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const cancelOne = async (id: string) => {
    if (!confirm("Cancelar esta rajada agendada?")) return;
    try {
      await cancel({ data: { id } });
      toast.success("Rajada cancelada");
      qc.invalidateQueries({ queryKey: ["alert-bursts"] });
    } catch (e) {
      toast.error("Falha ao cancelar", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  };

  return (
    <section className="rounded-3xl border border-border/70 bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <CalendarClock className="size-5 text-primary" />
        <h2 className="font-display text-lg font-semibold">Rajadas agendadas</h2>
        <Badge variant="outline" className="ml-auto text-xs">
          Executa no servidor — funciona com a aba fechada
        </Badge>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Agende reforços automáticos de um alerta (ex.: 5 pushes de 2 em 2 minutos a partir das 08:00).
        Limite anti-spam: 5 rajadas por hora por administrador.
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-[1.4fr_1fr_auto_auto_auto]">
        <div className="space-y-1.5">
          <Label className="text-xs">Alerta</Label>
          <Select value={alertId} onValueChange={setAlertId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um alerta ativo" />
            </SelectTrigger>
            <SelectContent>
              {active.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.message.slice(0, 60)}
                  {a.message.length > 60 ? "…" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Início</Label>
          <Input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Envios</Label>
          <Input
            type="number"
            min={1}
            max={50}
            value={repeatCount}
            onChange={(e) => setRepeatCount(Number(e.target.value))}
            className="w-24"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Intervalo (min)</Label>
          <Input
            type="number"
            min={1}
            max={1440}
            value={intervalMinutes}
            onChange={(e) => setIntervalMinutes(Number(e.target.value))}
            className="w-24"
          />
        </div>
        <div className="flex items-end">
          <Button type="button" onClick={submit} disabled={submitting} className="rounded-xl">
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Timer className="size-4" />}
            Agendar
          </Button>
        </div>
      </div>

      <div className="mt-5">
        <h3 className="mb-2 text-sm font-medium">Rajadas em andamento / futuras</h3>
        {isLoading && <p className="text-xs text-muted-foreground">Carregando…</p>}
        {!isLoading && (bursts ?? []).length === 0 && (
          <p className="rounded-xl border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
            Nenhuma rajada agendada.
          </p>
        )}
        <div className="space-y-2">
          {(bursts ?? []).map((b) => {
            const done = b.sent_count >= b.repeat_count;
            const cancelled = !!b.cancelled_at;
            const state = cancelled
              ? "Cancelada"
              : done
                ? "Concluída"
                : b.active
                  ? "Ativa"
                  : "Inativa";
            return (
              <div
                key={b.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-background/40 p-3 text-sm"
              >
                <Badge variant="outline" className="text-xs">
                  {state}
                </Badge>
                <span className="min-w-0 flex-1 truncate">{alertLabel(b.alert_id)}</span>
                <span className="text-xs text-muted-foreground">
                  {b.sent_count}/{b.repeat_count} envios · a cada {b.interval_minutes} min
                </span>
                <span className="text-xs text-muted-foreground">
                  Próximo: {new Date(b.next_run_at).toLocaleString("pt-BR")}
                </span>
                {!done && !cancelled && b.active && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => cancelOne(b.id)}
                    className="rounded-full"
                  >
                    <StopCircle className="size-3.5" /> Cancelar
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

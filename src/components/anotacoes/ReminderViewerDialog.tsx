import { Download, Pencil, X, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { format, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import logo from "@/assets/logo.png";
import type { Reminder, ReminderPriority } from "@/lib/notes-reminders.functions";

const PRI: Record<ReminderPriority, { label: string; className: string }> = {
  alta: {
    label: "Alta",
    className: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
  },
  media: {
    label: "Média",
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  },
  baixa: {
    label: "Baixa",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  },
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  reminder: Reminder | null;
  onEdit?: (r: Reminder) => void;
}

function downloadAsText(r: Reminder) {
  const dt = format(new Date(r.data_hora), "PPpp", { locale: ptBR });
  const body =
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `  U.E. EVARISTO CAMPELO DE MATOS\n` +
    `  Lembrete agendado\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Agendado para: ${dt}\n` +
    `Prioridade: ${PRI[r.prioridade].label}\n` +
    `Status: ${r.concluido ? "Concluído" : "Pendente"}\n\n` +
    `────────────────────────────────\n\n` +
    `${r.texto}\n\n` +
    `────────────────────────────────\n` +
    `Gerado pelo Conecta UEECM — conectaueecm.com\n`;
  const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `lembrete-${format(new Date(r.data_hora), "yyyy-MM-dd-HHmm")}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function ReminderViewerDialog({ open, onOpenChange, reminder, onEdit }: Props) {
  if (!reminder) return null;
  const dt = new Date(reminder.data_hora);
  const pri = PRI[reminder.prioridade] ?? PRI.media;
  const atrasado = !reminder.concluido && isPast(dt);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl overflow-hidden p-0">
        <VisuallyHidden>
          <DialogTitle>Lembrete</DialogTitle>
          <DialogDescription>Visualização do lembrete agendado</DialogDescription>
        </VisuallyHidden>

        <div className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <img
              src={logo}
              alt="U.E.E.C.M."
              className="size-12 rounded-xl bg-background object-contain p-1 shadow-sm ring-1 ring-border/50"
            />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-primary">
                Conecta UEECM
              </p>
              <p className="truncate text-xs text-muted-foreground">Lembrete agendado</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="ml-auto size-8 rounded-full"
              onClick={() => onOpenChange(false)}
              aria-label="Fechar"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={`rounded-full border ${pri.className}`}>
              {pri.label}
            </Badge>
            {reminder.concluido ? (
              <Badge
                variant="outline"
                className="gap-1 rounded-full border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
              >
                <CheckCircle2 className="size-3" /> Concluído
              </Badge>
            ) : atrasado ? (
              <Badge
                variant="outline"
                className="gap-1 rounded-full border-destructive/30 bg-destructive/10 text-destructive"
              >
                <AlertTriangle className="size-3" /> Atrasado
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 rounded-full">
                <Clock className="size-3" /> Pendente
              </Badge>
            )}
          </div>

          <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="size-4" />
            {format(dt, "PPpp", { locale: ptBR })}
          </p>

          <div className="mt-4 whitespace-pre-wrap break-words text-[17px] leading-relaxed text-foreground">
            {reminder.texto}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 bg-muted/40 px-6 py-3">
          <p className="text-[11px] text-muted-foreground">Documento gerado por conectaueecm.com</p>
          <div className="flex items-center gap-2">
            {onEdit ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => {
                  onOpenChange(false);
                  onEdit(reminder);
                }}
              >
                <Pencil className="size-4" /> Editar
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              className="rounded-full"
              onClick={() => downloadAsText(reminder)}
            >
              <Download className="size-4" /> Baixar mensagem
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

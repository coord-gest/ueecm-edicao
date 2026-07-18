import { Pencil, Trash2, Clock, AlertTriangle, Eye } from "lucide-react";
import { format, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Reminder, ReminderPriority } from "@/lib/notes-reminders.functions";

const PRI_CONF: Record<ReminderPriority, { label: string; className: string }> = {
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
  reminder: Reminder;
  onEdit: (r: Reminder) => void;
  onDelete: (r: Reminder) => void;
  onToggleDone: (r: Reminder) => void;
  onView?: (r: Reminder) => void;
}

export function ReminderCard({ reminder, onEdit, onDelete, onToggleDone, onView }: Props) {
  const dt = new Date(reminder.data_hora);
  const pri = PRI_CONF[reminder.prioridade] ?? PRI_CONF.media;
  const atrasado = !reminder.concluido && isPast(dt);

  return (
    <article
      className={`flex items-start gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-sm transition-shadow hover:shadow-md ${
        reminder.concluido ? "opacity-60" : ""
      } ${onView ? "cursor-pointer" : ""}`}
      onClick={onView ? () => onView(reminder) : undefined}
    >
      <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={reminder.concluido}
          onCheckedChange={() => onToggleDone(reminder)}
          aria-label={reminder.concluido ? "Marcar como pendente" : "Marcar como concluído"}
        />
      </div>

      <div className="min-w-0 flex-1">
        <p
          className={`text-sm leading-relaxed ${
            reminder.concluido ? "line-through text-muted-foreground" : "text-foreground"
          }`}
        >
          {reminder.texto}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3" />
            {format(dt, "PPp", { locale: ptBR })}
          </span>
          <Badge variant="outline" className={`rounded-full border ${pri.className}`}>
            {pri.label}
          </Badge>
          {atrasado ? (
            <Badge
              variant="outline"
              className="rounded-full border border-destructive/30 bg-destructive/10 text-destructive"
            >
              <AlertTriangle className="mr-1 size-3" /> Atrasado
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
        {onView ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 rounded-full"
            aria-label="Visualizar"
            onClick={() => onView(reminder)}
          >
            <Eye className="size-4" />
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 rounded-full"
          aria-label="Editar"
          onClick={() => onEdit(reminder)}
        >
          <Pencil className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 rounded-full text-destructive hover:text-destructive"
          aria-label="Apagar"
          onClick={() => onDelete(reminder)}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </article>
  );
}

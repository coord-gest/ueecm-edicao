import { Pin, PinOff, Pencil, Trash2, Eye } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Note } from "@/lib/notes-reminders.functions";
import { NOTE_COLOR_CLASSES } from "./noteColors";

interface Props {
  note: Note;
  onEdit: (note: Note) => void;
  onDelete: (note: Note) => void;
  onTogglePin: (note: Note) => void;
  onView?: (note: Note) => void;
}

export function NoteCard({ note, onEdit, onDelete, onTogglePin, onView }: Props) {
  const colorConf = NOTE_COLOR_CLASSES[note.cor] ?? NOTE_COLOR_CLASSES.default;
  const updated = note.updated_at
    ? formatDistanceToNow(new Date(note.updated_at), { addSuffix: true, locale: ptBR })
    : "";
  const iconSize = Math.min(note.icone_tamanho ?? 48, 80);

  return (
    <article
      className={`group relative flex flex-col gap-3 rounded-2xl border border-border/70 border-l-4 ${colorConf.border} bg-card p-4 shadow-sm transition-shadow hover:shadow-md ${onView ? "cursor-pointer" : ""}`}
      onClick={onView ? () => onView(note) : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {note.icone_url ? (
            <img
              src={note.icone_url}
              alt=""
              style={{ width: iconSize, height: iconSize }}
              className="shrink-0 rounded-lg object-contain"
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-display text-sm font-semibold text-foreground sm:text-base">
              {note.titulo || <span className="italic text-muted-foreground">Sem título</span>}
            </h3>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 rounded-full"
            aria-label={note.fixado ? "Desfixar" : "Fixar"}
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin(note);
            }}
          >
            {note.fixado ? <Pin className="size-4 text-primary" /> : <PinOff className="size-4" />}
          </Button>
        </div>
      </div>

      {note.conteudo ? (
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
          {note.conteudo}
        </p>
      ) : null}

      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className={`rounded-full text-[10px] ${colorConf.badge}`}>
            {colorConf.label}
          </Badge>
          <span className="text-[11px] text-muted-foreground">{updated}</span>
        </div>
        <div className="flex items-center gap-1">
          {onView ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 rounded-full"
              aria-label="Visualizar"
              onClick={(e) => {
                e.stopPropagation();
                onView(note);
              }}
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
            onClick={(e) => {
              e.stopPropagation();
              onEdit(note);
            }}
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 rounded-full text-destructive hover:text-destructive"
            aria-label="Apagar"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(note);
            }}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
    </article>
  );
}

import { Download, Pencil, Pin, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import logo from "@/assets/logo.png";
import type { Note } from "@/lib/notes-reminders.functions";
import { NOTE_COLOR_CLASSES } from "./noteColors";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  note: Note | null;
  onEdit?: (n: Note) => void;
}

function downloadAsText(note: Note) {
  const created = format(new Date(note.created_at), "PPpp", { locale: ptBR });
  const updated = format(new Date(note.updated_at), "PPpp", { locale: ptBR });
  const body =
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `  U.E. EVARISTO CAMPELO DE MATOS\n` +
    `  Anotação pessoal\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Título: ${note.titulo || "(sem título)"}\n` +
    `Criada em: ${created}\n` +
    `Atualizada em: ${updated}\n\n` +
    `────────────────────────────────\n\n` +
    `${note.conteudo || "(sem conteúdo)"}\n\n` +
    `────────────────────────────────\n` +
    `Gerado pelo Conecta UEECM — conectaueecm.com\n`;
  const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const slug =
    (note.titulo || "anotacao")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40) || "anotacao";
  a.download = `${slug}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function NoteViewerDialog({ open, onOpenChange, note, onEdit }: Props) {
  if (!note) return null;
  const cor = NOTE_COLOR_CLASSES[note.cor] ?? NOTE_COLOR_CLASSES.default;
  const updated = format(new Date(note.updated_at), "PPpp", { locale: ptBR });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl overflow-hidden p-0">
        <VisuallyHidden>
          <DialogTitle>{note.titulo || "Anotação"}</DialogTitle>
          <DialogDescription>Visualização da anotação</DialogDescription>
        </VisuallyHidden>

        {/* Header com logo */}
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
              <p className="truncate text-xs text-muted-foreground">Anotação pessoal · {updated}</p>
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

        {/* Barra de cor + título */}
        <div className={`h-1 w-full ${cor.border} border-t-4`} />

        <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className={`rounded-full ${cor.badge}`}>
              {cor.label}
            </Badge>
            {note.fixado ? (
              <Badge variant="outline" className="gap-1 rounded-full">
                <Pin className="size-3" /> Fixada
              </Badge>
            ) : null}
          </div>
          <div className="flex items-start gap-4">
            {note.icone_url ? (
              <img
                src={note.icone_url}
                alt=""
                style={{
                  width: Math.min(note.icone_tamanho ?? 48, 128),
                  height: Math.min(note.icone_tamanho ?? 48, 128),
                }}
                className="shrink-0 rounded-xl object-contain"
              />
            ) : null}
            <h2 className="font-display text-2xl font-bold leading-tight text-foreground">
              {note.titulo || <span className="italic text-muted-foreground">Sem título</span>}
            </h2>
          </div>
          <div className="mt-4 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-foreground/90">
            {note.conteudo || <span className="italic text-muted-foreground">Sem conteúdo.</span>}
          </div>
        </div>

        {/* Rodapé de ações */}
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
                  onEdit(note);
                }}
              >
                <Pencil className="size-4" /> Editar
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              className="rounded-full"
              onClick={() => downloadAsText(note)}
            >
              <Download className="size-4" /> Baixar mensagem
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Upload, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import logo from "@/assets/logo.png";
import type { Note, NoteColor } from "@/lib/notes-reminders.functions";
import { NOTE_COLORS, NOTE_COLOR_CLASSES } from "./noteColors";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: Note | null;
  onSave: (data: {
    id?: string;
    titulo: string;
    conteudo: string;
    cor: NoteColor;
    fixado: boolean;
    icone_url: string | null;
    icone_tamanho: number;
  }) => void;
  saving?: boolean;
}

const MAX_ICON_BYTES = 200 * 1024; // 200 KB max
const PRESET_ICONS: { label: string; url: string }[] = [{ label: "Logo da Escola", url: logo }];

export function NoteEditorDialog({ open, onOpenChange, initial, onSave, saving }: Props) {
  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [cor, setCor] = useState<NoteColor>("default");
  const [fixado, setFixado] = useState(false);
  const [iconeUrl, setIconeUrl] = useState<string | null>(null);
  const [iconeTamanho, setIconeTamanho] = useState<number>(48);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTitulo(initial?.titulo ?? "");
      setConteudo(initial?.conteudo ?? "");
      setCor((initial?.cor as NoteColor) ?? "default");
      setFixado(initial?.fixado ?? false);
      setIconeUrl(initial?.icone_url ?? null);
      setIconeTamanho(initial?.icone_tamanho ?? 48);
    }
  }, [open, initial]);

  const handleUpload = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem válida.");
      return;
    }
    if (file.size > MAX_ICON_BYTES) {
      toast.error("Ícone muito grande (máx. 200 KB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setIconeUrl(String(reader.result));
    };
    reader.readAsDataURL(file);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar anotação" : "Nova anotação"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="note-titulo">Título</Label>
            <Input
              id="note-titulo"
              maxLength={200}
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Reunião com pais na 6ª"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="note-conteudo">Conteúdo</Label>
            <Textarea
              id="note-conteudo"
              rows={6}
              maxLength={10_000}
              value={conteudo}
              onChange={(e) => setConteudo(e.target.value)}
              placeholder="Escreva sua anotação..."
            />
          </div>

          <div className="space-y-2">
            <Label>Cor</Label>
            <div className="flex flex-wrap gap-2">
              {NOTE_COLORS.map((c) => {
                const conf = NOTE_COLOR_CLASSES[c];
                const active = cor === c;
                return (
                  <button
                    key={c}
                    type="button"
                    aria-label={conf.label}
                    onClick={() => setCor(c)}
                    className={`rounded-full border-2 px-3 py-1 text-xs transition ${conf.badge} ${
                      active ? "border-foreground" : "border-transparent"
                    }`}
                  >
                    {conf.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Ícone da anotação */}
          <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5">
                <ImagePlus className="size-4" /> Ícone
              </Label>
              {iconeUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIconeUrl(null)}
                  className="h-7 gap-1 text-xs text-muted-foreground hover:text-destructive"
                >
                  <X className="size-3" /> Remover
                </Button>
              ) : null}
            </div>

            <div className="flex items-start gap-3">
              <div
                className="flex shrink-0 items-center justify-center rounded-lg border border-dashed border-border/70 bg-background"
                style={{ width: 72, height: 72 }}
              >
                {iconeUrl ? (
                  <img
                    src={iconeUrl}
                    alt="Ícone"
                    style={{
                      width: Math.min(iconeTamanho, 64),
                      height: Math.min(iconeTamanho, 64),
                    }}
                    className="object-contain"
                  />
                ) : (
                  <ImagePlus className="size-6 text-muted-foreground/60" />
                )}
              </div>

              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_ICONS.map((p) => (
                    <button
                      key={p.url}
                      type="button"
                      onClick={() => setIconeUrl(p.url)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background px-2.5 py-1 text-[11px] font-medium hover:bg-accent"
                    >
                      <img src={p.url} alt="" className="size-4 object-contain" />
                      {p.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border/70 bg-background px-2.5 py-1 text-[11px] font-medium hover:bg-accent"
                  >
                    <Upload className="size-3" /> Enviar imagem
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUpload(f);
                      e.target.value = "";
                    }}
                  />
                </div>
              </div>
            </div>

            {iconeUrl ? (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Tamanho do ícone</Label>
                  <span className="text-xs font-mono text-muted-foreground">{iconeTamanho}px</span>
                </div>
                <Slider
                  min={16}
                  max={128}
                  step={2}
                  value={[iconeTamanho]}
                  onValueChange={([v]) => setIconeTamanho(v ?? 48)}
                />
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 px-3 py-2">
            <Label htmlFor="note-fixado" className="cursor-pointer">
              Fixar no topo
            </Label>
            <Switch id="note-fixado" checked={fixado} onCheckedChange={setFixado} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={() =>
              onSave({
                id: initial?.id,
                titulo: titulo.trim(),
                conteudo,
                cor,
                fixado,
                icone_url: iconeUrl,
                icone_tamanho: iconeTamanho,
              })
            }
            disabled={saving}
          >
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Reminder, ReminderPriority } from "@/lib/notes-reminders.functions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: Reminder | null;
  onSave: (data: {
    id?: string;
    texto: string;
    data_hora: string;
    prioridade: ReminderPriority;
  }) => void;
  saving?: boolean;
}

/** timestamptz ISO -> valor para input datetime-local (local timezone). */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ReminderEditorDialog({ open, onOpenChange, initial, onSave, saving }: Props) {
  const [texto, setTexto] = useState("");
  const [dataLocal, setDataLocal] = useState("");
  const [prioridade, setPrioridade] = useState<ReminderPriority>("media");

  useEffect(() => {
    if (open) {
      setTexto(initial?.texto ?? "");
      setDataLocal(toLocalInput(initial?.data_hora ?? null));
      setPrioridade((initial?.prioridade as ReminderPriority) ?? "media");
    }
  }, [open, initial]);

  const handleSave = () => {
    if (!texto.trim() || !dataLocal) return;
    // datetime-local não tem TZ; new Date(local) usa timezone do usuário.
    const iso = new Date(dataLocal).toISOString();
    onSave({ id: initial?.id, texto: texto.trim(), data_hora: iso, prioridade });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar lembrete" : "Novo lembrete"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rem-texto">Descrição</Label>
            <Textarea
              id="rem-texto"
              rows={3}
              maxLength={500}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Ex.: Enviar boletim para os pais"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rem-data">Data e hora</Label>
            <Input
              id="rem-data"
              type="datetime-local"
              value={dataLocal}
              onChange={(e) => setDataLocal(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              A notificação será enviada no seu fuso horário.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Prioridade</Label>
            <Select value={prioridade} onValueChange={(v) => setPrioridade(v as ReminderPriority)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="media">Média</SelectItem>
                <SelectItem value="baixa">Baixa</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !texto.trim() || !dataLocal}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

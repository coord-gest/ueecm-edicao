import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { gerarComunicadoIA } from "@/lib/ai-assistant.functions";

interface Props {
  onGerado: (r: { titulo: string; mensagem: string }) => void;
  turma?: string;
  triggerLabel?: string;
}

export function AssistenteComunicadoIA({ onGerado, turma, triggerLabel = "Gerar com IA" }: Props) {
  const [open, setOpen] = useState(false);
  const [tema, setTema] = useState("");
  const [publico, setPublico] = useState("responsáveis e alunos");
  const [urgencia, setUrgencia] = useState("normal");
  const [loading, setLoading] = useState(false);

  async function handleGerar() {
    if (tema.trim().length < 10) {
      toast.error("Descreva o assunto (mín. 10 caracteres)");
      return;
    }
    setLoading(true);
    try {
      const r = await gerarComunicadoIA({ data: { tema, publico, urgencia, turma } });
      onGerado(r);
      setOpen(false);
      setTema("");
      toast.success("Rascunho gerado!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-2">
          <Sparkles className="h-4 w-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Assistente IA — Comunicado
          </DialogTitle>
          <DialogDescription>
            Descreva o que precisa comunicar. A IA gera um rascunho — você revisa antes de publicar.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Assunto / detalhes</Label>
            <Textarea
              value={tema}
              onChange={(e) => setTema(e.target.value)}
              rows={5}
              placeholder="Ex.: reunião de pais dia 25/07 às 19h no auditório para tratar do calendário do 2º semestre..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Público</Label>
              <Input value={publico} onChange={(e) => setPublico(e.target.value)} />
            </div>
            <div>
              <Label>Urgência</Label>
              <Select value={urgencia} onValueChange={setUrgencia}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa (informativo)</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="alta">Alta (atenção)</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleGerar} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Gerar rascunho
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

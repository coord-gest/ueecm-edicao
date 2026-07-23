import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Heart, Loader2 } from "lucide-react";
import { toast } from "sonner";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "@tanstack/react-router";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { enviarDepoimento } from "@/lib/familias-depoimentos.functions";

type Tipo = "comentario" | "sugestao" | "elogio";
type Vinculo = "mae" | "pai" | "responsavel" | "aluno" | "professor" | "ex_aluno" | "comunidade";

const VINCULOS: Array<{ value: Vinculo; label: string }> = [
  { value: "mae", label: "Mãe" },
  { value: "pai", label: "Pai" },
  { value: "responsavel", label: "Responsável" },
  { value: "aluno", label: "Aluno(a)" },
  { value: "professor", label: "Professor(a)" },
  { value: "ex_aluno", label: "Ex-aluno(a)" },
  { value: "comunidade", label: "Comunidade" },
];

const TIPOS: Array<{ value: Tipo; label: string }> = [
  { value: "elogio", label: "Elogio" },
  { value: "comentario", label: "Comentário" },
  { value: "sugestao", label: "Sugestão" },
];

interface Props {
  triggerLabel?: string;
  triggerClassName?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
}

export function FamiliasSubmitDialog({
  triggerLabel = "Deixar depoimento",
  triggerClassName,
  variant = "default",
}: Props) {
  const enviar = useServerFn(enviarDepoimento);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [tipo, setTipo] = useState<Tipo>("elogio");
  const [vinculo, setVinculo] = useState<Vinculo>("mae");
  const [mensagem, setMensagem] = useState("");
  const [autorNome, setAutorNome] = useState("");
  const [autorIdade, setAutorIdade] = useState("");
  const [turmaAno, setTurmaAno] = useState("");
  const [email, setEmail] = useState("");
  const [consentimento, setConsentimento] = useState(false);
  const [maiorIdade, setMaiorIdade] = useState(false);

  function reset() {
    setTipo("elogio");
    setVinculo("mae");
    setMensagem("");
    setAutorNome("");
    setAutorIdade("");
    setTurmaAno("");
    setEmail("");
    setConsentimento(false);
    setMaiorIdade(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mensagem.trim().length < 20) {
      toast.error("Escreva ao menos 20 caracteres na mensagem.");
      return;
    }
    if (!consentimento) {
      toast.error("É necessário marcar o consentimento LGPD para enviar.");
      return;
    }
    if (!maiorIdade) {
      toast.error(
        "Confirme ser maior de 18 anos ou responsável legal pelo autor do depoimento.",
      );
      return;
    }
    setLoading(true);
    try {
      const idadeNum = autorIdade ? Number(autorIdade) : null;
      await enviar({
        data: {
          mensagem: mensagem.trim(),
          tipo,
          vinculo,
          autor_nome: autorNome.trim() || null,
          autor_idade:
            idadeNum && Number.isFinite(idadeNum) && idadeNum >= 3 && idadeNum <= 120
              ? idadeNum
              : null,
          turma_ano: turmaAno.trim() || null,
          email_contato: email.trim() || null,
          consentimento_lgpd: true,
          autor_maior_idade: true,
          consentimento_versao: "v1",
        },
      });
      toast.success("Recebido! Em análise.", {
        description: "Seu depoimento será publicado após aprovação da equipe.",
      });
      reset();
      setOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao enviar.";
      toast.error("Não foi possível enviar", { description: msg });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} className={triggerClassName}>
          <Heart className="mr-2 size-4" aria-hidden />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Famílias UEECM — Deixe seu depoimento</DialogTitle>
          <DialogDescription>
            Comentário, sugestão ou elogio. Seu envio passa por aprovação antes de ser publicado.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="fd-tipo">Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as Tipo)}>
                <SelectTrigger id="fd-tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fd-vinculo">Vínculo</Label>
              <Select value={vinculo} onValueChange={(v) => setVinculo(v as Vinculo)}>
                <SelectTrigger id="fd-vinculo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VINCULOS.map((v) => (
                    <SelectItem key={v.value} value={v.value}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fd-msg">Mensagem *</Label>
            <Textarea
              id="fd-msg"
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              placeholder="Compartilhe sua experiência com a UEECM..."
              rows={5}
              maxLength={800}
              required
            />
            <p className="text-xs text-muted-foreground">
              {mensagem.length}/800 caracteres (mínimo 20)
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="fd-nome">Nome (opcional)</Label>
              <Input
                id="fd-nome"
                value={autorNome}
                onChange={(e) => setAutorNome(e.target.value)}
                placeholder="Família Silva"
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fd-idade">Idade (opcional)</Label>
              <Input
                id="fd-idade"
                type="number"
                inputMode="numeric"
                value={autorIdade}
                onChange={(e) => setAutorIdade(e.target.value)}
                min={3}
                max={120}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="fd-turma">Turma/Ano (opcional)</Label>
              <Input
                id="fd-turma"
                value={turmaAno}
                onChange={(e) => setTurmaAno(e.target.value)}
                placeholder="Ex: 6º Ano"
                maxLength={60}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fd-email">E-mail contato (opcional)</Label>
              <Input
                id="fd-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Não será exibido"
                maxLength={180}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" /> Enviando...
                </>
              ) : (
                "Enviar depoimento"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

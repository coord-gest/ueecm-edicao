import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, HandCoins, Loader2, Copy } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { PainelLayout } from "@/components/PainelLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  formatBRL,
  getVaquinha,
  listarContribuicoes,
  registrarContribuicao,
} from "@/lib/vaquinhas";

export const Route = createFileRoute("/vaquinhas/$id")({
  ssr: false,
  head: ({ params }) => ({ meta: [{ title: `Vaquinha ${params.id.slice(0, 8)} | UEECM` }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: VaquinhaDetalhe,
});

function VaquinhaDetalhe() {
  const { id } = Route.useParams();
  const vaqQ = useQuery({ queryKey: ["vaquinha", id], queryFn: () => getVaquinha(id) });
  const contQ = useQuery({ queryKey: ["vaquinha-contribs", id], queryFn: () => listarContribuicoes(id) });

  if (vaqQ.isLoading) {
    return (
      <PainelLayout>
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando…
        </div>
      </PainelLayout>
    );
  }
  const v = vaqQ.data;
  if (!v) {
    return (
      <PainelLayout>
        <div className="p-8 text-center text-muted-foreground">Vaquinha não encontrada.</div>
      </PainelLayout>
    );
  }
  const pct = Math.min(100, Math.round((v.arrecadado_centavos / v.meta_centavos) * 100));

  return (
    <PainelLayout>
      <div className="mx-auto max-w-3xl space-y-4 p-4">
        <Link to="/vaquinhas" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>

        {v.foto_url && <img src={v.foto_url} alt={v.titulo} className="max-h-72 w-full rounded-md object-cover" />}

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-xl">{v.titulo}</CardTitle>
              <Badge variant={v.status === "ativa" ? "default" : "secondary"}>{v.status}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">Beneficiário: {v.beneficiario}</p>
            {v.prazo && <p className="text-xs text-muted-foreground">Prazo: {new Date(v.prazo).toLocaleDateString("pt-BR")}</p>}
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="whitespace-pre-wrap text-sm">{v.descricao}</p>
            <Progress value={pct} />
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold">{formatBRL(v.arrecadado_centavos)}</span>
              <span className="text-muted-foreground">de {formatBRL(v.meta_centavos)} · {pct}%</span>
            </div>

            {v.chave_pix && (
              <div className="rounded-md border bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Chave Pix</p>
                <div className="flex items-center justify-between gap-2">
                  <code className="truncate text-sm">{v.chave_pix}</code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      navigator.clipboard.writeText(v.chave_pix!);
                      toast.success("Chave Pix copiada!");
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {v.status === "ativa" && (
              <ContribuirDialog vaquinhaId={v.id} onDone={() => contQ.refetch()} />
            )}
          </CardContent>
        </Card>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Contribuições</h2>
          {contQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : !contQ.data || contQ.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ainda sem contribuições. Seja o primeiro!</p>
          ) : (
            <ul className="space-y-2">
              {contQ.data.map((c) => (
                <li key={c.id} className="rounded-md border bg-card p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">
                      {c.anonimo ? "Anônimo" : c.contribuinte_nome || "Contribuinte"}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{formatBRL(c.valor_centavos)}</span>
                      {c.confirmado ? (
                        <Badge variant="default">Confirmado</Badge>
                      ) : (
                        <Badge variant="outline">Aguardando</Badge>
                      )}
                    </div>
                  </div>
                  {c.mensagem && <p className="mt-1 text-sm text-muted-foreground">“{c.mensagem}”</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </PainelLayout>
  );
}

function ContribuirDialog({ vaquinhaId, onDone }: { vaquinhaId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [valor, setValor] = useState("");
  const [nome, setNome] = useState("");
  const [msg, setMsg] = useState("");
  const [anon, setAnon] = useState(false);
  const [comp, setComp] = useState("");
  const [saving, setSaving] = useState(false);

  async function salvar() {
    const v = Number(valor.replace(",", "."));
    if (!Number.isFinite(v) || v <= 0) {
      toast.error("Informe um valor válido em R$.");
      return;
    }
    setSaving(true);
    try {
      await registrarContribuicao({
        vaquinha_id: vaquinhaId,
        valor_reais: v,
        mensagem: msg,
        anonimo: anon,
        contribuinte_nome: nome,
        comprovante_url: comp,
      });
      toast.success("Obrigado! A coordenação vai confirmar o recebimento.");
      setOpen(false);
      setValor(""); setNome(""); setMsg(""); setComp(""); setAnon(false);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao registrar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full"><HandCoins className="mr-2 h-4 w-4" /> Registrar contribuição</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar contribuição</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Valor (R$)</Label>
            <Input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Ex: 50,00" />
          </div>
          <div className="flex items-center gap-2">
            <Switch id="an" checked={anon} onCheckedChange={setAnon} />
            <Label htmlFor="an">Doar anonimamente</Label>
          </div>
          {!anon && (
            <div>
              <Label>Seu nome (opcional)</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
          )}
          <div>
            <Label>Mensagem (opcional)</Label>
            <Textarea rows={3} value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={400} />
          </div>
          <div>
            <Label>Link do comprovante (opcional)</Label>
            <Input placeholder="URL do print/PDF" value={comp} onChange={(e) => setComp(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">
            Sua contribuição fica <strong>aguardando confirmação</strong> pela coordenação, que valida o recebimento pelo Pix.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>
            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
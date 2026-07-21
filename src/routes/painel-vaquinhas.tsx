import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { HandCoins, Loader2, Plus, Check, X } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  atualizarVaquinha,
  confirmarContribuicao,
  criarVaquinha,
  formatBRL,
  listarContribuicoes,
  listarVaquinhas,
  type StatusVaquinha,
} from "@/lib/vaquinhas";

export const Route = createFileRoute("/painel-vaquinhas")({
  ssr: false,
  head: () => ({ meta: [{ title: "Gestão — Vaquinhas | UEECM" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: PainelVaquinhas,
});

function PainelVaquinhas() {
  const q = useQuery({ queryKey: ["painel-vaquinhas"], queryFn: () => listarVaquinhas(true) });

  return (
    <PainelLayout>
      <div className="mx-auto max-w-5xl space-y-4 p-4">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <HandCoins className="h-6 w-6 text-primary" /> Gestão de Vaquinhas
            </h1>
            <p className="text-sm text-muted-foreground">Crie, edite e confirme contribuições.</p>
          </div>
          <NovaVaquinhaDialog onDone={() => q.refetch()} />
        </header>

        {q.isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando…
          </div>
        ) : !q.data || q.data.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground">Nenhuma vaquinha cadastrada.</CardContent></Card>
        ) : (
          <div className="space-y-4">
            {q.data.map((v) => (
              <VaquinhaAdminCard key={v.id} v={v} onChanged={() => q.refetch()} />
            ))}
          </div>
        )}
      </div>
    </PainelLayout>
  );
}

function VaquinhaAdminCard({ v, onChanged }: { v: Awaited<ReturnType<typeof listarVaquinhas>>[number]; onChanged: () => void }) {
  const [status, setStatus] = useState<StatusVaquinha>(v.status);
  const [destaque, setDestaque] = useState(v.destaque);
  const [showContribs, setShowContribs] = useState(false);
  const contQ = useQuery({
    queryKey: ["admin-contribs", v.id],
    queryFn: () => listarContribuicoes(v.id),
    enabled: showContribs,
  });
  const pct = Math.min(100, Math.round((v.arrecadado_centavos / v.meta_centavos) * 100));

  async function salvar() {
    try {
      await atualizarVaquinha(v.id, { status, destaque });
      toast.success("Atualizado.");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-lg">{v.titulo}</CardTitle>
            <p className="text-xs text-muted-foreground">Beneficiário: {v.beneficiario}</p>
          </div>
          <Badge variant={v.status === "ativa" ? "default" : "secondary"}>{v.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Progress value={pct} />
        <div className="flex justify-between text-xs">
          <span>{formatBRL(v.arrecadado_centavos)}</span>
          <span className="text-muted-foreground">de {formatBRL(v.meta_centavos)} · {pct}%</span>
        </div>

        <div className="flex flex-wrap items-end gap-2 border-t pt-3">
          <div className="w-40">
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={(x) => setStatus(x as StatusVaquinha)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="rascunho">Rascunho</SelectItem>
                <SelectItem value="ativa">Ativa</SelectItem>
                <SelectItem value="pausada">Pausada</SelectItem>
                <SelectItem value="concluida">Concluída</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Switch id={`d-${v.id}`} checked={destaque} onCheckedChange={setDestaque} />
            <Label htmlFor={`d-${v.id}`} className="text-sm">Destaque</Label>
          </div>
          <Button size="sm" onClick={salvar}>Salvar</Button>
          <Button size="sm" variant="outline" onClick={() => setShowContribs((s) => !s)}>
            {showContribs ? "Ocultar" : "Ver"} contribuições
          </Button>
        </div>

        {showContribs && (
          <div className="space-y-2 border-t pt-3">
            {contQ.isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : !contQ.data || contQ.data.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem contribuições ainda.</p>
            ) : (
              contQ.data.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
                  <div className="min-w-0">
                    <div className="truncate">
                      <span className="font-medium">{c.anonimo ? "Anônimo" : c.contribuinte_nome || "—"}</span>
                      <span className="ml-2 text-muted-foreground">{formatBRL(c.valor_centavos)}</span>
                    </div>
                    {c.mensagem && <p className="truncate text-xs text-muted-foreground">{c.mensagem}</p>}
                    {c.comprovante_url && (
                      <a className="text-xs text-primary underline" href={c.comprovante_url} target="_blank" rel="noreferrer">
                        comprovante
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {c.confirmado ? (
                      <Button size="sm" variant="outline" onClick={async () => { await confirmarContribuicao(c.id, false); contQ.refetch(); onChanged(); }}>
                        <X className="mr-1 h-4 w-4" />Desfazer
                      </Button>
                    ) : (
                      <Button size="sm" onClick={async () => { await confirmarContribuicao(c.id, true); toast.success("Confirmado."); contQ.refetch(); onChanged(); }}>
                        <Check className="mr-1 h-4 w-4" />Confirmar
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NovaVaquinhaDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [beneficiario, setBeneficiario] = useState("");
  const [meta, setMeta] = useState("");
  const [pix, setPix] = useState("");
  const [foto, setFoto] = useState("");
  const [prazo, setPrazo] = useState("");
  const [destaque, setDestaque] = useState(false);
  const [saving, setSaving] = useState(false);

  async function salvar() {
    const m = Number(meta.replace(",", "."));
    if (!titulo.trim() || !descricao.trim() || !beneficiario.trim() || !Number.isFinite(m) || m <= 0) {
      toast.error("Preencha os campos obrigatórios (meta em R$).");
      return;
    }
    setSaving(true);
    try {
      await criarVaquinha({
        titulo, descricao, beneficiario,
        meta_reais: m,
        chave_pix: pix, foto_url: foto, prazo, destaque,
        status: "ativa",
      });
      toast.success("Vaquinha criada.");
      setOpen(false);
      setTitulo(""); setDescricao(""); setBeneficiario(""); setMeta(""); setPix(""); setFoto(""); setPrazo(""); setDestaque(false);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="mr-1 h-4 w-4" /> Nova vaquinha</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Nova vaquinha</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Título</Label><Input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={140} /></div>
          <div><Label>Descrição</Label><Textarea rows={4} value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={2000} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Beneficiário</Label><Input value={beneficiario} onChange={(e) => setBeneficiario(e.target.value)} /></div>
            <div><Label>Meta (R$)</Label><Input inputMode="decimal" value={meta} onChange={(e) => setMeta(e.target.value)} placeholder="Ex: 1500,00" /></div>
          </div>
          <div><Label>Chave Pix</Label><Input value={pix} onChange={(e) => setPix(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>URL da foto</Label><Input value={foto} onChange={(e) => setFoto(e.target.value)} /></div>
            <div><Label>Prazo</Label><Input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} /></div>
          </div>
          <div className="flex items-center gap-2"><Switch id="dest" checked={destaque} onCheckedChange={setDestaque} /><Label htmlFor="dest">Destaque</Label></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>{saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} Criar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
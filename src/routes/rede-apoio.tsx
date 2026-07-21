import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { HeartHandshake, HandHelping, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { PainelLayout } from "@/components/PainelLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Switch } from "@/components/ui/switch";
import {
  CATEGORIAS,
  criarOferta,
  criarPedido,
  listarOfertas,
  listarPedidos,
  type CategoriaApoio,
  type Urgencia,
} from "@/lib/rede-apoio";

export const Route = createFileRoute("/rede-apoio")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Rede de Apoio | UEECM" },
      {
        name: "description",
        content:
          "Ofereça ou peça ajuda dentro da comunidade escolar — transporte, reforço, material, alimentação e mais.",
      },
    ],
  }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: RedeApoioPage,
});

function catLabel(id: string) {
  return CATEGORIAS.find((c) => c.id === id)?.label ?? id;
}
function catEmoji(id: string) {
  return CATEGORIAS.find((c) => c.id === id)?.emoji ?? "🤝";
}

function RedeApoioPage() {
  const ofertasQ = useQuery({ queryKey: ["apoio-ofertas"], queryFn: () => listarOfertas("aprovado") });
  const pedidosQ = useQuery({ queryKey: ["apoio-pedidos"], queryFn: () => listarPedidos("aprovado") });

  return (
    <PainelLayout>
      <div className="mx-auto max-w-4xl space-y-4 p-4">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <HeartHandshake className="h-6 w-6 text-primary" /> Rede de Apoio
            </h1>
            <p className="text-sm text-muted-foreground">
              Nossa comunidade cuidando de si mesma. Ofereça ajuda ou peça apoio.
            </p>
          </div>
          <DialogNovo onCreated={() => { ofertasQ.refetch(); pedidosQ.refetch(); }} />
        </header>

        <Tabs defaultValue="ofertas">
          <TabsList>
            <TabsTrigger value="ofertas">Ofertas ({ofertasQ.data?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="pedidos">Pedidos ({pedidosQ.data?.length ?? 0})</TabsTrigger>
          </TabsList>

          <TabsContent value="ofertas" className="mt-4 space-y-3">
            {ofertasQ.isLoading ? (
              <Loader />
            ) : (ofertasQ.data ?? []).length === 0 ? (
              <Empty texto="Nenhuma oferta aprovada ainda. Seja o primeiro a ajudar!" />
            ) : (
              (ofertasQ.data ?? []).map((o) => (
                <Card key={o.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <span>{catEmoji(o.categoria)}</span> {o.titulo}
                    </CardTitle>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge variant="secondary">{catLabel(o.categoria)}</Badge>
                      {o.bairro && <Badge variant="outline">{o.bairro}</Badge>}
                      {o.disponibilidade && <Badge variant="outline">{o.disponibilidade}</Badge>}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="whitespace-pre-wrap text-sm">{o.descricao}</p>
                    {o.contato && (
                      <p className="text-xs text-muted-foreground">
                        Contato: <span className="font-medium">{o.contato}</span>
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="pedidos" className="mt-4 space-y-3">
            {pedidosQ.isLoading ? (
              <Loader />
            ) : (pedidosQ.data ?? []).length === 0 ? (
              <Empty texto="Nenhum pedido no momento." />
            ) : (
              (pedidosQ.data ?? []).map((p) => (
                <Card key={p.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <span>{catEmoji(p.categoria)}</span> {p.titulo}
                    </CardTitle>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge variant="secondary">{catLabel(p.categoria)}</Badge>
                      <Badge
                        variant={p.urgencia === "alta" ? "destructive" : "outline"}
                        className="capitalize"
                      >
                        Urgência: {p.urgencia}
                      </Badge>
                      {p.anonimo && <Badge variant="outline">Anônimo</Badge>}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="whitespace-pre-wrap text-sm">{p.descricao}</p>
                    <p className="text-xs text-muted-foreground">
                      Fale com a coordenação para conectar-se a este pedido.
                    </p>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </PainelLayout>
  );
}

function Loader() {
  return (
    <div className="flex items-center justify-center py-10 text-muted-foreground">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando…
    </div>
  );
}
function Empty({ texto }: { texto: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
        <HandHelping className="h-10 w-10 opacity-40" />
        <p className="text-sm">{texto}</p>
      </CardContent>
    </Card>
  );
}

function DialogNovo({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<"oferta" | "pedido">("oferta");
  const [categoria, setCategoria] = useState<CategoriaApoio>("outro");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [contato, setContato] = useState("");
  const [bairro, setBairro] = useState("");
  const [disponibilidade, setDisponibilidade] = useState("");
  const [urgencia, setUrgencia] = useState<Urgencia>("normal");
  const [anonimo, setAnonimo] = useState(true);
  const [saving, setSaving] = useState(false);

  async function salvar() {
    if (!titulo.trim() || !descricao.trim()) {
      toast.error("Preencha título e descrição.");
      return;
    }
    setSaving(true);
    try {
      if (tipo === "oferta") {
        await criarOferta({ categoria, titulo, descricao, contato, bairro, disponibilidade });
      } else {
        await criarPedido({
          categoria,
          titulo,
          descricao,
          urgencia,
          anonimo,
          contato_reserva: contato,
        });
      }
      toast.success("Enviado! Sua publicação passará por moderação da coordenação.");
      setOpen(false);
      setTitulo(""); setDescricao(""); setContato(""); setBairro(""); setDisponibilidade("");
      onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="mr-1 h-4 w-4" /> Publicar</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova publicação</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as "oferta" | "pedido")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="oferta">Oferta (quero ajudar)</SelectItem>
                <SelectItem value="pedido">Pedido (preciso de ajuda)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Categoria</Label>
            <Select value={categoria} onValueChange={(v) => setCategoria(v as CategoriaApoio)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIAS.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.emoji} {c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Título</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={120} />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={4} maxLength={1200} />
          </div>
          {tipo === "oferta" ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Bairro</Label>
                  <Input value={bairro} onChange={(e) => setBairro(e.target.value)} />
                </div>
                <div>
                  <Label>Disponibilidade</Label>
                  <Input placeholder="Ex: sábados à tarde" value={disponibilidade} onChange={(e) => setDisponibilidade(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Contato</Label>
                <Input placeholder="WhatsApp/e-mail" value={contato} onChange={(e) => setContato(e.target.value)} />
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Urgência</Label>
                  <Select value={urgencia} onValueChange={(v) => setUrgencia(v as Urgencia)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baixa">Baixa</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end gap-2">
                  <Switch checked={anonimo} onCheckedChange={setAnonimo} id="anon" />
                  <Label htmlFor="anon" className="text-sm">Publicar anônimo</Label>
                </div>
              </div>
              <div>
                <Label>Contato reservado (só para coordenação)</Label>
                <Input value={contato} onChange={(e) => setContato(e.target.value)} />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>
            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
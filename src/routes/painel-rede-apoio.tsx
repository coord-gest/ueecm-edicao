import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Shield, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { PainelLayout } from "@/components/PainelLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CATEGORIAS,
  listarOfertas,
  listarPedidos,
  moderarOferta,
  moderarPedido,
} from "@/lib/rede-apoio";

export const Route = createFileRoute("/painel-rede-apoio")({
  ssr: false,
  head: () => ({ meta: [{ title: "Moderação — Rede de Apoio | UEECM" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: PainelRedeApoioPage,
});

function catLabel(id: string) {
  return CATEGORIAS.find((c) => c.id === id)?.label ?? id;
}

function PainelRedeApoioPage() {
  const ofertasQ = useQuery({ queryKey: ["mod-ofertas"], queryFn: () => listarOfertas("pendente") });
  const pedidosQ = useQuery({ queryKey: ["mod-pedidos"], queryFn: () => listarPedidos("pendente") });

  async function decidirO(id: string, status: "aprovado" | "rejeitado") {
    try { await moderarOferta(id, status); toast.success(status === "aprovado" ? "Oferta aprovada." : "Oferta rejeitada."); ofertasQ.refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro."); }
  }
  async function decidirP(id: string, status: "aprovado" | "rejeitado") {
    try { await moderarPedido(id, status); toast.success(status === "aprovado" ? "Pedido aprovado." : "Pedido rejeitado."); pedidosQ.refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro."); }
  }

  return (
    <PainelLayout>
      <div className="mx-auto max-w-4xl space-y-4 p-4">
        <header>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Shield className="h-6 w-6 text-primary" /> Moderação — Rede de Apoio
          </h1>
          <p className="text-sm text-muted-foreground">Aprove ou rejeite publicações antes de exibir na comunidade.</p>
        </header>

        <Tabs defaultValue="ofertas">
          <TabsList>
            <TabsTrigger value="ofertas">Ofertas pendentes ({ofertasQ.data?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="pedidos">Pedidos pendentes ({pedidosQ.data?.length ?? 0})</TabsTrigger>
          </TabsList>

          <TabsContent value="ofertas" className="mt-4 space-y-3">
            {ofertasQ.isLoading ? <L /> : (ofertasQ.data ?? []).length === 0 ? <E /> : (
              ofertasQ.data!.map((o) => (
                <Card key={o.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{o.titulo}</CardTitle>
                    <div className="flex gap-2 text-xs"><Badge variant="secondary">{catLabel(o.categoria)}</Badge>{o.bairro && <Badge variant="outline">{o.bairro}</Badge>}</div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="whitespace-pre-wrap text-sm">{o.descricao}</p>
                    {o.contato && <p className="text-xs text-muted-foreground">Contato: {o.contato}</p>}
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => decidirO(o.id, "aprovado")}><Check className="mr-1 h-4 w-4" />Aprovar</Button>
                      <Button size="sm" variant="outline" onClick={() => decidirO(o.id, "rejeitado")}><X className="mr-1 h-4 w-4" />Rejeitar</Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="pedidos" className="mt-4 space-y-3">
            {pedidosQ.isLoading ? <L /> : (pedidosQ.data ?? []).length === 0 ? <E /> : (
              pedidosQ.data!.map((p) => (
                <Card key={p.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{p.titulo}</CardTitle>
                    <div className="flex gap-2 text-xs">
                      <Badge variant="secondary">{catLabel(p.categoria)}</Badge>
                      <Badge variant={p.urgencia === "alta" ? "destructive" : "outline"}>{p.urgencia}</Badge>
                      {p.anonimo && <Badge variant="outline">anônimo</Badge>}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="whitespace-pre-wrap text-sm">{p.descricao}</p>
                    {p.contato_reserva && <p className="text-xs text-muted-foreground">Contato reservado: {p.contato_reserva}</p>}
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => decidirP(p.id, "aprovado")}><Check className="mr-1 h-4 w-4" />Aprovar</Button>
                      <Button size="sm" variant="outline" onClick={() => decidirP(p.id, "rejeitado")}><X className="mr-1 h-4 w-4" />Rejeitar</Button>
                    </div>
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

function L() {
  return <div className="flex items-center justify-center py-10 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando…</div>;
}
function E() {
  return <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">Nada pendente 🎉</div>;
}
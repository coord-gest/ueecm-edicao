import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck, Loader2, Check, X, Pin } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listarMuralModeracao, moderarMuralPost, MURAL_CATEGORIAS } from "@/lib/mural.functions";

export const Route = createFileRoute("/painel-mural-moderacao")({
  head: () => ({
    meta: [
      { title: "Moderação do Mural — Conecta UEECM" },
      { name: "description", content: "Aprove ou recuse posts do Mural da Comunidade enviados pelas famílias." },
    ],
  }),
  component: ModeracaoPage,
});

function ModeracaoPage() {
  const listar = useServerFn(listarMuralModeracao);
  const moderar = useServerFn(moderarMuralPost);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["mural-moderacao"], queryFn: () => listar(), staleTime: 15_000 });

  const m = useMutation({
    mutationFn: (v: { postId: string; acao: "aprovar" | "rejeitar" | "fixar" | "desafixar" }) => moderar({ data: v }),
    onSuccess: (_r, v) => {
      toast.success(v.acao === "aprovar" ? "Post aprovado" : v.acao === "rejeitar" ? "Post rejeitado" : "Atualizado");
      qc.invalidateQueries({ queryKey: ["mural-moderacao"] });
      qc.invalidateQueries({ queryKey: ["mural-feed"] });
    },
    onError: (e: unknown) => toast.error((e as Error).message),
  });

  return (
    <div className="container mx-auto max-w-4xl p-4 md:p-6 space-y-6">
      <header className="flex items-start gap-3">
        <div className="rounded-[5px] bg-primary/10 p-2 text-primary"><ShieldCheck className="h-5 w-5" /></div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Moderação do Mural</h1>
          <p className="text-sm text-muted-foreground">Posts enviados pelas famílias aguardando aprovação da escola.</p>
        </div>
      </header>

      {q.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-6"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
      ) : (q.data ?? []).length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Nada pendente. Mural sob controle. 🎉</CardContent></Card>
      ) : (
        <div className="space-y-4">
          {q.data?.map((p) => {
            const cat = MURAL_CATEGORIAS.find((c) => c.id === p.categoria);
            return (
              <Card key={p.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline">{cat?.emoji} {cat?.label}</Badge>
                    <span className="text-sm font-medium">{p.autor_nome}</span>
                    <span className="text-xs text-muted-foreground">• {new Date(p.created_at).toLocaleString("pt-BR")}</span>
                  </div>
                  <CardTitle className="text-lg pt-1">{p.titulo}</CardTitle>
                  <CardDescription className="whitespace-pre-wrap">{p.conteudo}</CardDescription>
                </CardHeader>
                <CardContent>
                  {p.imagem_url && <img src={p.imagem_url} alt="" className="rounded-[5px] max-h-64 mb-3 object-cover" loading="lazy" />}
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" onClick={() => m.mutate({ postId: p.id, acao: "aprovar" })} disabled={m.isPending} className="gap-1">
                      <Check className="h-4 w-4" /> Aprovar
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => { if (confirm("Rejeitar este post? Ele será excluído.")) m.mutate({ postId: p.id, acao: "rejeitar" }); }} disabled={m.isPending} className="gap-1">
                      <X className="h-4 w-4" /> Rejeitar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => m.mutate({ postId: p.id, acao: "fixar" })} disabled={m.isPending} className="gap-1">
                      <Pin className="h-4 w-4" /> Aprovar e fixar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
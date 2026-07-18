import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, XCircle, Loader2, Eye } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { sanitizeHtml } from "@/lib/sanitize";

import { PainelLayout } from "@/components/PainelLayout";

export const Route = createFileRoute("/painel-aprovacao")({
  ssr: false,
  head: () => ({ meta: [{ title: "Aprovação de posts | Painel" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: Aprovacao,
});

function Aprovacao() {
  const { user, hasRole } = useAuth();
  const qc = useQueryClient();
  const canApprove = hasRole("desenvolvedor") || hasRole("diretor") || hasRole("coordenador");

  const [preview, setPreview] = useState<{ titulo: string; conteudo: string | null } | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");

  const { data: queue, isLoading } = useQuery({
    queryKey: ["aprovacao-fila"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("id, titulo, resumo, conteudo, autor, data, updated_at")
        .eq("status", "em_revisao")
        .order("updated_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: canApprove,
  });

  const approve = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("posts")
        .update({
          status: "publicado",
          aprovado_por: user?.id,
          aprovado_em: new Date().toISOString(),
          motivo_rejeicao: null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Post publicado!");
      qc.invalidateQueries({ queryKey: ["aprovacao-fila"] });
      qc.invalidateQueries({ queryKey: ["painel-stats"] });
    },
    onError: (e: unknown) =>
      toast.error("Erro", { description: e instanceof Error ? e.message : undefined }),
  });

  const reject = useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo: string }) => {
      const { error } = await supabase
        .from("posts")
        .update({
          status: "rejeitado",
          motivo_rejeicao: motivo,
          aprovado_por: user?.id,
          aprovado_em: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Post rejeitado");
      setRejecting(null);
      setMotivo("");
      qc.invalidateQueries({ queryKey: ["aprovacao-fila"] });
    },
    onError: (e: unknown) =>
      toast.error("Erro", { description: e instanceof Error ? e.message : undefined }),
  });

  if (!canApprove) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary px-4 text-center">
        <div>
          <h1 className="font-display text-xl font-semibold">Acesso restrito</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Apenas Desenvolvedor, Diretor ou Coordenador.
          </p>
          <Button asChild className="mt-4 rounded-full">
            <Link to="/painel">Voltar</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <PainelLayout>
      <div className="min-h-screen bg-secondary">
        <header className="border-b border-border/60 bg-background/85 backdrop-blur-lg">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
            <div>
              <p className="font-display text-lg font-semibold text-primary">Fila de aprovação</p>
              <p className="text-xs text-muted-foreground">
                Revise e publique posts enviados pela equipe
              </p>
            </div>
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/painel">
                <ArrowLeft className="size-4" /> Painel
              </Link>
            </Button>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (queue ?? []).length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card py-16 text-center">
              <CheckCircle2 className="mx-auto size-8 text-accent" />
              <p className="mt-3 font-display text-foreground">Nenhum post aguardando aprovação</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {(queue ?? []).map((p) => (
                <li
                  key={p.id}
                  className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Badge variant="outline">Em revisão</Badge>
                      <p className="mt-2 font-display text-lg font-semibold text-foreground">
                        {p.titulo}
                      </p>
                      <p className="text-sm text-muted-foreground">por {p.autor}</p>
                      <p className="mt-2 line-clamp-2 text-sm">{p.resumo}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        onClick={() => setPreview({ titulo: p.titulo, conteudo: p.conteudo })}
                      >
                        <Eye className="size-4" /> Pré-visualizar
                      </Button>
                      <Button
                        size="sm"
                        className="rounded-full"
                        disabled={approve.isPending}
                        onClick={() => approve.mutate(p.id)}
                      >
                        <CheckCircle2 className="size-4" /> Aprovar e publicar
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="rounded-full"
                        onClick={() => {
                          setRejecting(p.id);
                          setMotivo("");
                        }}
                      >
                        <XCircle className="size-4" /> Rejeitar
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </main>

        <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{preview?.titulo}</DialogTitle>
            </DialogHeader>
            <div
              className="prose prose-sm sm:prose-base max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{
                __html: sanitizeHtml(preview?.conteudo ?? "<p><em>Sem conteúdo</em></p>"),
              }}
            />
          </DialogContent>
        </Dialog>

        <Dialog
          open={!!rejecting}
          onOpenChange={(o) => {
            if (!o) {
              setRejecting(null);
              setMotivo("");
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rejeitar publicação</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">Informe o motivo para o autor revisar:</p>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={4}
              placeholder="Ex.: ajustar título e adicionar imagem de capa..."
            />
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setRejecting(null);
                  setMotivo("");
                }}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                disabled={!motivo.trim() || reject.isPending}
                onClick={() => rejecting && reject.mutate({ id: rejecting, motivo: motivo.trim() })}
              >
                {reject.isPending && <Loader2 className="size-4 animate-spin" />} Confirmar rejeição
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PainelLayout>
  );
}

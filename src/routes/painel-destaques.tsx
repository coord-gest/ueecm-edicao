import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Star, Search, Loader2, ImageIcon, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";

import { PainelLayout } from "@/components/PainelLayout";

export const Route = createFileRoute("/painel-destaques")({
  ssr: false,
  head: () => ({ meta: [{ title: "Destaques da Home | Painel" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: PainelDestaques,
});

const MAX_DESTAQUES = 5;

function PainelDestaques() {
  const { hasRole } = useAuth();
  const canManage =
    hasRole("desenvolvedor") || hasRole("admin") || hasRole("diretor") || hasRole("coordenador") || hasRole("social_media");
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  const { data: posts, isLoading } = useQuery({
    queryKey: ["painel-destaques"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("id, titulo, resumo, imagem, autor, data, status, destaque")
        .eq("status", "publicado")
        .order("data", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: canManage,
  });

  const toggle = useMutation({
    mutationFn: async ({ id, destaque }: { id: string; destaque: boolean }) => {
      const { error } = await supabase.from("posts").update({ destaque }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.destaque ? "Adicionado aos destaques" : "Removido dos destaques");
      qc.invalidateQueries({ queryKey: ["painel-destaques"] });
      qc.invalidateQueries({ queryKey: ["posts-publicos"] });
    },
    onError: (e: unknown) =>
      toast.error("Erro ao atualizar", {
        description: e instanceof Error ? e.message : undefined,
      }),
  });

  const destaques = useMemo(() => (posts ?? []).filter((p) => p.destaque), [posts]);
  const candidatos = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (posts ?? []).filter(
      (p) =>
        !p.destaque &&
        (term === "" ||
          p.titulo.toLowerCase().includes(term) ||
          (p.resumo ?? "").toLowerCase().includes(term) ||
          (p.autor ?? "").toLowerCase().includes(term)),
    );
  }, [posts, q]);

  if (!canManage) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary px-4 text-center">
        <div>
          <h1 className="font-display text-xl font-semibold">Acesso restrito</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Apenas Desenvolvedor, Diretor, Coordenador ou Administrador.
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
            <div className="flex items-center gap-3">
              <Star className="size-6 text-gold" />
              <div>
                <p className="font-display text-lg font-semibold text-primary">Destaques da Home</p>
                <p className="text-xs text-muted-foreground">
                  Escolha quais publicações aparecem no carrossel da página inicial
                </p>
              </div>
            </div>
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/painel">
                <ArrowLeft className="size-4" /> Painel
              </Link>
            </Button>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
          {/* Em destaque agora */}
          <section className="rounded-3xl border border-gold/30 bg-gold/5 p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
                <Star className="size-5 text-gold" /> Em destaque agora
              </h2>
              <Badge variant="outline" className="rounded-full">
                {destaques.length} / {MAX_DESTAQUES} no carrossel
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              O carrossel da Home mostra os {MAX_DESTAQUES} destaques mais recentes (por data da
              publicação).
            </p>

            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : destaques.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-border bg-card py-10 text-center">
                <p className="font-display text-foreground">Nenhum destaque selecionado</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Marque uma publicação abaixo para que ela apareça no carrossel da Home.
                </p>
              </div>
            ) : (
              <ul className="mt-4 space-y-3">
                {destaques.map((p, i) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-3 shadow-sm"
                  >
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gold/20 text-xs font-semibold text-gold-foreground">
                      {i + 1}
                    </div>
                    <Thumb src={p.imagem} alt={p.titulo} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">{p.titulo}</p>
                      <p className="line-clamp-1 text-xs text-muted-foreground">
                        {p.autor} · {new Date(p.data).toLocaleDateString("pt-BR")}
                      </p>
                      {i >= MAX_DESTAQUES && (
                        <p className="mt-1 text-xs text-amber-600">
                          Fora do carrossel — só os {MAX_DESTAQUES} mais recentes aparecem.
                        </p>
                      )}
                    </div>
                    <Switch
                      checked={true}
                      onCheckedChange={(v) => toggle.mutate({ id: p.id, destaque: v })}
                      disabled={toggle.isPending}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Adicionar destaques */}
          <section className="mt-8 rounded-3xl border border-border/70 bg-card p-6 shadow-sm">
            <h2 className="font-display text-lg font-semibold text-foreground">
              Adicionar mais destaques
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Marque outras publicações (projetos, notícias e eventos) para incluir nos destaques.
            </p>

            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por título, autor ou resumo..."
                className="rounded-full pl-9"
              />
            </div>

            {isLoading ? null : candidatos.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-border bg-secondary py-10 text-center text-sm text-muted-foreground">
                Nenhuma outra publicação disponível.
              </div>
            ) : (
              <ul className="mt-4 divide-y divide-border/60">
                {candidatos.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 py-3">
                    <Thumb src={p.imagem} alt={p.titulo} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">{p.titulo}</p>
                      <p className="line-clamp-1 text-xs text-muted-foreground">
                        {p.autor} · {new Date(p.data).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <Switch
                      checked={false}
                      onCheckedChange={(v) => toggle.mutate({ id: p.id, destaque: v })}
                      disabled={toggle.isPending}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
            <GripVertical className="size-3.5" />
            Dica: a ordem do carrossel segue a data da publicação (mais recente primeiro). Para
            mudar a ordem, ajuste a data no editor do post.
          </p>
        </main>
      </div>
    </PainelLayout>
  );
}

function Thumb({ src, alt }: { src: string | null; alt: string }) {
  if (!src) {
    return (
      <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <ImageIcon className="size-5" />
      </div>
    );
  }
  return (
    <img src={src} alt={alt} className="size-14 shrink-0 rounded-xl object-cover" loading="lazy" />
  );
}

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Database, Loader2, Sprout, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { SEED_AUTHOR_TAG, SEED_POSTS } from "@/lib/seed-posts";

export function SeedPostsCard() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const seed = useMutation({
    mutationFn: async () => {
      // Idempotente: remove seeds anteriores antes de inserir, evitando duplicatas.
      await supabase.from("posts").delete().like("autor", `${SEED_AUTHOR_TAG}%`);
      const now = Date.now();
      const rows = SEED_POSTS.map((p) => {
        const data = new Date(now - p.diasAtras * 86_400_000).toISOString();
        return {
          titulo: p.titulo,
          resumo: p.resumo,
          conteudo: p.conteudo,
          imagem: p.imagem,
          autor: p.autor,
          autor_id: user?.id,
          turma: p.turma,
          disciplina: p.disciplina,
          destaque: p.destaque,
          geral: p.geral,
          status: "publicado" as const,
          aprovado_por: user?.id,
          aprovado_em: data,
          data,
        };
      });
      const { error } = await supabase.from("posts").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => {
      toast.success(`${n} posts de demonstração criados!`);
      qc.invalidateQueries({ queryKey: ["painel-posts"] });
      qc.invalidateQueries({ queryKey: ["painel-stats"] });
      qc.invalidateQueries({ queryKey: ["home-posts"] });
    },
    onError: (e: unknown) =>
      toast.error("Erro ao gerar seed", {
        description: e instanceof Error ? e.message : undefined,
      }),
  });

  const wipe = useMutation({
    mutationFn: async () => {
      const { error, count } = await supabase
        .from("posts")
        .delete({ count: "exact" })
        .like("autor", `${SEED_AUTHOR_TAG}%`);
      if (error) throw error;
      return count ?? 0;
    },
    onSuccess: (n) => {
      toast.success(`${n} posts de demonstração removidos`);
      qc.invalidateQueries({ queryKey: ["painel-posts"] });
      qc.invalidateQueries({ queryKey: ["painel-stats"] });
      qc.invalidateQueries({ queryKey: ["home-posts"] });
    },
    onError: (e: unknown) =>
      toast.error("Erro ao remover seed", {
        description: e instanceof Error ? e.message : undefined,
      }),
  });

  return (
    <div className="mt-6 rounded-3xl border border-accent/40 bg-accent/5 p-6 shadow-sm">
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
        <Database className="size-5 text-accent-foreground" /> Seed de dados (Desenvolvedor)
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Gere {SEED_POSTS.length} posts fictícios profissionais para demonstração do blog e do
        painel. Todos serão criados já publicados, com capa, autor marcado como{" "}
        <code className="rounded bg-muted px-1 text-xs">{SEED_AUTHOR_TAG}</code> e datas escalonadas
        nos últimos dias.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          className="rounded-full"
          onClick={() => seed.mutate()}
          disabled={seed.isPending || wipe.isPending}
        >
          {seed.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sprout className="size-4" />
          )}
          Gerar {SEED_POSTS.length} posts de exemplo
        </Button>
        <Button
          variant="outline"
          className="rounded-full"
          onClick={() => {
            if (
              confirm(
                "Remover todos os posts marcados como 'Seed Demo'? Esta ação não pode ser desfeita.",
              )
            )
              wipe.mutate();
          }}
          disabled={seed.isPending || wipe.isPending}
        >
          {wipe.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Trash2 className="size-4" />
          )}
          Remover posts de demonstração
        </Button>
      </div>
    </div>
  );
}

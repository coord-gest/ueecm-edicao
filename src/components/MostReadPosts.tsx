import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Eye, TrendingUp, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type MostReadRow = {
  id: string;
  titulo: string;
  views: number | null;
  imagem: string | null;
  published_at?: string | null;
};

const INITIAL = 5;
const STEP = 5;
const MAX = 20;

export function MostReadPosts({ limit = INITIAL }: { limit?: number }) {
  const [visible, setVisible] = useState(limit);

  const { data, isLoading } = useQuery({
    queryKey: ["posts-mais-lidos", MAX],
    queryFn: async () => {
      // 1) Tenta posts com views > 0, ordenados por visualizações
      const withViews = await supabase
        .from("posts")
        .select("id, titulo, views, imagem, published_at")
        .eq("status", "publicado")
        .gt("views", 0)
        .order("views", { ascending: false, nullsFirst: false })
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(MAX);

      if (withViews.error) throw withViews.error;

      const rows = (withViews.data ?? []) as MostReadRow[];
      if (rows.length > 0) return { rows, fallback: false as const };

      // 2) Fallback: nenhum post com views — mostra os mais recentes
      const recent = await supabase
        .from("posts")
        .select("id, titulo, views, imagem, published_at")
        .eq("status", "publicado")
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(MAX);
      if (recent.error) throw recent.error;
      return { rows: (recent.data ?? []) as MostReadRow[], fallback: true as const };
    },
    staleTime: 60_000,
  });

  if (isLoading) return null;

  const rows = data?.rows ?? [];
  const fallback = data?.fallback ?? false;

  return (
    <aside className="hover-lift rounded-2xl border border-border/70 bg-card p-5 shadow-elegant">
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
        {fallback ? (
          <Clock className="size-5 text-primary dark:text-foreground" aria-hidden="true" />
        ) : (
          <TrendingUp className="size-5 text-primary dark:text-foreground" aria-hidden="true" />
        )}
        {fallback ? "Publicações recentes" : "Mais lidos"}
      </h2>

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Ainda não há publicações para exibir.</p>
      ) : (
        <>
          {fallback && (
            <p className="mt-1 text-xs text-muted-foreground">
              Ainda sem visualizações registradas — mostrando os posts mais recentes.
            </p>
          )}
          <ol className="mt-4 space-y-3">
            {rows.slice(0, visible).map((post, i) => (
              <li key={post.id} className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary dark:bg-foreground/10 dark:text-foreground"
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <Link
                    to="/posts/$id"
                    params={{ id: post.id }}
                    className="line-clamp-2 text-sm font-medium hover:text-primary"
                  >
                    {post.titulo}
                  </Link>
                  <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Eye className="size-3" aria-hidden="true" />
                    <span className="tabular-nums font-medium text-foreground/80">
                      {(post.views ?? 0).toLocaleString("pt-BR")}
                    </span>
                    <span>visualizações</span>
                  </p>
                </div>
              </li>
            ))}
          </ol>

          {visible < rows.length && (
            <div className="mt-4 flex justify-center">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => setVisible((v) => Math.min(v + STEP, rows.length))}
              >
                Ver mais
              </Button>
            </div>
          )}
        </>
      )}
    </aside>
  );
}

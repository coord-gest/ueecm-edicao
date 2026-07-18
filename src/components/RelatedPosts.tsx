import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatarDataHora } from "@/data/mock";
import { Badge } from "@/components/ui/badge";

interface Props {
  postId: string;
  disciplina: string | null;
  turma: string | null;
}

/** Lista 3 posts relacionados (mesma disciplina/turma) excluindo o atual. */
export function RelatedPosts({ postId, disciplina, turma }: Props) {
  const { data: posts } = useQuery({
    queryKey: ["related-posts", postId, disciplina, turma],
    queryFn: async () => {
      let query = supabase
        .from("posts")
        .select("id, titulo, resumo, imagem, autor, data, disciplina, turma")
        .eq("status", "publicado")
        .neq("id", postId)
        .order("data", { ascending: false })
        .limit(3);

      if (disciplina) {
        query = query.eq("disciplina", disciplina);
      } else if (turma) {
        query = query.eq("turma", turma);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fallback: se não encontrou nada relacionado, traz os mais recentes
      if (!data || data.length === 0) {
        const { data: recentes } = await supabase
          .from("posts")
          .select("id, titulo, resumo, imagem, autor, data, disciplina, turma")
          .eq("status", "publicado")
          .neq("id", postId)
          .order("data", { ascending: false })
          .limit(3);
        return recentes ?? [];
      }
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  if (!posts || posts.length === 0) return null;

  return (
    <section className="mt-12 border-t border-border/70 pt-8">
      <h2 className="font-display text-xl font-semibold">Continue lendo</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((p) => (
          <Link
            key={p.id}
            to="/posts/$id"
            params={{ id: p.id }}
            className="group hover-lift sheen overflow-hidden rounded-2xl border border-border/70 bg-card shadow-elegant hover:border-primary/50"
          >
            {p.imagem && (
              <div className="aspect-[16/9] overflow-hidden bg-muted">
                <img
                  src={p.imagem}
                  alt={p.titulo}
                  loading="lazy"
                  className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
            )}
            <div className="p-4">
              <div className="flex flex-wrap gap-1.5">
                {p.disciplina && (
                  <Badge variant="secondary" className="rounded-full text-xs">
                    {p.disciplina}
                  </Badge>
                )}
              </div>
              <h3 className="mt-2 line-clamp-2 font-display text-base font-semibold leading-tight group-hover:text-primary">
                {p.titulo}
              </h3>
              {p.resumo && (
                <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{p.resumo}</p>
              )}
              <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarDays className="size-3.5" /> {formatarDataHora(p.data)}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

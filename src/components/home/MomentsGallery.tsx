import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useReveal } from "@/hooks/use-reveal";
import { Skeleton } from "@/components/ui/skeleton";
import { Camera } from "lucide-react";

type MomentItem = {
  postId: string;
  titulo: string;
  imagem: string;
};

const VISIBLE = 12;
const ROTATE_MS = 30000;

/** Extrai URLs de imagens do HTML do conteúdo do post. */
function extractImagesFromHtml(html: string | null): string[] {
  if (!html) return [];
  const urls: string[] = [];
  const re = /<img[^>]+src=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    urls.push(m[1]);
  }
  return urls;
}

function pickRandom<T>(pool: T[], count: number): T[] {
  if (pool.length <= count) return pool.slice();
  const copy = pool.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

export function MomentsGallery() {
  const ref = useReveal<HTMLElement>();

  const { data, isLoading } = useQuery({
    queryKey: ["home-momentos"],
    queryFn: async (): Promise<MomentItem[]> => {
      const { data, error } = await supabase
        .from("posts")
        .select("id, titulo, imagem, imagem_url, conteudo, data, published_at, created_at")
        .eq("status", "publicado")
        .order("data", { ascending: false })
        .limit(60);
      if (error) throw error;

      const seen = new Set<string>();
      const items: MomentItem[] = [];

      for (const p of data ?? []) {
        const candidates: string[] = [];
        if (p.imagem) candidates.push(p.imagem);
        if (p.imagem_url && p.imagem_url !== p.imagem) candidates.push(p.imagem_url);
        for (const src of extractImagesFromHtml(p.conteudo)) {
          if (!candidates.includes(src)) candidates.push(src);
        }

        for (const src of candidates) {
          if (seen.has(src)) continue;
          seen.add(src);
          items.push({ postId: p.id, titulo: p.titulo, imagem: src });
        }
      }

      return items;
    },
  });

  const pool = useMemo(() => data ?? [], [data]);
  const [visible, setVisible] = useState<MomentItem[]>([]);

  useEffect(() => {
    if (pool.length === 0) {
      setVisible([]);
      return;
    }
    setVisible(pickRandom(pool, VISIBLE));
    if (pool.length <= VISIBLE) return;
    const id = setInterval(() => {
      setVisible(pickRandom(pool, VISIBLE));
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [pool]);

  if (!isLoading && pool.length === 0) return null;

  return (
    <section ref={ref} className="reveal mt-10 md:mt-16">
      <div className="mb-6 flex items-end justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <Camera className="size-5 text-accent" />
          <h2 className="font-display text-2xl text-primary sm:text-3xl">Momentos</h2>
        </div>
        <Link
          to="/posts"
          className="text-xs font-semibold uppercase tracking-widest text-accent transition-colors hover:text-primary"
        >
          Ver galeria completa
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 md:grid-cols-6">
        {isLoading || visible.length === 0
          ? Array.from({ length: VISIBLE }).map((_, i) => (
              <Skeleton key={i} className="aspect-square w-full " />
            ))
          : visible.map((m, i) => (
              <Link
                key={`${m.postId}-${m.imagem}-${i}`}
                to="/posts/$id"
                params={{ id: m.postId }}
                className="group relative block aspect-square overflow-hidden border border-border bg-secondary shadow-sm transition-all hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent animate-in fade-in duration-700"
              >
                <img
                  src={m.imagem}
                  alt={m.titulo}
                  loading="lazy"
                  className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-neutral-900/75 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="absolute inset-x-0 bottom-0 line-clamp-2 p-1.5 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                  {m.titulo}
                </div>
              </Link>
            ))}
      </div>
    </section>
  );
}

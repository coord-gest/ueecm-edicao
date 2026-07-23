import { CalendarDays, User } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { type Post, formatarDataHora } from "@/data/posts-utils";

export function PostCard({ post }: { post: Post }) {
  return (
    <Link
      to="/posts/$id"
      params={{ id: post.id }}
      className="group hover-lift sheen flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-elegant focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        <img
          src={post.imagem}
          alt={post.titulo}
          loading="lazy"
          width={800}
          height={600}
          className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          {post.geral && (
            <Badge className="rounded-full bg-gold text-gold-foreground hover:bg-gold">Geral</Badge>
          )}
          {post.disciplina && (
            <Badge className="rounded-full bg-accent text-accent-foreground hover:bg-accent">
              {post.disciplina}
            </Badge>
          )}
          {post.turma && (
            <Badge variant="secondary" className="rounded-full">
              {post.turma}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-lg font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
          {post.titulo}
        </h3>
        <p className="mt-2 line-clamp-3 flex-1 text-sm text-muted-foreground">{post.resumo}</p>
        <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <User className="size-3.5" /> {post.autor}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="size-3.5" /> {formatarDataHora(post.data)}
          </span>
        </div>
      </div>
    </Link>
  );
}

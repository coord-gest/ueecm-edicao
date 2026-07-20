import { ClientOnly, createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { ArrowLeft, CalendarDays, Clock, Eye, User } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatarDataHora } from "@/data/mock";
import { sanitizeHtml } from "@/lib/sanitize";
import { PostShare } from "@/components/PostShare";
import { PostComentarios } from "@/components/PostComentarios";
import { ReadingProgress } from "@/components/ReadingProgress";
import { TableOfContents } from "@/components/TableOfContents";
import { RelatedPosts } from "@/components/RelatedPosts";
import { MostReadPosts } from "@/components/MostReadPosts";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { BackToTop } from "@/components/BackToTop";
import { PostContent } from "@/components/PostContent";
import { ReadingModeToolbar, useReadingMode } from "@/components/ReadingMode";
import { calcularTempoLeitura, extrairTOC } from "@/lib/reading";
import { cn } from "@/lib/utils";
import heroImg from "@/assets/hero-school.jpg";

const fetchPost = async (id: string) => {
  const { data, error } = await supabase
    .from("posts")
    .select(
      "id, titulo, resumo, conteudo, imagem, autor, data, turma, disciplina, destaque, geral, status, views, created_at, published_at",
    )
    .eq("id", id)
    .eq("status", "publicado")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw notFound();
  return data;
};

export const postQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ["post-publico", id],
    queryFn: () => fetchPost(id),
  });

export const Route = createFileRoute("/posts/$id")({
  loader: ({ params, context }) => context.queryClient.ensureQueryData(postQueryOptions(params.id)),
  head: ({ loaderData, params }) => {
    const title = loaderData?.titulo
      ? `${loaderData.titulo} | U.E. Evaristo Campelo de Matos`
      : "Notícia | U.E. Evaristo Campelo de Matos";
    const description = loaderData?.resumo ?? "Notícia da U.E. Evaristo Campelo de Matos.";
    const canonicalUrl = `https://conectaueecm.com/posts/${params.id}`;
    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: description },
      { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1" },
      { property: "og:title", content: loaderData?.titulo ?? title },
      { property: "og:description", content: description },
      { property: "og:type", content: "article" },
      { property: "og:url", content: canonicalUrl },
      { property: "og:locale", content: "pt_BR" },
      { property: "og:site_name", content: "U.E. Evaristo Campelo de Matos" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: loaderData?.titulo ?? title },
      { name: "twitter:description", content: description },
    ];
    if (loaderData?.autor) meta.push({ name: "author", content: loaderData.autor });
    if (loaderData?.published_at || loaderData?.data)
      meta.push({
        property: "article:published_time",
        content: String(loaderData.published_at ?? loaderData.data),
      });
    if (loaderData?.imagem) {
      meta.push({ property: "og:image", content: loaderData.imagem });
      meta.push({ property: "og:image:alt", content: loaderData.titulo ?? "" });
      meta.push({ name: "twitter:image", content: loaderData.imagem });
    }
    return {
      meta,
      links: [{ rel: "canonical", href: canonicalUrl }],
      scripts: loaderData
        ? [
            {
              type: "application/ld+json",
              children: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "NewsArticle",
                headline: loaderData.titulo,
                description: loaderData.resumo,
                image: loaderData.imagem ?? undefined,
                datePublished: loaderData.published_at ?? loaderData.data,
                dateModified: loaderData.published_at ?? loaderData.data,
                inLanguage: "pt-BR",
                mainEntityOfPage: canonicalUrl,
                author: { "@type": "Person", name: loaderData.autor },
                publisher: {
                  "@type": "EducationalOrganization",
                  name: "U.E. Evaristo Campelo de Matos",
                  url: "https://conectaueecm.com/",
                  logo: {
                    "@type": "ImageObject",
                    url: "https://conectaueecm.com/icon-512.png",
                  },
                },
              }),
            },
            {
              type: "application/ld+json",
              children: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                itemListElement: [
                  {
                    "@type": "ListItem",
                    position: 1,
                    name: "Início",
                    item: "https://conectaueecm.com/",
                  },
                  {
                    "@type": "ListItem",
                    position: 2,
                    name: "Notícias",
                    item: "https://conectaueecm.com/posts",
                  },
                  { "@type": "ListItem", position: 3, name: loaderData.titulo, item: canonicalUrl },
                ],
              }),
            },
          ]
        : undefined,
    };
  },
  component: PostDetail,
  errorComponent: ({ error, reset }) => (
    <div className="min-h-dvh bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-semibold">Erro ao carregar a notícia</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <Button onClick={reset} className="mt-6 rounded-full">
          Tentar novamente
        </Button>
      </main>
      <SiteFooter />
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-dvh bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-semibold">Notícia não encontrada</h1>
        <Button asChild className="mt-6 rounded-full">
          <Link to="/">Voltar para a página inicial</Link>
        </Button>
      </main>
      <SiteFooter />
    </div>
  ),
});

function PostDetail() {
  const { id } = Route.useParams();
  const { data: post } = useSuspenseQuery(postQueryOptions(id));
  const reading = useReadingMode();

  const {
    html: conteudoComIds,
    toc,
    tempoLeitura,
  } = useMemo(() => {
    const safe = sanitizeHtml(post?.conteudo ?? "");
    const { html, toc } = extrairTOC(safe);
    return {
      html,
      toc,
      tempoLeitura: calcularTempoLeitura(safe || post?.resumo || ""),
    };
  }, [post?.conteudo, post?.resumo]);

  useEffect(() => {
    if (!post?.id) return;
    // Fire-and-forget: incrementa visualizações via SECURITY DEFINER RPC
    supabase.rpc("increment_post_views", { _post_id: post.id }).then(() => {
      // noop
    });
  }, [post?.id]);

  if (!post) return null;

  return (
    <div className="min-h-dvh bg-background">
      <ReadingProgress />
      <SiteHeader />
      <aside
        className="pointer-events-none fixed inset-y-0 left-0 z-10 hidden w-[calc((100vw-48rem)/2-1rem)] max-w-xs pt-28 pl-6 xl:block"
        aria-hidden={toc.length < 2}
      >
        <div className="pointer-events-auto">
          <TableOfContents items={toc} variant="sidebar" />
        </div>
      </aside>
      <article className="mx-auto max-w-3xl px-4 pb-16 pt-8 sm:px-6">
        <Breadcrumbs
          className="mb-3"
          items={[
            { label: "Início", to: "/" },
            { label: "Notícias", to: "/posts" },
            { label: post.titulo },
          ]}
        />
        <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
          <Link to="/">
            <ArrowLeft className="size-4" /> Voltar
          </Link>
        </Button>

        <div className="flex flex-wrap gap-2">
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

        <h1 className="mt-4 font-display text-3xl font-semibold leading-tight sm:text-4xl">
          {post.titulo}
        </h1>

        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <User className="size-4" /> {post.autor}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="size-4" />{" "}
            {formatarDataHora(post.published_at ?? post.created_at ?? post.data)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-4" /> {tempoLeitura} min de leitura
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Eye className="size-4" /> {post.views ?? 0} visualizações
          </span>
        </div>

        <div className="mt-4 flex justify-end">
          <ReadingModeToolbar
            aumentar={reading.aumentar}
            diminuir={reading.diminuir}
            toggleContraste={reading.toggleContraste}
            highContrast={reading.highContrast}
            size={reading.size}
          />
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-border/70">
          <img
            src={post.imagem ?? heroImg}
            alt={post.titulo}
            className="aspect-[16/9] w-full object-cover"
          />
        </div>

        <p className="mt-6 text-lg leading-relaxed text-muted-foreground">{post.resumo}</p>

        <div className="xl:hidden">
          <TableOfContents items={toc} />
        </div>

        {conteudoComIds && (
          <ClientOnly
            fallback={
              <div
                className={cn(
                  "prose prose-neutral mt-6 max-w-none dark:prose-invert prose-headings:font-display prose-headings:scroll-mt-24 prose-img:rounded-xl",
                  reading.articleClass,
                )}
                dangerouslySetInnerHTML={{ __html: conteudoComIds }}
              />
            }
          >
            <PostContent
              html={conteudoComIds}
              className={cn(
                "prose prose-neutral mt-6 max-w-none dark:prose-invert prose-headings:font-display prose-headings:scroll-mt-24 prose-img:rounded-xl",
                reading.articleClass,
              )}
            />
          </ClientOnly>
        )}

        <PostShare title={post.titulo} text={post.resumo ?? undefined} />
        <RelatedPosts postId={post.id} disciplina={post.disciplina} turma={post.turma} />
        <div className="mt-10">
          <MostReadPosts />
        </div>
        <PostComentarios postId={post.id} />
      </article>
      <BackToTop />
      <SiteFooter />
    </div>
  );
}

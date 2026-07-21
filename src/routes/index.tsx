import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Users,
  Calendar,
  Clock,
  AlertTriangle,
  Eye,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { useReveal } from "@/hooks/use-reveal";
import { StatsBar } from "@/components/home/StatsBar";
import { CtaDuo } from "@/components/home/CtaDuo";
import { UpcomingEvents } from "@/components/home/UpcomingEvents";
import { TeamHighlight } from "@/components/home/TeamHighlight";
import { TitinhoCta } from "@/components/home/TitinhoCta";
import { PushInline } from "@/components/home/PushInline";
import { Testimonials } from "@/components/home/Testimonials";
import { AlunosDestaque } from "@/components/home/AlunosDestaque";
import { QuickContact } from "@/components/home/QuickContact";
import { MomentsGallery } from "@/components/home/MomentsGallery";
import { patrocinadoresQueryOptions } from "@/components/home/Patrocinadores";
import { listPatrocinadoresPublicos } from "@/lib/patrocinadores.functions";
const Patrocinadores = lazy(() =>
  import("@/components/home/Patrocinadores").then((m) => ({ default: m.Patrocinadores })),
);
import { SobreEscola } from "@/components/home/SobreEscola";
import { LayoutGrid, List } from "lucide-react";
import type { Post } from "@/data/mock";
import { OPINIONS } from "@/data/opinions";
import heroImg from "@/assets/hero-school.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "U.E. Evaristo Campelo de Matos — Escola pública em Assunção do Piauí" },
      {
        name: "description",
        content:
          "Portal oficial da U.E. Evaristo Campelo de Matos em Assunção do Piauí (PI): notícias, calendário escolar, eventos, comunicados, equipe pedagógica e conquistas dos alunos.",
      },
      {
        name: "keywords",
        content:
          "UEECM, U.E. Evaristo Campelo de Matos, escola Assunção do Piauí, escola pública Piauí, Evaristo Campelo, calendário escolar UEECM, notícias UEECM, portal escolar",
      },
      { name: "author", content: "U.E. Evaristo Campelo de Matos" },
      { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1" },
      { name: "googlebot", content: "index, follow, max-image-preview:large, max-snippet:-1" },
      { name: "geo.region", content: "BR-PI" },
      { name: "geo.placename", content: "Assunção do Piauí" },
      { property: "og:title", content: "U.E. Evaristo Campelo de Matos — Portal oficial" },
      {
        property: "og:description",
        content:
          "Notícias, calendário, eventos e comunicados da comunidade escolar da UEECM em Assunção do Piauí.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://conectaueecm.com/" },
      { property: "og:image", content: "https://conectaueecm.com/og-image.jpg" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "U.E. Evaristo Campelo de Matos — Assunção do Piauí" },
      { property: "og:locale", content: "pt_BR" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "U.E. Evaristo Campelo de Matos — Portal oficial" },
      {
        name: "twitter:description",
        content: "Notícias, calendário e comunicados da comunidade escolar UEECM.",
      },
      { name: "twitter:image", content: "https://conectaueecm.com/og-image.jpg" },
    ],
    links: [{ rel: "canonical", href: "https://conectaueecm.com/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "U.E. Evaristo Campelo de Matos",
          alternateName: "UEECM",
          url: "https://conectaueecm.com/",
          inLanguage: "pt-BR",
          publisher: { "@id": "https://conectaueecm.com/#organization" },
          potentialAction: {
            "@type": "SearchAction",
            target: "https://conectaueecm.com/posts?q={search_term_string}",
            "query-input": "required name=search_term_string",
          },
        }),
      },
    ],
  }),
  component: Home,
});

function Home() {
  const { data: posts, isLoading } = useQuery({
    queryKey: ["posts-publicos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select(
          "id, titulo, resumo, imagem, autor, data, turma, disciplina, destaque, geral, published_at, created_at, views",
        )
        .eq("status", "publicado")
        .order("data", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((p) => ({
        id: p.id,
        titulo: p.titulo,
        resumo: p.resumo,
        imagem: p.imagem ?? heroImg,
        autor: p.autor,
        // Prefere timestamp completo (com hora + fuso) para exibir corretamente.
        data: p.published_at ?? p.created_at ?? p.data,
        turma: p.turma ?? undefined,
        disciplina: p.disciplina ?? undefined,
        destaque: p.destaque,
        geral: p.geral,
        views: p.views ?? 0,
      })) as (Post & { views: number })[];
    },
  });

  const lista = useMemo(() => posts ?? [], [posts]);
  const destaques = lista.filter((p) => p.destaque).slice(0, 4);
  const heroSlides = destaques.length > 0 ? destaques : lista.slice(0, 4);
  const hero = heroSlides[0];
  // "Mais Lidas": ranking real por visualizações, sem excluir o destaque/hero.
  const maisLidasBase = [...lista]
    .filter((p) => (p.views ?? 0) > 0)
    .sort((a, b) => {
      const viewsDiff = (b.views ?? 0) - (a.views ?? 0);
      if (viewsDiff !== 0) return viewsDiff;
      return new Date(b.data).getTime() - new Date(a.data).getTime();
    });
  const maisLidas = (maisLidasBase.length > 0 ? maisLidasBase : lista).slice(0, 3);
  const isMobile = useIsMobile();
  const gridLimit = isMobile ? 20 : 12;

  // Categorias (disciplinas) presentes nas notícias, para chips de filtro.
  const [categoriaAtiva, setCategoriaAtiva] = useState<string>("Todas");
  const categorias = useMemo(() => {
    const set = new Set<string>();
    lista.forEach((p) => {
      if (p.disciplina) set.add(p.disciplina);
    });
    return ["Todas", ...Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"))];
  }, [lista]);
  const gridFiltrado = useMemo(() => {
    const base =
      categoriaAtiva === "Todas" ? lista : lista.filter((p) => p.disciplina === categoriaAtiva);
    return base.slice(0, gridLimit);
  }, [lista, categoriaAtiva, gridLimit]);

  // Modo de exibição do grid: editorial (cards grandes) vs compacto (lista).
  const [modoGrid, setModoGrid] = useState<"editorial" | "compacto">("editorial");

  const [hoje, setHoje] = useState<string | null>(null);
  useEffect(() => {
    setHoje(
      new Date().toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      }),
    );
  }, []);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between border-b border-border py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
          <span className="capitalize" suppressHydrationWarning>
            {hoje ?? "\u00a0"}
          </span>
          <div className="hidden items-center gap-6 sm:flex">
            <span className="text-muted-foreground">Edição Digital</span>
            <Link
              to="/posts"
              className="bg-primary px-3 py-1 text-primary-foreground transition-colors hover:bg-accent"
            >
              Ver Edição
            </Link>
          </div>
        </div>
      </div>

      <SiteHeader />

      <section
        className="mx-auto mb-10 w-full max-w-7xl px-4 pt-4 sm:px-6 sm:pt-6 md:mb-16 lg:px-8"
        aria-label="Notícias em destaque"
      >
        {isLoading ? (
          <HeroSkeleton />
        ) : heroSlides.length > 0 ? (
          <HeroCarousel slides={heroSlides} />
        ) : (
          <EmptyHero />
        )}
      </section>

      <div className="mx-auto w-full max-w-7xl px-4 pb-16 pt-4 sm:px-6 sm:pb-20 sm:pt-6 lg:px-8">
        <h1 className="sr-only">
          Portal U.E. Evaristo Campelo de Matos — notícias e comunicados da comunidade escolar
        </h1>

        {/* Sobre a escola (resumo) */}
        <RevealSection>
          <SobreEscola />
        </RevealSection>

        {/* Faixa de estatísticas */}
        <RevealSection delay={80}>
          <StatsBar />
        </RevealSection>

        {/* CTA duplo: agendar + portal */}
        <RevealSection delay={160}>
          <CtaDuo />
        </RevealSection>

        {/* Próximos eventos */}
        <RevealSection delay={80}>
          <UpcomingEvents />
        </RevealSection>

        {/* Faixa: Mais lidas + Opinião */}
        <RevealSection className="mb-10 grid grid-cols-1 gap-8 md:mb-16 md:gap-10 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <SectionHeader title="Mais Lidas" />
            <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-3">
              {isLoading
                ? Array.from({ length: 3 }).map((_, i) => <SidebarSkeleton key={i} />)
                : maisLidas.map((p, i) => <SidebarItem key={p.id} post={p} rank={i + 1} />)}
            </div>
          </div>
          <aside className="lg:col-span-4">
            <OpinionCard />
          </aside>
        </RevealSection>

        {/* Grid uniforme — últimas notícias, com chips de categoria */}
        {(gridFiltrado.length > 0 || isLoading) && (
          <RevealSection>
            <div className="mb-6 flex items-end justify-between border-b-2 border-primary pb-3">
              <h2 className="font-display text-2xl text-primary sm:text-3xl lg:text-4xl">
                Últimas Notícias
              </h2>
              <div className="flex items-center gap-4">
                <div className="hidden items-center gap-1 rounded-full border border-border bg-card p-1 sm:flex">
                  <button
                    type="button"
                    onClick={() => setModoGrid("editorial")}
                    aria-pressed={modoGrid === "editorial"}
                    aria-label="Modo editorial"
                    className={`grid size-7 place-items-center rounded-full transition-colors ${
                      modoGrid === "editorial"
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:text-accent"
                    }`}
                  >
                    <LayoutGrid className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setModoGrid("compacto")}
                    aria-pressed={modoGrid === "compacto"}
                    aria-label="Modo compacto"
                    className={`grid size-7 place-items-center rounded-full transition-colors ${
                      modoGrid === "compacto"
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:text-accent"
                    }`}
                  >
                    <List className="size-3.5" />
                  </button>
                </div>
                <Link
                  to="/posts"
                  className="text-xs font-semibold uppercase tracking-widest text-accent transition-colors hover:text-primary"
                >
                  Ver todas <ArrowRight className="inline size-3" />
                </Link>
              </div>
            </div>

            {categorias.length > 2 && (
              <div className="mb-8 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:overflow-visible sm:px-0">
                <div className="flex gap-2 pb-1">
                  {categorias.map((cat) => {
                    const ativa = cat === categoriaAtiva;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCategoriaAtiva(cat)}
                        className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-widest transition-all ${
                          ativa
                            ? "border-accent bg-accent text-accent-foreground shadow-sm"
                            : "border-border bg-card text-muted-foreground hover:border-accent/60 hover:text-accent"
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {modoGrid === "editorial" ? (
              <div className="grid grid-cols-1 gap-x-8 gap-y-12 md:grid-cols-2 lg:grid-cols-3">
                {isLoading
                  ? Array.from({ length: 6 }).map((_, i) => <GridSkeleton key={i} />)
                  : gridFiltrado.map((p) => <GridArticle key={p.id} post={p} />)}
              </div>
            ) : (
              <ul className="divide-y divide-border border border-border bg-card">
                {isLoading
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <li key={i} className="flex items-center gap-4 p-4">
                        <Skeleton className="size-16 " />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-3 w-24" />
                          <Skeleton className="h-4 w-full" />
                        </div>
                      </li>
                    ))
                  : gridFiltrado.map((p) => <CompactArticle key={p.id} post={p} />)}
              </ul>
            )}
            {!isLoading && gridFiltrado.length === 0 && (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Nenhuma publicação em <strong>{categoriaAtiva}</strong> por enquanto.
              </p>
            )}
          </RevealSection>
        )}

        {/* Push inline */}
        <RevealSection className="mt-10 md:mt-16">
          <PushInline />
        </RevealSection>

        {/* Depoimentos */}
        <RevealSection delay={80}>
          <Testimonials />
        </RevealSection>

        {/* Alunos de Destaque do Mês */}
        <RevealSection delay={80}>
          <AlunosDestaque />
        </RevealSection>

        {/* Galeria de momentos */}
        <RevealSection delay={80}>
          <MomentsGallery />
        </RevealSection>

        {/* Nossos Patrocinadores (visível quando um evento estiver ativo) */}
        <RevealSection className="mt-10 md:mt-24" delay={120}>
          <Patrocinadores />
        </RevealSection>

        {/* Equipe em destaque */}
        <RevealSection delay={80}>
          <TeamHighlight />
        </RevealSection>

        {/* Resumos institucionais */}
        <RevealSection delay={80}>
          <SchoolHighlights />
        </RevealSection>

        {/* Contato rápido */}
        <RevealSection delay={80}>
          <QuickContact />
        </RevealSection>

        {/* CTA Titinho */}
        <RevealSection delay={120}>
          <TitinhoCta />
        </RevealSection>
      </div>

      <SiteFooter />
    </div>
  );
}

function CompactArticle({ post }: { post: Post }) {
  return (
    <li>
      <Link
        to="/posts/$id"
        params={{ id: post.id }}
        className="flex items-center gap-4 p-4 transition-colors hover:bg-accent/5"
      >
        {post.imagem ? (
          <img
            src={post.imagem}
            alt=""
            className="size-16 shrink-0 object-cover"
            loading="lazy"
          />
        ) : (
          <div className="grid size-16 shrink-0 place-items-center bg-secondary text-muted-foreground">
            <Eye className="size-5" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-accent">
            {post.disciplina && <span>{post.disciplina}</span>}
            <span className="text-muted-foreground">
              {new Date(post.data).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "short",
              })}
            </span>
          </div>
          <h3 className="line-clamp-2 font-display text-base text-primary sm:text-lg">
            {post.titulo}
          </h3>
        </div>
      </Link>
    </li>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="mb-6 flex items-center gap-3">
      <span className="h-px flex-1 bg-border" />
      <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.3em] text-accent">
        {title}
      </h2>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

function RevealSection({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useReveal<HTMLElement>({ delay });
  return (
    <section ref={ref} className={`reveal ${className}`}>
      {children}
    </section>
  );
}

function HeroCarousel({ slides }: { slides: Post[] }) {
  const [index, setIndex] = useState(0);
  const total = slides.length;
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    if (total <= 1 || paused) return;
    // Usuários com "reduzir movimento" recebem uma rotação bem mais lenta.
    const interval = reducedMotion ? 12000 : 5500;
    const id = setInterval(() => setIndex((i) => (i + 1) % total), interval);
    return () => clearInterval(id);
  }, [total, paused, reducedMotion]);

  useEffect(() => {
    if (index >= total) setIndex(0);
  }, [total, index]);

  const go = (n: number) => setIndex(((n % total) + total) % total);

  return (
    <div
      className="relative overflow-hidden bg-neutral-950"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Wrapper com aspect ratio — os slides são empilhados em absoluto e
          alternam via crossfade, evitando o "piscar" do translateX. */}
      <div className="relative aspect-[4/5] w-full sm:aspect-[16/9] lg:aspect-[16/7]">
        {slides.map((post, i) => {
          const active = i === index;
          return (
            <article
              key={post.id}
              className={`hero-slide group ${active ? "hero-slide-active" : ""}`}
              aria-hidden={!active}
            >
              <Link to="/posts/$id" params={{ id: post.id }} className="block size-full">
                <div className="relative size-full overflow-hidden bg-neutral-950">
                  {/* Fundo desfocado com a mesma imagem — preenche laterais sem recortar. */}
                  <img
                    src={post.imagem ?? heroImg}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 size-full scale-110 object-cover opacity-60 blur-2xl"
                  />
                  {/* Imagem principal 100% visível (sem recorte). */}
                  <img
                    src={post.imagem ?? heroImg}
                    alt={post.titulo}
                    className={`relative size-full object-contain transition-transform duration-700 group-hover:scale-[1.02] ${
                      active ? "ken-burns" : ""
                    }`}
                  />
                  {/* Overlay: mais denso no dark para garantir contraste do texto. */}
                  <div className="absolute inset-0 bg-linear-to-t from-neutral-950/95 via-neutral-950/55 to-neutral-950/10 dark:from-black dark:via-black/70 dark:to-black/20" />
                  <div className="absolute inset-x-0 bottom-0 p-6 text-primary-foreground sm:p-10 lg:p-14">
                    <div className="mb-3 flex flex-wrap items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-white [text-shadow:0_1px_2px_rgb(0_0_0_/_0.6)]">
                      <span className="bg-gold px-2.5 py-1 text-gold-foreground [text-shadow:none]">
                        {post.disciplina ?? "Destaque"}
                      </span>
                      <span>
                        {new Date(post.data).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                    <h2 className="max-w-4xl font-display text-2xl leading-[1.05] text-white [text-shadow:0_2px_10px_rgb(0_0_0_/_0.55)] sm:text-3xl lg:text-4xl xl:text-5xl dark:text-gold dark:[text-shadow:0_2px_12px_rgb(0_0_0_/_0.85)]">
                        {post.titulo}
                      </h2>

                    {post.resumo && (
                      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/90 [text-shadow:0_1px_6px_rgb(0_0_0_/_0.55)] sm:text-base lg:text-lg dark:text-white dark:[text-shadow:0_1px_8px_rgb(0_0_0_/_0.85)]">
                        {post.resumo}
                      </p>
                    )}
                    <div className="mt-5 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-white [text-shadow:0_1px_2px_rgb(0_0_0_/_0.6)] dark:text-gold">
                      Ler matéria{" "}
                      <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </div>
              </Link>
            </article>
          );
        })}
      </div>

      {total > 1 && (
        <>
          <button
            type="button"
            aria-label="Anterior"
            onClick={() => go(index - 1)}
            className="absolute left-3 top-1/2 z-20 hidden -translate-y-1/2 items-center justify-center rounded-full bg-background/80 p-2 text-primary shadow-md transition hover:bg-background sm:flex"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            aria-label="Próximo"
            onClick={() => go(index + 1)}
            className="absolute right-3 top-1/2 z-20 hidden -translate-y-1/2 items-center justify-center rounded-full bg-background/80 p-2 text-primary shadow-md transition hover:bg-background sm:flex"
          >
            <ChevronRight className="size-5" />
          </button>
          <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Ir para slide ${i + 1}`}
                onClick={() => go(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-8 bg-gold" : "w-3 bg-background/60 hover:bg-background"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SidebarItem({ post, rank }: { post: Post; rank: number }) {
  const views = "views" in post && typeof post.views === "number" ? post.views : 0;

  return (
    <Link to="/posts/$id" params={{ id: post.id }} className="group flex gap-4">
      <span className="font-display text-5xl leading-none text-accent/70 transition-colors group-hover:text-accent">
        {String(rank).padStart(2, "0")}
      </span>
      <div className="space-y-2">
        {post.disciplina && (
          <span className="text-[10px] font-semibold uppercase tracking-widest text-accent">
            {post.disciplina}
          </span>
        )}
        <h3 className="font-display text-lg leading-tight text-primary transition-colors group-hover:text-accent sm:text-xl">
          {post.titulo}
        </h3>
        <p className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <Eye className="size-3.5" aria-hidden="true" />
          <span className="tabular-nums">{views.toLocaleString("pt-BR")}</span>
          <span>visualizações</span>
        </p>
      </div>
    </Link>
  );
}

function GridArticle({ post }: { post: Post }) {
  const dataFmt = new Date(post.data).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  return (
    <Link
      to="/posts/$id"
      params={{ id: post.id }}
      className="group flex flex-col outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <div className="relative mb-4 aspect-[16/9] overflow-hidden bg-secondary border border-black/5 shadow-[0_6px_18px_-8px_rgb(0_0_0_/_0.18)] ring-1 ring-black/5 transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_18px_36px_-12px_rgb(0_0_0_/_0.28)] dark:border-white/10 dark:ring-white/10 dark:bg-card dark:shadow-[0_6px_18px_-8px_rgb(0_0_0_/_0.55)] dark:group-hover:shadow-[0_20px_40px_-12px_rgb(0_0_0_/_0.75)]">
        <img
          src={post.imagem ?? heroImg}
          alt={post.titulo}
          className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
      </div>
      <div className="flex flex-1 flex-col">
        <time className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          {dataFmt}
        </time>
        <h3 className="mb-3 font-display text-xl font-bold leading-snug text-primary transition-colors group-hover:text-accent sm:text-[22px]">
          {post.titulo}
        </h3>
        {post.resumo && (
          <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
            {post.resumo}
          </p>
        )}
        {post.disciplina && (
          <span className="mt-3 inline-flex w-fit text-[10px] font-semibold uppercase tracking-widest text-accent">
            {post.disciplina}
          </span>
        )}
      </div>
    </Link>
  );
}

// Rotação por hora do dia (07:00 - 17:00). Fora dessa janela, mantém o
// último slot exibido. A cada dia, o ponto de partida avança, de modo que
// toda a lista é percorrida ao longo do tempo.
function useCurrentOpinion() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  return useMemo(() => {
    if (!now) return OPINIONS[0];
    const START_HOUR = 7;
    const END_HOUR = 17;
    const slotsPerDay = END_HOUR - START_HOUR + 1;
    const hour = Math.min(Math.max(now.getHours(), START_HOUR), END_HOUR);
    const slot = hour - START_HOUR;

    const startOfYear = new Date(now.getFullYear(), 0, 0);
    const diff = now.getTime() - startOfYear.getTime();
    const dayOfYear = Math.floor(diff / 86_400_000);

    const index =
      (((dayOfYear * slotsPerDay + slot) % OPINIONS.length) + OPINIONS.length) % OPINIONS.length;
    return OPINIONS[index];
  }, [now]);
}

function OpinionCard() {
  const entry = useCurrentOpinion();
  const label = entry.type === "citacao" ? "Citação" : "Opinião";

  return (
    <div className="relative h-full overflow-hidden bg-[image:var(--gradient-primary)] p-8 text-white">
      <span className="absolute right-4 top-2 font-display text-[8rem] leading-none text-gold/30">
        "
      </span>
      <span className="relative mb-4 block text-[10px] font-semibold uppercase tracking-[0.3em] text-gold">
        {label}
      </span>
      <p className="relative mb-6 font-display text-xl italic leading-snug sm:text-2xl">
        {entry.text}
      </p>
      <div className="relative flex items-center gap-3 border-t border-white/20 pt-4">
        <div className="grid size-10 place-items-center rounded-full bg-gold font-display text-base text-gold-foreground">
          {entry.initials}
        </div>
        <div>
          <p className="text-sm font-semibold">{entry.author}</p>
          <p className="text-[10px] uppercase tracking-widest text-gold">{entry.role}</p>
        </div>
      </div>
    </div>
  );
}

function EmptyHero() {
  return (
    <div className="flex aspect-[16/9] items-center justify-center border border-dashed border-border bg-secondary text-center">
      <div>
        <p className="font-display text-2xl font-bold text-primary">Nenhuma publicação ainda</p>
        <p className="mt-2 text-sm text-muted-foreground">
          As notícias da escola aparecerão aqui em breve.
        </p>
      </div>
    </div>
  );
}

function HeroSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="aspect-[16/9] w-full rounded-none" />
      <Skeleton className="h-12 w-4/5 rounded-none" />
      <Skeleton className="h-6 w-3/5 rounded-none" />
    </div>
  );
}

function SidebarSkeleton() {
  return (
    <div className="flex gap-4 border-b border-border pb-6">
      <Skeleton className="h-10 w-10 rounded-none" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-16 rounded-none" />
        <Skeleton className="h-5 w-full rounded-none" />
        <Skeleton className="h-5 w-4/5 rounded-none" />
      </div>
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <Skeleton className="h-4 w-20 rounded-none" />
      <Skeleton className="h-6 w-full rounded-none" />
      <Skeleton className="h-4 w-3/4 rounded-none" />
    </div>
  );
}

function SchoolHighlights() {
  const { data: equipeCount } = useQuery({
    queryKey: ["equipe-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("profissionais_publicos" as never)
        .select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const { data: proxEvento } = useQuery({
    queryKey: ["prox-evento"],
    queryFn: async () => {
      const hoje = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from("eventos")
        .select("titulo, data_inicio")
        .gte("data_inicio", hoje)
        .order("data_inicio", { ascending: true })
        .limit(1)
        .maybeSingle();
      return data as { titulo: string; data_inicio: string } | null;
    },
  });

  const { data: alertas } = useQuery({
    queryKey: ["ultimos-alertas-home"],
    queryFn: async () => {
      const { data } = await supabase
        .from("alerts")
        .select("id, message, variant, created_at")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(3);
      return (data ?? []) as Array<{
        id: string;
        message: string;
        variant: string | null;
        created_at: string;
      }>;
    },
  });

  const cards = [
    {
      icon: Users,
      titulo: "Equipe",
      resumo:
        equipeCount && equipeCount > 0
          ? `${equipeCount} profissionais dedicados ao ensino e à formação dos nossos alunos.`
          : "Conheça os profissionais que fazem parte da nossa escola.",
      to: "/equipe" as const,
      acao: "Ver equipe",
    },
    {
      icon: Calendar,
      titulo: "Calendário",
      resumo: proxEvento
        ? `Próximo evento: ${proxEvento.titulo} em ${new Date(proxEvento.data_inicio).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })}.`
        : "Acompanhe eventos, feriados e datas importantes do ano letivo.",
      to: "/calendario" as const,
      acao: "Ver calendário",
    },
    {
      icon: Clock,
      titulo: "Horários",
      resumo: "Consulte a grade de horários por turma e turno (manhã, tarde e noite).",
      to: "/horarios" as const,
      acao: "Ver horários",
    },
  ];

  return (
    <section className="mt-20 mb-16">
      <div className="mb-8 flex items-end justify-between border-b-2 border-primary pb-3">
        <h2 className="font-display text-2xl text-primary sm:text-3xl lg:text-4xl">Nossa Escola</h2>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link
            key={c.titulo}
            to={c.to}
            className="group relative flex flex-col overflow-hidden border border-accent/25 bg-[image:var(--gradient-primary)] p-6 text-white shadow-elegant ring-1 ring-black/5 transition-all hover:-translate-y-1.5 hover:border-gold/50 hover:shadow-2xl"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute -top-16 -right-16 size-40 rounded-full bg-gold/25 blur-3xl transition-transform group-hover:scale-125"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute -bottom-20 -left-14 size-48 rounded-full bg-accent/40 blur-3xl"
            />
            <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-gold via-accent to-gold" />
            <div className="relative mb-4 inline-flex size-12 items-center justify-center bg-gold text-gold-foreground shadow-gold transition-transform group-hover:scale-110">
              <c.icon className="size-6" />
            </div>
            <h3 className="relative font-display text-xl text-white">{c.titulo}</h3>
            <p className="relative mt-2 flex-1 text-sm leading-relaxed text-white/80">
              {c.resumo}
            </p>
            <span className="relative mt-4 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-widest text-gold transition-transform group-hover:translate-x-1">
              {c.acao} <ArrowRight className="size-3" />
            </span>
          </Link>
        ))}

        <div className="relative flex flex-col overflow-hidden border-2 border-destructive/40 bg-card p-6 shadow-md ring-1 ring-destructive/10">
          <span className="absolute inset-x-0 top-0 h-1 bg-destructive" />
          <div className="mb-4 inline-flex size-12 items-center justify-center bg-destructive/10 text-destructive">
            <AlertTriangle className="size-6" />
          </div>
          <h3 className="font-display text-xl text-primary">Últimos Alertas</h3>

          {alertas && alertas.length > 0 ? (
            <ul className="mt-3 flex-1 space-y-2.5">
              {alertas.map((a) => (
                <li key={a.id} className="border-l-2 border-destructive/60 pl-3">
                  <p className="line-clamp-2 text-xs font-medium leading-snug text-foreground">
                    {a.message}
                  </p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {new Date(a.created_at).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                    })}
                    {a.variant ? ` · ${a.variant}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
              Nenhum alerta ativo no momento. Tudo certo por aqui.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

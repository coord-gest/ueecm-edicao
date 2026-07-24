import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  CalendarSearch,
  Clock,
  Images,
  Loader2,
  Newspaper,
  Star,
  X,
} from "lucide-react";
import { PhotoLightbox } from "@/components/PhotoLightbox";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { AutoPresentationMode } from "@/components/AutoPresentationMode";
import { PostCard } from "@/components/PostCard";
import { PostFilters } from "@/components/PostFilters";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import type { Post } from "@/data/posts-utils";
import heroImg from "@/assets/hero-school.jpg";

export const Route = createFileRoute("/posts/")({
  head: () => ({
    meta: [
      { title: "Notícias e Publicações — U.E. Evaristo Campelo de Matos" },
      {
        name: "description",
        content:
          "Todas as notícias, comunicados, eventos e conquistas da U.E. Evaristo Campelo de Matos. Filtre por turma, disciplina e período.",
      },
      { property: "og:title", content: "Notícias e Publicações — UEECM" },
      {
        property: "og:description",
        content:
          "Publicações, comunicados e conquistas da comunidade escolar UEECM em Assunção do Piauí.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://conectaueecm.com/posts" },
      { property: "og:image", content: "https://conectaueecm.com/og-image.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://conectaueecm.com/og-image.jpg" },
    ],
    links: [{ rel: "canonical", href: "https://conectaueecm.com/posts" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Notícias e Publicações — UEECM",
          url: "https://conectaueecm.com/posts",
          inLanguage: "pt-BR",
          isPartOf: { "@type": "WebSite", url: "https://conectaueecm.com/" },
        }),
      },
    ],
  }),
  component: PostsListagem,
});

const PAGE_SIZE = 15;

type MomentoItem = {
  postId: string;
  titulo: string;
  imagem: string;
  data: string;
  turma?: string;
  disciplina?: string;
};

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

type Periodo = "todos" | "7d" | "30d" | "3m" | "6m" | "1a";

const periodoOpcoes: { value: Periodo; label: string }[] = [
  { value: "todos", label: "Todos os períodos" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Último mês" },
  { value: "3m", label: "Últimos 3 meses" },
  { value: "6m", label: "Últimos 6 meses" },
  { value: "1a", label: "Último ano" },
];

function periodoParaData(periodo: Periodo): string | null {
  if (periodo === "todos") return null;
  const agora = new Date();
  switch (periodo) {
    case "7d":
      agora.setDate(agora.getDate() - 7);
      break;
    case "30d":
      agora.setDate(agora.getDate() - 30);
      break;
    case "3m":
      agora.setMonth(agora.getMonth() - 3);
      break;
    case "6m":
      agora.setMonth(agora.getMonth() - 6);
      break;
    case "1a":
      agora.setFullYear(agora.getFullYear() - 1);
      break;
  }
  return agora.toISOString();
}

function PostsListagem() {
  const [turma, setTurma] = useState("todas");
  const [disciplina, setDisciplina] = useState("todas");
  const [periodo, setPeriodo] = useState<Periodo>("todos");
  const [page, setPage] = useState(0);
  const [aba, setAba] = useState<"ultimos" | "destaques" | "momentos">("ultimos");

  // Reseta página ao mudar qualquer filtro
  const handleTurma = (v: string) => {
    setTurma(v);
    setPage(0);
  };
  const handleDisciplina = (v: string) => {
    setDisciplina(v);
    setPage(0);
  };
  const handlePeriodo = (v: Periodo) => {
    setPeriodo(v);
    setPage(0);
  };
  const handleLimpar = () => {
    setTurma("todas");
    setDisciplina("todas");
    setPeriodo("todos");
    setPage(0);
  };

  const filtrosAtivos = turma !== "todas" || disciplina !== "todas" || periodo !== "todos";

  const { data: dbPosts, isLoading } = useQuery({
    queryKey: ["posts-listagem", periodo],
    queryFn: async () => {
      const dataMin = periodoParaData(periodo);
      let q = supabase
        .from("posts")
        .select("id, titulo, resumo, imagem, autor, data, turma, disciplina, destaque, geral")
        .eq("status", "publicado")
        .order("data", { ascending: false });
      if (dataMin) q = q.gte("data", dataMin);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map((p) => ({
        id: p.id,
        titulo: p.titulo,
        resumo: p.resumo,
        imagem: p.imagem ?? heroImg,
        autor: p.autor,
        data: p.data,
        turma: p.turma ?? undefined,
        disciplina: p.disciplina ?? undefined,
        destaque: p.destaque,
        geral: p.geral,
      })) as Post[];
    },
  });

  const todos = useMemo(() => dbPosts ?? [], [dbPosts]);
  const destaques = useMemo(() => todos.filter((p) => p.destaque), [todos]);

  // Momentos: todas as imagens de todos os posts, por data (capa + inline no conteúdo)
  const { data: dbMomentos, isLoading: isLoadingMomentos } = useQuery({
    queryKey: ["posts-momentos", periodo],
    queryFn: async () => {
      const dataMin = periodoParaData(periodo);
      let q = supabase
        .from("posts")
        .select("id, titulo, imagem, imagem_url, conteudo, data, turma, disciplina")
        .eq("status", "publicado")
        .order("data", { ascending: false });
      if (dataMin) q = q.gte("data", dataMin);
      const { data, error } = await q;
      if (error) throw error;

      const items: MomentoItem[] = [];
      const seen = new Set<string>();
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
          items.push({
            postId: p.id,
            titulo: p.titulo,
            imagem: src,
            data: p.data,
            turma: p.turma ?? undefined,
            disciplina: p.disciplina ?? undefined,
          });
        }
      }
      return items;
    },
  });

  const momentos = useMemo(() => dbMomentos ?? [], [dbMomentos]);

  const filtrar = useCallback(
    (lista: Post[]) =>
      lista.filter((p) => {
        const okTurma = turma === "todas" || p.turma === turma;
        const okDisc = disciplina === "todas" || p.disciplina === disciplina;
        return okTurma && okDisc;
      }),
    [turma, disciplina],
  );

  const filtrarMomentos = useCallback(
    (lista: MomentoItem[]) =>
      lista.filter((m) => {
        const okTurma = turma === "todas" || m.turma === turma;
        const okDisc = disciplina === "todas" || m.disciplina === disciplina;
        return okTurma && okDisc;
      }),
    [turma, disciplina],
  );

  const listaFiltrada = useMemo(
    () => filtrar(aba === "destaques" ? destaques : todos),
    [todos, destaques, aba, filtrar],
  );

  const momentosFiltrados = useMemo(() => filtrarMomentos(momentos), [momentos, filtrarMomentos]);

  const isAlbum = aba === "momentos";
  const pageSize = isAlbum ? 24 : PAGE_SIZE;
  const totalPaginas = Math.max(
    1,
    Math.ceil((isAlbum ? momentosFiltrados.length : listaFiltrada.length) / pageSize),
  );
  const listaVisiveis = useMemo(
    () => listaFiltrada.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [listaFiltrada, page],
  );
  const momentosVisiveis = useMemo(
    () => momentosFiltrados.slice(page * pageSize, page * pageSize + pageSize),
    [momentosFiltrados, page, pageSize],
  );

  const handleAba = (v: string) => {
    setAba(v as "ultimos" | "destaques" | "momentos");
    setPage(0);
  };

  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />

      {/* Hero da página */}
      <section className="border-b border-border/60 bg-gradient-to-br from-primary/8 via-background to-background py-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Button asChild variant="ghost" size="sm" className="-ml-2 rounded-full">
                  <Link to="/">
                    <ArrowLeft className="size-4" /> Início
                  </Link>
                </Button>
              </div>
              <h1 className="mt-2 font-display text-3xl font-bold text-foreground sm:text-4xl">
                Todas as Publicações
              </h1>
              <div className="mt-2 text-muted-foreground">
                {isLoading ? (
                  <Skeleton className="h-4 w-40" />
                ) : (
                  <>
                    <span className="font-semibold text-foreground">{listaFiltrada.length}</span>{" "}
                    publicação{listaFiltrada.length !== 1 ? "ões" : ""} encontrada
                    {listaFiltrada.length !== 1 ? "s" : ""}
                    {filtrosAtivos && " com os filtros aplicados"}
                  </>
                )}
              </div>
            </div>
            {/* Seletor de período — destaque visual */}
            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <CalendarSearch className="size-3.5" /> Período
              </label>
              <Select value={periodo} onValueChange={handlePeriodo}>
                <SelectTrigger className="w-52 rounded-full border-primary/30 bg-card shadow-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {periodoOpcoes.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* Filtros de turma/disciplina + badge de filtros ativos */}
        <div className="space-y-3">
          <PostFilters
            turma={turma}
            disciplina={disciplina}
            onTurma={handleTurma}
            onDisciplina={handleDisciplina}
            onLimpar={handleLimpar}
          />
          {filtrosAtivos && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Filtros ativos:</span>
              {turma !== "todas" && (
                <Badge variant="secondary" className="gap-1 rounded-full">
                  {turma}
                  <button onClick={() => handleTurma("todas")} aria-label="Remover filtro turma">
                    <X className="size-3" />
                  </button>
                </Badge>
              )}
              {disciplina !== "todas" && (
                <Badge variant="secondary" className="gap-1 rounded-full">
                  {disciplina}
                  <button
                    onClick={() => handleDisciplina("todas")}
                    aria-label="Remover filtro disciplina"
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              )}
              {periodo !== "todos" && (
                <Badge variant="secondary" className="gap-1 rounded-full">
                  {periodoOpcoes.find((o) => o.value === periodo)?.label}
                  <button
                    onClick={() => handlePeriodo("todos")}
                    aria-label="Remover filtro período"
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              )}
              <button
                onClick={handleLimpar}
                className="text-xs text-primary underline-offset-2 hover:underline"
              >
                Limpar tudo
              </button>
            </div>
          )}
        </div>

        {/* Abas */}
        <Tabs value={aba} onValueChange={handleAba} className="mt-6">
          <TabsList className="rounded-full">
            <TabsTrigger value="ultimos" className="rounded-full">
              <Clock className="size-4" /> Últimos Posts
              {!isLoading && (
                <Badge variant="secondary" className="ml-1.5 rounded-full px-1.5 py-0 text-[10px]">
                  {filtrar(todos).length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="destaques" className="rounded-full">
              <Star className="size-4" /> Em Destaque
              {!isLoading && (
                <Badge variant="secondary" className="ml-1.5 rounded-full px-1.5 py-0 text-[10px]">
                  {filtrar(destaques).length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="momentos" className="rounded-full">
              <Images className="size-4" /> Momentos
              {!isLoadingMomentos && (
                <Badge variant="secondary" className="ml-1.5 rounded-full px-1.5 py-0 text-[10px]">
                  {momentosFiltrados.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ultimos">
            <PostGrid lista={listaVisiveis} isLoading={isLoading} />
          </TabsContent>
          <TabsContent value="destaques">
            <PostGrid lista={listaVisiveis} isLoading={isLoading} />
          </TabsContent>
          <TabsContent value="momentos">
            <MomentosAlbum
              lista={momentosVisiveis}
              isLoading={isLoadingMomentos}
              pageSize={pageSize}
            />
          </TabsContent>
        </Tabs>

        {/* Paginação */}
        {/* Paginação */}
        {!(isAlbum ? isLoadingMomentos : isLoading) && totalPaginas > 1 && (
          <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              disabled={page === 0}
              onClick={() => {
                setPage((p) => p - 1);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              <ArrowLeft className="size-4" /> Anterior
            </Button>

            {/* Números de página */}
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPaginas }).map((_, i) => {
                // Mostra no máximo 5 páginas ao redor da atual
                if (
                  totalPaginas <= 7 ||
                  i === 0 ||
                  i === totalPaginas - 1 ||
                  Math.abs(i - page) <= 1
                ) {
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        setPage(i);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                        i === page
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                      }`}
                    >
                      {i + 1}
                    </button>
                  );
                }
                // Reticências
                if (Math.abs(i - page) === 2) {
                  return (
                    <span key={i} className="px-1 text-muted-foreground">
                      …
                    </span>
                  );
                }
                return null;
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              disabled={page + 1 >= totalPaginas}
              onClick={() => {
                setPage((p) => p + 1);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              Próxima <ArrowRight className="size-4" />
            </Button>
          </div>
        )}

        {/* Info de paginação */}
        {!isAlbum && !isLoading && listaFiltrada.length > 0 && (
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Exibindo {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, listaFiltrada.length)}{" "}
            de {listaFiltrada.length} publicaç{listaFiltrada.length !== 1 ? "ões" : "ão"}
          </p>
        )}
        {isAlbum && !isLoadingMomentos && momentosFiltrados.length > 0 && (
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Exibindo {page * pageSize + 1}–
            {Math.min((page + 1) * pageSize, momentosFiltrados.length)} de{" "}
            {momentosFiltrados.length} imagens
          </p>
        )}
      </main>

      <AutoPresentationMode />
      <SiteFooter />
    </div>
  );
}

function PostGrid({ lista, isLoading }: { lista: Post[]; isLoading?: boolean }) {
  if (isLoading) {
    return (
      <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: PAGE_SIZE }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border/70 bg-card p-4">
            <Skeleton className="aspect-[16/9] w-full rounded-xl" />
            <Skeleton className="mt-4 h-4 w-3/4" />
            <Skeleton className="mt-2 h-4 w-1/2" />
            <Skeleton className="mt-4 h-3 w-1/3" />
          </div>
        ))}
      </div>
    );
  }

  if (lista.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-dashed border-border bg-card py-20 text-center">
        <Newspaper className="mx-auto size-10 text-muted-foreground/40" />
        <p className="mt-4 font-display text-lg font-semibold text-foreground">
          Nenhuma publicação encontrada
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Tente ajustar os filtros ou escolher outro período.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {lista.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}

function MomentosAlbum({
  lista,
  isLoading,
  pageSize,
}: {
  lista: MomentoItem[];
  isLoading?: boolean;
  pageSize: number;
}) {
  const [lightbox, setLightbox] = useState<MomentoItem | null>(null);

  if (isLoading) {
    return (
      <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: pageSize }).map((_, i) => (
          <Skeleton key={i} className="aspect-square w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (lista.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-dashed border-border bg-card py-20 text-center">
        <Images className="mx-auto size-10 text-muted-foreground/40" />
        <p className="mt-4 font-display text-lg font-semibold text-foreground">
          Nenhum momento encontrado
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Tente ajustar os filtros ou escolher outro período.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-6">
        {lista.map((m, i) => (
          <div
            key={`${m.postId}-${m.imagem}-${i}`}
            className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-secondary shadow-sm transition-all hover:shadow-md"
          >
            <button
              type="button"
              onClick={() => setLightbox(m)}
              className="block size-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              aria-label={`Ampliar imagem: ${m.titulo}`}
            >
              <img
                src={m.imagem}
                alt={m.titulo}
                loading="lazy"
                className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </button>
            <Link
              to="/posts/$id"
              params={{ id: m.postId }}
              className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 bg-gradient-to-t from-neutral-900/90 via-neutral-900/60 to-transparent p-2 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            >
              <span className="line-clamp-2 text-[11px] font-medium">{m.titulo}</span>
              <span className="text-[10px] text-white/80">
                {new Date(m.data).toLocaleDateString("pt-BR")}
              </span>
            </Link>
          </div>
        ))}
      </div>

      <PhotoLightbox
        src={lightbox?.imagem ?? ""}
        alt={lightbox?.titulo ?? ""}
        open={!!lightbox}
        onOpenChange={(v) => !v && setLightbox(null)}
      />
    </>
  );
}

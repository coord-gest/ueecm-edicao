import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Download, Images, Loader2 } from "lucide-react";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import { getAlbumPublico, type GaleriaFoto } from "@/lib/galeria.functions";
import { downloadUrl } from "@/lib/image-compress";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { ShareButton } from "@/components/ShareButton";

export const Route = createFileRoute("/galeria/$id")({
  loader: async ({ params }) => {
    const res = await getAlbumPublico({ data: { id: params.id } });
    if (!res.album) throw notFound();
    return res;
  },
  head: ({ loaderData }) => {
    const album = loaderData?.album;
    return {
      meta: [
        { title: album ? `${album.titulo} | Galeria` : "Álbum" },
        {
          name: "description",
          content:
            album?.descricao?.slice(0, 160) ??
            `Fotos do evento ${album?.titulo ?? ""} na U.E. Evaristo Campelo de Matos.`,
        },
        { property: "og:title", content: album?.titulo ?? "Álbum" },
        {
          property: "og:description",
          content: album?.descricao ?? "Fotos do evento na escola.",
        },
        { property: "og:type", content: "article" },
        ...(album?.capa_url ? [{ property: "og:image", content: album.capa_url }] : []),
        ...(album?.capa_url ? [{ name: "twitter:image", content: album.capa_url }] : []),
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  notFoundComponent: () => (
    <>
      <SiteHeader />
      <main className="container mx-auto px-4 py-16 text-center">
        <Images className="h-14 w-14 mx-auto text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Álbum não encontrado</h1>
        <p className="text-muted-foreground mb-6">
          Este álbum pode ter sido removido ou não está publicado.
        </p>
        <Button asChild>
          <Link to="/galeria">Voltar para a galeria</Link>
        </Button>
      </main>
      <SiteFooter />
    </>
  ),
  errorComponent: ({ error, reset }) => (
    <>
      <SiteHeader />
      <main className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-3">Erro ao carregar álbum</h1>
        <p className="text-muted-foreground mb-6">{error.message}</p>
        <Button onClick={reset}>Tentar novamente</Button>
      </main>
      <SiteFooter />
    </>
  ),
  component: AlbumPage,
});

function AlbumPage() {
  const loaderData = Route.useLoaderData();
  const { album, fotos } = loaderData as { album: NonNullable<typeof loaderData.album>; fotos: GaleriaFoto[] };
  const [index, setIndex] = useState(-1);
  const { data } = useQuery({
    queryKey: ["galeria-publico", album.id],
    queryFn: () => getAlbumPublico({ data: { id: album.id } }),
    initialData: { album, fotos },
    refetchOnWindowFocus: true,
  });

  const currentAlbum = data.album ?? album;
  const currentFotos: GaleriaFoto[] = (data.fotos ?? fotos) as GaleriaFoto[];

  const slides = currentFotos.map((f) => ({
    src: f.url,
    alt: f.legenda ?? currentAlbum.titulo,
    width: f.largura ?? undefined,
    height: f.altura ?? undefined,
  }));

  return (
    <>
      <SiteHeader />
      <main className="container mx-auto px-4 py-10 max-w-6xl min-h-[60vh]">
        <div className="mb-6 flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/galeria">
              <ArrowLeft className="h-4 w-4 mr-1" /> Todos os álbuns
            </Link>
          </Button>
          <ShareButton
            data={{
              title: currentAlbum.titulo,
              text: currentAlbum.descricao ?? `Álbum: ${currentAlbum.titulo}`,
            }}
          />
        </div>

        <header className="mb-6">
          <h1 className="text-3xl md:text-4xl font-bold">{currentAlbum.titulo}</h1>
          {currentAlbum.data_evento && (
            <p className="text-sm text-muted-foreground mt-1">
              {new Date(currentAlbum.data_evento).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
              {" · "}
              {currentFotos.length} foto{currentFotos.length === 1 ? "" : "s"}
            </p>
          )}
          {currentAlbum.descricao && (
            <p className="mt-3 text-muted-foreground max-w-3xl whitespace-pre-line">
              {currentAlbum.descricao}
            </p>
          )}
        </header>

        {currentFotos.length === 0 ? (
          <div className="text-center py-16 border rounded-xl bg-muted/30">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">Ainda não há fotos neste álbum.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {currentFotos.map((f, i) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setIndex(i)}
                className="group relative aspect-square overflow-hidden rounded-lg bg-muted focus:outline-none focus:ring-2 focus:ring-primary"
                aria-label={`Abrir foto ${i + 1}`}
              >
                <img
                  src={f.url}
                  alt={f.legenda ?? `Foto ${i + 1}`}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div
                  className="absolute bottom-1 right-1 grid place-items-center rounded-full bg-background/80 backdrop-blur p-2 opacity-0 group-hover:opacity-100 transition"
                  onClick={(e) => {
                    e.stopPropagation();
                    downloadUrl(f.url, `${currentAlbum.titulo}-${i + 1}.jpg`);
                  }}
                  role="button"
                  aria-label="Baixar foto"
                >
                  <Download className="h-4 w-4" />
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      <Lightbox
        open={index >= 0}
        index={index}
        close={() => setIndex(-1)}
        slides={slides}
        toolbar={{
          buttons: [
            <button
              key="download"
              type="button"
              className="yarl__button"
              aria-label="Baixar foto"
              onClick={() => {
                const f = currentFotos[index];
                if (f) downloadUrl(f.url, `${currentAlbum.titulo}-${index + 1}.jpg`);
              }}
            >
              <Download className="h-5 w-5" />
            </button>,
            "close",
          ],
        }}
        controller={{ closeOnBackdropClick: true }}
      />

      <SiteFooter />
    </>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Images, Camera } from "lucide-react";
import { listAlbunsPublicos } from "@/lib/galeria.functions";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { AutoPresentationMode } from "@/components/AutoPresentationMode";

export const Route = createFileRoute("/galeria")({
  head: () => ({
    meta: [
      { title: "Galeria de Eventos | U.E. Evaristo Campelo de Matos" },
      {
        name: "description",
        content:
          "Álbuns fotográficos dos eventos, celebrações e conquistas da nossa comunidade escolar.",
      },
      { property: "og:title", content: "Galeria de Eventos" },
      {
        property: "og:description",
        content: "Momentos marcantes da U.E. Evaristo Campelo de Matos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GaleriaIndex,
});

function GaleriaIndex() {
  const { data: albuns = [], isLoading } = useQuery({
    queryKey: ["galeria-albuns-publicos"],
    queryFn: () => listAlbunsPublicos(),
  });

  return (
    <>
      <SiteHeader />
      <main className="container mx-auto px-4 py-10 max-w-6xl min-h-[60vh]">
        <header className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 text-primary">
            <Camera className="h-7 w-7" />
            <h1 className="text-3xl md:text-4xl font-bold">Galeria de Eventos</h1>
          </div>
          <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
            Reviva os momentos marcantes da nossa comunidade escolar.
          </p>
        </header>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-[4/3] rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : albuns.length === 0 ? (
          <div className="text-center py-16 border rounded-xl bg-muted/30">
            <Images className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Ainda não há álbuns publicados.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {albuns.map((a) => (
              <Link
                key={a.id}
                to="/galeria/$id"
                params={{ id: a.id }}
                className="group overflow-hidden rounded-xl border bg-card transition-all hover:shadow-lg hover:-translate-y-0.5"
              >
                <div className="aspect-[4/3] overflow-hidden bg-muted">
                  {a.capa_url ? (
                    <img
                      src={a.capa_url}
                      alt={a.titulo}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="h-full w-full grid place-items-center text-muted-foreground">
                      <Images className="h-10 w-10" />
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h2 className="font-semibold text-lg group-hover:text-primary transition-colors">
                    {a.titulo}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {a.total_fotos} foto{a.total_fotos === 1 ? "" : "s"}
                    {a.data_evento &&
                      ` · ${new Date(a.data_evento).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })}`}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
      <AutoPresentationMode />
      <SiteFooter />
    </>
  );
}

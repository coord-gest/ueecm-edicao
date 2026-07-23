import { useEffect, useMemo, useState } from "react";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import Autoplay from "embla-carousel-autoplay";
import {
  Heart,
  ExternalLink,
  MessageCircle,
  Instagram,
  Facebook,
  Globe,
  Phone,
} from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import {
  listPatrocinadoresPublicos,
  type Patrocinador,
  type EventoPatrocinio,
} from "@/lib/patrocinadores.functions";

export const patrocinadoresQueryOptions = (
  fetchFn: () => Promise<{ eventos: EventoPatrocinio[]; patrocinadores: Patrocinador[] }>,
) =>
  queryOptions({
    queryKey: ["home-patrocinadores"],
    queryFn: fetchFn,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
import { useReveal } from "@/hooks/use-reveal";
import { trackEvent } from "@/lib/analytics";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type CtaInfo = { label: string; icon: typeof Globe };

function ctaFromUrl(url: string): CtaInfo {
  const u = url.toLowerCase();
  if (u.includes("wa.me") || u.includes("whatsapp"))
    return { label: "Conversar no WhatsApp", icon: MessageCircle };
  if (u.includes("instagram.com")) return { label: "Ver no Instagram", icon: Instagram };
  if (u.includes("facebook.com") || u.includes("fb.com"))
    return { label: "Ver no Facebook", icon: Facebook };
  if (u.startsWith("tel:")) return { label: "Ligar agora", icon: Phone };
  if (u.startsWith("mailto:")) return { label: "Enviar e-mail", icon: MessageCircle };
  return { label: "Visitar site", icon: Globe };
}

export function Patrocinadores() {
  const ref = useReveal<HTMLElement>();
  const fetchPatros = useServerFn(listPatrocinadoresPublicos);
  const { data, isLoading } = useQuery(patrocinadoresQueryOptions(() => fetchPatros()));

  const patros = data?.patrocinadores ?? [];
  const eventos = data?.eventos ?? [];

  const [selected, setSelected] = useState<Patrocinador | null>(null);
  const selectedEvento = useMemo<EventoPatrocinio | null>(
    () => (selected ? (eventos.find((e) => e.id === selected.evento_id) ?? null) : null),
    [selected, eventos],
  );
  const cta = selected?.link_url ? ctaFromUrl(selected.link_url) : null;

  useEffect(() => {
    if (patros.length === 0) return;
    for (const p of patros) {
      void trackEvent("patrocinador_view", { metadata: { patrocinador_id: p.id, nome: p.nome } });
    }
  }, [patros]);

  if (isLoading) return null;
  if (eventos.length === 0 || patros.length === 0) return null;

  const openSponsor = (p: Patrocinador) => {
    setSelected(p);
    void trackEvent("patrocinador_open", { metadata: { patrocinador_id: p.id, nome: p.nome } });
  };

  return (
    <section ref={ref} className="reveal mb-10 md:mb-16">
      <div className="mb-8 flex items-end justify-between border-b-2 border-primary pb-3">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-accent">
            Apoio à comunidade escolar
          </p>
          <h2 className="font-display text-2xl text-primary sm:text-3xl lg:text-4xl">
            Nossos Apoiadores
          </h2>
        </div>
        <Heart className="size-6 text-accent" />
      </div>

      <div className="space-y-12">
        {eventos.map((evento) => {
          const items = patros.filter((p) => p.evento_id === evento.id);
          if (items.length === 0) return null;
          return (
            <div key={evento.id}>
              <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 className="font-display text-lg text-primary sm:text-xl">{evento.nome}</h3>
                {evento.descricao && (
                  <p className="text-sm text-muted-foreground">{evento.descricao}</p>
                )}
              </div>
              <Carousel
                opts={{
                  loop: items.length > 1,
                  align: "start",
                  containScroll: "trimSnaps",
                }}
                plugins={
                  items.length > 1
                    ? [Autoplay({ delay: 7000, stopOnInteraction: true, stopOnMouseEnter: true })]
                    : []
                }
                className="w-full touch-pan-y"
              >
                <CarouselContent className="-ml-3 sm:-ml-4">
                  {items.map((p) => (
                    <CarouselItem
                      key={p.id}
                      className="basis-[75%] pl-3 min-[420px]:basis-1/2 sm:basis-1/3 sm:pl-4 md:basis-1/4 lg:basis-1/5"
                    >
                      <button
                        type="button"
                        onClick={() => openSponsor(p)}
                        className="block h-full w-full text-left"
                        aria-label={`Ver detalhes de ${p.nome}`}
                      >
                        <div className="group flex aspect-[4/5] h-full flex-col overflow-hidden rounded-[5px] border border-border bg-card transition-all hover:-translate-y-0.5 hover:border-accent hover:shadow-md">
                          <div className="relative flex min-h-0 flex-[3] items-center justify-center bg-secondary/30 p-3">
                            {p.logo_url ? (
                              <img
                                src={p.logo_url}
                                alt={p.nome}
                                loading="lazy"
                                draggable={false}
                                className="max-h-full max-w-full object-contain"
                              />
                            ) : (
                              <div className="grid h-full w-full place-items-center text-3xl font-semibold text-primary">
                                {p.nome.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            {p.link_url && (
                              <ExternalLink className="absolute right-2 top-2 size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                            )}
                          </div>
                          <div className="flex flex-1 flex-col items-center justify-center gap-0.5 px-3 py-2 text-center">
                            <div className="line-clamp-1 text-sm font-semibold text-primary">
                              {p.nome}
                            </div>
                            {p.descricao && (
                              <p className="line-clamp-2 text-[11px] leading-tight text-muted-foreground">
                                {p.descricao}
                              </p>
                            )}
                            {p.tipo_apoio && (
                              <div className="text-[10px] font-semibold uppercase tracking-widest text-accent">
                                {p.tipo_apoio}
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                {items.length > 1 && (
                  <>
                    <CarouselPrevious className="hidden sm:flex" />
                    <CarouselNext className="hidden sm:flex" />
                  </>
                )}
              </Carousel>
            </div>
          );
        })}
      </div>
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Agradecemos a todos que apoiam nossos eventos escolares. 💛
      </p>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg overflow-hidden p-0">
          {selected && (
            <>
              <div className="relative flex h-72 items-center justify-center bg-secondary p-4 sm:h-80">
                {selected.logo_url ? (
                  <img
                    src={selected.logo_url}
                    alt={selected.nome}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="grid size-40 place-items-center bg-card text-6xl font-bold text-primary shadow-md">
                    {selected.nome.slice(0, 2).toUpperCase()}
                  </div>
                )}
                {selected.tipo_apoio && (
                  <Badge className="absolute right-4 top-4 bg-accent text-accent-foreground">
                    {selected.tipo_apoio}
                  </Badge>
                )}
              </div>

              <div className="space-y-4 p-6">
                <DialogHeader className="space-y-2 text-left">
                  <DialogTitle className="font-display text-2xl text-primary">
                    {selected.nome}
                  </DialogTitle>
                  {selectedEvento && (
                    <DialogDescription className="flex items-center gap-2 text-sm">
                      <Heart className="size-3.5 text-accent" />
                      Apoia:{" "}
                      <span className="font-semibold text-foreground">{selectedEvento.nome}</span>
                    </DialogDescription>
                  )}
                </DialogHeader>

                {selected.descricao && (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {selected.descricao}
                  </p>
                )}

                {selected.link_url && cta ? (
                  <Button
                    asChild
                    size="lg"
                    className="w-full rounded-full"
                    onClick={() =>
                      void trackEvent("patrocinador_click", {
                        metadata: {
                          patrocinador_id: selected.id,
                          nome: selected.nome,
                          url: selected.link_url,
                        },
                      })
                    }
                  >
                    <a href={selected.link_url} target="_blank" rel="noopener noreferrer sponsored">
                      <cta.icon className="size-4" />
                      {cta.label}
                    </a>
                  </Button>
                ) : (
                  <p className="rounded-[5px] bg-muted/50 p-3 text-center text-xs text-muted-foreground">
                    Este patrocinador ainda não informou um contato público.
                  </p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

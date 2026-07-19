import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Camera, Calendar, Filter, Loader2, ImageOff, Cloud } from "lucide-react";
import { z } from "zod";

import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { listMomentosAnos, listMomentosEventos, listMomentosFotos } from "@/lib/momentos.functions";

const searchSchema = z.object({
  ano: z.string().optional(),
  evento: z.string().optional(),
});

export const Route = createFileRoute("/momentos")({
  ssr: false,
  validateSearch: (raw) => searchSchema.parse(raw),
  head: () => ({
    meta: [
      { title: "Momentos UEECM — Galeria de fotos da escola" },
      {
        name: "description",
        content:
          "Momentos marcantes da U.E. Evaristo Campelo de Matos: eventos, apresentações e o dia a dia da escola em Assunção do Piauí.",
      },
      { property: "og:title", content: "Momentos UEECM — Galeria de fotos" },
      {
        property: "og:description",
        content: "Galeria pública com os melhores momentos da comunidade escolar UEECM.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://conectaueecm.com/momentos" },
      { property: "og:image", content: "https://conectaueecm.com/og-image.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://conectaueecm.com/og-image.jpg" },
    ],
    links: [{ rel: "canonical", href: "https://conectaueecm.com/momentos" }],
  }),
  component: MomentosPage,
});

function MomentosPage() {
  const search = useSearch({ from: "/momentos" });
  const navigate = Route.useNavigate();

  const [selectedAno, setSelectedAno] = useState<string | undefined>(search.ano);
  const [selectedEvento, setSelectedEvento] = useState<string | undefined>(search.evento);
  const [lightbox, setLightbox] = useState<{ id: string; name: string } | null>(null);

  const anosFn = useServerFn(listMomentosAnos);
  const eventosFn = useServerFn(listMomentosEventos);
  const fotosFn = useServerFn(listMomentosFotos);

  const anosQ = useQuery({
    queryKey: ["momentos", "anos"],
    queryFn: () => anosFn(),
    staleTime: 5 * 60_000,
  });

  // Auto-seleciona o ano mais recente quando não veio via URL.
  useEffect(() => {
    if (!selectedAno && anosQ.data?.anos?.length) {
      setSelectedAno(anosQ.data.anos[0].name);
    }
  }, [anosQ.data, selectedAno]);

  const eventosQ = useQuery({
    queryKey: ["momentos", "eventos", selectedAno],
    queryFn: () => eventosFn({ data: { ano: selectedAno! } }),
    enabled: Boolean(selectedAno),
    staleTime: 5 * 60_000,
  });

  const fotosQ = useQuery({
    queryKey: ["momentos", "fotos", selectedAno, selectedEvento],
    queryFn: () => fotosFn({ data: { ano: selectedAno!, evento: selectedEvento! } }),
    enabled: Boolean(selectedAno && selectedEvento),
    staleTime: 5 * 60_000,
  });

  // Sincroniza filtros com a URL para permitir compartilhamento.
  useEffect(() => {
    void navigate({
      search: {
        ...(selectedAno ? { ano: selectedAno } : {}),
        ...(selectedEvento ? { evento: selectedEvento } : {}),
      },
      replace: true,
    });
  }, [selectedAno, selectedEvento, navigate]);

  const eventosOrdenados = useMemo(() => eventosQ.data?.eventos ?? [], [eventosQ.data]);

  const notConnected = anosQ.data && !anosQ.data.connected;

  return (
    <div className="min-h-dvh flex flex-col bg-gradient-to-b from-background to-muted/30">
      <SiteHeader />

      <main className="flex-1">
        <section className="border-b bg-gradient-to-br from-primary/10 via-background to-accent/5">
          <div className="mx-auto max-w-6xl px-4 py-10 md:py-14">
            <Badge variant="secondary" className="gap-1">
              <Camera className="h-3 w-3" /> Galeria pública
            </Badge>
            <h1 className="mt-3 text-3xl md:text-5xl font-bold tracking-tight">
              Momentos <span className="text-primary">UEECM</span>
            </h1>
            <p className="mt-3 text-muted-foreground max-w-2xl">
              Reviva os melhores momentos da nossa escola: eventos, projetos, apresentações e o
              cotidiano da comunidade escolar. Todas as fotos são hospedadas no Google Drive
              institucional.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-6">
          <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4 shadow-sm">
            <Filter className="h-4 w-4 text-muted-foreground mb-2" />
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Ano</label>
              <Select
                value={selectedAno}
                onValueChange={(v) => {
                  setSelectedAno(v);
                  setSelectedEvento(undefined);
                }}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {anosQ.data?.anos?.map((a) => (
                    <SelectItem key={a.folderId} value={a.name}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Evento</label>
              <Select
                value={selectedEvento}
                onValueChange={setSelectedEvento}
                disabled={!selectedAno || eventosOrdenados.length === 0}
              >
                <SelectTrigger className="w-[240px]">
                  <SelectValue
                    placeholder={
                      selectedAno
                        ? eventosOrdenados.length
                          ? "Todos os eventos"
                          : "Sem eventos"
                        : "Escolha um ano"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {eventosOrdenados.map((e) => (
                    <SelectItem key={e.folderId} value={e.name}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(selectedAno || selectedEvento) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedEvento(undefined);
                }}
                disabled={!selectedEvento}
              >
                Limpar evento
              </Button>
            )}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16">
          {notConnected && (
            <div className="rounded-lg border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
              <Cloud className="mx-auto mb-2 h-6 w-6 opacity-70" />A galeria será exibida assim que
              o Google Drive institucional estiver conectado.
            </div>
          )}

          {/* Sem evento selecionado — mostra grade de eventos como álbuns */}
          {!selectedEvento && selectedAno && (
            <>
              {eventosQ.isLoading ? (
                <GridSkeleton />
              ) : eventosOrdenados.length === 0 ? (
                <EmptyState label={`Nenhum evento publicado em ${selectedAno} ainda.`} />
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {eventosOrdenados.map((e) => (
                    <button
                      key={e.folderId}
                      onClick={() => setSelectedEvento(e.name)}
                      className="group relative overflow-hidden rounded-xl border bg-card text-left shadow-sm transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <div className="aspect-[4/3] bg-muted overflow-hidden">
                        {e.cover ? (
                          <img
                            src={`/api/public/momentos-foto/${e.cover.fileId}`}
                            alt={e.name}
                            loading="lazy"
                            className="h-full w-full object-cover transition group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-muted-foreground">
                            <ImageOff className="h-8 w-8" />
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <div className="font-medium leading-tight">{e.name}</div>
                        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" /> {selectedAno}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Evento selecionado — mostra fotos */}
          {selectedEvento && (
            <>
              <div className="mb-4 flex items-baseline justify-between">
                <h2 className="text-xl font-semibold">
                  {selectedEvento}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    · {selectedAno}
                  </span>
                </h2>
              </div>
              {fotosQ.isLoading ? (
                <GridSkeleton />
              ) : (fotosQ.data?.fotos ?? []).length === 0 ? (
                <EmptyState label="Nenhuma foto neste evento." />
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {fotosQ.data!.fotos.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setLightbox({ id: f.id, name: f.name })}
                      className="group aspect-square overflow-hidden rounded-lg border bg-muted focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <img
                        src={`/api/public/momentos-foto/${f.id}`}
                        alt={f.name}
                        loading="lazy"
                        className="h-full w-full object-cover transition group-hover:scale-105"
                      />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </main>

      <SiteFooter />

      <Dialog open={!!lightbox} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="truncate">{lightbox?.name}</DialogTitle>
          </DialogHeader>
          {lightbox && (
            <img
              src={`/api/public/momentos-foto/${lightbox.id}`}
              alt={lightbox.name}
              className="max-h-[75vh] w-full rounded-md object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="aspect-[4/3] animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-10 text-center">
      <Loader2 className="mx-auto mb-3 h-6 w-6 opacity-40" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

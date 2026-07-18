import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, Globe, GraduationCap, Linkedin, Star } from "lucide-react";

import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import {
  CARGO_LABEL,
  getInitials,
  tempoDeProfissao,
  type Cargo,
  type Profissional,
} from "@/lib/profissionais";

export const Route = createFileRoute("/equipe/$id")({
  head: ({ params }) => ({
    meta: [
      { title: "Perfil do profissional | U.E. Evaristo Campelo de Matos" },
      {
        name: "description",
        content:
          "Conheça um integrante da equipe da U.E. Evaristo Campelo de Matos: biografia, disciplinas e contato.",
      },
      { property: "og:title", content: "Perfil da equipe — UEECM" },
      { property: "og:description", content: "Perfil de um profissional da equipe escolar UEECM." },
      { property: "og:type", content: "profile" },
      { property: "og:url", content: `https://conectaueecm.com/equipe/${params.id}` },
      { property: "og:image", content: "https://conectaueecm.com/og-image.jpg" },
    ],
    links: [{ rel: "canonical", href: `https://conectaueecm.com/equipe/${params.id}` }],
  }),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-lg px-6 py-24 text-center">
      <p className="font-display text-lg">Não foi possível carregar o perfil.</p>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      <Button asChild className="mt-4 rounded-full" variant="outline">
        <Link to="/equipe">Voltar</Link>
      </Button>
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-lg px-6 py-24 text-center">
      <p className="font-display text-lg">Profissional não encontrado.</p>
      <Button asChild className="mt-4 rounded-full" variant="outline">
        <Link to="/equipe">Voltar à equipe</Link>
      </Button>
    </div>
  ),
  component: DetalhePage,
});

function DetalhePage() {
  const { id } = Route.useParams();

  const { data, isLoading } = useQuery({
    queryKey: ["profissional-detalhe", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profissionais_publicos")
        .select(
          "id, nome, foto_url, cargo, cargo_descricao, disciplinas, bio, formacao, anos_experiencia, ano_ingresso, destaque, ordem, ativo, linkedin_url, lattes_url, site_url",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as Profissional | null;
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
        <Button asChild variant="ghost" size="sm" className="mb-4 rounded-full">
          <Link to="/equipe">
            <ArrowLeft className="size-4" /> Voltar à equipe
          </Link>
        </Button>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-48 rounded-3xl" />
            <Skeleton className="h-64 rounded-3xl" />
          </div>
        ) : !data ? (
          <div className="rounded-3xl border border-dashed border-border bg-card py-16 text-center">
            <p className="font-display text-lg">Profissional não encontrado.</p>
          </div>
        ) : (
          <article className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm">
            <div className="relative h-32 bg-gradient-to-br from-primary via-primary/85 to-primary/60 sm:h-44 md:h-52">
              {data.destaque && (
                <Badge className="absolute right-3 top-3 rounded-full bg-gold text-gold-foreground hover:bg-gold sm:right-4 sm:top-4">
                  <Star className="size-3" /> Destaque
                </Badge>
              )}
            </div>

            <div className="-mt-14 flex flex-col items-center gap-3 px-4 pb-6 text-center sm:-mt-16 sm:px-6 md:-mt-20 md:px-8">
              {data.foto_url ? (
                <img
                  src={data.foto_url}
                  alt={data.nome}
                  width={160}
                  height={160}
                  className="size-28 rounded-full object-cover ring-4 ring-card sm:size-32 md:size-40"
                />
              ) : (
                <div className="flex size-28 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 font-display text-3xl font-semibold text-primary-foreground ring-4 ring-card sm:size-32 sm:text-4xl md:size-40">
                  {getInitials(data.nome)}
                </div>
              )}

              <h1 className="break-words font-display text-2xl font-bold sm:text-3xl">
                {data.nome}
              </h1>
              <p className="break-words text-sm font-medium text-primary sm:text-base">
                {data.cargo_descricao || CARGO_LABEL[data.cargo as Cargo]}
              </p>

              {data.disciplinas?.length > 0 && (
                <div className="flex flex-wrap justify-center gap-1.5">
                  {data.disciplinas.map((d) => (
                    <Badge key={d} variant="secondary" className="rounded-full">
                      <BookOpen className="size-3" /> {d}
                    </Badge>
                  ))}
                </div>
              )}

              {tempoDeProfissao(data) && (
                <p className="text-xs font-medium text-foreground/80 sm:text-sm">
                  {tempoDeProfissao(data)}
                </p>
              )}
            </div>

            <div className="grid gap-6 border-t border-border/60 px-4 py-6 sm:px-6 md:grid-cols-3 md:px-8">
              <div className="space-y-5 md:col-span-2">
                {data.bio ? (
                  <section>
                    <h2 className="mb-2 font-display text-lg font-semibold">Sobre</h2>
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
                      {data.bio}
                    </p>
                  </section>
                ) : (
                  <p className="text-sm text-muted-foreground">Biografia ainda não cadastrada.</p>
                )}

                {data.formacao && (
                  <section>
                    <h2 className="mb-2 font-display text-lg font-semibold">Formação</h2>
                    <p className="flex items-start gap-2 text-sm text-muted-foreground">
                      <GraduationCap className="mt-0.5 size-4 shrink-0" />
                      <span className="min-w-0 flex-1 break-words">{data.formacao}</span>
                    </p>
                  </section>
                )}
              </div>

              <aside className="space-y-3">
                <h2 className="font-display text-lg font-semibold">Contato</h2>
                <div className="space-y-2 text-sm">
                  {data.linkedin_url && (
                    <a
                      href={data.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-2xl border border-border/70 px-3 py-2 transition-colors hover:border-primary/50 hover:text-primary"
                    >
                      <Linkedin className="size-4 shrink-0" /> LinkedIn
                    </a>
                  )}
                  {data.lattes_url && (
                    <a
                      href={data.lattes_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-2xl border border-border/70 px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors hover:border-primary/50 hover:text-primary"
                    >
                      Lattes
                    </a>
                  )}
                  {data.site_url && (
                    <a
                      href={data.site_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-2xl border border-border/70 px-3 py-2 transition-colors hover:border-primary/50 hover:text-primary"
                    >
                      <Globe className="size-4 shrink-0" /> Site
                    </a>
                  )}
                  {!data.linkedin_url && !data.lattes_url && !data.site_url && (
                    <p className="text-xs text-muted-foreground">
                      Contato disponível apenas na secretaria da escola.
                    </p>
                  )}
                </div>
              </aside>
            </div>
          </article>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

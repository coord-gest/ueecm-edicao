import { useQuery } from "@tanstack/react-query";
import { AlertCircle, BookOpen, Globe, GraduationCap, Linkedin, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  CARGO_LABEL,
  getInitials,
  tempoDeProfissao,
  type Cargo,
  type Profissional,
} from "@/lib/profissionais";

interface Props {
  profissionalId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfissionalPerfilDialog({ profissionalId, open, onOpenChange }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["profissional-perfil", profissionalId],
    enabled: !!profissionalId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profissionais_publicos")
        .select(
          "id, nome, foto_url, cargo, cargo_descricao, disciplinas, bio, formacao, anos_experiencia, ano_ingresso, destaque, ordem, ativo, linkedin_url, lattes_url, site_url",
        )
        .eq("id", profissionalId!)
        .maybeSingle();
      if (error) throw error;
      return data as Profissional | null;
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby="perfil-desc"
        className="max-h-[92vh] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] gap-0 overflow-hidden overflow-y-auto p-0 sm:w-full sm:max-w-2xl"
      >
        {isLoading ? (
          <PerfilSkeleton />
        ) : error ? (
          <PerfilErro mensagem={error.message} />
        ) : !data ? (
          <PerfilVazio />
        ) : (
          <PerfilConteudo p={data} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function PerfilSkeleton() {
  return (
    <>
      <DialogHeader className="sr-only">
        <DialogTitle>Carregando perfil</DialogTitle>
        <DialogDescription id="perfil-desc">
          Buscando informações do profissional…
        </DialogDescription>
      </DialogHeader>
      <Skeleton className="h-32 w-full rounded-[5px] sm:h-40" />
      <div className="-mt-14 flex flex-col items-center gap-2 px-5 pb-4 sm:-mt-16 sm:px-8">
        <Skeleton className="size-28 rounded-full ring-4 ring-background sm:size-32" />
        <Skeleton className="mt-2 h-6 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="space-y-3 border-t border-border/60 px-5 py-5 sm:px-8">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </>
  );
}

function PerfilErro({ mensagem }: { mensagem: string }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <DialogHeader className="space-y-1">
        <DialogTitle className="flex items-center justify-center gap-2 font-display text-lg">
          <AlertCircle className="size-5 text-destructive" aria-hidden />
          Não foi possível carregar o perfil
        </DialogTitle>
        <DialogDescription id="perfil-desc" className="text-sm text-muted-foreground">
          {mensagem || "Tente novamente em instantes."}
        </DialogDescription>
      </DialogHeader>
    </div>
  );
}

function PerfilVazio() {
  return (
    <div className="px-6 py-12 text-center">
      <DialogHeader className="space-y-1">
        <DialogTitle className="font-display text-lg">Perfil indisponível</DialogTitle>
        <DialogDescription id="perfil-desc">
          Este profissional não está disponível no momento.
        </DialogDescription>
      </DialogHeader>
    </div>
  );
}

function PerfilConteudo({ p }: { p: Profissional }) {
  const semContatoPublico = !p.linkedin_url && !p.lattes_url && !p.site_url;

  return (
    <>
      <div
        className="relative h-28 bg-gradient-to-br from-primary via-primary/85 to-primary/60 sm:h-40"
        aria-hidden
      >
        {p.destaque && (
          <Badge className="absolute right-3 top-3 rounded-full bg-gold text-gold-foreground hover:bg-gold sm:right-4 sm:top-4">
            <Star className="size-3" aria-hidden /> Destaque
          </Badge>
        )}
      </div>

      <div className="-mt-12 flex flex-col items-center gap-2 px-4 pb-4 text-center sm:-mt-16 sm:px-8">
        {p.foto_url ? (
          <img
            src={p.foto_url}
            alt={`Foto de ${p.nome}`}
            width={128}
            height={128}
            className="size-24 rounded-full object-cover ring-4 ring-background sm:size-32"
          />
        ) : (
          <div
            className="flex size-24 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 font-display text-2xl font-semibold text-primary-foreground ring-4 ring-background sm:size-32 sm:text-3xl"
            aria-hidden
          >
            {getInitials(p.nome)}
          </div>
        )}
        <DialogHeader className="space-y-1">
          <DialogTitle className="break-words font-display text-lg sm:text-2xl">
            {p.nome}
          </DialogTitle>
          <DialogDescription
            id="perfil-desc"
            className="break-words text-sm font-medium text-primary sm:text-base"
          >
            {p.cargo_descricao || CARGO_LABEL[p.cargo as Cargo]}
          </DialogDescription>
        </DialogHeader>

        {p.disciplinas?.length > 0 && (
          <ul aria-label="Disciplinas" className="flex flex-wrap justify-center gap-1.5">
            {p.disciplinas.map((d) => (
              <li key={d}>
                <Badge variant="secondary" className="rounded-full">
                  <BookOpen className="size-3" aria-hidden /> {d}
                </Badge>
              </li>
            ))}
          </ul>
        )}

        {tempoDeProfissao(p) && (
          <p className="text-xs font-medium text-foreground/80 sm:text-sm">{tempoDeProfissao(p)}</p>
        )}
      </div>

      <div className="grid gap-5 border-t border-border/60 px-4 py-5 sm:gap-6 sm:px-8 md:grid-cols-3">
        <div className="space-y-5 md:col-span-2">
          <section aria-labelledby="perfil-sobre">
            <h3 id="perfil-sobre" className="mb-2 font-display text-base font-semibold">
              Sobre
            </h3>
            {p.bio ? (
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
                {p.bio}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Biografia ainda não cadastrada.</p>
            )}
          </section>

          {p.formacao && (
            <section aria-labelledby="perfil-formacao">
              <h3 id="perfil-formacao" className="mb-2 font-display text-base font-semibold">
                Formação
              </h3>
              <p className="flex items-start gap-2 text-sm text-muted-foreground">
                <GraduationCap className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1 break-words">{p.formacao}</span>
              </p>
            </section>
          )}
        </div>

        <aside aria-labelledby="perfil-contato" className="space-y-3">
          <h3 id="perfil-contato" className="font-display text-base font-semibold">
            Contato
          </h3>
          <div className="space-y-2 text-sm">
            {p.linkedin_url && (
              <a
                href={p.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Abrir LinkedIn de ${p.nome} em nova aba`}
                className="flex items-center gap-2 rounded-2xl border border-border/70 px-3 py-2 transition-colors hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Linkedin className="size-4 shrink-0" aria-hidden /> LinkedIn
              </a>
            )}
            {p.lattes_url && (
              <a
                href={p.lattes_url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Abrir currículo Lattes de ${p.nome} em nova aba`}
                className="flex items-center gap-2 rounded-2xl border border-border/70 px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Lattes
              </a>
            )}
            {p.site_url && (
              <a
                href={p.site_url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Abrir site pessoal de ${p.nome} em nova aba`}
                className="flex items-center gap-2 rounded-2xl border border-border/70 px-3 py-2 transition-colors hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Globe className="size-4 shrink-0" aria-hidden /> Site
              </a>
            )}
            {semContatoPublico && (
              <p className="text-xs text-muted-foreground">
                Contatos privados. Procure a secretaria da escola.
              </p>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}

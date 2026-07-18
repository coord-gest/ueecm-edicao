import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, GraduationCap, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { supabase } from "@/integrations/supabase/client";
import { CARGO_LABEL, type Cargo, type Profissional, getInitials } from "@/lib/profissionais";

const SHOWCASE_LIMIT = 8;

export function ProfissionaisShowcase() {
  const { data, isLoading } = useQuery({
    queryKey: ["profissionais-home"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profissionais_publicos")
        .select(
          "id, nome, foto_url, cargo, cargo_descricao, disciplinas, bio, anos_experiencia, ano_ingresso, destaque, ordem",
        )
        .eq("ativo", true)
        .order("destaque", { ascending: false })
        .order("ordem", { ascending: true })
        .order("nome", { ascending: true })
        .limit(SHOWCASE_LIMIT);
      if (error) throw error;
      return (data ?? []) as Pick<
        Profissional,
        | "id"
        | "nome"
        | "foto_url"
        | "cargo"
        | "cargo_descricao"
        | "disciplinas"
        | "bio"
        | "anos_experiencia"
        | "ano_ingresso"
        | "destaque"
        | "ordem"
      >[];
    },
  });

  return (
    <section className="mt-20">
      <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Badge className="mb-2 rounded-full bg-gold/15 text-gold-foreground hover:bg-gold/15">
            <GraduationCap className="size-3.5" /> Nossa equipe
          </Badge>
          <h2 className="font-display text-3xl font-bold text-foreground">
            Profissionais da educação
          </h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Conheça quem dá vida ao dia a dia da escola: diretoria, coordenação, professores,
            secretaria e demais profissionais que fazem o U.E. - Evaristo Campelo de Matos
            acontecer.
          </p>
        </div>
        <Button
          asChild
          variant="outline"
          className="mt-3 w-fit rounded-full border-primary/30 text-primary hover:bg-primary/5 sm:mt-0"
        >
          <Link to="/equipe">
            Ver todos <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-3xl border border-border/70 bg-card p-5">
              <div className="shimmer mx-auto size-24 rounded-full" />
              <div className="shimmer mx-auto mt-4 h-4 w-2/3 rounded-md" />
              <div className="shimmer mx-auto mt-2 h-3 w-1/2 rounded-md" />
            </div>
          ))}
        </div>
      ) : (data?.length ?? 0) === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card py-14 text-center">
          <Users className="mx-auto mb-2 size-8 text-muted-foreground" />
          <p className="font-display text-lg text-foreground">
            Nenhum profissional cadastrado ainda
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            A diretoria poderá apresentar a equipe em breve.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {data!.map((p) => (
            <ProfissionalMiniCard key={p.id} p={p} />
          ))}
        </div>
      )}
    </section>
  );
}

function ProfissionalMiniCard({
  p,
}: {
  p: Pick<
    Profissional,
    "id" | "nome" | "foto_url" | "cargo" | "cargo_descricao" | "disciplinas" | "anos_experiencia"
  >;
}) {
  const cargoLabel = CARGO_LABEL[p.cargo as Cargo] ?? p.cargo_descricao ?? "Profissional";
  return (
    <Link
      to="/equipe"
      className="group hover-lift sheen relative flex flex-col items-center rounded-3xl border border-border/70 bg-card p-5 text-center shadow-elegant hover:border-primary/40"
    >
      <div className="relative">
        {p.foto_url ? (
          <img
            src={p.foto_url}
            alt={p.nome}
            width={96}
            height={96}
            loading="lazy"
            className="size-24 rounded-full object-cover ring-4 ring-background"
          />
        ) : (
          <div className="flex size-24 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 font-display text-2xl font-semibold text-primary-foreground ring-4 ring-background">
            {getInitials(p.nome)}
          </div>
        )}
      </div>
      <p className="mt-4 line-clamp-1 font-display text-base font-semibold text-foreground">
        {p.nome}
      </p>
      <p className="mt-0.5 text-xs font-medium text-primary">{cargoLabel}</p>
      {p.disciplinas?.length > 0 && (
        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
          {p.disciplinas.slice(0, 2).join(" · ")}
        </p>
      )}
      {p.anos_experiencia != null && (
        <Badge variant="secondary" className="mt-3 rounded-full text-[10px]">
          {p.anos_experiencia} anos de profissão
        </Badge>
      )}
    </Link>
  );
}

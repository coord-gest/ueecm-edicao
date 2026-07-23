import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getInitials } from "@/lib/profissionais";
import { CARGO_LABEL, type Cargo } from "@/lib/profissionais";
import { useReveal } from "@/hooks/use-reveal";

type ProfPublico = {
  id: string;
  nome: string;
  foto_url: string | null;
  cargo: string | null;
  cargo_descricao: string | null;
  disciplinas: string[] | null;
};

export function TeamHighlight() {
  const ref = useReveal<HTMLElement>();
  const { data, isLoading } = useQuery({
    queryKey: ["home-equipe-destaque"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profissionais_publicos" as never)
        .select("id, nome, foto_url, cargo, cargo_descricao, disciplinas")
        .order("ordem", { ascending: true, nullsFirst: false })
        .limit(8);
      if (error) throw error;
      return (data ?? []) as unknown as ProfPublico[];
    },
    staleTime: 5 * 60_000,
  });

  if (!isLoading && (!data || data.length === 0)) return null;

  return (
    <section ref={ref} className="reveal mb-10 md:mb-16">
      <div className="mb-8 flex items-end justify-between border-b-2 border-primary pb-3">
        <h2 className="font-display text-2xl text-primary sm:text-3xl lg:text-4xl">Nossa Equipe</h2>
        <Link
          to="/equipe"
          className="text-xs font-semibold uppercase tracking-widest text-accent transition-colors hover:text-primary"
        >
          Conheça todos <ArrowRight className="inline size-3" />
        </Link>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:overflow-visible sm:px-0">
        <div className="flex gap-4 sm:grid sm:grid-cols-3 lg:grid-cols-4">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-40 w-56 shrink-0 animate-pulse rounded-[5px] bg-secondary/50 sm:w-auto"
                />
              ))
            : (data ?? []).slice(0, 8).map((p) => <TeamCard key={p.id} p={p} />)}
        </div>
      </div>
    </section>
  );
}

function TeamCard({ p }: { p: ProfPublico }) {
  const disciplinas = (p.disciplinas ?? []).filter(Boolean).slice(0, 2).join(" · ");
  const cargoLabel = p.cargo ? (CARGO_LABEL[p.cargo as Cargo] ?? p.cargo) : "";
  const subtitle = p.cargo_descricao || disciplinas || cargoLabel;
  return (
    <Link
      to="/equipe"
      className="group relative flex w-56 shrink-0 flex-col items-center overflow-hidden border border-border bg-primary p-5 text-center text-white transition-colors hover:border-gold sm:w-auto"
    >
      <span className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gold" />
      <div className="relative mb-3 size-20 overflow-hidden rounded-full bg-[#0f1b3d] ring-2 ring-gold/40 transition-all group-hover:ring-gold">
        {p.foto_url ? (
          <img src={p.foto_url} alt={p.nome} className="size-full object-cover" loading="lazy" />
        ) : (
          <div className="grid size-full place-items-center font-display text-2xl text-white">
            {getInitials(p.nome)}
          </div>
        )}
      </div>
      <h3 className="relative line-clamp-2 font-display text-sm font-semibold leading-tight text-white transition-colors group-hover:text-gold sm:text-base">
        {p.nome}
      </h3>
      {subtitle && (
        <p className="relative mt-1 line-clamp-2 text-[11px] uppercase tracking-widest text-white/75">
          {subtitle}
        </p>
      )}
    </Link>
  );
}

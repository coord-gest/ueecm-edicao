import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, MapPin, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useReveal } from "@/hooks/use-reveal";

type Evento = {
  id: string;
  titulo: string;
  data_inicio: string | null;
  horario: string | null;
  local: string | null;
  categoria: string | null;
  cor: string | null;
};

const MES_CURTO = [
  "JAN",
  "FEV",
  "MAR",
  "ABR",
  "MAI",
  "JUN",
  "JUL",
  "AGO",
  "SET",
  "OUT",
  "NOV",
  "DEZ",
];

export function UpcomingEvents() {
  const ref = useReveal<HTMLElement>();
  const { data, isLoading } = useQuery({
    queryKey: ["home-prox-eventos"],
    queryFn: async () => {
      const hoje = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("eventos")
        .select("id, titulo, data_inicio, horario, local, categoria, cor")
        .eq("ativo", true)
        .gte("data_inicio", hoje)
        .order("data_inicio", { ascending: true })
        .limit(3);
      if (error) throw error;
      return (data ?? []) as Evento[];
    },
    staleTime: 60_000,
  });

  if (!isLoading && (!data || data.length === 0)) return null;

  return (
    <section ref={ref} className="reveal mb-10 md:mb-16">
      <div className="mb-8 flex items-end justify-between border-b-2 border-primary pb-3">
        <h2 className="font-display text-2xl text-primary sm:text-3xl lg:text-4xl">
          Próximos Eventos
        </h2>
        <Link
          to="/calendario"
          className="text-xs font-semibold uppercase tracking-widest text-accent transition-colors hover:text-primary"
        >
          Ver calendário <ArrowRight className="inline size-3" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-[5px] border border-border bg-secondary/50"
              />
            ))
          : (data ?? []).map((ev) => <EventoCard key={ev.id} ev={ev} />)}
      </div>
    </section>
  );
}

function parseEventDate(v: string | null): Date | null {
  if (!v) return null;
  const iso = v.length <= 10 ? `${v}T00:00:00` : v;
  const d = new Date(iso);
  if (!isNaN(d.getTime())) return d;
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return null;
}

function EventoCard({ ev }: { ev: Evento }) {
  const d = parseEventDate(ev.data_inicio);
  const dia = d ? String(d.getDate()).padStart(2, "0") : "--";
  const mes = d ? MES_CURTO[d.getMonth()] : "";
  const cor = ev.cor || undefined;

  return (
    <Link
      to="/calendario"
      className="group relative flex overflow-hidden rounded-[5px] border-2 border-border bg-[image:var(--gradient-hero)] text-white shadow-md ring-1 ring-black/5 transition-all hover:-translate-y-0.5 hover:border-gold hover:shadow-xl"
    >
      <span className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-linear-to-r from-gold via-gold/70 to-transparent" />
      <span className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-gold/20 blur-2xl transition-transform group-hover:scale-125" />
      <div
        className="relative flex w-24 shrink-0 flex-col items-center justify-center border-r border-white/15 bg-gold text-gold-foreground"
        style={cor ? { backgroundColor: cor } : undefined}
      >
        <span className="font-display text-3xl leading-none tabular-nums">{dia}</span>
        <span className="mt-1 text-[10px] font-semibold uppercase tracking-widest">{mes}</span>
      </div>
      <div className="relative flex flex-1 flex-col justify-center gap-1 p-4">
        {ev.categoria && (
          <span className="text-[10px] font-semibold uppercase tracking-widest text-gold">
            {ev.categoria}
          </span>
        )}
        <h3 className="line-clamp-2 font-display text-base leading-snug text-white transition-colors group-hover:text-gold sm:text-lg">
          {ev.titulo}
        </h3>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/80">
          {ev.horario && (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" aria-hidden /> {ev.horario}
            </span>
          )}
          {ev.local && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" aria-hidden /> {ev.local}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

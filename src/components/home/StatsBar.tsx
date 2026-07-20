import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { GraduationCap, Users, Newspaper, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useReveal } from "@/hooks/use-reveal";

const FOUNDING_YEAR = 1982; // Escola fundada em 1982 — cálculo automático a cada ano

function useCountUp(target: number, duration = 1200) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target <= 0) {
      setValue(0);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

export function StatsBar() {
  const ref = useReveal<HTMLDivElement>();
  const anos = new Date().getFullYear() - FOUNDING_YEAR;

  const { data: profs } = useQuery({
    queryKey: ["stats-profs"],
    queryFn: async () => {
      const { count } = await supabase
        .from("profissionais_publicos" as never)
        .select("*", { count: "exact", head: true });
      return count ?? 0;
    },
    staleTime: 5 * 60_000,
  });

  const { data: posts } = useQuery({
    queryKey: ["stats-posts"],
    queryFn: async () => {
      const { count } = await supabase
        .from("posts")
        .select("id", { count: "exact", head: true })
        .eq("status", "publicado");
      return count ?? 0;
    },
    staleTime: 5 * 60_000,
  });

  const { data: eventos } = useQuery({
    queryKey: ["stats-eventos-ano"],
    queryFn: async () => {
      const y = new Date().getFullYear();
      const { count } = await supabase
        .from("eventos")
        .select("id", { count: "exact", head: true })
        .gte("data_inicio", `${y}-01-01`)
        .lte("data_inicio", `${y}-12-31`);
      return count ?? 0;
    },
    staleTime: 5 * 60_000,
  });

  const items = [
    { icon: CalendarDays, value: anos, label: "Anos de tradição", suffix: "+" },
    { icon: Users, value: profs ?? 0, label: "Profissionais", suffix: "" },
    { icon: Newspaper, value: posts ?? 0, label: "Publicações", suffix: "" },
    {
      icon: GraduationCap,
      value: eventos ?? 0,
      label: "Eventos em " + new Date().getFullYear(),
      suffix: "",
    },
  ];

  return (
    <div
      ref={ref}
      className="reveal group relative mb-10 md:mb-16 grid grid-cols-2 gap-3 overflow-hidden border border-border bg-[image:var(--gradient-primary)] p-5 text-white shadow-lg sm:p-6 md:grid-cols-4 md:gap-6"
    >
      <span className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-linear-to-r from-gold via-gold/70 to-transparent" />
      <span className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-gold/20 blur-3xl" />
      <span className="pointer-events-none absolute -bottom-20 -left-10 size-56 rounded-full bg-accent/40 blur-3xl" />
      {items.map((it) => (
        <StatCell key={it.label} {...it} />
      ))}
    </div>
  );
}

function StatCell({
  icon: Icon,
  value,
  label,
  suffix,
}: {
  icon: React.ElementType;
  value: number;
  label: string;
  suffix: string;
}) {
  const n = useCountUp(value);
  return (
    <div className="relative flex items-center gap-4">
      <div className="inline-flex size-11 shrink-0 items-center justify-center bg-gold text-gold-foreground shadow-md">
        <Icon className="size-5" aria-hidden />
      </div>
      <div>
        <p className="font-display text-2xl leading-none text-white tabular-nums sm:text-3xl">
          {n.toLocaleString("pt-BR")}
          {suffix}
        </p>
        <p className="mt-1 text-[11px] font-semibold uppercase tracking-widest text-gold">
          {label}
        </p>
      </div>
    </div>
  );
}

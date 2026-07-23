import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Cake, CalendarDays, Megaphone, Sparkles, Maximize2, Pause, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/tv")({
  head: () => ({
    meta: [
      { title: "Modo TV — UEECM" },
      { name: "description", content: "Painel rotativo para telas de corredor e recepção." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TvMode,
});

type SlideKind = "urgentes" | "aniversariantes" | "destaques" | "eventos";
type Slide = { kind: SlideKind; title: string; render: () => React.ReactElement };

const SLIDE_MS = 10_000;

function TvMode() {
  const alertsQ = useQuery({
    queryKey: ["tv", "alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alerts")
        .select("id, message, variant, link_label, image_url, starts_at, expires_at, active")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      const now = Date.now();
      return (data ?? []).filter((a) => {
        if (a.starts_at && new Date(a.starts_at).getTime() > now) return false;
        if (a.expires_at && new Date(a.expires_at).getTime() < now) return false;
        return true;
      });
    },
    refetchInterval: 60_000,
  });

  const birthdaysQ = useQuery({
    queryKey: ["tv", "aniversariantes"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("tv_aniversariantes_hoje");
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 60 * 60_000,
  });

  const highlightsQ = useQuery({
    queryKey: ["tv", "destaques"],
    queryFn: async () => {
      const first = new Date();
      first.setDate(1);
      first.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from("alunos_destaque_publicos")
        .select("id, motivo, foto_url, exibir_foto, posicao, aluno_nome, turma_nome, mes")
        .gte("mes", first.toISOString().slice(0, 10))
        .order("posicao", { ascending: true })
        .limit(12);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 5 * 60_000,
  });

  const eventsQ = useQuery({
    queryKey: ["tv", "eventos"],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("eventos")
        .select("id, titulo, descricao, data, horario, local, categoria, cor, destaque")
        .eq("ativo", true)
        .gte("data", today)
        .order("data", { ascending: true })
        .limit(8);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 5 * 60_000,
  });

  const slides = useMemo<Slide[]>(() => {
    const list: Slide[] = [];
    const alerts = alertsQ.data ?? [];
    const birthdays = (birthdaysQ.data ?? []) as { primeiro_nome: string; turma_nome: string }[];
    const highlights = highlightsQ.data ?? [];
    const events = eventsQ.data ?? [];

    for (const a of alerts) {
      list.push({
        kind: "urgentes",
        title: "Urgente",
        render: () => <UrgentSlide alert={a} />,
      });
    }
    if (birthdays.length > 0) {
      list.push({
        kind: "aniversariantes",
        title: "Aniversariantes de hoje",
        render: () => <BirthdaySlide people={birthdays} />,
      });
    }
    // Highlights: paginate 3 por vez
    for (let i = 0; i < highlights.length; i += 3) {
      const chunk = highlights.slice(i, i + 3);
      list.push({
        kind: "destaques",
        title: "Alunos em destaque",
        render: () => <HighlightSlide items={chunk} />,
      });
    }
    // Events: paginate 4 por vez
    for (let i = 0; i < events.length; i += 4) {
      const chunk = events.slice(i, i + 4);
      list.push({
        kind: "eventos",
        title: "Próximos eventos",
        render: () => <EventsSlide items={chunk} />,
      });
    }
    if (list.length === 0) {
      list.push({
        kind: "destaques",
        title: "Bem-vindos",
        render: () => <EmptySlide />,
      });
    }
    return list;
  }, [alertsQ.data, birthdaysQ.data, highlightsQ.data, eventsQ.data]);

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [clock, setClock] = useState(() => new Date());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (paused || slides.length <= 1) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % slides.length), SLIDE_MS);
    return () => clearInterval(id);
  }, [paused, slides.length]);

  useEffect(() => {
    if (index >= slides.length) setIndex(0);
  }, [index, slides.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setIndex((i) => (i + 1) % slides.length);
      else if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + slides.length) % slides.length);
      else if (e.key === " ") {
        e.preventDefault();
        setPaused((p) => !p);
      } else if (e.key === "f" || e.key === "F") requestFs();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slides.length]);

  function requestFs() {
    const el = containerRef.current ?? document.documentElement;
    if (!document.fullscreenElement) el.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.().catch(() => {});
  }

  const current = slides[index];

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white"
    >
      {/* Header */}
      <header className="flex items-center justify-between px-10 pt-8">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold uppercase tracking-widest text-white/80 backdrop-blur">
            {current?.title ?? "UEECM"}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right font-display">
            <div className="text-4xl font-bold tabular-nums">
              {clock.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </div>
            <div className="text-sm text-white/70">
              {clock.toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "2-digit",
                month: "long",
              })}
            </div>
          </div>
          <div className="flex gap-1 opacity-0 transition-opacity hover:opacity-100 focus-within:opacity-100">
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10"
              onClick={() => setPaused((p) => !p)}
              aria-label={paused ? "Retomar" : "Pausar"}
            >
              {paused ? <Play className="size-5" /> : <Pause className="size-5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10"
              onClick={requestFs}
              aria-label="Tela cheia"
            >
              <Maximize2 className="size-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Slide */}
      <main
        key={index}
        className="flex flex-1 items-center justify-center px-10 py-6 animate-fade-in"
      >
        {current?.render()}
      </main>

      {/* Progress dots */}
      <footer className="flex flex-col items-center gap-2 pb-6">
        <div className="flex gap-2">
          {slides.map((s, i) => (
            <span
              key={i}
              className={`h-2 rounded-full transition-all ${i === index ? "w-10 bg-white" : "w-2 bg-white/30"}`}
              aria-hidden
            />
          ))}
        </div>
        <div className="text-xs uppercase tracking-widest text-white/50">
          UEECM · pressione F para tela cheia · ← → para navegar · espaço para pausar
        </div>
      </footer>
    </div>
  );
}

function UrgentSlide({
  alert,
}: {
  alert: { message: string; variant: string; link_label: string | null; image_url: string | null };
}) {
  const color =
    alert.variant === "destructive"
      ? "from-red-600 to-rose-800"
      : alert.variant === "warning"
        ? "from-amber-500 to-orange-700"
        : alert.variant === "success"
          ? "from-emerald-500 to-green-700"
          : "from-sky-500 to-indigo-700";
  return (
    <div
      className={`flex w-full max-w-6xl flex-col items-center gap-8 rounded-3xl bg-gradient-to-br ${color} p-16 text-center shadow-2xl animate-scale-in`}
    >
      <Megaphone className="size-24 opacity-90" />
      <p className="text-6xl font-bold leading-tight">{alert.message}</p>
      {alert.link_label ? <p className="text-2xl opacity-90">{alert.link_label}</p> : null}
    </div>
  );
}

function BirthdaySlide({ people }: { people: { primeiro_nome: string; turma_nome: string }[] }) {
  return (
    <div className="flex w-full max-w-7xl flex-col items-center gap-10 text-center animate-scale-in">
      <div className="flex items-center gap-4">
        <Cake className="size-16 text-pink-300" />
        <h2 className="text-6xl font-bold">Feliz aniversário!</h2>
      </div>
      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {people.slice(0, 12).map((p, i) => (
          <div key={i} className="rounded-2xl bg-white/10 p-6 backdrop-blur">
            <div className="text-3xl font-bold">{p.primeiro_nome}</div>
            {p.turma_nome ? <div className="mt-1 text-lg text-white/70">{p.turma_nome}</div> : null}
          </div>
        ))}
      </div>
      {people.length > 12 ? (
        <p className="text-xl text-white/70">+{people.length - 12} aniversariantes hoje</p>
      ) : null}
    </div>
  );
}

type HighlightRow = {
  id: string;
  motivo: string | null;
  foto_url: string | null;
  exibir_foto: boolean | null;
  aluno: { nome_completo: string } | null;
  turma: { nome: string } | null;
};

function HighlightSlide({ items }: { items: HighlightRow[] }) {
  return (
    <div className="flex w-full max-w-7xl flex-col items-center gap-8 animate-scale-in">
      <div className="flex items-center gap-3">
        <Sparkles className="size-12 text-yellow-300" />
        <h2 className="text-5xl font-bold">Destaques do mês</h2>
      </div>
      <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-3">
        {items.map((h) => (
          <div
            key={h.id}
            className="flex flex-col items-center gap-4 rounded-3xl bg-white/10 p-8 text-center backdrop-blur"
          >
            {h.exibir_foto && h.foto_url ? (
              <img
                src={h.foto_url}
                alt=""
                className="size-36 rounded-full border-4 border-white/40 object-cover"
              />
            ) : (
              <div className="grid size-36 place-items-center rounded-full bg-white/20 text-5xl font-bold">
                {h.aluno?.nome_completo?.[0] ?? "★"}
              </div>
            )}
            <div>
              <div className="text-2xl font-bold">{h.aluno?.nome_completo}</div>
              {h.turma?.nome ? <div className="text-base text-white/70">{h.turma.nome}</div> : null}
            </div>
            {h.motivo ? <p className="text-lg text-white/85 line-clamp-4">{h.motivo}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

type EventRow = {
  id: string;
  titulo: string;
  descricao: string | null;
  data: string | null;
  horario: string | null;
  local: string | null;
  categoria: string | null;
  cor: string | null;
};

function EventsSlide({ items }: { items: EventRow[] }) {
  return (
    <div className="flex w-full max-w-7xl flex-col gap-8 animate-scale-in">
      <div className="flex items-center gap-3">
        <CalendarDays className="size-12 text-sky-300" />
        <h2 className="text-5xl font-bold">Próximos eventos</h2>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {items.map((e) => {
          const d = e.data ? new Date(e.data + "T12:00:00") : null;
          return (
            <div
              key={e.id}
              className="flex items-stretch gap-4 rounded-2xl bg-white/10 p-6 backdrop-blur"
            >
              <div className="flex min-w-24 flex-col items-center justify-center rounded-xl bg-white/15 px-4 py-3">
                <div className="text-4xl font-bold leading-none">
                  {d ? d.getDate().toString().padStart(2, "0") : "--"}
                </div>
                <div className="mt-1 text-sm uppercase tracking-wider text-white/80">
                  {d ? d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "") : ""}
                </div>
              </div>
              <div className="flex flex-1 flex-col justify-center">
                <div className="text-2xl font-bold leading-tight">{e.titulo}</div>
                <div className="mt-1 flex flex-wrap gap-3 text-base text-white/80">
                  {e.horario ? <span>{e.horario}</span> : null}
                  {e.local ? <span>· {e.local}</span> : null}
                  {e.categoria ? <span>· {e.categoria}</span> : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EmptySlide() {
  return (
    <div className="text-center animate-scale-in">
      <div className="text-8xl font-bold">UEECM</div>
      <p className="mt-4 text-2xl text-white/70">Bem-vindos!</p>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Keyboard,
  Maximize,
  Minimize,
  Pause,
  Play,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PresentationSection {
  id: string;
  label: string;
}

export interface PresentationModeProps {
  sections: PresentationSection[];
  /** Intervalo inicial (ms) do autoplay. 0 = começa desligado. */
  autoPlayMs?: number;
  /** Classe extra para o botão de ativação. */
  className?: string;
}

const AUTOPLAY_OPTIONS = [
  { ms: 4000, label: "4s" },
  { ms: 7000, label: "7s" },
  { ms: 12000, label: "12s" },
  { ms: 20000, label: "20s" },
];

/**
 * Transforma uma página de rolagem vertical em uma apresentação estilo slide
 * deck, navegável por teclado e em tela cheia. Cada `section.id` deve
 * corresponder a um elemento com o mesmo `id` na página.
 */
export function PresentationMode({
  sections,
  autoPlayMs = 0,
  className,
}: PresentationModeProps) {
  const [active, setActive] = useState(false);
  const [current, setCurrent] = useState(0);
  const [cursorHidden, setCursorHidden] = useState(false);
  const [autoPlaying, setAutoPlaying] = useState(false);
  const [intervalMs, setIntervalMs] = useState<number>(autoPlayMs > 0 ? autoPlayMs : 7000);
  const [showHints, setShowHints] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const cursorTimer = useRef<number | null>(null);
  const autoTimer = useRef<number | null>(null);

  const total = sections.length;

  const goTo = useCallback(
    (index: number) => {
      if (total === 0) return;
      const clamped = Math.max(0, Math.min(index, total - 1));
      setCurrent(clamped);
      const el = document.getElementById(sections[clamped]!.id);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [sections, total],
  );

  const exit = useCallback(async () => {
    setActive(false);
    setAutoPlaying(false);
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        /* noop */
      }
    }
  }, []);

  const enter = useCallback(async () => {
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      /* alguns navegadores bloqueiam sem gesto */
    }
    setCurrent(0);
    setActive(true);
    if (autoPlayMs > 0) setAutoPlaying(true);
    requestAnimationFrame(() => {
      const first = sections[0];
      if (first) document.getElementById(first.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [sections, autoPlayMs]);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      /* noop */
    }
  }, []);

  // Teclado
  useEffect(() => {
    if (!active) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        goTo(current + 1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        goTo(current - 1);
      } else if (e.key === "Escape") {
        void exit();
      } else if (e.key.toLowerCase() === "p") {
        setAutoPlaying((v) => !v);
      } else if (e.key.toLowerCase() === "f") {
        void toggleFullscreen();
      } else if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
        setShowHints((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, current, exit, goTo, toggleFullscreen]);

  // Fullscreen sync
  useEffect(() => {
    function onFsChange() {
      setIsFullscreen(!!document.fullscreenElement);
      if (!document.fullscreenElement && active) setActive(false);
    }
    setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, [active]);

  // Sair automaticamente em telas < md (768px)
  useEffect(() => {
    if (!active) return;
    const mq = window.matchMedia("(max-width: 767px)");
    function onChange(e: MediaQueryListEvent) {
      if (e.matches) void exit();
    }
    if (mq.matches) void exit();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [active, exit]);

  // Cursor auto-hide
  useEffect(() => {
    if (!active) return;
    function bump() {
      setCursorHidden(false);
      if (cursorTimer.current) window.clearTimeout(cursorTimer.current);
      cursorTimer.current = window.setTimeout(() => setCursorHidden(true), 3000);
    }
    bump();
    window.addEventListener("mousemove", bump);
    window.addEventListener("keydown", bump);
    return () => {
      window.removeEventListener("mousemove", bump);
      window.removeEventListener("keydown", bump);
      if (cursorTimer.current) window.clearTimeout(cursorTimer.current);
    };
  }, [active]);

  // Autoplay
  useEffect(() => {
    if (!active || !autoPlaying || intervalMs <= 0) return;
    autoTimer.current = window.setTimeout(() => {
      const next = current + 1;
      if (next >= total) {
        setAutoPlaying(false);
        return;
      }
      goTo(next);
    }, intervalMs);
    return () => {
      if (autoTimer.current) window.clearTimeout(autoTimer.current);
    };
  }, [active, autoPlaying, intervalMs, current, goTo, total]);

  const section = sections[current];
  const progress = total > 0 ? ((current + 1) / total) * 100 : 0;

  return (
    <>
      {!active && (
        <Button
          type="button"
          onClick={enter}
          size="sm"
          className={cn(
            "fixed bottom-6 left-6 z-50 hidden shadow-lg md:inline-flex",
            className,
          )}
          aria-label="Iniciar modo de apresentação"
        >
          <Play className="mr-2 h-4 w-4" /> Apresentar
        </Button>
      )}

      {active && section && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Modo de apresentação"
          className={cn(
            "pointer-events-none fixed inset-0 z-[60] animate-fade-in",
            cursorHidden && "cursor-none",
          )}
        >
          {/* Contador topo + controles */}
          <div className="pointer-events-auto absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-2 rounded-full bg-background/70 px-4 py-2 text-sm font-medium text-foreground shadow-md backdrop-blur">
            <span className="tabular-nums">
              {String(current + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
            </span>
            <span className="mx-2 opacity-50">—</span>
            <span className="max-w-[40vw] truncate">{section.label}</span>

            <span className="mx-2 h-4 w-px bg-border" />

            <button
              type="button"
              onClick={() => setAutoPlaying((v) => !v)}
              aria-label={autoPlaying ? "Pausar autoplay" : "Iniciar autoplay"}
              aria-pressed={autoPlaying}
              className="rounded-full p-1 transition-colors hover:bg-muted"
              title={autoPlaying ? "Pausar (P)" : "Reproduzir (P)"}
            >
              {autoPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <select
              value={intervalMs}
              onChange={(e) => setIntervalMs(Number(e.target.value))}
              aria-label="Intervalo do autoplay"
              className="cursor-pointer bg-transparent text-xs font-semibold text-foreground outline-none"
            >
              {AUTOPLAY_OPTIONS.map((o) => (
                <option key={o.ms} value={o.ms}>
                  {o.label}
                </option>
              ))}
            </select>

            <span className="mx-2 h-4 w-px bg-border" />

            <button
              type="button"
              onClick={() => void toggleFullscreen()}
              aria-label={isFullscreen ? "Sair de tela cheia" : "Entrar em tela cheia"}
              className="rounded-full p-1 transition-colors hover:bg-muted"
              title={isFullscreen ? "Sair de tela cheia (F)" : "Tela cheia (F)"}
            >
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => setShowHints((v) => !v)}
              aria-label="Mostrar atalhos de teclado"
              aria-pressed={showHints}
              className="rounded-full p-1 transition-colors hover:bg-muted"
              title="Atalhos (?)"
            >
              <Keyboard className="h-4 w-4" />
            </button>
          </div>

          {/* Sair */}
          <button
            type="button"
            onClick={() => void exit()}
            aria-label="Sair da apresentação"
            className="pointer-events-auto absolute right-4 top-4 rounded-full bg-background/70 p-2 text-foreground shadow-md backdrop-blur transition-colors hover:bg-background"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Prev */}
          <button
            type="button"
            onClick={() => goTo(current - 1)}
            disabled={current === 0}
            aria-label="Slide anterior"
            className="pointer-events-auto absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-background/50 p-3 text-foreground shadow-md backdrop-blur transition-all hover:bg-background hover:scale-110 disabled:opacity-30 disabled:hover:scale-100"
          >
            <ChevronLeft className="h-7 w-7" />
          </button>

          {/* Next */}
          <button
            type="button"
            onClick={() => goTo(current + 1)}
            disabled={current === total - 1}
            aria-label="Próximo slide"
            className="pointer-events-auto absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-background/50 p-3 text-foreground shadow-md backdrop-blur transition-all hover:bg-background hover:scale-110 disabled:opacity-30 disabled:hover:scale-100"
          >
            <ChevronRight className="h-7 w-7" />
          </button>

          {/* Painel de atalhos */}
          {showHints && (
            <div className="pointer-events-auto absolute bottom-8 left-4 max-w-xs rounded-md bg-background/80 p-3 text-xs text-foreground shadow-md backdrop-blur animate-fade-in">
              <div className="mb-2 flex items-center justify-between gap-4">
                <span className="font-semibold uppercase tracking-widest text-muted-foreground">
                  Atalhos
                </span>
                <button
                  type="button"
                  onClick={() => setShowHints(false)}
                  aria-label="Fechar painel de atalhos"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <ul className="space-y-1.5">
                <ShortcutRow keys={["◀", "▶"]} label="Navegar entre slides" />
                <ShortcutRow keys={["Espaço", "PageDown"]} label="Próximo slide" />
                <ShortcutRow keys={["P"]} label="Pausar / retomar autoplay" />
                <ShortcutRow keys={["F"]} label="Tela cheia" />
                <ShortcutRow keys={["?"]} label="Mostrar / ocultar atalhos" />
                <ShortcutRow keys={["Esc"]} label="Sair da apresentação" />
              </ul>
            </div>
          )}

          {/* Indicador numérico canto inferior direito */}
          <div className="pointer-events-none absolute bottom-6 right-4 rounded-md bg-background/70 px-3 py-1.5 text-xs font-semibold text-foreground shadow-md backdrop-blur tabular-nums">
            Slide {current + 1} de {total}
          </div>

          {/* Progresso */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1.5 bg-background/30">
            <div
              className="h-full bg-primary transition-[width] duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </>
  );
}

function ShortcutRow({ keys, label }: { keys: string[]; label: string }) {
  return (
    <li className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1">
        {keys.map((k) => (
          <kbd
            key={k}
            className="min-w-[1.5rem] rounded border border-border bg-muted px-1.5 py-0.5 text-center font-mono text-[10px] font-semibold text-foreground"
          >
            {k}
          </kbd>
        ))}
      </span>
    </li>
  );
}

export default PresentationMode;
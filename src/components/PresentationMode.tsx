import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PresentationSection {
  id: string;
  label: string;
}

export interface PresentationModeProps {
  sections: PresentationSection[];
  /** Autoplay em ms (0 = desativado). */
  autoPlayMs?: number;
  /** Classe extra para o botão de ativação. */
  className?: string;
}

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
    requestAnimationFrame(() => {
      const first = sections[0];
      if (first) document.getElementById(first.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [sections]);

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
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, current, exit, goTo]);

  // Fullscreen sync
  useEffect(() => {
    function onFsChange() {
      if (!document.fullscreenElement && active) setActive(false);
    }
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

  // Autoplay opcional
  useEffect(() => {
    if (!active || !autoPlayMs || autoPlayMs <= 0) return;
    autoTimer.current = window.setTimeout(() => {
      const next = current + 1;
      if (next >= total) return;
      goTo(next);
    }, autoPlayMs);
    return () => {
      if (autoTimer.current) window.clearTimeout(autoTimer.current);
    };
  }, [active, autoPlayMs, current, goTo, total]);

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
          {/* Contador topo */}
          <div className="pointer-events-auto absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-background/70 px-4 py-2 text-sm font-medium text-foreground shadow-md backdrop-blur">
            <span className="tabular-nums">
              {String(current + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
            </span>
            <span className="mx-2 opacity-50">—</span>
            <span>{section.label}</span>
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

          {/* Progresso */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-background/30">
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

export default PresentationMode;
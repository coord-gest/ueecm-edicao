import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Maximize2, X, Home, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getApresentacao, type Apresentacao } from "@/lib/apresentacoes";
import { ScaledSlide } from "@/components/apresentacao/SlideRenderer";

export const Route = createFileRoute("/apresentar/$id")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Apresentação — UEECM" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Player,
});

function Player() {
  const { id } = Route.useParams();
  const [ap, setAp] = useState<Apresentacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [hideUi, setHideUi] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    getApresentacao(id)
      .then((res) => {
        if (!res) setErro("Apresentação não encontrada ou sem permissão de acesso.");
        else setAp(res);
      })
      .catch((e) => setErro(e instanceof Error ? e.message : "Falha ao carregar"));
  }, [id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!ap) return;
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        setIdx((i) => Math.min(i + 1, ap.slides.length - 1));
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        setIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Home") {
        setIdx(0);
      } else if (e.key === "End") {
        setIdx(ap.slides.length - 1);
      } else if (e.key.toLowerCase() === "f") {
        toggleFullscreen();
      } else if (e.key === "Escape") {
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ap]);

  useEffect(() => {
    function bump() {
      setHideUi(false);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setHideUi(true), 2500);
    }
    bump();
    window.addEventListener("mousemove", bump);
    window.addEventListener("touchstart", bump);
    return () => {
      window.removeEventListener("mousemove", bump);
      window.removeEventListener("touchstart", bump);
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  async function toggleFullscreen() {
    const el = stageRef.current ?? document.documentElement;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await el.requestFullscreen();
    } catch {
      /* alguns navegadores bloqueiam sem gesto do usuário */
    }
  }

  if (erro) {
    return (
      <div className="grid min-h-screen place-items-center bg-black p-6 text-white">
        <div className="max-w-md rounded-2xl border border-white/20 bg-white/5 p-6 text-center">
          <p className="text-sm">{erro}</p>
          <Button asChild variant="secondary" className="mt-4">
            <Link to="/">
              <Home className="mr-2 h-4 w-4" /> Voltar ao início
            </Link>
          </Button>
        </div>
      </div>
    );
  }
  if (!ap) {
    return (
      <div className="grid min-h-screen place-items-center bg-black text-white">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const total = ap.slides.length;
  const slide = ap.slides[idx];

  return (
    <div ref={stageRef} className="fixed inset-0 bg-black">
      <ScaledSlide slide={slide} tema={ap.tema} className="h-full w-full" />

      {/* Controles */}
      <div
        className={`pointer-events-none absolute inset-0 flex flex-col justify-between p-3 transition-opacity duration-300 ${
          hideUi ? "opacity-0" : "opacity-100"
        }`}
      >
        <div className="pointer-events-auto flex items-center gap-2 self-end rounded-full bg-black/60 px-3 py-1 text-xs text-white backdrop-blur">
          <span>
            {idx + 1} / {total}
          </span>
          <span className="opacity-60">•</span>
          <span className="max-w-[240px] truncate">{ap.titulo}</span>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="ml-2 rounded-full p-1 hover:bg-white/10"
            aria-label="Tela cheia"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
          <Link
            to="/painel-apresentacoes/$id"
            params={{ id }}
            className="rounded-full p-1 hover:bg-white/10"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </Link>
        </div>

        <div className="pointer-events-auto flex items-center justify-center gap-3">
          <Button
            variant="secondary"
            size="icon"
            onClick={() => setIdx((i) => Math.max(i - 1, 0))}
            disabled={idx === 0}
            aria-label="Slide anterior"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            onClick={() => setIdx((i) => Math.min(i + 1, total - 1))}
            disabled={idx === total - 1}
            aria-label="Próximo slide"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
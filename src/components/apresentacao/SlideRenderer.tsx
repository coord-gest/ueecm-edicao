import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Slide, Tema } from "@/lib/apresentacoes";

const TEMA_BG: Record<Tema, string> = {
  institucional: "bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white",
  escuro: "bg-neutral-950 text-white",
  claro: "bg-white text-slate-900",
};

const TEMA_ACCENT: Record<Tema, string> = {
  institucional: "text-sky-300",
  escuro: "text-amber-300",
  claro: "text-indigo-600",
};

/**
 * Renderiza um slide em canvas fixo 1920x1080 e escala para caber no container pai.
 * O pai precisa ter `position: relative` e `overflow: hidden`.
 */
export function ScaledSlide({
  slide,
  tema,
  className = "",
}: {
  slide: Slide;
  tema: Tema;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const recalc = () => {
      const { width, height } = el.getBoundingClientRect();
      const s = Math.min(width / 1920, height / 1080);
      setScale(s > 0 ? s : 0.3);
    };
    recalc();
    const ro = new ResizeObserver(recalc);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={containerRef} className={`relative overflow-hidden ${TEMA_BG[tema]} ${className}`}>
      <div
        className="apresentacao-slide absolute left-1/2 top-1/2"
        style={{
          width: 1920,
          height: 1080,
          marginLeft: -960,
          marginTop: -540,
          transform: `scale(${scale})`,
          transformOrigin: "center center",
        }}
      >
        <SlideContent slide={slide} tema={tema} />
      </div>
    </div>
  );
}

function SlideContent({ slide, tema }: { slide: Slide; tema: Tema }) {
  const accent = TEMA_ACCENT[tema];
  const wrap = (children: ReactNode) => (
    <div className="flex h-full w-full flex-col justify-center px-32 py-24">{children}</div>
  );

  switch (slide.kind) {
    case "titulo":
      return wrap(
        <div className="flex flex-col items-start gap-8">
          {slide.kicker ? (
            <div className={`slide-kicker font-semibold ${accent}`}>{slide.kicker}</div>
          ) : null}
          <h1 className="slide-title-lg font-bold">{slide.titulo}</h1>
          {slide.subtitulo ? (
            <p className="slide-subtitle max-w-[1400px] opacity-80">{slide.subtitulo}</p>
          ) : null}
        </div>,
      );

    case "texto":
      return wrap(
        <div className="flex flex-col gap-10">
          {slide.titulo ? <h2 className="slide-title font-bold">{slide.titulo}</h2> : null}
          {slide.corpo ? (
            <p className="slide-body-lg max-w-[1500px] whitespace-pre-wrap opacity-90">
              {slide.corpo}
            </p>
          ) : null}
          {slide.bullets?.length ? (
            <ul className="flex list-disc flex-col gap-5 pl-16">
              {slide.bullets.map((b, i) => (
                <li key={i} className="slide-body max-w-[1500px]">
                  {b}
                </li>
              ))}
            </ul>
          ) : null}
        </div>,
      );

    case "imagem":
      return (
        <div className="flex h-full w-full flex-col items-center justify-center p-16">
          {slide.url ? (
            <img
              src={slide.url}
              alt={slide.alt ?? slide.legenda ?? ""}
              className="max-h-[86%] max-w-full rounded-3xl object-contain shadow-2xl"
            />
          ) : (
            <div className="grid h-2/3 w-2/3 place-items-center rounded-3xl border-4 border-dashed border-white/30">
              <span className="slide-body opacity-60">Imagem ainda não enviada</span>
            </div>
          )}
          {slide.legenda ? (
            <p className="slide-caption mt-6 max-w-[1400px] text-center opacity-80">
              {slide.legenda}
            </p>
          ) : null}
        </div>
      );

    case "imagemTexto": {
      const dir = slide.posicao === "direita" ? "flex-row-reverse" : "flex-row";
      return (
        <div className={`flex h-full w-full items-center gap-16 p-24 ${dir}`}>
          <div className="flex h-full w-1/2 items-center justify-center">
            {slide.url ? (
              <img
                src={slide.url}
                alt={slide.titulo ?? ""}
                className="max-h-full max-w-full rounded-3xl object-cover shadow-2xl"
              />
            ) : (
              <div className="grid h-full w-full place-items-center rounded-3xl border-4 border-dashed border-white/30">
                <span className="slide-caption opacity-60">Sem imagem</span>
              </div>
            )}
          </div>
          <div className="flex w-1/2 flex-col gap-8">
            {slide.titulo ? <h2 className="slide-title font-bold">{slide.titulo}</h2> : null}
            {slide.corpo ? (
              <p className="slide-body whitespace-pre-wrap opacity-90">{slide.corpo}</p>
            ) : null}
          </div>
        </div>
      );
    }

    case "citacao":
      return wrap(
        <div className="flex flex-col items-start gap-10">
          <span className={`text-[220px] font-serif leading-none ${accent}`}>“</span>
          <p className="slide-title-lg max-w-[1600px] font-medium italic">{slide.frase}</p>
          {slide.autor ? <p className={`slide-subtitle ${accent}`}>— {slide.autor}</p> : null}
        </div>,
      );

    case "estatistica": {
      const cols =
        slide.itens.length >= 3 ? "grid-cols-3" : slide.itens.length === 2 ? "grid-cols-2" : "grid-cols-1";
      return wrap(
        <div className="flex flex-col gap-14">
          {slide.titulo ? <h2 className="slide-title font-bold">{slide.titulo}</h2> : null}
          <div className={`grid ${cols} gap-10`}>
            {slide.itens.slice(0, 3).map((it, i) => (
              <div
                key={i}
                className="rounded-3xl bg-white/10 p-14 text-center backdrop-blur"
              >
                <div
                  className={`text-[180px] font-bold leading-none tracking-tight ${accent}`}
                >
                  {it.valor}
                </div>
                <div className="slide-body mt-6 opacity-90">{it.descricao}</div>
              </div>
            ))}
          </div>
        </div>,
      );
    }
  }
}

export function slideResumo(slide: Slide): string {
  switch (slide.kind) {
    case "titulo":
      return slide.titulo || "Título";
    case "texto":
      return slide.titulo || slide.bullets?.[0] || slide.corpo?.slice(0, 40) || "Texto";
    case "imagem":
      return slide.legenda || "Imagem";
    case "imagemTexto":
      return slide.titulo || "Imagem + texto";
    case "citacao":
      return slide.frase.slice(0, 40) || "Citação";
    case "estatistica":
      return slide.titulo || "Estatística";
  }
}

export const SLIDE_KINDS: { value: Slide["kind"]; label: string }[] = [
  { value: "titulo", label: "Título" },
  { value: "texto", label: "Texto / Tópicos" },
  { value: "imagem", label: "Imagem" },
  { value: "imagemTexto", label: "Imagem + Texto" },
  { value: "citacao", label: "Citação" },
  { value: "estatistica", label: "Estatística" },
];
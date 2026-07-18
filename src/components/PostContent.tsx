import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  html: string;
  className?: string;
}

interface LightboxState {
  items: Array<{ src: string; alt: string }>;
  index: number;
}

interface VideoLightboxState {
  src: string;
  title?: string;
}

function withAutoplay(src: string): string {
  try {
    const url = new URL(src, window.location.href);
    url.searchParams.set("autoplay", "1");
    if (url.hostname.includes("youtube")) url.searchParams.set("rel", "0");
    return url.toString();
  } catch {
    return src + (src.includes("?") ? "&" : "?") + "autoplay=1";
  }
}

const PLACEHOLDER_SVG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 640 360'><rect width='100%' height='100%' fill='#e5e7eb'/><g fill='#6b7280' font-family='sans-serif' text-anchor='middle'><text x='50%' y='48%' font-size='22'>Mídia indisponível</text><text x='50%' y='60%' font-size='14'>Não foi possível carregar este item.</text></g></svg>`,
  );

/**
 * Renders sanitized post HTML and progressively enhances media carousels:
 * - 1 item at a time, autoplay 3s, pauses on hover/focus/touch
 * - Keyboard navigation (← → Home End) with visible focus
 * - Click image → fullscreen lightbox (ESC / click fora / botão fecha)
 * - YouTube autoplay-safe: mudança de slide pausa vídeo anterior
 * - Placeholder gracioso para URLs de mídia inválidas
 */
export function PostContent({ html, className }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const [videoLightbox, setVideoLightbox] = useState<VideoLightboxState | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const cleanups: Array<() => void> = [];
    const carousels = Array.from(root.querySelectorAll<HTMLElement>(".media-carousel"));

    carousels.forEach((carousel) => {
      const track = carousel.querySelector<HTMLElement>(".media-carousel-track");
      if (!track) return;
      const items = Array.from(track.querySelectorAll<HTMLElement>(".media-carousel-item"));
      if (items.length === 0) return;

      const isImages = carousel.getAttribute("data-type") === "images";
      const isVideos = carousel.getAttribute("data-type") === "videos";

      // --- Error handling: broken images/iframes get a placeholder ---
      items.forEach((item) => {
        const img = item.querySelector<HTMLImageElement>("img");
        if (img) {
          const setBg = () => {
            if (img.src) item.style.setProperty("--bg-img", `url("${img.src}")`);
          };
          if (img.complete) setBg();
          else img.addEventListener("load", setBg);
          const onErr = () => {
            img.src = PLACEHOLDER_SVG;
            img.setAttribute("data-broken", "true");
            img.style.cursor = "default";
            item.style.removeProperty("--bg-img");
          };
          img.addEventListener("error", onErr);
          cleanups.push(() => {
            img.removeEventListener("error", onErr);
            img.removeEventListener("load", setBg);
          });
          if (!img.getAttribute("src")) onErr();
        }
        const iframe = item.querySelector("iframe");
        if (iframe && !iframe.getAttribute("src")) {
          iframe.replaceWith(makePlaceholder());
        }
      });

      // Collect lightbox items (only valid images)
      const imageList: Array<{ src: string; alt: string; el: HTMLImageElement }> = [];
      if (isImages) {
        items.forEach((item) => {
          const img = item.querySelector<HTMLImageElement>("img");
          if (!img || img.getAttribute("data-broken") === "true") return;
          imageList.push({ src: img.src, alt: img.alt || "", el: img });
        });
        imageList.forEach((entry, i) => {
          entry.el.style.cursor = "zoom-in";
          entry.el.setAttribute("role", "button");
          entry.el.setAttribute("tabindex", "0");
          entry.el.setAttribute("aria-label", "Abrir imagem em tela cheia");
          const open = () =>
            setLightbox({ items: imageList.map(({ src, alt }) => ({ src, alt })), index: i });
          const onClick = () => open();
          const onKey = (e: KeyboardEvent) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              open();
            }
          };
          entry.el.addEventListener("click", onClick);
          entry.el.addEventListener("keydown", onKey);
          cleanups.push(() => {
            entry.el.removeEventListener("click", onClick);
            entry.el.removeEventListener("keydown", onKey);
          });
        });
      }

      if (items.length <= 1) return;

      // --- Controls ---
      const prev = document.createElement("button");
      prev.type = "button";
      prev.setAttribute("aria-label", "Slide anterior");
      prev.className = "media-carousel-btn media-carousel-btn-prev";
      prev.innerHTML = "‹";
      const next = document.createElement("button");
      next.type = "button";
      next.setAttribute("aria-label", "Próximo slide");
      next.className = "media-carousel-btn media-carousel-btn-next";
      next.innerHTML = "›";
      const dots = document.createElement("div");
      dots.className = "media-carousel-dots";
      items.forEach((_, i) => {
        const d = document.createElement("button");
        d.type = "button";
        d.setAttribute("aria-label", `Ir para slide ${i + 1}`);
        d.className = "media-carousel-dot";
        d.dataset.index = String(i);
        dots.appendChild(d);
      });
      carousel.appendChild(prev);
      carousel.appendChild(next);
      carousel.appendChild(dots);

      // Make carousel focusable for keyboard nav
      carousel.setAttribute("tabindex", "0");
      carousel.setAttribute("role", "region");
      carousel.setAttribute("aria-roledescription", "carrossel");

      let current = 0;
      const pauseYouTube = (item: HTMLElement) => {
        const iframe = item.querySelector<HTMLIFrameElement>("iframe");
        if (!iframe) return;
        try {
          iframe.contentWindow?.postMessage(
            JSON.stringify({ event: "command", func: "pauseVideo", args: [] }),
            "*",
          );
          // Vimeo
          iframe.contentWindow?.postMessage({ method: "pause" }, "*");
        } catch {
          /* cross-origin ignored */
        }
      };
      const goTo = (i: number, smooth = true) => {
        const nextIndex = (i + items.length) % items.length;
        if (isVideos && nextIndex !== current) pauseYouTube(items[current]);
        current = nextIndex;
        const target = items[current];
        track.scrollTo({
          left: target.offsetLeft - track.offsetLeft,
          behavior: smooth ? "smooth" : "auto",
        });
        Array.from(dots.children).forEach((el, idx) => {
          (el as HTMLElement).classList.toggle("is-active", idx === current);
        });
      };
      goTo(0, false);

      // --- Autoplay ---
      let timer: ReturnType<typeof setInterval> | null = null;
      let userPaused = false;
      const start = () => {
        if (timer || userPaused) return;
        timer = setInterval(() => goTo(current + 1), isVideos ? 5000 : 3000);
      };
      const stop = () => {
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
      };
      const withRestart = (fn: () => void) => () => {
        stop();
        fn();
        start();
      };

      const onPrev = withRestart(() => goTo(current - 1));
      const onNext = withRestart(() => goTo(current + 1));
      prev.addEventListener("click", onPrev);
      next.addEventListener("click", onNext);

      const dotHandlers: Array<() => void> = [];
      Array.from(dots.children).forEach((el) => {
        const h = withRestart(() => goTo(Number((el as HTMLElement).dataset.index)));
        el.addEventListener("click", h);
        dotHandlers.push(() => el.removeEventListener("click", h));
      });

      // Keyboard on the carousel region
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          onPrev();
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          onNext();
        } else if (e.key === "Home") {
          e.preventDefault();
          withRestart(() => goTo(0))();
        } else if (e.key === "End") {
          e.preventDefault();
          withRestart(() => goTo(items.length - 1))();
        }
      };
      carousel.addEventListener("keydown", onKey);

      // Pause on hover / focus / touch
      const pause = () => {
        userPaused = true;
        stop();
      };
      const resume = () => {
        userPaused = false;
        start();
      };
      carousel.addEventListener("mouseenter", pause);
      carousel.addEventListener("mouseleave", resume);
      carousel.addEventListener("focusin", pause);
      carousel.addEventListener("focusout", resume);
      carousel.addEventListener("touchstart", pause, { passive: true });
      carousel.addEventListener("touchend", () => setTimeout(resume, 2000), { passive: true });

      // Pause when carousel is off-screen
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => (e.isIntersecting ? start() : stop()));
        },
        { threshold: 0.25 },
      );
      io.observe(carousel);

      // For videos: overlay click → open fullscreen lightbox (carousel pauses globally)
      if (isVideos) {
        items.forEach((item) => {
          const iframe = item.querySelector<HTMLIFrameElement>("iframe");
          if (!iframe) return;
          // Prevent iframe from stealing pointer; overlay handles click
          const overlay = document.createElement("button");
          overlay.type = "button";
          overlay.className = "media-video-overlay";
          overlay.setAttribute("aria-label", "Assistir vídeo em tela cheia");
          overlay.innerHTML =
            '<span class="media-video-play" aria-hidden="true"><svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></span>';
          const onClick = (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            const src = iframe.getAttribute("src");
            if (!src) return;
            setVideoLightbox({ src, title: iframe.getAttribute("title") ?? undefined });
          };
          overlay.addEventListener("click", onClick);
          item.appendChild(overlay);
          cleanups.push(() => {
            overlay.removeEventListener("click", onClick);
            overlay.remove();
          });
        });
      }

      // Global pause/resume (used by video lightbox)
      const onPauseAll = () => pause();
      const onResumeAll = () => resume();
      document.addEventListener("carousel:pause-all", onPauseAll);
      document.addEventListener("carousel:resume-all", onResumeAll);
      cleanups.push(() => {
        document.removeEventListener("carousel:pause-all", onPauseAll);
        document.removeEventListener("carousel:resume-all", onResumeAll);
      });

      // Sync current on manual scroll (mobile swipe)
      let scrollTimeout: ReturnType<typeof setTimeout> | null = null;
      const onScroll = () => {
        if (scrollTimeout) clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          const w = track.clientWidth;
          const idx = Math.round(track.scrollLeft / w);
          if (idx !== current && idx >= 0 && idx < items.length) {
            current = idx;
            Array.from(dots.children).forEach((el, i) => {
              (el as HTMLElement).classList.toggle("is-active", i === current);
            });
          }
        }, 120);
      };
      track.addEventListener("scroll", onScroll, { passive: true });

      // Handle orientation change → recenter current slide
      const onResize = () => goTo(current, false);
      window.addEventListener("resize", onResize);
      window.addEventListener("orientationchange", onResize);

      start();

      cleanups.push(() => {
        stop();
        io.disconnect();
        prev.removeEventListener("click", onPrev);
        next.removeEventListener("click", onNext);
        carousel.removeEventListener("keydown", onKey);
        carousel.removeEventListener("mouseenter", pause);
        carousel.removeEventListener("mouseleave", resume);
        carousel.removeEventListener("focusin", pause);
        carousel.removeEventListener("focusout", resume);
        track.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onResize);
        window.removeEventListener("orientationchange", onResize);
        dotHandlers.forEach((fn) => fn());
        prev.remove();
        next.remove();
        dots.remove();
      });
    });

    return () => cleanups.forEach((fn) => fn());
  }, [html]);

  // Lightbox: scroll lock, ESC, arrows, focus trap on close button
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
      else if (e.key === "ArrowLeft")
        setLightbox((l) =>
          l ? { ...l, index: (l.index - 1 + l.items.length) % l.items.length } : l,
        );
      else if (e.key === "ArrowRight")
        setLightbox((l) => (l ? { ...l, index: (l.index + 1) % l.items.length } : l));
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtnRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [lightbox]);

  // Video lightbox: pauses all carousels while open, ESC/click fora fecham
  useEffect(() => {
    if (!videoLightbox) return;
    document.dispatchEvent(new CustomEvent("carousel:pause-all"));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setVideoLightbox(null);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      document.dispatchEvent(new CustomEvent("carousel:resume-all"));
    };
  }, [videoLightbox]);

  const current = lightbox ? lightbox.items[lightbox.index] : null;

  return (
    <>
      <div ref={rootRef} className={cn(className)} dangerouslySetInnerHTML={{ __html: html }} />
      {lightbox && current && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Imagem em tela cheia"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4 animate-fade-in"
          onClick={() => setLightbox(null)}
        >
          <button
            ref={closeBtnRef}
            type="button"
            aria-label="Fechar (Esc)"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-2xl text-white outline-none hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white"
            onClick={(e) => {
              e.stopPropagation();
              setLightbox(null);
            }}
          >
            ×
          </button>
          {lightbox.items.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Imagem anterior"
                className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-3xl text-white outline-none hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white sm:left-6"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightbox((l) =>
                    l ? { ...l, index: (l.index - 1 + l.items.length) % l.items.length } : l,
                  );
                }}
              >
                ‹
              </button>
              <button
                type="button"
                aria-label="Próxima imagem"
                className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-3xl text-white outline-none hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white sm:right-6"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightbox((l) => (l ? { ...l, index: (l.index + 1) % l.items.length } : l));
                }}
              >
                ›
              </button>
            </>
          )}
          <img
            src={current.src}
            alt={current.alt}
            className="max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = PLACEHOLDER_SVG;
            }}
          />
        </div>
      )}
      {videoLightbox && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Vídeo em tela cheia"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4 animate-fade-in"
          onClick={() => setVideoLightbox(null)}
        >
          <button
            type="button"
            aria-label="Fechar (Esc)"
            className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-2xl text-white outline-none hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white"
            onClick={(e) => {
              e.stopPropagation();
              setVideoLightbox(null);
            }}
          >
            ×
          </button>
          <div
            className="relative aspect-video w-full max-w-[min(1280px,calc(100vw-2rem))] max-h-[calc(100vh-4rem)]"
            onClick={(e) => e.stopPropagation()}
          >
            <iframe
              src={withAutoplay(videoLightbox.src)}
              title={videoLightbox.title ?? "Vídeo"}
              className="h-full w-full rounded-lg"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
            />
          </div>
        </div>
      )}
    </>
  );
}

function makePlaceholder(): HTMLElement {
  const div = document.createElement("div");
  div.className = "media-carousel-placeholder";
  div.setAttribute("role", "img");
  div.setAttribute("aria-label", "Mídia indisponível");
  div.textContent = "Mídia indisponível";
  return div;
}

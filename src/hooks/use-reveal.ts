import { useEffect, useRef } from "react";

export interface UseRevealOptions {
  /** Atraso em ms aplicado à transição (para efeito escalonado). */
  delay?: number;
}

/**
 * Scroll reveal: adiciona a classe `is-visible` quando o elemento entra
 * na viewport (uma única vez). Use com a utility CSS `reveal` do styles.css.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(
  options: UseRevealOptions = {},
) {
  const { delay = 0 } = options;
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof window === "undefined" || typeof IntersectionObserver === "undefined") return;

    // Se o usuário prefere menos movimento, revela imediatamente.
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      el.classList.add("is-visible");
      return;
    }

    if (delay > 0) {
      el.style.transitionDelay = `${delay}ms`;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -80px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [delay]);

  return ref;
}

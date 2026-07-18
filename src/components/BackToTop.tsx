import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Botão flutuante "voltar ao topo".
 * Aparece após o usuário rolar mais de 400px.
 */
export function BackToTop() {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onScroll = () => setVisivel(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      type="button"
      aria-label="Voltar ao topo"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={cn(
        "fixed bottom-20 right-4 z-40 inline-flex size-11 items-center justify-center rounded-full",
        "bg-primary text-primary-foreground shadow-lg ring-1 ring-border/40",
        "transition-all duration-200 hover:scale-105 hover:bg-primary/90",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "sm:bottom-6 sm:right-6",
        visivel ? "opacity-100" : "pointer-events-none opacity-0 translate-y-2",
      )}
    >
      <ArrowUp className="size-5" />
    </button>
  );
}

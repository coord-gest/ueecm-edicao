import { useEffect, useState } from "react";
import { PresentationMode, type PresentationSection } from "./PresentationMode";

interface Props {
  /** Seletor CSS para os "slides". Padrão: `main section`. */
  selector?: string;
  autoPlayMs?: number;
}

/**
 * Detecta automaticamente seções da página e habilita o Modo Apresentação
 * sem exigir que cada rota atribua `id`s manualmente. Cada elemento que
 * corresponde ao seletor recebe um `id` gerado (se não tiver) e o texto do
 * primeiro heading (h1-h3) é usado como rótulo.
 */
export function AutoPresentationMode({
  selector = "main section, main > article, main > div[data-slide]",
  autoPlayMs = 0,
}: Props) {
  const [sections, setSections] = useState<PresentationSection[]>([]);

  useEffect(() => {
    // Aguarda um frame para o DOM da rota estar montado.
    const raf = requestAnimationFrame(() => {
      const nodes = Array.from(document.querySelectorAll<HTMLElement>(selector));
      const found: PresentationSection[] = [];
      nodes.forEach((el, idx) => {
        // Ignora elementos escondidos.
        if (el.offsetParent === null && el.getClientRects().length === 0) return;
        if (!el.id) el.id = `slide-${idx + 1}`;
        const label =
          el.getAttribute("data-slide-label") ||
          el.querySelector("h1, h2, h3")?.textContent?.trim() ||
          `Seção ${idx + 1}`;
        found.push({ id: el.id, label: label.slice(0, 80) });
      });
      setSections(found);
    });
    return () => cancelAnimationFrame(raf);
  }, [selector]);

  if (sections.length < 2) return null;
  return <PresentationMode sections={sections} autoPlayMs={autoPlayMs} />;
}

export default AutoPresentationMode;
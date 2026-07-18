// Utilitários de leitura: tempo estimado e extração de sumário (TOC).

export interface TocItem {
  id: string;
  text: string;
  level: 2 | 3;
}

/** Calcula tempo de leitura em minutos (200 palavras/min). */
export function calcularTempoLeitura(html: string | null | undefined): number {
  if (!html) return 1;
  const texto = html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const palavras = texto ? texto.split(" ").length : 0;
  return Math.max(1, Math.ceil(palavras / 200));
}

/** Normaliza string para slug ASCII estável. */
export function slugify(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

/**
 * Extrai H2/H3 do HTML e injeta `id` em cada heading.
 * Retorna o HTML modificado + lista de itens do TOC.
 */
export function extrairTOC(html: string): { html: string; toc: TocItem[] } {
  if (typeof window === "undefined" || !html) {
    // SSR: usa regex simples para gerar ids sem mutar nada
    const toc: TocItem[] = [];
    const seen = new Set<string>();
    const out = html.replace(/<(h[23])([^>]*)>([\s\S]*?)<\/\1>/gi, (_m, tag, attrs, inner) => {
      const text = inner.replace(/<[^>]+>/g, "").trim();
      if (!text) return _m;
      let id = slugify(text);
      let i = 2;
      while (seen.has(id)) id = `${slugify(text)}-${i++}`;
      seen.add(id);
      toc.push({ id, text, level: tag.toLowerCase() === "h2" ? 2 : 3 });
      const cleanAttrs = String(attrs).replace(/\sid="[^"]*"/i, "");
      return `<${tag}${cleanAttrs} id="${id}">${inner}</${tag}>`;
    });
    return { html: out, toc };
  }

  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild as HTMLElement;
  const headings = root.querySelectorAll("h2, h3");
  const toc: TocItem[] = [];
  const seen = new Set<string>();
  headings.forEach((h) => {
    const text = (h.textContent ?? "").trim();
    if (!text) return;
    let id = slugify(text);
    let i = 2;
    while (seen.has(id)) id = `${slugify(text)}-${i++}`;
    seen.add(id);
    h.setAttribute("id", id);
    toc.push({ id, text, level: h.tagName === "H2" ? 2 : 3 });
  });
  return { html: root.innerHTML, toc };
}

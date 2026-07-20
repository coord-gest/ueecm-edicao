import { useEffect, useState } from "react";
import { List } from "lucide-react";
import type { TocItem } from "@/lib/reading";
import { cn } from "@/lib/utils";

interface Props {
  items: TocItem[];
  variant?: "inline" | "sidebar";
}

/** Sumário lateral com indicador de seção ativa via IntersectionObserver. */
export function TableOfContents({ items, variant = "inline" }: Props) {
  const [activeId, setActiveId] = useState<string | null>(items[0]?.id ?? null);

  useEffect(() => {
    if (items.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 },
    );
    items.forEach((item) => {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [items]);

  if (items.length < 2) return null;

  return (
    <nav
      aria-label="Sumário do artigo"
      className={cn(
        "not-prose rounded-2xl border border-border/70 bg-card/50 p-4",
        variant === "inline" && "my-6",
        variant === "sidebar" && "max-h-[calc(100dvh-8rem)] overflow-y-auto",
      )}
    >
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
        <List className="size-4" /> Neste artigo
      </div>
      <ul className="space-y-1.5 text-sm">
        {items.map((item) => (
          <li key={item.id} className={cn(item.level === 3 && "pl-4")}>
            <a
              href={`#${item.id}`}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(item.id)?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                });
                history.replaceState(null, "", `#${item.id}`);
              }}
              className={cn(
                "block rounded-md px-2 py-1 transition-colors",
                activeId === item.id
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

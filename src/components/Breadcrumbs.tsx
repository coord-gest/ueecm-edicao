import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { Fragment } from "react";

export type Crumb = { label: string; to?: string };

export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center gap-1 text-xs text-muted-foreground ${className ?? ""}`}
    >
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((it, i) => {
          const last = i === items.length - 1;
          return (
            <Fragment key={`${it.label}-${i}`}>
              <li className="min-w-0">
                {it.to && !last ? (
                  <Link
                    to={it.to}
                    className="truncate rounded px-1 py-0.5 hover:bg-accent hover:text-accent-foreground"
                  >
                    {it.label}
                  </Link>
                ) : (
                  <span
                    aria-current={last ? "page" : undefined}
                    className={last ? "font-medium text-foreground" : ""}
                  >
                    {it.label}
                  </span>
                )}
              </li>
              {!last && <ChevronRight className="size-3 shrink-0 opacity-60" aria-hidden="true" />}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}

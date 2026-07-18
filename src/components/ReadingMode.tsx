import { useEffect, useState } from "react";
import { Contrast, Minus, Plus, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const FONT_KEY = "reading.fontSize";
const CONTRAST_KEY = "reading.highContrast";

type Size = "sm" | "md" | "lg" | "xl";

const SIZES: Size[] = ["sm", "md", "lg", "xl"];

const SIZE_CLASSES: Record<Size, string> = {
  sm: "prose-base",
  md: "prose-lg",
  lg: "prose-xl",
  xl: "prose-2xl",
};

/**
 * Hook que devolve classes do `prose` para aplicar no artigo,
 * baseado nas preferências do leitor salvas em localStorage.
 */
export function useReadingMode() {
  const [size, setSize] = useState<Size>("md");
  const [highContrast, setHighContrast] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const s = window.localStorage.getItem(FONT_KEY) as Size | null;
      if (s && SIZES.includes(s)) setSize(s);
      setHighContrast(window.localStorage.getItem(CONTRAST_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  const persist = (next: { size?: Size; highContrast?: boolean }) => {
    try {
      if (next.size) window.localStorage.setItem(FONT_KEY, next.size);
      if (typeof next.highContrast === "boolean") {
        window.localStorage.setItem(CONTRAST_KEY, next.highContrast ? "1" : "0");
      }
    } catch {
      /* ignore */
    }
  };

  const aumentar = () => {
    const i = SIZES.indexOf(size);
    if (i < SIZES.length - 1) {
      const next = SIZES[i + 1];
      setSize(next);
      persist({ size: next });
    }
  };
  const diminuir = () => {
    const i = SIZES.indexOf(size);
    if (i > 0) {
      const next = SIZES[i - 1];
      setSize(next);
      persist({ size: next });
    }
  };
  const toggleContraste = () => {
    const next = !highContrast;
    setHighContrast(next);
    persist({ highContrast: next });
  };

  const articleClass = cn(SIZE_CLASSES[size], highContrast && "reading-high-contrast");

  return { size, highContrast, aumentar, diminuir, toggleContraste, articleClass };
}

/**
 * Toolbar discreta para o leitor controlar fonte e contraste.
 */
export function ReadingModeToolbar({
  aumentar,
  diminuir,
  toggleContraste,
  highContrast,
  size,
  className,
}: {
  aumentar: () => void;
  diminuir: () => void;
  toggleContraste: () => void;
  highContrast: boolean;
  size: Size;
  className?: string;
}) {
  const minimo = size === "sm";
  const maximo = size === "xl";
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-border/60 bg-card/80 p-1 shadow-sm",
        className,
      )}
      role="group"
      aria-label="Modo de leitura"
    >
      <Type className="ml-2 size-4 text-muted-foreground" aria-hidden="true" />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 rounded-full"
        onClick={diminuir}
        disabled={minimo}
        aria-label="Diminuir fonte"
      >
        <Minus className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 rounded-full"
        onClick={aumentar}
        disabled={maximo}
        aria-label="Aumentar fonte"
      >
        <Plus className="size-4" />
      </Button>
      <Button
        type="button"
        variant={highContrast ? "default" : "ghost"}
        size="icon"
        className="size-8 rounded-full"
        onClick={toggleContraste}
        aria-pressed={highContrast}
        aria-label="Alternar alto contraste"
      >
        <Contrast className="size-4" />
      </Button>
    </div>
  );
}

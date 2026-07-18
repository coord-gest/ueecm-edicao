import type { NoteColor } from "@/lib/notes-reminders.functions";

/**
 * Mapeamento cor semântica → classes Tailwind sobre tokens do design system.
 * Sem cores hardcoded — usa apenas variantes já existentes no tema.
 */
export const NOTE_COLOR_CLASSES: Record<
  NoteColor,
  { border: string; badge: string; label: string }
> = {
  default: {
    border: "border-l-border",
    badge: "bg-muted text-muted-foreground",
    label: "Padrão",
  },
  amber: {
    border: "border-l-amber-500",
    badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    label: "Âmbar",
  },
  rose: {
    border: "border-l-rose-500",
    badge: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    label: "Rosa",
  },
  sky: {
    border: "border-l-sky-500",
    badge: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    label: "Azul",
  },
  violet: {
    border: "border-l-violet-500",
    badge: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    label: "Violeta",
  },
  emerald: {
    border: "border-l-emerald-500",
    badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    label: "Verde",
  },
};

export const NOTE_COLORS: NoteColor[] = ["default", "amber", "rose", "sky", "violet", "emerald"];

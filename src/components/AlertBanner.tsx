import { useEffect, useMemo, useState } from "react";
import {
  X,
  Info,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { uniqueRealtimeChannelName } from "@/lib/realtime-channel";

type Variant = "info" | "success" | "warning" | "destructive";

type AlertRow = {
  id: string;
  message: string;
  link_url: string | null;
  link_label: string | null;
  image_url: string | null;
  variant: Variant;
  active: boolean;
  expires_at: string | null;
  starts_at: string | null;
  daily_start_time: string | null;
  daily_end_time: string | null;
  created_at: string;
};

const STORAGE_KEY = "ecm.alerts.dismissed.v1";

function readDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeDismissed(ids: Set<string>) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    /* ignore */
  }
}

const variantStyles: Record<
  Variant,
  { ring: string; accent: string; iconBg: string; icon: typeof Info; label: string }
> = {
  info: {
    ring: "ring-sky-500/30",
    accent: "from-sky-500/15 to-transparent",
    iconBg: "bg-sky-500/15 text-sky-600 dark:text-sky-300",
    icon: Info,
    label: "Informação",
  },
  success: {
    ring: "ring-emerald-500/30",
    accent: "from-emerald-500/15 to-transparent",
    iconBg: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
    icon: CheckCircle2,
    label: "Sucesso",
  },
  warning: {
    ring: "ring-amber-500/30",
    accent: "from-amber-500/15 to-transparent",
    iconBg: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
    icon: AlertTriangle,
    label: "Aviso",
  },
  destructive: {
    ring: "ring-red-500/30",
    accent: "from-red-500/15 to-transparent",
    iconBg: "bg-red-500/15 text-red-600 dark:text-red-300",
    icon: AlertOctagon,
    label: "Urgente",
  },
};

function isExternal(url: string) {
  return /^https?:\/\//i.test(url);
}

function parseTimeToMinutes(t: string | null): number | null {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function isWithinSchedule(a: AlertRow, now: Date): boolean {
  if (a.starts_at && new Date(a.starts_at) > now) return false;
  if (a.expires_at && new Date(a.expires_at) <= now) return false;

  const start = parseTimeToMinutes(a.daily_start_time);
  const end = parseTimeToMinutes(a.daily_end_time);
  if (start === null && end === null) return true;

  const minutes = now.getHours() * 60 + now.getMinutes();
  const s = start ?? 0;
  const e = end ?? 24 * 60;
  // Janela normal
  if (s <= e) return minutes >= s && minutes <= e;
  // Cruza meia-noite (ex.: 22:00 -> 06:00)
  return minutes >= s || minutes <= e;
}

export function AlertBanner() {
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(() => readDismissed());
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const { data } = await supabase
        .from("alerts")
        .select(
          "id, message, link_url, link_label, image_url, variant, active, expires_at, starts_at, daily_start_time, daily_end_time, created_at",
        )
        .eq("active", true)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order("created_at", { ascending: false });
      if (active && data) setAlerts(data as AlertRow[]);
    };

    load();

    const channel = supabase
      .channel(uniqueRealtimeChannelName("alerts-public"))
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, () => load())
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const visible = useMemo(
    () => alerts.filter((a) => !dismissed.has(a.id) && isWithinSchedule(a, new Date(now))),
    [alerts, dismissed, now],
  );

  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (index >= visible.length) setIndex(0);
  }, [visible.length, index]);

  useEffect(() => {
    if (visible.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss(visible[index]?.id);
      if (e.key === "ArrowRight") setIndex((i) => (i + 1) % visible.length);
      if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + visible.length) % visible.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, index]);

  if (visible.length === 0) return null;

  const dismiss = (id: string) => {
    const next = new Set(dismissed);
    next.add(id);
    setDismissed(next);
    writeDismissed(next);
  };

  const current = visible[Math.min(index, visible.length - 1)];
  const v = variantStyles[current.variant];
  const Icon = v.icon;
  const external = current.link_url ? isExternal(current.link_url) : false;
  const hasMany = visible.length > 1;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Alertas"
    >
      <div
        className="absolute inset-0 bg-background/70 backdrop-blur-sm"
        onClick={() => dismiss(current.id)}
        aria-hidden
      />
      <div className="relative w-full max-w-md sm:max-w-lg md:max-w-xl">
        {/* Stacked card hint behind */}
        {hasMany && (
          <>
            <div className="pointer-events-none absolute inset-x-6 -bottom-2 h-4 rounded-2xl bg-card/60 ring-1 ring-border shadow-lg" />
            <div className="pointer-events-none absolute inset-x-10 -bottom-4 h-4 rounded-2xl bg-card/40 ring-1 ring-border shadow-md" />
          </>
        )}

        <div
          key={current.id}
          role="alert"
          className={cn(
            "relative overflow-hidden rounded-2xl bg-card text-card-foreground shadow-2xl ring-1 ring-border",
            "animate-in fade-in zoom-in-95 duration-200",
            v.ring,
          )}
        >
          <div
            className={cn(
              "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-80",
              v.accent,
            )}
            aria-hidden
          />

          <button
            type="button"
            onClick={() => dismiss(current.id)}
            aria-label="Fechar alerta"
            className="absolute right-3 top-3 z-10 inline-flex size-8 items-center justify-center rounded-full bg-background/60 text-muted-foreground transition hover:bg-background hover:text-foreground"
          >
            <X className="size-4" />
          </button>

          <div className="relative flex max-h-[85vh] flex-col gap-4 p-5 sm:flex-row sm:p-6">
            <div
              className={cn(
                "flex size-12 shrink-0 items-center justify-center rounded-xl",
                v.iconBg,
              )}
            >
              <Icon className="size-6" aria-hidden />
            </div>

            <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {v.label}
                </span>
                {hasMany && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {index + 1}/{visible.length}
                  </span>
                )}
              </div>

              <div className="-mr-2 flex-1 overflow-y-auto pr-2 [scrollbar-width:thin]">
                <div className="flex flex-col gap-3">
                  {current.image_url && (
                    <img
                      src={current.image_url}
                      alt=""
                      loading="lazy"
                      className="w-full rounded-lg border border-border object-contain"
                    />
                  )}

                  <p className="whitespace-pre-wrap break-words text-base font-medium leading-relaxed text-foreground sm:text-lg">
                    {current.message}
                  </p>
                </div>
              </div>

              <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
                {current.link_url ? (
                  <a
                    href={current.link_url}
                    target={external ? "_blank" : undefined}
                    rel={external ? "noopener noreferrer" : undefined}
                    onClick={() => dismiss(current.id)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90"
                  >
                    {current.link_label || "Saiba mais"}
                    {external && <ExternalLink className="size-3.5" aria-hidden />}
                  </a>
                ) : (
                  <span />
                )}

                {hasMany && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setIndex((i) => (i - 1 + visible.length) % visible.length)}
                      aria-label="Alerta anterior"
                      className="inline-flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                    >
                      <ChevronLeft className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIndex((i) => (i + 1) % visible.length)}
                      aria-label="Próximo alerta"
                      className="inline-flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                    >
                      <ChevronRight className="size-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

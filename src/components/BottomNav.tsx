import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home,
  Newspaper,
  Calendar,
  Clock,
  CalendarPlus,
  LayoutDashboard,
  LogIn,
} from "lucide-react";
import { useAuth } from "@/lib/use-auth";
import { cn } from "@/lib/utils";

const items = [
  { label: "Início", to: "/", icon: Home },
  { label: "Posts", to: "/posts", icon: Newspaper },
  { label: "Calendário", to: "/calendario", icon: Calendar },
  { label: "Horários", to: "/horarios", icon: Clock },
  { label: "Agendar", to: "/agendar", icon: CalendarPlus },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, loading } = useAuth();

  const last = loading
    ? null
    : user
      ? { label: "Painel", to: "/painel" as const, icon: LayoutDashboard }
      : { label: "Entrar", to: "/login" as const, icon: LogIn };

  const all = last ? [...items, last] : [...items];

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border/60 bg-background/95 backdrop-blur-lg md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-between px-1 gap-0.5">
        {all.map(({ label, to, icon: Icon }) => {
          const active =
            to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(`${to}/`);
          return (
            <li key={to} className="min-w-0 flex-1">
              <Link
                to={to}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-primary",
                )}
              >
                <Icon
                  className={cn("size-[18px] transition-transform", active && "scale-110")}
                  strokeWidth={active ? 2.4 : 2}
                />
                <span className="w-full truncate text-center">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

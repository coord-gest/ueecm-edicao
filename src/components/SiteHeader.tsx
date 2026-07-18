import { Link, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, LogIn, LayoutDashboard, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/lib/use-auth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components/NotificationBell";
import { PushSubscribeButton } from "@/components/PushSubscribeButton";
import { BottomNav } from "@/components/BottomNav";
import { OfflineBanner } from "@/components/OfflineBanner";
import logo from "@/assets/logo.png";
import { cn } from "@/lib/utils";

const nav = [
  { label: "Início", to: "/" },
  { label: "Sobre", to: "/sobre" },
  { label: "Publicações", to: "/posts" },

  { label: "Equipe", to: "/equipe" },
  { label: "Calendário", to: "/calendario" },
  { label: "Horários", to: "/horarios" },
  { label: "Agendar", to: "/agendar" },
];

const desktopNav = nav.filter((item) => !["/sobre", "/agendar"].includes(item.to));

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, loading } = useAuth();

  return (
    <>
      <OfflineBanner />
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/85 backdrop-blur-lg">

        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:h-18 sm:px-6 lg:gap-4 lg:px-8">
          <Link to="/" className="flex min-w-0 items-center gap-2 sm:gap-3 xl:shrink">
            <img
              src={logo}
              alt="Brasão U.E. Evaristo Campelo de Matos"
              className="size-11 shrink-0 sm:size-12 xl:size-14"
              width={48}
              height={48}
            />
            <span className="truncate border-y-2 border-primary px-2 py-1 font-display text-xs font-bold tracking-tight text-primary sm:text-sm xl:text-base 2xl:whitespace-nowrap 2xl:text-xl dark:text-foreground">
              U.E. Evaristo Campelo de Matos
            </span>
          </Link>

          <nav className="hidden min-w-0 flex-1 items-center justify-between gap-2 xl:flex">
            <div className="flex flex-1 items-center justify-between gap-1">
              {desktopNav.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground",
                    pathname === item.to && "text-primary",
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <ThemeToggle className="ml-1 rounded-full" />
              <NotificationBell />
              <PushSubscribeButton className="ml-1 rounded-full" />
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="ml-1 rounded-full"
                aria-label="Configurações"
              >
                <Link to="/configuracoes">
                  <Settings className="size-4" />
                </Link>
              </Button>
              {loading ? (
                <div
                  className="ml-1 h-9 w-24 animate-pulse rounded-full bg-muted"
                  aria-hidden="true"
                />
              ) : (
                <Button asChild className="ml-1 rounded-full">
                  <Link to={user ? "/painel" : "/login"}>
                    {user ? <LayoutDashboard className="size-4" /> : <LogIn className="size-4" />}
                    {user ? "Painel" : "Entrar"}
                  </Link>
                </Button>
              )}
            </div>
          </nav>

          <div className="flex items-center gap-1 xl:hidden">
            <NotificationBell />
            <PushSubscribeButton className="rounded-full" />
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="rounded-full"
              aria-label="Configurações"
            >
              <Link to="/configuracoes">
                <Settings className="size-4" />
              </Link>
            </Button>
            <ThemeToggle className="rounded-full" />
            {/* Hamburger só em tablet — no mobile o BottomNav cuida da navegação */}
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <button
                  className="hidden rounded-full p-2 text-primary md:inline-flex"
                  aria-label="Abrir menu"
                >
                  <Menu className="size-6" />
                </button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="w-[85vw] max-w-sm sm:max-w-md p-0 flex flex-col"
              >
                <SheetHeader className="border-b border-border/60 px-5 py-4">
                  <SheetTitle className="flex items-center gap-2">
                    <img src={logo} alt="UEECM" className="h-10 w-auto" />
                    <span className="text-base font-bold">Menu</span>
                  </SheetTitle>
                </SheetHeader>
                <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-4 py-4">
                  {nav.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setOpen(false)}
                      className="rounded-lg px-4 py-3 text-sm font-medium text-foreground hover:bg-primary hover:text-primary-foreground"
                    >
                      {item.label}
                    </Link>
                  ))}
                  {loading ? (
                    <div
                      className="mt-2 h-11 animate-pulse rounded-lg bg-muted"
                      aria-hidden="true"
                    />
                  ) : (
                    <Button asChild className="mt-2 rounded-lg">
                      <Link to={user ? "/painel" : "/login"} onClick={() => setOpen(false)}>
                        {user ? (
                          <LayoutDashboard className="size-4" />
                        ) : (
                          <LogIn className="size-4" />
                        )}
                        {user ? "Ir para o painel" : "Entrar no painel"}
                      </Link>
                    </Button>
                  )}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
      <BottomNav />
    </>
  );
}

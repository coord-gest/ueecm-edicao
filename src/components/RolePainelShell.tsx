import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { useAuth } from "@/lib/use-auth";
import { roleLabels } from "@/lib/roles";

interface Props {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

/**
 * Casca visual comum a todos os painéis por perfil.
 * Renderiza header, saudação, badges de papéis e o conteúdo específico do painel.
 */
export function RolePainelShell({ title, subtitle, children }: Props) {
  const { user, roles, loading, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/", replace: true });
  };

  return (
    <>
      <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b border-border/60 bg-background/85 pl-14 pr-4 backdrop-blur-lg sm:pl-6 sm:pr-6">
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm font-semibold text-foreground sm:text-base">
            {title}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <ThemeToggle className="rounded-full" />
          <Link
            to="/"
            className="hidden h-9 items-center justify-center rounded-full px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground sm:inline-flex"
          >
            Ver blog
          </Link>
          <Button onClick={handleSignOut} variant="outline" size="sm" className="rounded-full">
            <LogOut className="size-4" /> <span className="hidden sm:inline">Sair</span>
          </Button>
        </div>
      </header>

      <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <Breadcrumbs className="mb-3" items={[{ label: "Início", to: "/" }, { label: title }]} />
          <div className="rounded-3xl border border-border/70 bg-card p-6 shadow-sm">
            <h1 className="font-display text-lg font-semibold leading-tight text-foreground break-all sm:text-xl">
              Olá,{" "}
              <span className="break-all font-medium">
                {user?.user_metadata?.display_name ?? user?.email}
              </span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{user?.email}</p>
            {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Shield className="size-4 text-primary" />
              {loading ? (
                <Skeleton className="h-5 w-36" />
              ) : roles.length === 0 ? (
                <span className="text-sm text-muted-foreground">Sem papéis atribuídos</span>
              ) : (
                roles.map((r) => (
                  <Badge
                    key={r}
                    variant={r === "admin" || r === "desenvolvedor" ? "default" : "secondary"}
                  >
                    {roleLabels[r]}
                  </Badge>
                ))
              )}
            </div>
          </div>

          <div className="mt-6 space-y-6">{children}</div>
        </div>
      </main>
    </>
  );
}

interface ShortcutCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  items: { label: string; to: string; icon?: ReactNode }[];
}

export function ShortcutSection({ title, description, icon, items }: ShortcutCardProps) {
  return (
    <div className="rounded-3xl border border-border/70 bg-card p-6 shadow-sm">
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
        {icon} {title}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {items.map((it) => (
          <Button key={it.to} asChild variant="outline" className="justify-start rounded-xl">
            <Link to={it.to} className="flex items-center gap-2">
              {it.icon}
              <span>{it.label}</span>
            </Link>
          </Button>
        ))}
      </div>
    </div>
  );
}

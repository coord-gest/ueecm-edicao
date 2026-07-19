import { Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, GraduationCap } from "lucide-react";
import type { ReactNode } from "react";
import { Breadcrumbs } from "@/components/Breadcrumbs";

export function EscolaShell({
  title,
  description,
  actions,
  current,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  current?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.history.back();
    } else {
      router.navigate({ to: "/escola" });
    }
  };
  return (
    <div className="min-h-dvh bg-secondary">
      <header className="border-b border-border/60 bg-background/85 backdrop-blur-lg">
        <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <GraduationCap className="size-6 shrink-0 text-primary" />
            <div className="min-w-0 leading-tight">
              <p className="truncate font-display text-base font-semibold text-primary sm:text-lg">
                {title}
              </p>
              {description && (
                <p className="hidden truncate text-xs text-muted-foreground sm:block">
                  {description}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-3 text-sm font-medium hover:bg-accent"
            aria-label="Voltar"
          >
            <ArrowLeft className="size-4" /> <span className="hidden sm:inline">Voltar</span>
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Breadcrumbs
          className="mb-3"
          items={[
            { label: "Painel", to: "/painel" },
            { label: "Escola", to: "/escola" },
            ...(current ? [{ label: current }] : []),
          ]}
        />
        {actions && <div className="mb-4 flex flex-wrap gap-2">{actions}</div>}
        {children}
      </main>
    </div>
  );
}

export function AccessDenied() {
  return (
    <div className="min-h-dvh grid place-items-center bg-secondary p-6">
      <div className="max-w-md rounded-3xl border border-border/70 bg-card p-8 text-center shadow-sm">
        <h1 className="font-display text-xl font-semibold text-foreground">Acesso restrito</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Apenas administração escolar (admin, diretor, coordenador, secretário) pode acessar esta
          área.
        </p>
        <Link to="/painel" className="mt-4 inline-block text-sm text-primary underline">
          Voltar ao painel
        </Link>
      </div>
    </div>
  );
}

export function useIsSchoolAdmin(hasRole: (r: import("@/lib/use-auth").AppRole) => boolean) {
  return (
    hasRole("desenvolvedor") ||
    hasRole("admin") ||
    hasRole("diretor") ||
    hasRole("coordenador") ||
    hasRole("secretario")
  );
}

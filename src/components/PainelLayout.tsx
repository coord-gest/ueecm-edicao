import type { ReactNode } from "react";
import { useAuth } from "@/lib/use-auth";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
  useIsInsideSidebarProvider,
} from "@/components/ui/sidebar";
import { PainelSidebar } from "@/components/PainelSidebar";

/**
 * Wrapper that keeps the painel sidebar persistent across all painel-* routes.
 *
 * Idempotent: if the component is already rendered inside a SidebarProvider
 * (e.g. the root-level fallback in __root.tsx), it just renders children so
 * we never nest two sidebars. This guarantees the sidebar stays visible even
 * on routes that forget to wrap themselves explicitly.
 */
export function PainelLayout({ children }: { children: ReactNode }) {
  const alreadyWrapped = useIsInsideSidebarProvider();
  const { user, loading } = useAuth();

  if (alreadyWrapped) return <>{children}</>;
  // Unauthenticated visitors (or while auth is resolving) should never see
  // the painel sidebar — render the public content only.
  if (loading || !user) return <>{children}</>;

  return (
    <SidebarProvider>
      <div className="flex min-h-dvh w-full bg-secondary">
        <PainelSidebar />
        <SidebarInset className="relative flex flex-1 flex-col bg-secondary">
          <div className="pointer-events-none absolute left-2 top-2 z-40">
            <div className="pointer-events-auto">
              <SidebarTrigger className="rounded-full bg-background/85 shadow-sm backdrop-blur" />
            </div>
          </div>
          {children}
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

/** Paths that should automatically get the painel sidebar shell. */
export const PAINEL_PATH_PREFIXES = [
  "/painel",
  "/calendario",
  "/horarios",
  "/usuarios",
  "/meus-filhos",
  "/meus-comunicados",
  "/minhas-turmas",
  "/escola",
  "/mural",
  "/rede-apoio",
  "/chat-aluno",
  "/mensagens-coordenacao",
  "/notificacoes",
];

export function isPainelPath(pathname: string): boolean {
  return PAINEL_PATH_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`) || pathname.startsWith(`${p}-`),
  );
}

/**
 * Root-level fallback: wraps children with PainelLayout whenever the current
 * route is a painel route. Safe on non-painel routes (renders children as-is).
 */
export function PainelLayoutFallback({
  pathname,
  children,
}: {
  pathname: string;
  children: ReactNode;
}) {
  if (!isPainelPath(pathname)) return <>{children}</>;
  return <AuthGatedPainelLayout>{children}</AuthGatedPainelLayout>;
}

function AuthGatedPainelLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  // While auth is resolving, or for unauthenticated visitors, render the
  // public layout without the painel sidebar. The sidebar is only for
  // authenticated users navigating the painel area.
  if (loading || !user) return <>{children}</>;
  return <PainelLayout>{children}</PainelLayout>;
}

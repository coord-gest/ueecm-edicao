import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, lazy, Suspense, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { installClientErrorMonitor } from "../lib/error-monitor";
import { installObservability } from "../lib/observability";
import { AuthProvider } from "../lib/use-auth";
import { ThemeProvider } from "../lib/use-theme";
import { supabase } from "../integrations/supabase/client";
import { Toaster } from "../components/ui/sonner";

import { CookieConsentBanner } from "../components/CookieConsentBanner";
import { AlertBanner } from "../components/AlertBanner";
import { registerServiceWorker } from "../lib/pwa-register";
import { installOnlineFlushListener } from "../lib/offline-queue";
import { UpdateBanner } from "../components/UpdateBanner";

import { PainelLayoutFallback } from "../components/PainelLayout";
import { trackPageView } from "../lib/analytics";
import { initI18n } from "../i18n";

// Inicializa o i18n uma única vez no bootstrap do módulo.
initI18n();

// Widgets não-críticos: carregados após o primeiro paint para aliviar o bundle raiz.
// ThemeEffectsOverlay é o maior ganho: seu módulo referencia ~12 MB de sprites sazonais.
const ThemeEffectsOverlay = lazy(() =>
  import("../components/ThemeEffectsOverlay").then((m) => ({ default: m.ThemeEffectsOverlay })),
);
const ChatWidget = lazy(() =>
  import("../components/ChatWidget").then((m) => ({ default: m.ChatWidget })),
);
const CommandMenu = lazy(() =>
  import("../components/CommandMenu").then((m) => ({ default: m.CommandMenu })),
);
const InstallPrompt = lazy(() =>
  import("../components/InstallPrompt").then((m) => ({ default: m.InstallPrompt })),
);
const PermissionsOnboarding = lazy(() =>
  import("../components/PermissionsOnboarding").then((m) => ({ default: m.PermissionsOnboarding })),
);

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A página que você está procurando não existe ou foi movida.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Erro ao carregar a página
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Algo deu errado. Tente recarregar a página ou voltar ao início.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Tentar novamente
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Voltar ao início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#F8F6EE" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "U.E. Evaristo" },
      { name: "application-name", content: "U.E. Evaristo" },
      { name: "format-detection", content: "telephone=no" },
      // Sitewide defaults — cada rota deve sobrescrever com título/descrição próprios.
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "U.E. Evaristo Campelo de Matos" },
      { property: "og:locale", content: "pt_BR" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400;1,9..40,500&display=swap",
      },
      { rel: "icon", type: "image/png", sizes: "any", href: "/favicon.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-192.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/icon-512.png" },
      { rel: "shortcut icon", href: "/favicon.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/favicon.png" },
      { rel: "manifest", href: "/manifest.json" },
      // Sinais padrão para user-agents/scanners: onde encontrar Política e Termos.
      { rel: "privacy-policy", href: "/privacidade" },
      { rel: "terms-of-service", href: "/termos-de-uso" },
      {
        rel: "alternate",
        type: "application/rss+xml",
        title: "Notícias U.E. Evaristo Campelo de Matos",
        href: "/rss.xml",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "EducationalOrganization",
              "@id": "https://conectaueecm.com/#organization",
              name: "U.E. Evaristo Campelo de Matos",
              url: "https://conectaueecm.com",
              logo: "https://conectaueecm.com/icon-512.png",
              address: {
                "@type": "PostalAddress",
                addressLocality: "Assunção do Piauí",
                addressRegion: "PI",
                addressCountry: "BR",
              },
            },
            {
              "@type": "WebSite",
              "@id": "https://conectaueecm.com/#website",
              url: "https://conectaueecm.com",
              name: "U.E. Evaristo Campelo de Matos",
              inLanguage: "pt-BR",
              publisher: { "@id": "https://conectaueecm.com/#organization" },
            },
          ],
        }),
      },
    ],
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  // Script inline síncrono: aplica tema (light/dark/system) e a cor de fundo
  // ANTES do CSS carregar. Previne flash branco no primeiro paint e mismatch
  // de hidratação quando o usuário tem preferência salva "system" ou "dark".
  const themeScript = `(function(){try{var p=localStorage.getItem('theme-preference');var m=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;var t=(p==='dark'||p==='light')?p:(p==='system'?(m?'dark':'light'):'light');var r=document.documentElement;if(t==='dark')r.classList.add('dark');r.style.colorScheme=t;r.style.backgroundColor=t==='dark'?'#0b0b0f':'#F8F6EE';}catch(e){}})();`;
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    installClientErrorMonitor();
    installObservability();
    registerServiceWorker();
    installOnlineFlushListener();
  }, []);

  // Nova versão do PWA agora é sinalizada pelo <UpdateBanner /> fixo no topo,
  // que escuta o evento "pwa-update-available" disparado pelo wrapper de SW.

  useEffect(() => {
    let lastUserId: string | null = null;
    let initialized = false;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const nextUserId = session?.user?.id ?? null;

      // Only react to actual sign-in / sign-out transitions. Token refreshes,
      // repeated INITIAL_SESSION / USER_UPDATED events keep the same user and
      // must NOT trigger router.invalidate(), otherwise beforeLoad re-runs
      // getUser() and creates an infinite login loop.
      if (!initialized) {
        initialized = true;
        lastUserId = nextUserId;
        return;
      }

      if (event === "TOKEN_REFRESHED" || nextUserId === lastUserId) {
        return;
      }

      lastUserId = nextUserId;
      router.invalidate();
      queryClient.invalidateQueries();
    });
    return () => subscription.unsubscribe();
  }, [router, queryClient]);

  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!pathname) return;
    trackPageView(pathname);
  }, [pathname]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <UpdateBanner />
          <AlertBanner />
          {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
          <PainelLayoutFallback pathname={pathname}>
            <Outlet />
          </PainelLayoutFallback>
          <Suspense fallback={null}>
            <CommandMenu />
            <InstallPrompt />
            <PermissionsOnboarding />
            <ChatWidget />
            <ThemeEffectsOverlay />
          </Suspense>
          <CookieConsentBanner />
          <Toaster />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

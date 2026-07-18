import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
      mutations: {
        retry: 0,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Preload em intent (hover/touch) e mantém dados frescos por 30s para
    // evitar que skeletons pisquem ao entrar em rotas já pré-carregadas.
    defaultPreload: "intent",
    defaultPreloadStaleTime: 30_000,
    defaultPreloadGcTime: 5 * 60_000,
    // Sem componente pending global — evita flash de fallback ao trocar de rota.
    defaultPendingMs: 400,
    defaultPendingMinMs: 0,
  });

  return router;
};

import { createFileRoute } from "@tanstack/react-router";

/**
 * GET /api/public/turnstile-config
 *
 * Devolve a Site Key pública do Cloudflare Turnstile em tempo de execução.
 * Isso evita falha em deploy Cloudflare quando a variável VITE_* não foi
 * injetada no build. A Site Key é pública por natureza; a Secret Key continua
 * apenas no servidor em TURNSTILE_SECRET_KEY.
 */
export const Route = createFileRoute("/api/public/turnstile-config")({
  server: {
    handlers: {
      GET: async () => {
        const siteKey = process.env.VITE_TURNSTILE_SITE_KEY ?? process.env.TURNSTILE_SITE_KEY;

        if (!siteKey) {
          return Response.json(
            { error: "Turnstile não configurado no servidor." },
            { status: 503 },
          );
        }

        return Response.json(
          { siteKey },
          {
            headers: {
              "cache-control": "public, max-age=300",
            },
          },
        );
      },
    },
  },
});
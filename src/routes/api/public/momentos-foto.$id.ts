import { createFileRoute } from "@tanstack/react-router";
import { logger } from "@/lib/logger";

/**
 * Proxy público para imagens da galeria Momentos.
 * O acesso ao Drive usa a conta institucional via connector gateway,
 * então este endpoint é o único caminho pelo qual visitantes carregam
 * as fotos. Antes de servir o binário, validamos que o arquivo:
 *   1. É uma imagem
 *   2. Está dentro da árvore UEECM/Momentos
 *
 * Cache agressivo para reduzir consumo do Drive.
 */
export const Route = createFileRoute("/api/public/momentos-foto/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const id = params.id;
        if (!id || !/^[\w-]{10,}$/.test(id)) {
          return new Response("Bad Request", { status: 400 });
        }
        try {
          const { isDriveConfigured, ensureUEECMTree, getDriveFileMeta, fetchDriveContent } =
            await import("@/lib/google-drive.server");
          if (!isDriveConfigured()) {
            return new Response("Drive não configurado", { status: 503 });
          }

          const meta = await getDriveFileMeta(id);
          if (!meta.mimeType?.startsWith("image/")) {
            return new Response("Not an image", { status: 403 });
          }

          // Verifica ancestralidade em UEECM/Momentos (2 níveis: ano/evento).
          const { momentosId } = await ensureUEECMTree();
          const parent1 = meta.parents?.[0];
          if (!parent1) return new Response("Forbidden", { status: 403 });
          const p1 = await getDriveFileMeta(parent1);
          const p2Id = p1.parents?.[0];
          if (!p2Id) return new Response("Forbidden", { status: 403 });
          const p2 = await getDriveFileMeta(p2Id);
          const anoParent = p2.parents?.[0];
          if (anoParent !== momentosId) {
            return new Response("Forbidden", { status: 403 });
          }

          const upstream = await fetchDriveContent(id);
          const headers = new Headers();
          headers.set("Content-Type", meta.mimeType);
          headers.set("Cache-Control", "public, max-age=86400, s-maxage=604800, immutable");
          const len = upstream.headers.get("Content-Length");
          if (len) headers.set("Content-Length", len);
          return new Response(upstream.body, { status: 200, headers });
        } catch (err) {
          logger.error("[momentos-foto]", err);
          return new Response("Erro ao carregar imagem", { status: 502 });
        }
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";
import { logger } from "@/lib/logger";

/**
 * Proxy público para imagens do Drive usadas em POSTS e outras superfícies.
 * Diferente de /api/public/momentos-foto/$id (que exige ancestral UEECM/Momentos),
 * este endpoint só exige:
 *   - mimeType image/*
 *   - o arquivo estar em qualquer lugar dentro da árvore UEECM/
 *
 * Cache agressivo (7 dias no edge) para reduzir chamadas ao Drive.
 */
export const Route = createFileRoute("/api/public/drive-foto/$id")({
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

          const { rootId } = await ensureUEECMTree();

          // Caminha pra cima até 8 níveis buscando o rootId de UEECM.
          let currentParents = meta.parents ?? [];
          let inside = false;
          for (let depth = 0; depth < 8 && currentParents.length > 0; depth++) {
            const parentId = currentParents[0]!;
            if (parentId === rootId) {
              inside = true;
              break;
            }
            const parentMeta = await getDriveFileMeta(parentId);
            currentParents = parentMeta.parents ?? [];
          }
          if (!inside) return new Response("Forbidden", { status: 403 });

          const upstream = await fetchDriveContent(id);
          const headers = new Headers();
          headers.set("Content-Type", meta.mimeType);
          headers.set("Cache-Control", "public, max-age=86400, s-maxage=604800, immutable");
          const len = upstream.headers.get("Content-Length");
          if (len) headers.set("Content-Length", len);
          return new Response(upstream.body, { status: 200, headers });
        } catch (err) {
          logger.error("[drive-foto]", err);
          return new Response("Erro ao carregar imagem", { status: 502 });
        }
      },
    },
  },
});

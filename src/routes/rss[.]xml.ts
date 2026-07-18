import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const BASE_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_SITE_URL) ||
  "https://conectaueecm.com";

const SITE_TITLE = "U.E. Evaristo Campelo de Matos — Notícias";
const SITE_DESC = "Últimas notícias, comunicados e eventos da U.E. Evaristo Campelo de Matos.";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export const Route = createFileRoute("/rss.xml")({
  server: {
    handlers: {
      GET: async () => {
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_PUBLISHABLE_KEY;

        let items: string[] = [];
        let lastBuild = new Date().toUTCString();

        if (url && key) {
          try {
            const supabase = createClient<Database>(url, key, {
              auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
            });
            const { data } = await supabase
              .from("posts")
              .select("id, titulo, resumo, autor, data, published_at, imagem, disciplina")
              .eq("status", "publicado")
              .order("published_at", { ascending: false })
              .limit(50);

            items = (data ?? []).map((p) => {
              const link = `${BASE_URL}/posts/${p.id}`;
              const pubDate = new Date(p.published_at ?? p.data).toUTCString();
              const enclosure = p.imagem
                ? `      <enclosure url="${escapeXml(p.imagem)}" type="image/jpeg" />`
                : "";
              return [
                `    <item>`,
                `      <title>${escapeXml(p.titulo)}</title>`,
                `      <link>${link}</link>`,
                `      <guid isPermaLink="true">${link}</guid>`,
                `      <pubDate>${pubDate}</pubDate>`,
                p.autor ? `      <author>${escapeXml(p.autor)}</author>` : "",
                p.disciplina ? `      <category>${escapeXml(p.disciplina)}</category>` : "",
                `      <description>${escapeXml(p.resumo ?? "")}</description>`,
                enclosure,
                `    </item>`,
              ]
                .filter(Boolean)
                .join("\n");
            });

            if (data && data[0]?.published_at) {
              lastBuild = new Date(data[0].published_at).toUTCString();
            }
          } catch {
            // mantém items vazios
          }
        }

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">`,
          `  <channel>`,
          `    <title>${escapeXml(SITE_TITLE)}</title>`,
          `    <link>${BASE_URL}</link>`,
          `    <description>${escapeXml(SITE_DESC)}</description>`,
          `    <language>pt-BR</language>`,
          `    <lastBuildDate>${lastBuild}</lastBuildDate>`,
          `    <atom:link href="${BASE_URL}/rss.xml" rel="self" type="application/rss+xml" />`,
          ...items,
          `  </channel>`,
          `</rss>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/rss+xml; charset=utf-8",
            "Cache-Control": "public, max-age=1800",
          },
        });
      },
    },
  },
});

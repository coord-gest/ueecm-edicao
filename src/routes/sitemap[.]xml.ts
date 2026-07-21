import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// BASE_URL deve ser a URL pública do site (sem barra final).
// Em produção, defina a variável de ambiente VITE_SITE_URL.
const BASE_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_SITE_URL) ||
  "https://conectaueecm.com";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const today = new Date().toISOString().slice(0, 10);
        const entries: SitemapEntry[] = [
          { path: "/", lastmod: today, changefreq: "daily", priority: "1.0" },
          { path: "/sobre", lastmod: today, changefreq: "monthly", priority: "0.8" },
          { path: "/calendario", lastmod: today, changefreq: "weekly", priority: "0.8" },
          { path: "/horarios", lastmod: today, changefreq: "monthly", priority: "0.7" },
          { path: "/equipe", lastmod: today, changefreq: "monthly", priority: "0.7" },
          { path: "/posts", lastmod: today, changefreq: "daily", priority: "0.9" },
          { path: "/agendar", lastmod: today, changefreq: "monthly", priority: "0.6" },
          { path: "/alunos-destaque", lastmod: today, changefreq: "weekly", priority: "0.7" },
          { path: "/familias", lastmod: today, changefreq: "monthly", priority: "0.6" },
          { path: "/momentos", lastmod: today, changefreq: "weekly", priority: "0.7" },
          { path: "/enquetes", lastmod: today, changefreq: "weekly", priority: "0.6" },
          { path: "/galeria", lastmod: today, changefreq: "weekly", priority: "0.6" },
          { path: "/solicitar-dados", lastmod: today, changefreq: "yearly", priority: "0.4" },
          { path: "/privacidade", lastmod: today, changefreq: "yearly", priority: "0.4" },
          { path: "/uso-de-imagem", lastmod: today, changefreq: "yearly", priority: "0.5" },
          { path: "/termos-de-uso", lastmod: today, changefreq: "yearly", priority: "0.4" },
        ];

        try {
          const url = process.env.SUPABASE_URL;
          const key = process.env.SUPABASE_PUBLISHABLE_KEY;
          if (url && key) {
            const supabase = createClient<Database>(url, key, {
              auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
            });
            const { data } = await supabase
              .from("posts")
              .select("id, updated_at, published_at")
              .eq("status", "publicado")
              .order("published_at", { ascending: false })
              .limit(1000);
            for (const p of data ?? []) {
              entries.push({
                path: `/posts/${p.id}`,
                lastmod: (p.updated_at ?? p.published_at ?? undefined)?.slice(0, 10),
                changefreq: "weekly",
                priority: "0.7",
              });
            }
          }
        } catch {
          // se Supabase falhar, mantém entradas estáticas
        }

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});

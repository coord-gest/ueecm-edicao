import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PRIVILEGED = new Set(["desenvolvedor", "developer", "diretor", "director", "admin"]);

async function assertPrivileged(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  const roles = (data ?? []).map((r: { role: string }) => String(r.role));
  if (!roles.some((r: string) => PRIVILEGED.has(r))) throw new Error("Acesso negado.");
}

/** Buckets do Supabase Storage cujo conteúdo deve ir para UEECM/Backups no Drive. */
const MIGRATABLE_BUCKETS = [
  "comunicados-anexos",
  "justificativas",
  "boletins-importados",
  "alert-images",
] as const;
type MigratableBucket = (typeof MIGRATABLE_BUCKETS)[number];

/** Extrai URLs de <img> num HTML. */
function extractImagesFromHtml(html: string | null | undefined): string[] {
  if (!html) return [];
  const out: string[] = [];
  const re = /<img[^>]+src=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) out.push(m[1]!);
  return out;
}

function sanitizeName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_").slice(0, 200);
}

function mimeFromName(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
  return (ext && map[ext]) || "application/octet-stream";
}

/** Devolve contagens do que existe hoje em Storage + Momentos (posts com imagem). */
export const getMigrationOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPrivileged(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const buckets: Record<string, number> = {};
    for (const b of MIGRATABLE_BUCKETS) {
      const { data } = await supabaseAdmin.storage.from(b).list("", {
        limit: 1000,
        sortBy: { column: "name", order: "asc" },
      });
      buckets[b] = (data ?? []).filter((o) => o.name && o.id !== null).length;
    }

    const { count: postCount } = await supabaseAdmin
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("status", "publicado");

    return { buckets, postsPublicados: postCount ?? 0 };
  });

/** Lista recursivamente objetos de um bucket, com paths relativos. */
async function listBucketRecursive(
  admin: any,
  bucket: string,
  prefix = "",
): Promise<Array<{ path: string; name: string }>> {
  const out: Array<{ path: string; name: string }> = [];
  const { data, error } = await admin.storage.from(bucket).list(prefix, {
    limit: 1000,
    sortBy: { column: "name", order: "asc" },
  });
  if (error) return out;
  for (const item of data ?? []) {
    if (!item.name) continue;
    const p = prefix ? `${prefix}/${item.name}` : item.name;
    // Pastas em storage vêm sem id
    if (item.id === null) {
      const sub = await listBucketRecursive(admin, bucket, p);
      out.push(...sub);
    } else {
      out.push({ path: p, name: item.name });
    }
  }
  return out;
}

/** Migra um lote de objetos de UM bucket para UEECM/Backups/<bucket>/... */
export const migrateStorageBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((raw) =>
    z
      .object({
        bucket: z.enum(MIGRATABLE_BUCKETS),
        offset: z.number().int().min(0).default(0),
        limit: z.number().int().min(1).max(10).default(5),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertPrivileged(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const {
      isDriveConfigured,
      ensureUEECMTree,
      findOrCreateFolder,
      ensureFolderPath,
      findFileByName,
      uploadFileServer,
    } = await import("@/lib/google-drive.server");
    if (!isDriveConfigured()) throw new Error("Google Drive não está conectado.");

    const all = await listBucketRecursive(supabaseAdmin, data.bucket);
    const total = all.length;
    const slice = all.slice(data.offset, data.offset + data.limit);

    const { backupsId } = await ensureUEECMTree();
    const bucketRootId = await findOrCreateFolder(data.bucket, backupsId);

    const results: Array<{ path: string; status: "ok" | "skipped" | "error"; error?: string }> = [];

    for (const item of slice) {
      try {
        const parts = item.path.split("/");
        const name = sanitizeName(parts.pop() ?? item.name);
        const parentId =
          parts.length > 0 ? await ensureFolderPath(parts, bucketRootId) : bucketRootId;

        const existing = await findFileByName(name, parentId);
        if (existing) {
          results.push({ path: item.path, status: "skipped" });
          continue;
        }

        // Baixa via signed URL (funciona mesmo em buckets privados)
        const { data: signed, error: signErr } = await supabaseAdmin.storage
          .from(data.bucket)
          .createSignedUrl(item.path, 300);
        if (signErr || !signed?.signedUrl) throw new Error(signErr?.message ?? "sem URL");

        const res = await fetch(signed.signedUrl);
        if (!res.ok) throw new Error(`download ${res.status}`);
        const buf = new Uint8Array(await res.arrayBuffer());

        await uploadFileServer({
          name,
          mimeType: res.headers.get("content-type") || mimeFromName(name),
          parentId,
          data: buf,
        });
        results.push({ path: item.path, status: "ok" });
      } catch (e) {
        results.push({ path: item.path, status: "error", error: (e as Error).message });
      }
    }

    return {
      total,
      processed: data.offset + slice.length,
      nextOffset: data.offset + slice.length < total ? data.offset + slice.length : null,
      results,
    };
  });

/** Lote de migração de Momentos: baixa imagens dos posts e envia p/ Drive. */
export const migrateMomentosBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((raw) =>
    z
      .object({
        offset: z.number().int().min(0).default(0),
        limit: z.number().int().min(1).max(5).default(3),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertPrivileged(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const {
      isDriveConfigured,
      ensureUEECMTree,
      findOrCreateFolder,
      findFileByName,
      uploadFileServer,
    } = await import("@/lib/google-drive.server");
    if (!isDriveConfigured()) throw new Error("Google Drive não está conectado.");

    const { data: posts, count } = await supabaseAdmin
      .from("posts")
      .select("id, titulo, slug, imagem, imagem_url, conteudo, data, published_at, created_at", {
        count: "exact",
      })
      .eq("status", "publicado")
      .order("data", { ascending: false })
      .range(data.offset, data.offset + data.limit - 1);

    const total = count ?? 0;
    const { momentosId } = await ensureUEECMTree();

    const results: Array<{
      postId: string;
      titulo: string;
      uploaded: number;
      skipped: number;
      errors: number;
    }> = [];

    for (const p of posts ?? []) {
      const urls = new Set<string>();
      if (p.imagem) urls.add(p.imagem);
      if (p.imagem_url && p.imagem_url !== p.imagem) urls.add(p.imagem_url);
      for (const src of extractImagesFromHtml(p.conteudo)) urls.add(src);

      let uploaded = 0;
      let skipped = 0;
      let errors = 0;

      if (urls.size > 0) {
        const dateStr = p.data || p.published_at || p.created_at || new Date().toISOString();
        const year = String(new Date(dateStr).getFullYear() || new Date().getFullYear());
        const anoId = await findOrCreateFolder(year, momentosId);
        const eventoId = await findOrCreateFolder("Publicações", anoId);
        const baseSlug = sanitizeName(p.slug || p.titulo || p.id).slice(0, 80);

        let idx = 0;
        for (const url of urls) {
          idx++;
          try {
            const extFromUrl = url.split("?")[0]!.split(".").pop()?.toLowerCase() ?? "jpg";
            const ext = ["jpg", "jpeg", "png", "webp", "gif"].includes(extFromUrl)
              ? extFromUrl
              : "jpg";
            const name = `${baseSlug}_${idx}.${ext}`;

            const existing = await findFileByName(name, eventoId);
            if (existing) {
              skipped++;
              continue;
            }

            // Só baixa se for URL http(s) válida
            if (!/^https?:\/\//.test(url)) {
              skipped++;
              continue;
            }
            const res = await fetch(url);
            if (!res.ok) throw new Error(`download ${res.status}`);
            const bin = new Uint8Array(await res.arrayBuffer());
            await uploadFileServer({
              name,
              mimeType: res.headers.get("content-type") || mimeFromName(name),
              parentId: eventoId,
              data: bin,
            });
            uploaded++;
          } catch {
            errors++;
          }
        }
      }

      results.push({
        postId: p.id,
        titulo: p.titulo ?? "(sem título)",
        uploaded,
        skipped,
        errors,
      });
    }

    const nextOffset =
      data.offset + (posts?.length ?? 0) < total ? data.offset + (posts?.length ?? 0) : null;

    return {
      total,
      processed: data.offset + (posts?.length ?? 0),
      nextOffset,
      results,
    };
  });

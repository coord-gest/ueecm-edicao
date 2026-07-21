import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PRIVILEGED = new Set(["desenvolvedor", "developer", "diretor", "director", "admin"]);

async function assertPrivileged(context: { supabase: any; userId: string }) {
  const { data: roles, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  if (error) throw new Error("Falha ao validar permissões.");
  const ok = (roles ?? []).some((r: { role: string }) => PRIVILEGED.has(String(r.role)));
  if (!ok) throw new Error("Acesso negado.");
}

/** Dispara um backup manualmente. Devolve estatísticas. */
export const runBackupNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPrivileged(context);
    const { runBackup } = await import("./backup.server");
    const res = await runBackup();
    // Move o arquivo de auto/ para manual/ para preservação
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const manualPath = res.path.replace(/^auto\//, "manual/");
    await supabaseAdmin.storage.from("backups").move(res.path, manualPath);
    return { ...res, path: manualPath };
  });

export type BackupFile = {
  name: string;
  path: string;
  size: number;
  created_at: string;
  kind: "auto" | "manual";
};

export const listBackups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BackupFile[]> => {
    await assertPrivileged(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const out: BackupFile[] = [];
    for (const folder of ["auto", "manual"] as const) {
      const { data } = await supabaseAdmin.storage
        .from("backups")
        .list(folder, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
      for (const f of data ?? []) {
        out.push({
          name: f.name,
          path: `${folder}/${f.name}`,
          size: (f.metadata as { size?: number } | null)?.size ?? 0,
          created_at: f.created_at ?? "",
          kind: folder,
        });
      }
    }
    return out.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  });

export const getBackupDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { path: string }) => data)
  .handler(async ({ data, context }) => {
    await assertPrivileged(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("backups")
      .createSignedUrl(data.path, 300);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });

export const deleteBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { path: string }) => data)
  .handler(async ({ data, context }) => {
    await assertPrivileged(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.storage.from("backups").remove([data.path]);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- RECURSOS (monitor de storage / db) ---------------- */

export type ResourceStats = {
  buckets: Array<{ name: string; files: number; bytes: number }>;
  totalBytes: number;
  tables: Array<{ name: string; rows: number }>;
  totalRows: number;
};

const MONITORED_TABLES = [
  "alunos",
  "notas",
  "frequencia",
  "comunicados",
  "posts",
  "audit_logs",
  "analytics_events",
  "system_errors",
  "push_notifications_queue",
  "push_subscriptions",
] as const;

export const getResourceStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ResourceStats> => {
    await assertPrivileged(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: buckets } = await supabaseAdmin.storage.listBuckets();
    const bucketStats: ResourceStats["buckets"] = [];
    let totalBytes = 0;

    for (const b of buckets ?? []) {
      // Paginação simples: lista até 1000 arquivos na raiz e subpastas de 1 nível
      let files = 0;
      let bytes = 0;
      async function walk(prefix: string) {
        const { data } = await supabaseAdmin.storage.from(b.name).list(prefix, { limit: 1000 });
        for (const f of data ?? []) {
          if ((f as { id?: string | null }).id === null) {
            // é uma pasta
            await walk(prefix ? `${prefix}/${f.name}` : f.name);
          } else {
            files += 1;
            bytes += (f.metadata as { size?: number } | null)?.size ?? 0;
          }
        }
      }
      await walk("");
      bucketStats.push({ name: b.name, files, bytes });
      totalBytes += bytes;
    }

    const tables: ResourceStats["tables"] = [];
    let totalRows = 0;
    for (const t of MONITORED_TABLES) {
      const { count } = await supabaseAdmin
        .from(t as never)
        .select("*", { count: "exact", head: true });
      const rows = count ?? 0;
      tables.push({ name: t, rows });
      totalRows += rows;
    }

    return {
      buckets: bucketStats.sort((a, b) => b.bytes - a.bytes),
      totalBytes,
      tables: tables.sort((a, b) => b.rows - a.rows),
      totalRows,
    };
  });

/* ---------------- OTIMIZAÇÃO DE IMAGENS ---------------- */

export type LargeImage = {
  bucket: string;
  path: string;
  size: number;
  publicUrl: string;
  created_at: string;
};

/** Lista imagens > threshold em buckets públicos, para compressão retroativa. */
export const listLargeImages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { minKB?: number; buckets?: string[] }) => data)
  .handler(async ({ data, context }): Promise<LargeImage[]> => {
    await assertPrivileged(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const minBytes = Math.max(50, data.minKB ?? 200) * 1024;
    const bucketsList = data.buckets ?? ["alert-images"]; // buckets públicos com imagens
    const out: LargeImage[] = [];

    for (const bucket of bucketsList) {
      async function walk(prefix: string) {
        const { data: files } = await supabaseAdmin.storage
          .from(bucket)
          .list(prefix, { limit: 1000 });
        for (const f of files ?? []) {
          if ((f as { id?: string | null }).id === null) {
            await walk(prefix ? `${prefix}/${f.name}` : f.name);
            continue;
          }
          const size = (f.metadata as { size?: number } | null)?.size ?? 0;
          if (size < minBytes) continue;
          const mime = (f.metadata as { mimetype?: string } | null)?.mimetype ?? "";
          if (!mime.startsWith("image/")) continue;
          const path = prefix ? `${prefix}/${f.name}` : f.name;
          const { data: pub } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);
          out.push({
            bucket,
            path,
            size,
            publicUrl: pub.publicUrl,
            created_at: f.created_at ?? "",
          });
        }
      }
      await walk("");
    }
    return out.sort((a, b) => b.size - a.size).slice(0, 200);
  });

/** Substitui um arquivo do storage por uma versão comprimida. */
export const replaceImageWithCompressed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: { bucket: string; path: string; base64: string; contentType: string }) => data,
  )
  .handler(async ({ data, context }) => {
    await assertPrivileged(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const bin = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
    const { error } = await supabaseAdmin.storage.from(data.bucket).update(data.path, bin, {
      contentType: data.contentType,
      cacheControl: "31536000",
      upsert: true,
    });
    if (error) throw new Error(error.message);
    return { ok: true, newSize: bin.byteLength };
  });

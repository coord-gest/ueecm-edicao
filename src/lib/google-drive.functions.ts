import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PRIVILEGED = new Set(["desenvolvedor", "developer", "diretor", "director", "admin"]);
const STAFF = new Set([...PRIVILEGED, "coordenador", "secretario", "professor"]);

async function getRoles(context: { supabase: any; userId: string }): Promise<string[]> {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  if (error) throw new Error("Falha ao validar permissões.");
  return (data ?? []).map((r: { role: string }) => String(r.role));
}

async function assertPrivileged(context: { supabase: any; userId: string }) {
  const roles = await getRoles(context);
  if (!roles.some((r) => PRIVILEGED.has(r))) throw new Error("Acesso negado.");
}

async function assertStaff(context: { supabase: any; userId: string }) {
  const roles = await getRoles(context);
  if (!roles.some((r) => STAFF.has(r))) throw new Error("Acesso negado.");
}

/**
 * Wrapper que delega para o helper server-only. Dynamic import evita puxar
 * `google-drive.server.ts` (que importa `jose` e `push-dispatcher.server`)
 * para o bundle do cliente, já que top-level imports de `.functions.ts`
 * atravessam a borda cliente/servidor.
 */
async function driveFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const { driveFetchServer } = await import("@/lib/google-drive.server");
  try {
    return await driveFetchServer(path, init);
  } catch (e) {
    const msg = (e as Error).message ?? "";
    if (msg === "google_drive_not_connected") {
      throw new Error(
        "Google Drive não está conectado. Configure GOOGLE_DRIVE_CLIENT_EMAIL e GOOGLE_DRIVE_PRIVATE_KEY (ou reuse as credenciais do Firebase) nas secrets do worker.",
      );
    }
    throw e;
  }
}

/** Status: verifica conexão e retorna dados da conta + quota. */
export const getDriveStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    try {
      const res = await driveFetch(
        "/drive/v3/about?fields=user(displayName,emailAddress,photoLink),storageQuota(limit,usage,usageInDrive)",
      );
      const data = (await res.json()) as {
        user?: { displayName?: string; emailAddress?: string; photoLink?: string };
        storageQuota?: { limit?: string; usage?: string; usageInDrive?: string };
      };
      return { connected: true as const, ...data };
    } catch (e) {
      return { connected: false as const, error: (e as Error).message };
    }
  });

/** Lista arquivos/pastas. Se folderId não vier, lista a raiz. */
export const listDriveFiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((raw) =>
    z
      .object({
        folderId: z.string().optional(),
        query: z.string().optional(),
        pageSize: z.number().int().min(1).max(200).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const clauses: string[] = ["trashed = false"];
    if (data.folderId) clauses.push(`'${data.folderId}' in parents`);
    if (data.query) clauses.push(`name contains '${data.query.replace(/'/g, "\\'")}'`);
    const q = encodeURIComponent(clauses.join(" and "));
    const fields = encodeURIComponent(
      "files(id,name,mimeType,size,modifiedTime,iconLink,thumbnailLink,webViewLink,webContentLink,parents)",
    );
    const size = data.pageSize ?? 100;
    const res = await driveFetch(
      `/drive/v3/files?q=${q}&fields=${fields}&pageSize=${size}&orderBy=folder,name`,
    );
    const json = (await res.json()) as {
      files?: Array<{
        id: string;
        name: string;
        mimeType: string;
        size?: string;
        modifiedTime?: string;
        iconLink?: string;
        thumbnailLink?: string;
        webViewLink?: string;
        webContentLink?: string;
        parents?: string[];
      }>;
    };
    return { files: json.files ?? [] };
  });

/** Cria uma pasta. Se parentId não vier, cria na raiz. */
export const createDriveFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((raw) =>
    z
      .object({
        name: z.string().min(1).max(200),
        parentId: z.string().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertPrivileged(context);
    const body = {
      name: data.name,
      mimeType: "application/vnd.google-apps.folder",
      ...(data.parentId ? { parents: [data.parentId] } : {}),
    };
    const res = await driveFetch("/drive/v3/files?fields=id,name,webViewLink", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await res.json()) as { id: string; name: string; webViewLink?: string };
  });

/** Upload multipart. Content vem base64 (limite prático ~15 MB por chamada). */
export const uploadFileToDrive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((raw) =>
    z
      .object({
        name: z.string().min(1).max(255),
        mimeType: z.string().min(1).max(255),
        parentId: z.string().optional(),
        contentBase64: z.string().min(1),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const boundary = "----lovableboundary" + Math.random().toString(36).slice(2);
    const metadata = {
      name: data.name,
      mimeType: data.mimeType,
      ...(data.parentId ? { parents: [data.parentId] } : {}),
    };
    const binary = Buffer.from(data.contentBase64, "base64");
    const enc = new TextEncoder();
    const head = enc.encode(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(
        metadata,
      )}\r\n--${boundary}\r\nContent-Type: ${data.mimeType}\r\nContent-Transfer-Encoding: binary\r\n\r\n`,
    );
    const tail = enc.encode(`\r\n--${boundary}--`);
    const body = new Uint8Array(head.length + binary.length + tail.length);
    body.set(head, 0);
    body.set(binary, head.length);
    body.set(tail, head.length + binary.length);

    const res = await driveFetch(
      "/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,thumbnailLink,size",
      {
        method: "POST",
        headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
        body,
      },
    );
    return (await res.json()) as {
      id: string;
      name: string;
      mimeType: string;
      webViewLink?: string;
      thumbnailLink?: string;
      size?: string;
    };
  });

/** Move para lixeira. */
export const deleteDriveFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((raw) => z.object({ fileId: z.string().min(1) }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertPrivileged(context);
    await driveFetch(`/drive/v3/files/${encodeURIComponent(data.fileId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trashed: true }),
    });
    return { ok: true as const };
  });

/** Garante pastas raiz: UEECM/Backups e UEECM/Momentos. Idempotente. */
export const ensureUEECMFolders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPrivileged(context);
    async function findOrCreate(name: string, parentId?: string): Promise<string> {
      const parentQ = parentId ? `'${parentId}' in parents` : "'root' in parents";
      const q = encodeURIComponent(
        `name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false and ${parentQ}`,
      );
      const listRes = await driveFetch(`/drive/v3/files?q=${q}&fields=files(id,name)`);
      const listJson = (await listRes.json()) as { files?: Array<{ id: string }> };
      if (listJson.files && listJson.files.length > 0) return listJson.files[0]!.id;
      const createRes = await driveFetch("/drive/v3/files?fields=id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          mimeType: "application/vnd.google-apps.folder",
          ...(parentId ? { parents: [parentId] } : {}),
        }),
      });
      const created = (await createRes.json()) as { id: string };
      return created.id;
    }
    const rootId = await findOrCreate("UEECM");
    const [backupsId, momentosId] = await Promise.all([
      findOrCreate("Backups", rootId),
      findOrCreate("Momentos", rootId),
    ]);
    return { rootId, backupsId, momentosId };
  });

/**
 * Envio dirigido por professores (e demais staff) para pastas fixas:
 *   destino "momentos" → UEECM/Momentos/<ano>/<evento>
 *   destino "backups"  → UEECM/Backups/professores/<pasta>
 * As pastas são criadas sob demanda. Retorna metadados do arquivo criado.
 */
export const uploadToUEECM = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((raw) =>
    z
      .object({
        destino: z.enum(["momentos", "backups"]),
        ano: z.string().min(1).max(20).optional(),
        evento: z.string().min(1).max(120).optional(),
        subpasta: z.string().min(1).max(120).optional(),
        name: z.string().min(1).max(255),
        mimeType: z.string().min(1).max(255),
        contentBase64: z.string().min(1),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { isDriveConfigured, ensureUEECMTree, findOrCreateFolder, uploadFileServer } =
      await import("@/lib/google-drive.server");
    if (!isDriveConfigured()) throw new Error("Google Drive não está conectado.");

    const { backupsId, momentosId } = await ensureUEECMTree();

    let parentId: string;
    if (data.destino === "momentos") {
      const ano = (data.ano ?? String(new Date().getFullYear())).trim();
      const evento = (data.evento ?? "Sem categoria").trim();
      const anoId = await findOrCreateFolder(ano, momentosId);
      parentId = await findOrCreateFolder(evento, anoId);
    } else {
      const sub = (data.subpasta ?? "professores").trim();
      parentId = await findOrCreateFolder(sub, backupsId);
    }

    const bytes = Buffer.from(data.contentBase64, "base64");
    const uploaded = await uploadFileServer({
      name: data.name,
      mimeType: data.mimeType,
      parentId,
      data: new Uint8Array(bytes),
    });
    return { ...uploaded, parentId };
  });

/**
 * Navegação do seletor "Escolher do Drive" para o editor de posts.
 * Sem folderId, lista as pastas de ano dentro de UEECM/Momentos.
 * Com folderId, lista subpastas + imagens do folder informado.
 * Retorna também a trilha (breadcrumb) para exibição no modal.
 */
export const listDrivePicker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((raw) => z.object({ folderId: z.string().optional() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { isDriveConfigured, ensureUEECMTree, listChildren, getDriveFileMeta } =
      await import("@/lib/google-drive.server");
    if (!isDriveConfigured()) throw new Error("Google Drive não está conectado.");

    const { momentosId, rootId } = await ensureUEECMTree();
    const parentId = data.folderId ?? momentosId;

    const [folders, images] = await Promise.all([
      listChildren(parentId, { onlyFolders: true, pageSize: 200 }),
      listChildren(parentId, { onlyImages: true, pageSize: 200 }),
    ]);

    // Breadcrumb: sobe até encontrar UEECM/Momentos.
    const breadcrumb: Array<{ id: string; name: string }> = [];
    if (data.folderId) {
      let cursor: string | undefined = data.folderId;
      for (let i = 0; i < 8 && cursor && cursor !== momentosId; i++) {
        const meta = await getDriveFileMeta(cursor);
        breadcrumb.unshift({ id: meta.id, name: meta.name });
        cursor = meta.parents?.[0];
        if (cursor === rootId) break;
      }
    }

    return {
      currentId: parentId,
      isRoot: parentId === momentosId,
      breadcrumb,
      folders: folders.map((f) => ({ id: f.id, name: f.name })),
      images: images.map((f) => ({
        id: f.id,
        name: f.name,
        thumbnailLink: f.thumbnailLink ?? null,
        mimeType: f.mimeType,
      })),
    };
  });

/**
 * Verifica se os fileIds informados existem no Drive e ainda são imagens.
 * Usado no submit do editor de posts para não persistir URLs quebradas.
 */
export const verifyDriveFiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((raw) =>
    z.object({ fileIds: z.array(z.string().min(10).max(200)).max(50) }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { isDriveConfigured, getDriveFileMeta } = await import("@/lib/google-drive.server");
    if (!isDriveConfigured()) throw new Error("Google Drive não está conectado.");

    const valid: string[] = [];
    const missing: string[] = [];
    const notImage: string[] = [];

    await Promise.all(
      data.fileIds.map(async (id) => {
        try {
          const meta = await getDriveFileMeta(id);
          if (!meta.mimeType?.startsWith("image/")) notImage.push(id);
          else valid.push(id);
        } catch {
          missing.push(id);
        }
      }),
    );

    return { valid, missing, notImage };
  });

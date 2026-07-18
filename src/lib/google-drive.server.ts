/**
 * Server-only helpers para o Google Drive.
 *
 * Autenticação: JWT de service account (RS256) → access_token OAuth2 →
 * chamadas diretas em https://www.googleapis.com/drive/v3. NÃO usamos
 * o gateway do Lovable — o app roda em Cloudflare Workers e depende
 * apenas de credenciais Google.
 *
 * Credenciais aceitas (nesta ordem):
 *   1. GOOGLE_DRIVE_CLIENT_EMAIL + GOOGLE_DRIVE_PRIVATE_KEY
 *   2. FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY (fallback: reuso
 *      do mesmo service account do FCM, desde que a pasta UEECM do
 *      Drive esteja compartilhada com esse email como Editor).
 *
 * Diferente de `google-drive.functions.ts`, estes utilitários NÃO exigem
 * sessão Supabase — são usados por:
 *   - cron de backup semanal (sem usuário logado)
 *   - listagem pública da galeria de Momentos (leitura anônima)
 *
 * Toda escrita/mutação continua protegida por rotas administrativas.
 */

import { SignJWT, importPKCS8 } from "jose";
import { normalizeFirebasePrivateKey } from "./push-dispatcher.server";

const GOOGLE_API = "https://www.googleapis.com";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";

type DriveCredentials = { clientEmail: string; privateKey: string };

function getDriveCredentials(): DriveCredentials {
  const clientEmail = process.env.GOOGLE_DRIVE_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL;
  const rawKey = process.env.GOOGLE_DRIVE_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY;
  if (!clientEmail || !rawKey) throw new Error("google_drive_not_connected");
  return { clientEmail, privateKey: normalizeFirebasePrivateKey(rawKey) };
}

// Cache do access_token OAuth2 (válido por ~1h — reusamos entre invocações).
let cachedDriveToken: { token: string; expiresAt: number } | null = null;

async function getDriveAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedDriveToken && cachedDriveToken.expiresAt > now + 60) {
    return cachedDriveToken.token;
  }
  const creds = getDriveCredentials();
  const key = await importPKCS8(creds.privateKey, "RS256");
  const assertion = await new SignJWT({ scope: DRIVE_SCOPE })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(creds.clientEmail)
    .setSubject(creds.clientEmail)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }).toString(),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`google_drive_auth_${res.status}: ${t.slice(0, 200)}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedDriveToken = { token: json.access_token, expiresAt: now + json.expires_in };
  return json.access_token;
}

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  thumbnailLink?: string;
  webViewLink?: string;
  webContentLink?: string;
  imageMediaMetadata?: { width?: number; height?: number };
  parents?: string[];
};

export async function driveFetchServer(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getDriveAccessToken();
  const res = await fetch(`${GOOGLE_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`google_drive_${res.status}: ${body.slice(0, 200)}`);
  }
  return res;
}

export function isDriveConfigured(): boolean {
  return Boolean(
    (process.env.GOOGLE_DRIVE_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL) &&
    (process.env.GOOGLE_DRIVE_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY),
  );
}

/** Busca uma pasta filha pelo nome. Retorna id ou null. */
export async function findFolder(name: string, parentId?: string): Promise<string | null> {
  const safe = name.replace(/'/g, "\\'");
  const parentClause = parentId ? `'${parentId}' in parents` : "'root' in parents";
  const q = encodeURIComponent(
    `name='${safe}' and mimeType='application/vnd.google-apps.folder' and trashed=false and ${parentClause}`,
  );
  const res = await driveFetchServer(`/drive/v3/files?q=${q}&fields=files(id)&pageSize=1`);
  const json = (await res.json()) as { files?: Array<{ id: string }> };
  return json.files?.[0]?.id ?? null;
}

/** Cria pasta filha e retorna o id. */
export async function createFolder(name: string, parentId?: string): Promise<string> {
  const res = await driveFetchServer("/drive/v3/files?fields=id", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      ...(parentId ? { parents: [parentId] } : {}),
    }),
  });
  const json = (await res.json()) as { id: string };
  return json.id;
}

export async function findOrCreateFolder(name: string, parentId?: string): Promise<string> {
  return (await findFolder(name, parentId)) ?? (await createFolder(name, parentId));
}

/** Encontra um arquivo pelo nome dentro de um pai específico. */
export async function findFileByName(name: string, parentId: string): Promise<DriveFile | null> {
  const safe = name.replace(/'/g, "\\'");
  const q = encodeURIComponent(
    `name='${safe}' and '${parentId}' in parents and trashed=false and mimeType!='application/vnd.google-apps.folder'`,
  );
  const res = await driveFetchServer(
    `/drive/v3/files?q=${q}&fields=files(id,name,mimeType,size,webViewLink)&pageSize=1`,
  );
  const json = (await res.json()) as { files?: DriveFile[] };
  return json.files?.[0] ?? null;
}

/** Resolve caminho "a/b/c" criando pastas conforme necessário sob um pai. */
export async function ensureFolderPath(segments: string[], parentId: string): Promise<string> {
  let current = parentId;
  for (const seg of segments) {
    const clean = seg.trim();
    if (!clean) continue;
    current = await findOrCreateFolder(clean, current);
  }
  return current;
}

/** Resolve a árvore padrão UEECM/{Backups,Momentos}. */
export async function ensureUEECMTree(): Promise<{
  rootId: string;
  backupsId: string;
  momentosId: string;
}> {
  const rootId = await findOrCreateFolder("UEECM");
  const [backupsId, momentosId] = await Promise.all([
    findOrCreateFolder("Backups", rootId),
    findOrCreateFolder("Momentos", rootId),
  ]);
  return { rootId, backupsId, momentosId };
}

/** Upload multipart genérico. Retorna metadados do arquivo criado. */
export async function uploadFileServer(params: {
  name: string;
  mimeType: string;
  parentId: string;
  data: Uint8Array;
}): Promise<DriveFile> {
  const { name, mimeType, parentId, data } = params;
  const boundary = "----lovableboundary" + Math.random().toString(36).slice(2);
  const metadata = { name, mimeType, parents: [parentId] };
  const enc = new TextEncoder();
  const head = enc.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(
      metadata,
    )}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\nContent-Transfer-Encoding: binary\r\n\r\n`,
  );
  const tail = enc.encode(`\r\n--${boundary}--`);
  const body = new Uint8Array(head.length + data.length + tail.length);
  body.set(head, 0);
  body.set(data, head.length);
  body.set(tail, head.length + data.length);

  const res = await driveFetchServer(
    "/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink,thumbnailLink",
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    },
  );
  return (await res.json()) as DriveFile;
}

/** Lista filhos de uma pasta (arquivos e pastas). */
export async function listChildren(
  parentId: string,
  opts: { pageSize?: number; onlyFolders?: boolean; onlyImages?: boolean } = {},
): Promise<DriveFile[]> {
  const clauses = ["trashed = false", `'${parentId}' in parents`];
  if (opts.onlyFolders) clauses.push("mimeType = 'application/vnd.google-apps.folder'");
  if (opts.onlyImages) clauses.push("mimeType contains 'image/'");
  const q = encodeURIComponent(clauses.join(" and "));
  const fields = encodeURIComponent(
    "files(id,name,mimeType,size,modifiedTime,thumbnailLink,webViewLink,imageMediaMetadata)",
  );
  const size = opts.pageSize ?? 200;
  const res = await driveFetchServer(
    `/drive/v3/files?q=${q}&fields=${fields}&pageSize=${size}&orderBy=name`,
  );
  const json = (await res.json()) as { files?: DriveFile[] };
  return json.files ?? [];
}

/** Baixa o conteúdo bruto de um arquivo (usado pelo proxy de imagens). */
export async function fetchDriveContent(fileId: string): Promise<Response> {
  return driveFetchServer(`/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`);
}

/** Metadados mínimos de um arquivo (para checar mimeType/pasta pai). */
export async function getDriveFileMeta(fileId: string): Promise<DriveFile> {
  const res = await driveFetchServer(
    `/drive/v3/files/${encodeURIComponent(
      fileId,
    )}?fields=id,name,mimeType,parents,size,modifiedTime`,
  );
  return (await res.json()) as DriveFile;
}

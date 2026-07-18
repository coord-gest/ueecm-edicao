import { supabase } from "@/integrations/supabase/client";

export const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"] as const;
export const ALLOWED_IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp"] as const;
export const MAX_IMAGE_SIZE_MB = 5;
export const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;

/**
 * Blocklist explícita — formatos que NUNCA devem ser aceitos, mesmo que
 * MIME/extensão pareçam válidos. SVG/HTML/XML podem conter <script> e
 * executar no navegador quando servidos do bucket público.
 */
const FORBIDDEN_MIME_TYPES = [
  "image/svg+xml",
  "text/html",
  "text/xml",
  "application/xml",
  "application/xhtml+xml",
  "application/javascript",
  "text/javascript",
  "application/x-shockwave-flash",
];
const FORBIDDEN_EXTENSIONS = [
  "svg",
  "svgz",
  "html",
  "htm",
  "xhtml",
  "xml",
  "js",
  "mjs",
  "swf",
  "exe",
  "sh",
  "phtml",
  "php",
];

export type ImageUploadError = {
  title: string;
  description: string;
};

/**
 * Lê os primeiros bytes e confirma que o conteúdo real é PNG/JPEG/WebP.
 * Bloqueia ataques onde um SVG/HTML é renomeado como .png com MIME falso.
 */
async function sniffImageMagicBytes(file: File): Promise<"png" | "jpeg" | "webp" | "unknown"> {
  try {
    const buf = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47 &&
      buf[4] === 0x0d &&
      buf[5] === 0x0a &&
      buf[6] === 0x1a &&
      buf[7] === 0x0a
    )
      return "png";
    // JPEG: FF D8 FF
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
    // WebP: "RIFF"...."WEBP"
    if (
      buf[0] === 0x52 &&
      buf[1] === 0x49 &&
      buf[2] === 0x46 &&
      buf[3] === 0x46 &&
      buf[8] === 0x57 &&
      buf[9] === 0x45 &&
      buf[10] === 0x42 &&
      buf[11] === 0x50
    )
      return "webp";
    return "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Validação síncrona rápida — MIME + extensão + blocklist.
 * Para bloquear polyglots, use também `validateImageFileStrict`.
 */
export function validateImageFile(file: File): ImageUploadError | null {
  const type = file.type.toLowerCase();
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();

  // Blocklist explícita — bloqueio duro independente de allowlist.
  if (FORBIDDEN_MIME_TYPES.includes(type) || FORBIDDEN_EXTENSIONS.includes(ext)) {
    return {
      title: "Formato de arquivo bloqueado",
      description:
        "Este tipo de arquivo (SVG, HTML, XML, scripts) não é permitido por motivos de segurança. Envie apenas PNG, JPG ou WebP.",
    };
  }

  const typeOk = (ALLOWED_IMAGE_TYPES as readonly string[]).includes(type);
  const extOk = (ALLOWED_IMAGE_EXTENSIONS as readonly string[]).includes(ext);

  // Correção crítica: exige AMBOS (MIME E extensão) na allowlist.
  // A lógica anterior usava OR, permitindo bypass via MIME/extensão divergentes.
  if (!typeOk || !extOk) {
    return {
      title: "Formato de imagem não suportado",
      description: `Envie um arquivo PNG, JPG ou WebP. Recebido: ${file.type || ext || "desconhecido"}.`,
    };
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      title: "Imagem muito grande",
      description: `O limite é ${MAX_IMAGE_SIZE_MB} MB. Sua imagem tem ${mb} MB. Reduza a resolução e tente novamente.`,
    };
  }

  return null;
}

/**
 * Validação estrita (assíncrona) com sniff de magic bytes.
 * Use antes de qualquer upload real para bloquear arquivos falsificados.
 */
export async function validateImageFileStrict(file: File): Promise<ImageUploadError | null> {
  const syncError = validateImageFile(file);
  if (syncError) return syncError;

  const sniffed = await sniffImageMagicBytes(file);
  if (sniffed === "unknown") {
    return {
      title: "Arquivo não é uma imagem válida",
      description:
        "O conteúdo do arquivo não corresponde a uma imagem PNG, JPG ou WebP. Ele pode estar corrompido ou ter sido renomeado.",
    };
  }

  const declaredType = file.type.toLowerCase();
  const mimeMatchesSniff =
    (sniffed === "png" && declaredType === "image/png") ||
    (sniffed === "jpeg" && (declaredType === "image/jpeg" || declaredType === "image/jpg")) ||
    (sniffed === "webp" && declaredType === "image/webp");

  if (!mimeMatchesSniff) {
    return {
      title: "Conteúdo do arquivo não corresponde ao tipo declarado",
      description:
        "O arquivo enviado parece ter sido renomeado. Envie a imagem original em PNG, JPG ou WebP.",
    };
  }

  return null;
}

function translateStorageError(message: string): ImageUploadError {
  const msg = message.toLowerCase();

  if (
    msg.includes("database schema is invalid") ||
    msg.includes("databaseinvalidobjectdefinition")
  ) {
    return {
      title: "Storage do Supabase indisponível",
      description:
        "O serviço de Storage do seu projeto Supabase está com a estrutura interna desatualizada. Abra o painel do Supabase em Settings → Infrastructure → Upgrade Project, ou contate o suporte do Supabase para reaplicar as migrations de storage. Enquanto isso, você pode colar a URL de uma imagem hospedada externamente no campo abaixo.",
    };
  }

  if (
    msg.includes("row-level security") ||
    msg.includes("rls") ||
    msg.includes("unauthorized") ||
    msg.includes("403")
  ) {
    return {
      title: "Sem permissão para enviar imagens",
      description:
        "Seu usuário não tem permissão para enviar imagens. Apenas Desenvolvedor, Admin, Diretor, Coordenador, Secretário e Professor podem enviar. Verifique seu papel na aba Usuários.",
    };
  }

  if (msg.includes("payload too large") || msg.includes("413")) {
    return {
      title: "Arquivo muito grande para o servidor",
      description: `Reduza a imagem para no máximo ${MAX_IMAGE_SIZE_MB} MB antes de enviar.`,
    };
  }

  if (msg.includes("network") || msg.includes("failed to fetch")) {
    return {
      title: "Falha de conexão",
      description: "Verifique sua internet e tente novamente em alguns segundos.",
    };
  }

  return {
    title: "Falha ao enviar imagem",
    description: message || "Tente novamente. Se persistir, contate o suporte.",
  };
}

export type UploadResult = { ok: true; url: string } | { ok: false; error: ImageUploadError };

export type UploadResponsiveResult =
  | {
      ok: true;
      /** URL da maior variante (compatível com `url` do uploadImage). */
      url: string;
      /** Atributo srcset pronto para uso: "url 800w, url 1600w". */
      srcset: string;
      /** Variantes individuais geradas. */
      variants: Array<{ url: string; width: number }>;
    }
  | { ok: false; error: ImageUploadError };

/** Larguras-alvo do srcset (px). A maior é usada como `src` padrão. */
const RESPONSIVE_WIDTHS = [800, 1600] as const;
/** Qualidade WebP (0-1). */
const WEBP_QUALITY = 0.82;

function loadImageBitmap(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

async function encodeWebp(img: HTMLImageElement, targetWidth: number): Promise<Blob | null> {
  const ratio = img.naturalHeight / img.naturalWidth;
  const width = Math.min(targetWidth, img.naturalWidth);
  const height = Math.round(width * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, width, height);
  return await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/webp", WEBP_QUALITY),
  );
}

/**
 * Faz upload da imagem convertendo-a para WebP em múltiplas larguras
 * (800w e 1600w) e devolve um `srcset` pronto para uso.
 * Em caso de falha na conversão (ex.: navegador sem suporte a WebP no canvas),
 * faz fallback para `uploadImage` com o arquivo original.
 */
export async function uploadResponsiveImage(
  file: File,
  folder: string,
): Promise<UploadResponsiveResult> {
  const validation = await validateImageFileStrict(file);
  if (validation) return { ok: false, error: validation };

  // Se já é WebP pequeno, evita re-encode desnecessário.
  try {
    const img = await loadImageBitmap(file);
    const baseId = crypto.randomUUID();
    const variants: Array<{ url: string; width: number }> = [];

    for (const w of RESPONSIVE_WIDTHS) {
      // Não gera variante maior que o original.
      if (w > img.naturalWidth && variants.length > 0) continue;
      const blob = await encodeWebp(img, w);
      if (!blob) continue;
      const path = `${folder}/${baseId}-${w}.webp`;
      const { error } = await supabase.storage.from("alert-images").upload(path, blob, {
        cacheControl: "31536000",
        upsert: false,
        contentType: "image/webp",
      });
      if (error) {
        return { ok: false, error: translateStorageError(error.message) };
      }
      const { data } = supabase.storage.from("alert-images").getPublicUrl(path);
      variants.push({ url: data.publicUrl, width: w });
    }

    if (variants.length === 0) {
      // Fallback para upload simples.
      const fb = await uploadImage(file, folder);
      if (!fb.ok) return fb;
      return {
        ok: true,
        url: fb.url,
        srcset: fb.url,
        variants: [{ url: fb.url, width: img.naturalWidth }],
      };
    }

    const srcset = variants.map((v) => `${v.url} ${v.width}w`).join(", ");
    const largest = variants[variants.length - 1];
    return { ok: true, url: largest.url, srcset, variants };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // Fallback transparente para upload simples se algo falhar no canvas.
    const fb = await uploadImage(file, folder);
    if (fb.ok) {
      return { ok: true, url: fb.url, srcset: fb.url, variants: [{ url: fb.url, width: 0 }] };
    }
    return { ok: false, error: translateStorageError(message) };
  }
}

/**
 * Faz upload de uma imagem para o bucket público `alert-images`.
 *
 * Comprime em WebP a até 1200px de largura (qualidade 0.82) para economizar
 * egress do Supabase Storage. Se a conversão falhar, faz fallback para o
 * arquivo original com `cacheControl` longo.
 *
 * @param folder - subpasta dentro do bucket (ex: "covers", "posts").
 */
export async function uploadImage(file: File, folder: string): Promise<UploadResult> {
  const validation = await validateImageFileStrict(file);
  if (validation) return { ok: false, error: validation };

  // Tenta comprimir em WebP 1200w antes de subir — economia típica 5-10×.
  let blob: Blob = file;
  let ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
  let contentType = file.type;
  try {
    const img = await loadImageBitmap(file);
    const webp = await encodeWebp(img, 1200);
    if (webp && webp.size < file.size) {
      blob = webp;
      ext = "webp";
      contentType = "image/webp";
    }
  } catch {
    // Fallback silencioso — sobe o arquivo original.
  }

  const path = `${folder}/${crypto.randomUUID()}.${ext}`;

  try {
    const { error } = await supabase.storage
      .from("alert-images")
      // cacheControl 1 ano: com URL única por UUID, imagens são imutáveis.
      .upload(path, blob, { cacheControl: "31536000", upsert: false, contentType });

    if (error) {
      return { ok: false, error: translateStorageError(error.message) };
    }

    const { data } = supabase.storage.from("alert-images").getPublicUrl(path);
    return { ok: true, url: data.publicUrl };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: translateStorageError(message) };
  }
}

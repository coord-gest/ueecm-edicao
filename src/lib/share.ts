import { toast } from "sonner";

export type ShareData = {
  title?: string;
  text?: string;
  url?: string;
};

/**
 * Compartilha via Web Share API nativa quando disponível
 * (Android/iOS/macOS Safari/Chrome desktop com share), com
 * fallback para copiar o link para a área de transferência.
 * Retorna true se a ação foi bem sucedida.
 */
export async function shareOrCopy(data: ShareData): Promise<boolean> {
  const url = data.url ?? (typeof window !== "undefined" ? window.location.href : "");
  const payload: ShareData = { ...data, url };

  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      // canShare pode não existir em navegadores antigos
      if (typeof navigator.canShare === "function" && !navigator.canShare(payload)) {
        throw new Error("canShare=false");
      }
      await navigator.share(payload);
      return true;
    } catch (err) {
      // AbortError = usuário cancelou; não fazemos fallback nesse caso
      if (err instanceof Error && err.name === "AbortError") return false;
      // outros erros caem para o copy
    }
  }

  try {
    if (typeof navigator !== "undefined" && navigator.clipboard && url) {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado para a área de transferência");
      return true;
    }
  } catch {
    // ignore
  }

  toast.error("Não foi possível compartilhar. Copie o link manualmente.");
  return false;
}

export function canNativeShare(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

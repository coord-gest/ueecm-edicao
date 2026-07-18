import { useState, useEffect } from "react";
import { ImageOff, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Extrai o fileId de uma URL de proxy do Drive.
 * Suporta /api/public/drive-foto/<id> e /api/public/momentos-foto/<id>.
 */
export function getDriveFileIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/\/api\/public\/(?:drive-foto|momentos-foto)\/([\w-]{10,})/);
  return m ? m[1] : null;
}

export function isDriveProxyUrl(url: string | null | undefined): boolean {
  return !!getDriveFileIdFromUrl(url);
}

export type DriveStatus = "idle" | "validating" | "ok" | "error";

interface DriveImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  /** Mostra um badge "Drive" no canto (útil no editor). */
  showBadge?: boolean;
  /** Indicador visual de validação/OK/erro no canto oposto. */
  status?: DriveStatus;
  /** Classe aplicada ao wrapper. */
  wrapperClassName?: string;
  /** Notifica o pai quando o carregamento falha ou volta a funcionar. */
  onErrorChange?: (hasError: boolean) => void;
}

/**
 * Componente de imagem com fallback visual e aviso quando o proxy do Drive
 * não encontra o arquivo. Padrão: lazy loading + decoding assíncrono para
 * economizar egress e melhorar Core Web Vitals em galerias.
 */
export function DriveImage({
  src,
  alt,
  showBadge,
  status,
  wrapperClassName,
  className,
  loading = "lazy",
  decoding = "async",
  onErrorChange,
  ...rest
}: DriveImageProps) {
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");

  // Reinicia quando o src muda (ex.: retry com cache-buster)
  useEffect(() => {
    setState("loading");
  }, [src]);

  useEffect(() => {
    onErrorChange?.(state === "error");
  }, [state, onErrorChange]);

  return (
    <div className={cn("relative size-full overflow-hidden bg-secondary", wrapperClassName)}>
      {state === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {state !== "error" && (
        <img
          {...rest}
          src={src}
          alt={alt}
          loading={loading}
          decoding={decoding}
          onLoad={() => setState("ok")}
          onError={() => setState("error")}
          className={cn(
            "size-full object-cover transition-opacity",
            state === "loading" ? "opacity-0" : "opacity-100",
            className,
          )}
        />
      )}

      {state === "error" && (
        <div
          role="img"
          aria-label={`Imagem indisponível: ${alt}`}
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 border border-dashed border-destructive/40 bg-destructive/5 p-3 text-center"
        >
          <ImageOff className="size-7 text-destructive/70" />
          <p className="text-xs font-medium text-destructive">Imagem indisponível</p>
          <p className="text-[10px] text-muted-foreground">Arquivo não encontrado no Drive.</p>
        </div>
      )}

      {showBadge && state === "ok" && (
        <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold uppercase text-white">
          Drive
        </span>
      )}

      {status && status !== "idle" && (
        <span
          className={cn(
            "pointer-events-none absolute right-2 top-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
            status === "validating" && "bg-muted text-muted-foreground",
            status === "ok" && "bg-emerald-600/90 text-white",
            status === "error" && "bg-destructive/90 text-white",
          )}
          aria-label={`Status: ${status}`}
        >
          {status === "validating" && <Loader2 className="size-3 animate-spin" />}
          {status === "ok" && <CheckCircle2 className="size-3" />}
          {status === "error" && <AlertTriangle className="size-3" />}
          {status === "validating" ? "Validando" : status === "ok" ? "OK" : "Erro"}
        </span>
      )}
    </div>
  );
}

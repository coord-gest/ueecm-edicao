import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GripVertical, RefreshCw, Trash2, ImageOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DriveImage, type DriveStatus } from "@/components/DriveImage";
import { verifyDriveFiles } from "@/lib/google-drive.functions";
import { cn } from "@/lib/utils";

export type GalleryItem = {
  fileId: string;
  name: string;
};

interface Props {
  items: GalleryItem[];
  onChange: (items: GalleryItem[]) => void;
  /** Notifica se qualquer item falhou (para bloquear o submit). */
  onStatusesChange?: (statuses: Record<string, DriveStatus>) => void;
}

const GALLERY_MARKER = /<div data-drive-gallery="1">[\s\S]*?<\/div>/;

/** Escapa apenas caracteres perigosos para atributos HTML. */
function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/** Extrai itens do bloco de galeria previamente serializado no conteúdo. */
export function parseGalleryFromContent(html: string): GalleryItem[] {
  const block = html.match(GALLERY_MARKER);
  if (!block) return [];
  const out: GalleryItem[] = [];
  const re =
    /<figure[^>]*>\s*<img\b[^>]*?data-drive-file-id="([^"]+)"[^>]*?alt="([^"]*)"[^>]*?\/?>[\s\S]*?<\/figure>|<figure[^>]*>\s*<img\b[^>]*?alt="([^"]*)"[^>]*?data-drive-file-id="([^"]+)"[^>]*?\/?>[\s\S]*?<\/figure>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block[0])) !== null) {
    const fileId = m[1] ?? m[4];
    const name = m[2] ?? m[3] ?? "";
    if (fileId) out.push({ fileId, name });
  }
  return out;
}

/** Serializa itens da galeria como bloco marcado (idempotente). */
export function serializeGallery(items: GalleryItem[]): string {
  if (items.length === 0) return "";
  const figures = items
    .map(
      (i) =>
        `<figure><img src="/api/public/drive-foto/${i.fileId}" alt="${escapeAttr(
          i.name,
        )}" data-drive-file-id="${i.fileId}" loading="lazy" decoding="async" sizes="(max-width: 640px) 100vw, 640px" /></figure>`,
    )
    .join("");
  return `<div data-drive-gallery="1">${figures}</div>`;
}

/** Substitui (ou anexa) o bloco de galeria dentro do HTML do conteúdo. */
export function replaceGalleryInContent(html: string, items: GalleryItem[]): string {
  const block = serializeGallery(items);
  if (GALLERY_MARKER.test(html)) {
    return html.replace(GALLERY_MARKER, block);
  }
  if (!block) return html;
  return `${html.trimEnd()}${block}`;
}

export function DriveGalleryManager({ items, onChange, onStatusesChange }: Props) {
  const [statuses, setStatuses] = useState<Record<string, DriveStatus>>({});
  const [retryToken, setRetryToken] = useState<Record<string, number>>({});
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fileIdsKey = useMemo(() => items.map((i) => i.fileId).join(","), [items]);

  // Valida (debounced) sempre que a lista muda
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (items.length === 0) {
      setStatuses({});
      onStatusesChange?.({});
      return;
    }
    setStatuses((prev) => {
      const next: Record<string, DriveStatus> = { ...prev };
      for (const it of items) {
        if (next[it.fileId] !== "ok" && next[it.fileId] !== "error") {
          next[it.fileId] = "validating";
        } else if (!next[it.fileId]) {
          next[it.fileId] = "validating";
        }
      }
      // Remove entradas de itens removidos
      for (const k of Object.keys(next)) {
        if (!items.find((i) => i.fileId === k)) delete next[k];
      }
      return next;
    });

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await verifyDriveFiles({
          data: { fileIds: items.map((i) => i.fileId) },
        });
        const next: Record<string, DriveStatus> = {};
        for (const id of res.valid) next[id] = "ok";
        for (const id of res.missing) next[id] = "error";
        for (const id of res.notImage) next[id] = "error";
        setStatuses(next);
        onStatusesChange?.(next);
      } catch {
        // rede/servidor: mantém validando para permitir retry manual
      }
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileIdsKey]);

  const remove = useCallback(
    (fileId: string) => onChange(items.filter((i) => i.fileId !== fileId)),
    [items, onChange],
  );

  const retry = useCallback(
    (fileId: string) => {
      setRetryToken((t) => ({ ...t, [fileId]: (t[fileId] ?? 0) + 1 }));
      setStatuses((s) => ({ ...s, [fileId]: "validating" }));
      // Re-valida imediatamente esse id
      verifyDriveFiles({ data: { fileIds: [fileId] } })
        .then((res) => {
          setStatuses((s) => {
            const next = { ...s };
            if (res.valid.includes(fileId)) next[fileId] = "ok";
            else next[fileId] = "error";
            onStatusesChange?.(next);
            return next;
          });
        })
        .catch(() => {
          setStatuses((s) => ({ ...s, [fileId]: "error" }));
        });
    },
    [onStatusesChange],
  );

  const handleDrop = (target: number) => {
    if (dragIndex === null || dragIndex === target) {
      setDragIndex(null);
      setOverIndex(null);
      return;
    }
    const next = [...items];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(target, 0, moved);
    onChange(next);
    setDragIndex(null);
    setOverIndex(null);
  };

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 bg-muted/30 p-4 text-center text-xs text-muted-foreground">
        Nenhuma imagem da galeria ainda. Clique em "Adicionar fotos do Drive".
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {items.map((it, idx) => {
        const status = statuses[it.fileId] ?? "validating";
        const token = retryToken[it.fileId] ?? 0;
        const src = `/api/public/drive-foto/${it.fileId}${token ? `?r=${token}` : ""}`;
        return (
          <li
            key={it.fileId}
            draggable
            onDragStart={() => setDragIndex(idx)}
            onDragOver={(e) => {
              e.preventDefault();
              setOverIndex(idx);
            }}
            onDragLeave={() => setOverIndex((v) => (v === idx ? null : v))}
            onDrop={(e) => {
              e.preventDefault();
              handleDrop(idx);
            }}
            onDragEnd={() => {
              setDragIndex(null);
              setOverIndex(null);
            }}
            className={cn(
              "group relative aspect-square overflow-hidden rounded-xl border bg-card transition",
              overIndex === idx && dragIndex !== null && dragIndex !== idx
                ? "border-primary ring-2 ring-primary/40"
                : "border-border/70",
              dragIndex === idx && "opacity-50",
            )}
            aria-label={`Item ${idx + 1}: ${it.name || it.fileId}`}
          >
            <DriveImage
              key={`${it.fileId}-${token}`}
              src={src}
              alt={it.name || `Imagem ${idx + 1}`}
              status={status}
              wrapperClassName="size-full"
            />

            {/* Handle de arraste */}
            <span
              className="pointer-events-none absolute bottom-1 left-1 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white opacity-0 transition group-hover:opacity-100"
              aria-hidden
            >
              <GripVertical className="size-3" /> {idx + 1}
            </span>

            {/* Ações */}
            <div className="absolute right-1 bottom-1 flex gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
              {status === "error" && (
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="size-7"
                  onClick={() => retry(it.fileId)}
                  aria-label="Tentar novamente"
                  title="Tentar carregar novamente"
                >
                  <RefreshCw className="size-3.5" />
                </Button>
              )}
              <Button
                type="button"
                size="icon"
                variant="destructive"
                className="size-7"
                onClick={() => remove(it.fileId)}
                aria-label="Remover da galeria"
                title="Remover"
              >
                {status === "error" ? (
                  <ImageOff className="size-3.5" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

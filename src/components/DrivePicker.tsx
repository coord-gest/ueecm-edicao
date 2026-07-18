import { useEffect, useState } from "react";
import { Loader2, Folder, ChevronRight, Home, ImageOff, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { listDrivePicker } from "@/lib/google-drive.functions";

type Node = {
  currentId: string;
  isRoot: boolean;
  breadcrumb: Array<{ id: string; name: string }>;
  folders: Array<{ id: string; name: string }>;
  images: Array<{ id: string; name: string; thumbnailLink: string | null; mimeType: string }>;
};

export type DrivePickerPick = { fileId: string; name: string; proxyUrl: string };

interface DrivePickerProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Seleção única (chamado imediatamente ao clicar na foto). */
  onPick?: (proxyUrl: string, meta: { fileId: string; name: string }) => void;
  /** Seleção múltipla: mostra checkboxes e devolve várias imagens ao confirmar. */
  multiple?: boolean;
  onPickMultiple?: (picks: DrivePickerPick[]) => void;
}

export function DrivePicker({
  open,
  onOpenChange,
  onPick,
  multiple,
  onPickMultiple,
}: DrivePickerProps) {
  const [loading, setLoading] = useState(false);
  const [node, setNode] = useState<Node | null>(null);
  const [, setStack] = useState<string[]>([]);
  const [selected, setSelected] = useState<Record<string, DrivePickerPick>>({});

  const load = async (folderId?: string) => {
    setLoading(true);
    try {
      const res = await listDrivePicker({ data: folderId ? { folderId } : {} });
      setNode(res);
    } catch (e) {
      toast.error("Erro ao carregar Drive", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setStack([]);
      setSelected({});
      load();
    }
  }, [open]);

  const enter = (id: string) => {
    setStack((s) => [...s, id]);
    load(id);
  };

  const goHome = () => {
    setStack([]);
    load();
  };

  const goCrumb = (id: string, idx: number) => {
    setStack((s) => s.slice(0, idx + 1));
    load(id);
  };

  const handleImageClick = (img: { id: string; name: string }) => {
    const proxyUrl = `/api/public/drive-foto/${img.id}`;
    if (multiple) {
      setSelected((prev) => {
        const next = { ...prev };
        if (next[img.id]) delete next[img.id];
        else next[img.id] = { fileId: img.id, name: img.name, proxyUrl };
        return next;
      });
    } else {
      onPick?.(proxyUrl, { fileId: img.id, name: img.name });
      onOpenChange(false);
    }
  };

  const confirmMultiple = () => {
    const picks = Object.values(selected);
    if (picks.length === 0) {
      toast.info("Selecione pelo menos uma foto");
      return;
    }
    onPickMultiple?.(picks);
    onOpenChange(false);
  };

  const selectedCount = Object.keys(selected).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {multiple ? "Escolher fotos do Google Drive" : "Escolher do Google Drive"}
          </DialogTitle>
          <DialogDescription>
            Navegue por <strong>UEECM/Momentos</strong>{" "}
            {multiple
              ? "e selecione várias fotos. As imagens serão servidas pelo proxy do Drive."
              : "e escolha uma foto já enviada."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-1 text-sm">
          <button
            type="button"
            onClick={goHome}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-secondary"
          >
            <Home className="size-3.5" /> Momentos
          </button>
          {node?.breadcrumb.map((c, i) => (
            <span key={c.id} className="inline-flex items-center gap-1">
              <ChevronRight className="size-3.5 text-muted-foreground" />
              <button
                type="button"
                onClick={() => goCrumb(c.id, i)}
                className="rounded-md px-2 py-1 hover:bg-secondary"
              >
                {c.name}
              </button>
            </span>
          ))}
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : !node ? null : (
          <div className="max-h-[60vh] overflow-y-auto pr-1">
            {node.folders.length > 0 && (
              <div className="mb-4">
                <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Pastas</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {node.folders.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => enter(f.id)}
                      className="flex items-center gap-2 rounded-xl border border-border/60 bg-card px-3 py-2 text-left text-sm hover:border-primary hover:bg-secondary"
                    >
                      <Folder className="size-4 shrink-0 text-primary" />
                      <span className="truncate">{f.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                Fotos ({node.images.length})
              </p>
              {node.images.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
                  <ImageOff className="size-8" />
                  <p className="text-sm">
                    {node.isRoot
                      ? "Escolha uma pasta de ano/evento para ver as fotos."
                      : "Nenhuma foto nesta pasta."}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                  {node.images.map((img) => {
                    const isChecked = !!selected[img.id];
                    return (
                      <button
                        key={img.id}
                        type="button"
                        onClick={() => handleImageClick(img)}
                        className={`group relative aspect-square overflow-hidden rounded-xl border bg-secondary transition ${
                          isChecked
                            ? "border-primary ring-2 ring-primary"
                            : "border-border/60 hover:border-primary"
                        }`}
                        title={img.name}
                      >
                        <img
                          src={`/api/public/drive-foto/${img.id}`}
                          alt={img.name}
                          loading="lazy"
                          className="size-full object-cover transition group-hover:scale-105"
                        />
                        {multiple && (
                          <span
                            className={`absolute right-2 top-2 flex size-6 items-center justify-center rounded-full border-2 ${
                              isChecked
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-white bg-black/40 text-transparent"
                            }`}
                          >
                            <Check className="size-3.5" />
                          </span>
                        )}
                        <span className="absolute inset-x-0 bottom-0 truncate bg-black/50 px-2 py-1 text-xs text-white">
                          {img.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          {multiple && (
            <p className="mr-auto text-xs text-muted-foreground">
              {selectedCount} foto{selectedCount === 1 ? "" : "s"} selecionada
              {selectedCount === 1 ? "" : "s"}
            </p>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          {multiple && (
            <Button onClick={confirmMultiple} disabled={selectedCount === 0}>
              Adicionar {selectedCount > 0 ? `(${selectedCount})` : ""}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

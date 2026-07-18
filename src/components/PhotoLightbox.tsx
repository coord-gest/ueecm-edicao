import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

export function PhotoLightbox({
  src,
  alt,
  open,
  onOpenChange,
}: {
  src: string;
  alt: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl border-0 bg-transparent p-0 shadow-none">
        <VisuallyHidden>
          <DialogTitle>{alt}</DialogTitle>
        </VisuallyHidden>
        <img
          src={src}
          alt={alt}
          className="mx-auto max-h-[85vh] w-auto rounded-2xl object-contain shadow-2xl"
        />
        <p className="mt-3 text-center text-sm text-white/90 drop-shadow">{alt}</p>
      </DialogContent>
    </Dialog>
  );
}

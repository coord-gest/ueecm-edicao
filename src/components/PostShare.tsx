import { useState } from "react";
import { Share2, Link2, Check, MessageCircle, Facebook, Twitter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

interface PostShareProps {
  title: string;
  text?: string;
  url?: string;
}

export function PostShare({ title, text, url }: PostShareProps) {
  const [copied, setCopied] = useState(false);
  const shareUrl = url ?? (typeof window !== "undefined" ? window.location.href : "");
  const shareText = text ?? title;

  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const handleNativeShare = async () => {
    try {
      await navigator.share({ title, text: shareText, url: shareUrl });
    } catch (err) {
      // usuário cancelou ou navegador não suporta - silencioso
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar o link");
    }
  };

  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedText = encodeURIComponent(shareText);

  return (
    <div className="mt-10 rounded-2xl border border-border/60 bg-card/40 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-semibold">Compartilhe esta notícia</h3>
          <p className="text-sm text-muted-foreground">Ajude a divulgar para mais pessoas.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canNativeShare && (
            <Button onClick={handleNativeShare} size="sm" className="rounded-full">
              <Share2 className="size-4" /> Compartilhar
            </Button>
          )}
          <Button
            onClick={() =>
              window.open(
                `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
                "_blank",
                "noopener,noreferrer",
              )
            }
            size="sm"
            variant="outline"
            className="rounded-full"
          >
            <MessageCircle className="size-4" /> WhatsApp
          </Button>
          <Button
            onClick={() =>
              window.open(
                `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
                "_blank",
                "noopener,noreferrer",
              )
            }
            size="sm"
            variant="outline"
            className="rounded-full"
          >
            <Twitter className="size-4" /> X
          </Button>
          <Button
            onClick={() =>
              window.open(
                `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
                "_blank",
                "noopener,noreferrer",
              )
            }
            size="sm"
            variant="outline"
            className="rounded-full"
          >
            <Facebook className="size-4" /> Facebook
          </Button>
          <Button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(shareUrl);
                toast.success("Link copiado! Agora cole no Instagram.");
                window.open("https://www.instagram.com/", "_blank", "noreferrer");
              } catch {
                toast.error("Não foi possível copiar o link");
              }
            }}
            size="sm"
            variant="outline"
            className="rounded-full"
          >
            <InstagramIcon className="size-4" /> Instagram
          </Button>
          <Button onClick={handleCopy} size="sm" variant="outline" className="rounded-full">
            {copied ? <Check className="size-4" /> : <Link2 className="size-4" />}
            {copied ? "Copiado" : "Copiar link"}
          </Button>
        </div>
      </div>
    </div>
  );
}

import { forwardRef, useRef, useState } from "react";
import { Download, Image as ImageIcon, Loader2 } from "lucide-react";
import { toPng } from "html-to-image";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";

export type ComunicadoImageData = {
  titulo: string;
  mensagem: string;
  autor?: string | null;
  data?: string | Date | null;
  destino?: string | null;
};

interface CardProps {
  data: ComunicadoImageData;
}

/** Card visual pronto para exportar como PNG.
 *  Estilo: cabeçalho institucional + corpo + rodapé assinado. */
export const ComunicadoImageCard = forwardRef<HTMLDivElement, CardProps>(function Card(
  { data },
  ref,
) {
  const when = data.data
    ? format(new Date(data.data), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })
    : format(new Date(), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });

  return (
    <div
      ref={ref}
      className="mx-auto w-full max-w-[640px] overflow-hidden rounded-2xl border border-border/70 bg-card shadow-lg"
    >
      {/* Cabeçalho */}
      <div className="relative flex items-center gap-3 bg-gradient-to-br from-primary/15 via-primary/8 to-transparent px-6 py-5">
        <img
          src={logo}
          alt="U.E.E.C.M."
          className="size-14 rounded-xl bg-background object-contain p-1 shadow-sm ring-1 ring-border/50"
        />
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
            U.E. Evaristo Campelo de Matos
          </p>
          <p className="font-display text-lg font-bold leading-tight text-foreground">
            Comunicado Oficial
          </p>
          <p className="text-[11px] text-muted-foreground">{when}</p>
        </div>
      </div>

      <div className="h-1 w-full bg-gradient-to-r from-primary via-primary/60 to-primary/20" />

      {/* Corpo */}
      <div className="px-6 py-6">
        {data.destino ? (
          <div className="mb-3 inline-flex items-center rounded-full border border-border/60 bg-muted/40 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            {data.destino}
          </div>
        ) : null}
        <h2 className="font-display text-2xl font-bold leading-tight text-foreground">
          {data.titulo || "Sem título"}
        </h2>
        <div className="mt-4 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-foreground/90">
          {data.mensagem || "Sem mensagem."}
        </div>
      </div>

      {/* Rodapé */}
      <div className="flex items-center justify-between gap-2 border-t border-border/60 bg-muted/40 px-6 py-3">
        <p className="text-[11px] text-muted-foreground">
          {data.autor ? `Por ${data.autor} · ` : ""}Gerado por conectaueecm.com
        </p>
        <img src={logo} alt="" className="size-6 opacity-70" />
      </div>
    </div>
  );
});

interface DownloadProps {
  data: ComunicadoImageData;
  fileName?: string;
  triggerLabel?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "default" | "lg";
  className?: string;
  /** Se true, também mostra o preview visual acima do botão. */
  showPreview?: boolean;
}

function slugify(s: string, max = 40) {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, max) || "comunicado"
  );
}

/** Botão + (opcional) preview que baixa o comunicado como PNG. */
export function ComunicadoDownloadImage({
  data,
  fileName,
  triggerLabel = "Baixar como imagem",
  variant = "default",
  size = "sm",
  className,
  showPreview = false,
}: DownloadProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setLoading(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: "#ffffff",
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${fileName ?? slugify(data.titulo)}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("Imagem gerada.");
    } catch (e) {
      toast.error("Falha ao gerar imagem", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={className}>
      {/* Preview sempre renderiza (fora de tela quando escondido) para o toPng funcionar */}
      <div className={showPreview ? "mb-3" : "pointer-events-none absolute -left-[10000px] top-0"}>
        <ComunicadoImageCard ref={cardRef} data={data} />
      </div>
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={handleDownload}
        disabled={loading}
        className="gap-1.5"
      >
        {loading ? <Loader2 className="size-4 animate-spin" /> : <ImageIcon className="size-4" />}
        {triggerLabel}
        {!loading ? <Download className="size-3.5 opacity-70" /> : null}
      </Button>
    </div>
  );
}

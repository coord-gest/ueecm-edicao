import { Share2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { shareOrCopy, type ShareData } from "@/lib/share";
import { cn } from "@/lib/utils";

type Props = Omit<ButtonProps, "onClick"> & {
  data: ShareData;
  label?: string;
  iconOnly?: boolean;
};

/**
 * Botão de compartilhar que usa Web Share API quando disponível
 * e cai para copiar-link como fallback. Acessível com aria-label
 * quando iconOnly=true.
 */
export function ShareButton({
  data,
  label = "Compartilhar",
  iconOnly = false,
  variant = "outline",
  size,
  className,
  ...rest
}: Props) {
  return (
    <Button
      type="button"
      variant={variant}
      size={size ?? (iconOnly ? "icon" : "sm")}
      aria-label={iconOnly ? label : undefined}
      className={cn(iconOnly && "min-h-11 min-w-11", className)}
      onClick={() => void shareOrCopy(data)}
      {...rest}
    >
      <Share2 className={cn("h-4 w-4", !iconOnly && "mr-2")} aria-hidden="true" />
      {!iconOnly && <span>{label}</span>}
    </Button>
  );
}

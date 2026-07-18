import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/hooks/use-online-status";

/**
 * Faixa fina no topo indicando modo offline. Renderiza somente quando
 * o navegador está sem conexão. Conteúdos cacheados (posts, comunicados,
 * horários) continuam disponíveis via Service Worker.
 */
export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex w-full items-center justify-center gap-2 bg-amber-500/95 px-3 py-1.5 text-xs font-medium text-amber-950 shadow-sm dark:bg-amber-400/90"
    >
      <WifiOff className="size-3.5" aria-hidden />
      <span>Você está offline — mostrando conteúdo salvo. Suas ações serão enviadas ao reconectar.</span>
    </div>
  );
}

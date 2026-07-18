import { useEffect, useState } from "react";

/**
 * Splash de boas-vindas do Titinho.
 * Aparece no cold-start do PWA (uma vez por sessão), sobre um fundo
 * bege igual ao background_color do manifest, e some com fade após ~1.8s.
 *
 * Não substitui a splash nativa do Android (que exibe o ícone do app):
 * ela roda depois, já dentro do app, como uma saudação do mascote.
 */
export function TitinhoWelcome() {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Só exibe no PWA/APP instalado (standalone) — no navegador desktop/web não aparece.
    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      window.matchMedia?.("(display-mode: fullscreen)").matches ||
      // iOS Safari
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (!isStandalone) return;
    try {
      if (sessionStorage.getItem("titinho-welcome-shown") === "1") return;
      sessionStorage.setItem("titinho-welcome-shown", "1");
    } catch {
      // sessionStorage indisponível — segue mostrando mesmo assim
    }
    setVisible(true);

    const fadeTimer = window.setTimeout(() => setFading(true), 4500);
    const hideTimer = window.setTimeout(() => setVisible(false), 5000);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      role="presentation"
      aria-hidden="true"
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-4 bg-[#F8F6EE] transition-opacity duration-500"
      style={{ opacity: fading ? 0 : 1 }}
    >
      <img
        src="/tito-splash.webp"
        alt=""
        className="max-h-[70vh] w-auto animate-in fade-in zoom-in-95 duration-700 drop-shadow-xl"
      />
      <div className="text-center animate-in fade-in slide-in-from-bottom-2 duration-700">
        <p className="text-2xl font-bold text-foreground">O APP da Escola UEECM</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Bem-vindo à U.E. Evaristo Campelo de Matos
        </p>
      </div>
    </div>
  );
}

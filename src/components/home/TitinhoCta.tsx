import { MessageCircle, Sparkles } from "lucide-react";
import titoAvatar from "/tito-avatar.webp?url";
import { useReveal } from "@/hooks/use-reveal";

export function TitinhoCta() {
  const ref = useReveal<HTMLDivElement>();

  const openChat = () => {
    // O ChatWidget escuta este evento global.
    window.dispatchEvent(new CustomEvent("open-titinho"));
  };

  return (
    <div ref={ref} className="reveal mb-10 mt-12 md:mb-16 md:mt-20">
      <div className="relative overflow-hidden rounded-[5px] border border-border bg-[image:var(--gradient-hero)] p-6 text-white shadow-lg sm:p-8">
        <span className="absolute -right-10 -top-10 size-40 rounded-full bg-gold/20 blur-3xl" />
        <div className="relative flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:text-left">
          <img
            src={titoAvatar}
            alt="Titinho, assistente da escola"
            className="size-24 shrink-0 rounded-full bg-background/10 ring-4 ring-gold/40 sm:size-28"
            loading="lazy"
          />
          <div className="flex-1 text-center sm:text-left">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/25 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-gold">
              <Sparkles className="size-3" aria-hidden /> Assistente virtual
            </span>
            <h3 className="mt-2 font-display text-2xl leading-tight sm:text-3xl">
              Precisa de ajuda? Fale com o Tito
            </h3>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/85 sm:text-base">
              Ele responde sobre horários, calendário, comunicados e ajuda você a encontrar o que
              precisa no portal.
            </p>
          </div>
          <button
            type="button"
            onClick={openChat}
            className="inline-flex shrink-0 items-center gap-2 bg-gold px-5 py-3 text-sm font-semibold text-gold-foreground transition-colors hover:bg-gold/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            <MessageCircle className="size-4" aria-hidden />
            Conversar agora
          </button>
        </div>
      </div>
    </div>
  );
}

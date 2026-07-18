import { MapPin, Phone, MessageCircle, Mail } from "lucide-react";
import { useReveal } from "@/hooks/use-reveal";

export function QuickContact() {
  const ref = useReveal<HTMLElement>();

  return (
    <section ref={ref} className="reveal mb-16">
      <div className="relative grid grid-cols-1 gap-6 overflow-hidden rounded-2xl border border-border bg-linear-to-br from-primary to-accent p-6 text-primary-foreground shadow-lg sm:p-8 lg:grid-cols-4">
        <span className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-linear-to-r from-gold via-gold/70 to-transparent" />
        <span className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-gold/20 blur-3xl" />
        <span className="pointer-events-none absolute -bottom-20 -left-16 size-64 rounded-full bg-accent/40 blur-3xl" />
        <a
          href="https://wa.me/5500000000000"
          target="_blank"
          rel="noopener noreferrer"
          className="group relative flex items-start gap-3 rounded-xl border border-primary-foreground/10 bg-primary-foreground/5 p-3 backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-gold/50 hover:bg-primary-foreground/10"
        >
          <div className="grid size-11 shrink-0 place-items-center rounded-full bg-gold text-gold-foreground shadow-md">
            <MessageCircle className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-gold">
              WhatsApp
            </div>
            <div className="mt-0.5 truncate text-sm font-semibold text-primary-foreground">
              Fale conosco
            </div>
          </div>
        </a>

        <a
          href="tel:+5500000000000"
          className="group relative flex items-start gap-3 rounded-xl border border-primary-foreground/10 bg-primary-foreground/5 p-3 backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-gold/50 hover:bg-primary-foreground/10"
        >
          <div className="grid size-11 shrink-0 place-items-center rounded-full bg-gold text-gold-foreground shadow-md">
            <Phone className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-gold">
              Telefone
            </div>
            <div className="mt-0.5 truncate text-sm font-semibold text-primary-foreground">
              Ligue direto
            </div>
          </div>
        </a>

        <a
          href="mailto:contato@conectaueecm.com"
          className="group relative flex items-start gap-3 rounded-xl border border-primary-foreground/10 bg-primary-foreground/5 p-3 backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-gold/50 hover:bg-primary-foreground/10"
        >
          <div className="grid size-11 shrink-0 place-items-center rounded-full bg-gold text-gold-foreground shadow-md">
            <Mail className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-gold">
              E-mail
            </div>
            <div className="mt-0.5 truncate text-sm font-semibold text-primary-foreground">
              contato@conectaueecm.com
            </div>
          </div>
        </a>

        <a
          href="https://maps.app.goo.gl/Ly53bRbMZtcqB9FJ9"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Abrir endereço no Google Maps"
          className="group relative flex items-start gap-3 rounded-xl border border-primary-foreground/10 bg-primary-foreground/5 p-3 backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-gold/50 hover:bg-primary-foreground/10"
        >
          <div className="grid size-11 shrink-0 place-items-center rounded-full bg-gold text-gold-foreground shadow-md">
            <MapPin className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-gold">
              Endereço
            </div>
            <div className="mt-0.5 text-sm font-semibold text-primary-foreground">
              Visite a UEECM
            </div>
          </div>
        </a>
      </div>
    </section>
  );
}

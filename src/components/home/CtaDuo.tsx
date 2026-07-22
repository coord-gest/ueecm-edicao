import { Link } from "@tanstack/react-router";
import { CalendarClock, ArrowRight, LogIn } from "lucide-react";
import { useReveal } from "@/hooks/use-reveal";

export function CtaDuo() {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className="reveal mb-10 md:mb-16 grid gap-4 md:grid-cols-2">
      <Link
        to="/agendar"
        className="group relative overflow-hidden rounded-[5px] border-2 border-border bg-[image:var(--gradient-hero)] p-6 text-white shadow-md ring-1 ring-black/5 transition-all hover:-translate-y-0.5 hover:shadow-xl sm:p-8"
      >
        <span className="absolute -right-6 -top-6 size-32 rounded-full bg-gold/20 blur-2xl transition-transform group-hover:scale-125" />
        <div className="relative flex items-start gap-4">
          <div className="inline-flex size-12 shrink-0 items-center justify-center bg-gold text-gold-foreground">
            <CalendarClock className="size-6" aria-hidden />
          </div>
          <div className="flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gold">
              Atendimento
            </p>
            <h3 className="mt-1 font-display text-xl leading-tight sm:text-2xl">
              Agende um horário com a equipe
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-white/85">
              Fale com direção, coordenação ou secretaria em um horário reservado.
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-gold">
              Agendar agora{" "}
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
            </span>
          </div>
        </div>
      </Link>

      <Link
        to="/login"
        className="group relative overflow-hidden rounded-[5px] border-2 border-border bg-card p-6 text-foreground shadow-md ring-1 ring-black/5 transition-all hover:-translate-y-0.5 hover:border-accent hover:shadow-xl sm:p-8"
      >
        <span className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-accent to-gold" />
        <div className="flex items-start gap-4">
          <div className="inline-flex size-12 shrink-0 items-center justify-center bg-accent/10 text-accent transition-colors group-hover:bg-accent group-hover:text-accent-foreground">
            <LogIn className="size-6" aria-hidden />
          </div>
          <div className="flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-accent">
              Portal
            </p>
            <h3 className="mt-1 font-display text-xl leading-tight text-primary sm:text-2xl">
              Acesse a área da comunidade
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Responsáveis, alunos e professores: notas, avisos e comunicados no seu perfil.
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-accent">
              Entrar{" "}
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
            </span>
          </div>
        </div>
      </Link>
    </div>
  );
}

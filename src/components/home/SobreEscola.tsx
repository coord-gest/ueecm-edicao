import { Link } from "@tanstack/react-router";
import { ArrowRight, Calendar, MapPin, Sparkles } from "lucide-react";
import { useReveal } from "@/hooks/use-reveal";

export function SobreEscola() {
  const ref = useReveal<HTMLElement>();

  return (
    <section ref={ref} className="reveal mb-10 md:mb-16">
      <div className="relative overflow-hidden border border-accent/25 bg-[image:var(--gradient-primary)] text-white shadow-elegant">
        <span
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-gold/30 blur-3xl"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-20 size-80 rounded-full bg-accent/40 blur-3xl"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-gold via-accent to-gold"
        />
        <div className="relative grid gap-8 p-6 sm:p-10 lg:grid-cols-5 lg:items-center">
          <div className="lg:col-span-3">
            <p className="inline-flex items-center gap-2 rounded-full bg-gold/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-gold ring-1 ring-gold/40">
              <Sparkles className="size-3.5" /> Sobre a nossa escola
            </p>
            <h2 className="mt-3 font-display text-2xl text-white sm:text-3xl lg:text-4xl">
              De duas salas em 1982 a referência em Assunção do Piauí
            </h2>
            <p className="mt-4 text-base leading-relaxed text-white/85">
              A <strong className="text-gold">U.E. Evaristo Campelo de Matos</strong> nasceu em
              1982, com apenas duas salas de aula, na administração de Nilo Campelo de Matos, e foi
              ampliada e reconstruída ao longo dos anos por gestores comprometidos com a educação
              pública. Seu nome homenageia <strong className="text-gold">Evaristo Campelo</strong>,
              vereador e figura marcante da história local. Hoje é referência no ensino fundamental
              na cidade — construída em parceria com famílias, professores e comunidade.
            </p>
            <Link
              to="/sobre"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-gold-foreground shadow-gold transition-transform hover:-translate-y-0.5 hover:bg-gold/90"
            >
              Conheça nossa história <ArrowRight className="size-4" />
            </Link>
          </div>
          <ul className="grid gap-3 lg:col-span-2">
            <MiniFact
              icon={Calendar}
              title="Fundada em 1982"
              text="44 anos de tradição educacional (desde 1982)"
            />
            <MiniFact
              icon={MapPin}
              title="Assunção do Piauí – PI"
              text="Rua Pedro Lacerda Cavalcante, s/n · CEP 64333-000"
            />
            <MiniFact
              icon={Sparkles}
              title="Ensino fundamental completo"
              text="Anos iniciais e finais, com projetos culturais e esportivos"
            />
          </ul>
        </div>
      </div>
    </section>
  );
}

function MiniFact({
  icon: Icon,
  title,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
}) {
  return (
    <li className="flex items-start gap-3 border border-white/15 bg-white/10 p-3.5 backdrop-blur-sm transition-colors hover:border-gold/50 hover:bg-white/15">
      <div className="grid size-10 shrink-0 place-items-center rounded-full bg-gold text-gold-foreground shadow-gold">
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-white/75">{text}</p>
      </div>
    </li>
  );
}

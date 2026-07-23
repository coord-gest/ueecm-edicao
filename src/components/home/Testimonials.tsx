import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Quote, ArrowRight } from "lucide-react";
import { useReveal } from "@/hooks/use-reveal";
import { Button } from "@/components/ui/button";
import { FamiliasSubmitDialog } from "@/components/home/FamiliasSubmitDialog";
import {
  listarDepoimentosAprovados,
  type DepoimentoPublico,
} from "@/lib/familias-depoimentos.functions";

const FALLBACK: Array<{ quote: string; autor: string; papel: string }> = [
  {
    quote:
      "Nossos filhos crescem cercados de cuidado, disciplina e afeto. A UEECM é parte da nossa família.",
    autor: "Família Andrade",
    papel: "Responsáveis — 6º ano",
  },
  {
    quote:
      "Os professores conhecem cada aluno pelo nome, pela história. Isso faz toda a diferença no aprendizado.",
    autor: "Márcia Ferreira",
    papel: "Mãe de aluna do Fundamental II",
  },
  {
    quote: "Aqui eu não sou só um número. Os professores me apoiam mesmo nos dias difíceis.",
    autor: "João P.",
    papel: "Aluno — 9º ano",
  },
];

const VINCULO_LABEL: Record<string, string> = {
  mae: "Mãe",
  pai: "Pai",
  responsavel: "Responsável",
  aluno: "Aluno(a)",
  professor: "Professor(a)",
  ex_aluno: "Ex-aluno(a)",
  comunidade: "Comunidade",
};

function papelFromDep(d: DepoimentoPublico): string {
  const vinc = VINCULO_LABEL[d.vinculo] ?? "Comunidade";
  const turma = d.turma_ano ? ` — ${d.turma_ano}` : "";
  return `${vinc}${turma}`.toUpperCase();
}

export function Testimonials() {
  const ref = useReveal<HTMLElement>();
  const [ativo, setAtivo] = useState(0);

  const { data: banco } = useQuery({
    queryKey: ["familias-depoimentos-aprovados"],
    queryFn: () => listarDepoimentosAprovados(),
    staleTime: 5 * 60_000,
  });

  const depoimentos = useMemo(() => {
    if (banco && banco.length > 0) {
      return banco.slice(0, 6).map((d) => ({
        quote: d.mensagem,
        autor: d.autor_nome || "Anônimo",
        papel: papelFromDep(d),
      }));
    }
    return FALLBACK;
  }, [banco]);

  useEffect(() => {
    if (depoimentos.length <= 1) return;
    const id = setInterval(() => setAtivo((i) => (i + 1) % depoimentos.length), 10000);
    return () => clearInterval(id);
  }, [depoimentos.length]);

  useEffect(() => {
    if (ativo >= depoimentos.length) setAtivo(0);
  }, [ativo, depoimentos.length]);

  const atual = depoimentos[ativo] ?? depoimentos[0];

  return (
    <section ref={ref} className="reveal mb-10 md:mb-16">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3 border-b-2 border-primary pb-3">
        <h2 className="font-display text-2xl text-primary sm:text-3xl lg:text-4xl">
          Famílias UEECM
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <FamiliasSubmitDialog variant="outline" />
          <Button asChild variant="ghost" size="sm">
            <Link to="/familias">
              Ver todos <ArrowRight className="ml-1 size-3.5" aria-hidden />
            </Link>
          </Button>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-[5px] border border-tint-blue-foreground/15 bg-tint-blue p-8 text-tint-blue-foreground shadow-elegant sm:p-12">
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-primary" />
        <Quote
          className="absolute -top-2 left-4 size-20 text-primary/20 sm:-top-4 sm:left-8 sm:size-32"
          strokeWidth={1.5}
        />
        <div key={ativo} className="relative animate-fade-in">
          <blockquote className="font-display text-xl leading-relaxed text-tint-blue-foreground sm:text-2xl lg:text-3xl">
            “{atual.quote}”
          </blockquote>
          <div className="mt-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-tint-blue-foreground/20" />
            <div className="text-right">
              <div className="text-sm font-semibold text-primary">{atual.autor}</div>
              <div className="text-xs uppercase tracking-widest text-tint-blue-foreground/70">
                {atual.papel}
              </div>
            </div>
          </div>
        </div>

        {depoimentos.length > 1 && (
          <div className="relative mt-8 flex justify-center gap-2">
            {depoimentos.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setAtivo(i)}
                aria-label={`Depoimento ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  i === ativo ? "w-8 bg-primary" : "w-1.5 bg-tint-blue-foreground/25"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

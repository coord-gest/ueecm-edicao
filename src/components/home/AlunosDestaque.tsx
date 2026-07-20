import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Award, Star } from "lucide-react";
import { useReveal } from "@/hooks/use-reveal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listDestaquesPublicos } from "@/lib/alunos-destaque.functions";

function firstOfMonth(offset = 0) {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

function mesLabel(iso: string) {
  const [y, m] = iso.split("-");
  const nomes = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];
  return `${nomes[Number(m) - 1]} / ${y}`;
}

function initials(nome: string) {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function AlunosDestaque() {
  const ref = useReveal<HTMLElement>();
  const meses = useMemo(() => [firstOfMonth(0), firstOfMonth(-1), firstOfMonth(-2)], []);
  const [mes, setMes] = useState(meses[0]);

  const { data, isLoading } = useQuery({
    queryKey: ["alunos-destaque-publicos", mes],
    queryFn: () => listDestaquesPublicos({ data: { mes } }),
    staleTime: 5 * 60_000,
  });

  const destaques = data?.rows ?? [];

  return (
    <section ref={ref} className="reveal mb-16">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3 border-b-2 border-primary pb-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-2xl text-primary sm:text-3xl lg:text-4xl">
            <Award className="size-7 text-gold" aria-hidden />
            Alunos de Destaque do Mês
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Reconhecimento aos alunos escolhidos por professores e coordenação.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={mes} onValueChange={setMes}>
            <SelectTrigger className="h-9 w-[180px] rounded-full">
              <SelectValue placeholder="Mês" />
            </SelectTrigger>
            <SelectContent>
              {meses.map((m) => (
                <SelectItem key={m} value={m}>
                  {mesLabel(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button asChild variant="ghost" size="sm">
            <Link to="/alunos-destaque">
              Ver todos <ArrowRight className="ml-1 size-3.5" aria-hidden />
            </Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-56 animate-pulse border border-border bg-card" />
          ))}
        </div>
      ) : destaques.length === 0 ? (
        <div className="border border-dashed border-border bg-card p-10 text-center">
          <Star className="mx-auto mb-3 size-8 text-muted-foreground/60" aria-hidden />
          <p className="font-display text-foreground">
            Nenhum destaque publicado para {mesLabel(mes)}.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Assim que a coordenação aprovar as indicações do mês, elas aparecerão aqui.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {destaques.slice(0, 10).map((d) => (
            <article
              key={d.id}
              className="group relative overflow-hidden border border-border bg-[image:var(--gradient-primary)] p-4 text-white shadow-md ring-1 ring-black/5 transition-all hover:-translate-y-0.5 hover:border-gold hover:shadow-xl"
            >
              <span className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-linear-to-r from-gold via-gold/70 to-transparent" />
              <span className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-gold/20 blur-2xl transition-transform group-hover:scale-125" />
              <div className="absolute right-3 top-3 z-10 flex size-8 items-center justify-center rounded-full bg-gold text-xs font-bold text-gold-foreground shadow-md">
                {d.posicao}º
              </div>
              <div className="relative mb-3 flex justify-center">
                {d.exibir_foto && d.foto_url ? (
                  <img
                    src={d.foto_url}
                    alt={d.aluno_nome}
                    className="size-20 rounded-full border-2 border-gold object-cover shadow-md"
                    loading="lazy"
                  />
                ) : (
                  <>
                    <div
                      className="flex size-20 items-center justify-center rounded-full border-2 border-dashed border-gold/60 bg-white/10 text-lg font-semibold text-gold"
                      style={
                        d.disciplina_cor
                          ? { borderColor: d.disciplina_cor, color: d.disciplina_cor }
                          : undefined
                      }
                      aria-hidden
                    >
                      <img src="/tito-avatar.webp" alt="" className="size-12 opacity-60" />
                    </div>
                    <span className="sr-only">{initials(d.aluno_nome)}</span>
                  </>
                )}
              </div>
              <h3 className="relative line-clamp-2 text-center font-display text-sm font-semibold text-white">
                {d.aluno_nome}
              </h3>
              <p className="relative mt-1 text-center text-xs text-white/80">
                {d.turma_nome}
              </p>
              {d.disciplina_nome && (
                <div className="relative mt-2 flex justify-center">
                  <Badge
                    variant="outline"
                    className="border-gold/60 text-[10px] text-gold"
                    style={
                      d.disciplina_cor
                        ? {
                            borderColor: d.disciplina_cor,
                            color: d.disciplina_cor,
                          }
                        : undefined
                    }
                  >
                    {d.disciplina_nome}
                  </Badge>
                </div>
              )}
              <p className="relative mt-3 line-clamp-3 text-center text-xs italic text-white/85">
                “{d.motivo}”
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

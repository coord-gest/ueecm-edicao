import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Quote, Filter } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FamiliasSubmitDialog } from "@/components/home/FamiliasSubmitDialog";
import {
  listarDepoimentosAprovados,
  type DepoimentoPublico,
} from "@/lib/familias-depoimentos.functions";

export const Route = createFileRoute("/familias")({
  component: FamiliasPage,
  head: () => ({
    meta: [
      { title: "Famílias UEECM — Depoimentos, elogios e sugestões" },
      {
        name: "description",
        content:
          "Depoimentos, elogios e sugestões de famílias, alunos e comunidade da UEECM Evaristo Campelo.",
      },
      { property: "og:title", content: "Famílias UEECM" },
      {
        property: "og:description",
        content: "O que famílias e alunos dizem sobre a UEECM Evaristo Campelo.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://conectaueecm.com/familias" },
      { property: "og:image", content: "https://conectaueecm.com/og-image.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://conectaueecm.com/og-image.jpg" },
    ],
    links: [{ rel: "canonical", href: "https://conectaueecm.com/familias" }],
  }),
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-destructive">
      Erro ao carregar depoimentos: {error.message}
    </div>
  ),
  notFoundComponent: () => <div className="p-8">Não encontrado.</div>,
});

const VINCULO_LABEL: Record<string, string> = {
  mae: "Mãe",
  pai: "Pai",
  responsavel: "Responsável",
  aluno: "Aluno(a)",
  professor: "Professor(a)",
  ex_aluno: "Ex-aluno(a)",
  comunidade: "Comunidade",
};

const TIPO_LABEL: Record<string, string> = {
  elogio: "Elogio",
  comentario: "Comentário",
  sugestao: "Sugestão",
};

function CardDep({ d }: { d: DepoimentoPublico }) {
  const vincLabel = VINCULO_LABEL[d.vinculo] ?? "Comunidade";
  return (
    <article className="relative rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:shadow-md">
      <Quote className="absolute right-4 top-4 size-8 text-accent/15" strokeWidth={1.5} />
      <span className="inline-block rounded-full bg-accent/10 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider text-accent">
        {TIPO_LABEL[d.tipo] ?? d.tipo}
      </span>
      <blockquote className="mt-3 text-base leading-relaxed text-foreground">
        “{d.mensagem}”
      </blockquote>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <div className="text-sm font-semibold text-primary">
          {d.autor_nome || "Anônimo"}
          {d.autor_idade ? (
            <span className="text-muted-foreground font-normal"> · {d.autor_idade} anos</span>
          ) : null}
        </div>
        <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
          {vincLabel}
          {d.turma_ano ? ` — ${d.turma_ano}` : ""}
        </div>
      </div>
    </article>
  );
}

function FamiliasPage() {
  const listar = useServerFn(listarDepoimentosAprovados);
  const { data, isLoading } = useQuery({
    queryKey: ["familias-depoimentos-aprovados", "full"],
    queryFn: () => listar(),
    staleTime: 3 * 60_000,
  });

  const [tipo, setTipo] = useState<string>("todos");
  const [vinc, setVinc] = useState<string>("todos");

  const filtrados = useMemo(() => {
    const arr = data ?? [];
    return arr.filter((d) => {
      if (tipo !== "todos" && d.tipo !== tipo) return false;
      if (vinc !== "todos" && d.vinculo !== vinc) return false;
      return true;
    });
  }, [data, tipo, vinc]);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b-2 border-primary pb-4">
          <div>
            <h1 className="font-display text-3xl text-primary sm:text-4xl">Famílias UEECM</h1>
            <p className="mt-2 text-muted-foreground">
              Depoimentos, elogios e sugestões de quem faz parte da nossa comunidade.
            </p>
          </div>
          <FamiliasSubmitDialog />
        </header>

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Filter className="size-4 text-muted-foreground" aria-hidden />
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              <SelectItem value="elogio">Elogios</SelectItem>
              <SelectItem value="comentario">Comentários</SelectItem>
              <SelectItem value="sugestao">Sugestões</SelectItem>
            </SelectContent>
          </Select>

          <Select value={vinc} onValueChange={setVinc}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Vínculo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os vínculos</SelectItem>
              {Object.entries(VINCULO_LABEL).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span className="ml-auto text-sm text-muted-foreground">
            {filtrados.length} depoimento{filtrados.length === 1 ? "" : "s"}
          </span>
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-52 rounded-2xl" />
            ))}
          </div>
        ) : filtrados.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
            Ainda não temos depoimentos publicados nesse filtro.
            <br />
            <span className="text-sm">Seja o primeiro a deixar o seu!</span>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtrados.map((d) => (
              <CardDep key={d.id} d={d} />
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { ArrowLeft, Award, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { PhotoLightbox } from "@/components/PhotoLightbox";
import {
  listDestaquesPublicos,
  listTurmasComDestaques,
  listDisciplinasComDestaques,
  type DestaquePublico,
} from "@/lib/alunos-destaque.functions";

export const Route = createFileRoute("/alunos-destaque")({
  head: () => ({
    meta: [
      { title: "Alunos de Destaque do Mês | U.E. Evaristo Campelo de Matos" },
      {
        name: "description",
        content:
          "Reconhecimento aos alunos escolhidos por professores e coordenação da U.E. Evaristo Campelo de Matos.",
      },
      { property: "og:title", content: "Alunos de Destaque do Mês | UEECM" },
      {
        property: "og:description",
        content: "Conheça os alunos que se destacaram no mês em cada turma e disciplina.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://conectaueecm.com/alunos-destaque" },
      { property: "og:image", content: "https://conectaueecm.com/og-image.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://conectaueecm.com/og-image.jpg" },
    ],
    links: [{ rel: "canonical", href: "https://conectaueecm.com/alunos-destaque" }],
  }),
  component: AlunosDestaquePage,
});

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

const PAGE_SIZE = 20;

function AlunosDestaquePage() {
  const meses = useMemo(
    () => [firstOfMonth(0), firstOfMonth(-1), firstOfMonth(-2), firstOfMonth(-3)],
    [],
  );
  const [mes, setMes] = useState(meses[0]);
  const [turma, setTurma] = useState<string>("todas");
  const [disciplina, setDisciplina] = useState<string>("todas");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);

  const { data: turmas } = useQuery({
    queryKey: ["destaques-turmas", mes],
    queryFn: () => listTurmasComDestaques({ data: { mes } }),
    staleTime: 60_000,
  });

  const { data: disciplinas } = useQuery({
    queryKey: ["destaques-disciplinas", mes],
    queryFn: () => listDisciplinasComDestaques({ data: { mes } }),
    staleTime: 60_000,
  });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["alunos-destaque-publicos-full", mes, turma, disciplina, q, page],
    queryFn: () =>
      listDestaquesPublicos({
        data: {
          mes,
          turma_nome: turma === "todas" ? null : turma,
          disciplina_nome: disciplina === "todas" ? null : disciplina,
          q: q.trim() || null,
          page,
          page_size: PAGE_SIZE,
        },
      }),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  const destaques = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const grupos = useMemo(() => {
    const g = new Map<string, DestaquePublico[]>();
    for (const d of destaques) {
      const chave = d.turma_nome;
      if (!g.has(chave)) g.set(chave, []);
      g.get(chave)!.push(d);
    }
    return Array.from(g.entries()).sort(([a], [b]) => a.localeCompare(b, "pt-BR"));
  }, [destaques]);

  const resetPage = () => setPage(1);

  return (
    <div className="min-h-dvh bg-secondary">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/">
              <ArrowLeft className="mr-1 size-4" aria-hidden /> Voltar
            </Link>
          </Button>
        </div>

        <header className="mb-8 text-center">
          <div className="mb-3 flex justify-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-gold/20">
              <Award className="size-8 text-gold" aria-hidden />
            </div>
          </div>
          <h1 className="font-display text-3xl text-primary sm:text-4xl lg:text-5xl">
            Alunos de Destaque do Mês
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
            Reconhecimento aos alunos escolhidos por professores e coordenação — {mesLabel(mes)}.
          </p>
        </header>

        <div className="mb-6 grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                resetPage();
              }}
              placeholder="Buscar aluno ou turma..."
              className="pl-9"
              maxLength={80}
            />
          </div>
          <Select
            value={turma}
            onValueChange={(v) => {
              setTurma(v);
              resetPage();
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todas as turmas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as turmas</SelectItem>
              {(turmas ?? []).map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={disciplina}
            onValueChange={(v) => {
              setDisciplina(v);
              resetPage();
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todas as disciplinas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as disciplinas</SelectItem>
              {(disciplinas ?? []).map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={mes}
            onValueChange={(v) => {
              setMes(v);
              resetPage();
            }}
          >
            <SelectTrigger>
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
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="h-64 animate-pulse rounded-2xl border border-border bg-card"
              />
            ))}
          </div>
        ) : grupos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <p className="font-display text-lg text-foreground">Nenhum destaque encontrado.</p>
            <p className="mt-2 text-sm text-muted-foreground">Ajuste a busca, o mês ou a turma.</p>
          </div>
        ) : (
          <div className={`space-y-10 ${isFetching ? "opacity-70" : ""}`}>
            {grupos.map(([turmaNome, itens]) => (
              <section key={turmaNome}>
                <h2 className="mb-4 border-l-4 border-gold pl-3 font-display text-xl text-primary sm:text-2xl">
                  {turmaNome}
                </h2>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                  {itens.map((d) => (
                    <article
                      key={d.id}
                      className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-[0_4px_16px_-8px_rgb(0_0_0_/_0.12)]"
                    >
                      <div className="absolute right-3 top-3 z-10 flex size-8 items-center justify-center rounded-full bg-gold text-xs font-bold text-gold-foreground">
                        {d.posicao}º
                      </div>
                      <div className="mb-3 flex justify-center">
                        {d.exibir_foto && d.foto_url ? (
                          <button
                            type="button"
                            onClick={() => setLightbox({ src: d.foto_url!, alt: d.aluno_nome })}
                            className="rounded-full ring-offset-2 ring-offset-card transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                            aria-label={`Ver foto de ${d.aluno_nome}`}
                          >
                            <img
                              src={d.foto_url}
                              alt={d.aluno_nome}
                              className="size-20 rounded-full border-2 border-gold/50 object-cover"
                              loading="lazy"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = "none";
                              }}
                            />
                          </button>
                        ) : (
                          <div
                            className="flex size-20 items-center justify-center rounded-full border-2 border-dashed border-border bg-secondary"
                            aria-hidden
                          >
                            <img src="/tito-avatar.webp" alt="" className="size-12 opacity-60" />
                          </div>
                        )}
                      </div>
                      <h3 className="line-clamp-2 text-center font-display text-sm font-semibold text-primary">
                        {d.aluno_nome}
                      </h3>
                      {d.disciplina_nome && (
                        <div className="mt-2 flex justify-center">
                          <Badge
                            variant="outline"
                            className="text-[10px]"
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
                      <p className="mt-3 line-clamp-4 text-center text-xs italic text-muted-foreground">
                        “{d.motivo}”
                      </p>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {total > PAGE_SIZE && (
          <div className="mt-8 flex items-center justify-center gap-3">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || isFetching}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </Button>
            <span className="text-sm text-muted-foreground">
              Página {page} de {totalPages} · {total} registro{total !== 1 ? "s" : ""}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || isFetching}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Próxima
            </Button>
          </div>
        )}
      </main>
      <SiteFooter />
      {lightbox && (
        <PhotoLightbox
          src={lightbox.src}
          alt={lightbox.alt}
          open={!!lightbox}
          onOpenChange={(v) => !v && setLightbox(null)}
        />
      )}
    </div>
  );
}

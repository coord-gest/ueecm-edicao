import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { GraduationCap, Briefcase, Star, Search } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProfissionalPerfilDialog } from "@/components/equipe/ProfissionalPerfilDialog";

import { supabase } from "@/integrations/supabase/client";
import {
  CARGO_LABEL,
  CARGO_ORDER,
  getInitials,
  tempoDeProfissao,
  type Cargo,
  type Profissional,
} from "@/lib/profissionais";

export const Route = createFileRoute("/equipe")({
  validateSearch: (search: Record<string, unknown>): { perfil?: string } => {
    const perfil = typeof search.perfil === "string" && search.perfil ? search.perfil : undefined;
    return perfil ? { perfil } : {};
  },
  head: () => ({
    meta: [
      { title: "Nossa Equipe — U.E. Evaristo Campelo de Matos" },
      {
        name: "description",
        content:
          "Conheça os profissionais da educação da U.E. Evaristo Campelo de Matos: diretoria, coordenação, professores e secretaria.",
      },
      { property: "og:title", content: "Nossa Equipe — U.E. Evaristo Campelo de Matos" },
      {
        property: "og:description",
        content: "Diretoria, coordenação, professores e demais profissionais da escola.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://conectaueecm.com/equipe" },
    ],
    links: [{ rel: "canonical", href: "https://conectaueecm.com/equipe" }],
  }),

  component: EquipePage,
});

function EquipePage() {
  const navigate = Route.useNavigate();
  const { perfil: perfilId } = Route.useSearch();
  const [busca, setBusca] = useState("");
  const [cargo, setCargo] = useState<"todos" | Cargo>("todos");
  const [disciplina, setDisciplina] = useState<string>("todas");

  const abrirPerfil = (p: Profissional) => {
    navigate({
      search: (prev: { perfil?: string }) => ({ ...prev, perfil: p.id }),
      replace: false,
    });
  };
  const fecharPerfil = () => {
    navigate({
      search: (prev: { perfil?: string }) => ({ ...prev, perfil: undefined }),
      replace: false,
    });
  };

  const { data, isLoading } = useQuery({
    queryKey: ["profissionais-publico"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profissionais_publicos")
        .select(
          "id, nome, foto_url, cargo, cargo_descricao, disciplinas, bio, formacao, anos_experiencia, ano_ingresso, destaque, ordem, ativo",
        )
        .eq("ativo", true)
        .order("ordem", { ascending: true })
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Profissional[];
    },
  });

  const disciplinasDisponiveis = useMemo(() => {
    const set = new Set<string>();
    (data ?? []).forEach((p) => (p.disciplinas ?? []).forEach((d) => d && set.add(d)));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [data]);

  const lista = useMemo(() => {
    const todos = data ?? [];
    const q = busca.trim().toLowerCase();
    return todos.filter((p) => {
      const okCargo = cargo === "todos" || p.cargo === cargo;
      if (!okCargo) return false;
      const okDisc =
        disciplina === "todas" ||
        (p.disciplinas ?? []).some((d) => d.toLowerCase() === disciplina.toLowerCase());
      if (!okDisc) return false;
      if (!q) return true;
      const hay = [
        p.nome,
        p.cargo_descricao,
        CARGO_LABEL[p.cargo as Cargo],
        p.bio,
        p.formacao,
        ...(p.disciplinas ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [data, busca, cargo, disciplina]);

  const agrupados = useMemo(() => {
    const map = new Map<Cargo, Profissional[]>();
    CARGO_ORDER.forEach((c) => map.set(c, []));
    lista.forEach((p) => {
      const arr = map.get(p.cargo as Cargo) ?? [];
      arr.push(p);
      map.set(p.cargo as Cargo, arr);
    });
    return map;
  }, [lista]);

  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />

      <section className="relative overflow-hidden border-b border-border/60 bg-gradient-to-br from-primary via-primary/90 to-primary/70 py-10 text-primary-foreground sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Badge className="mb-3 rounded-full bg-gold/90 text-gold-foreground hover:bg-gold sm:mb-4">
            <GraduationCap className="size-3.5" /> Nossa equipe
          </Badge>
          <h1 className="max-w-2xl font-display text-3xl font-bold leading-[1.15] sm:text-4xl md:text-5xl">
            Os profissionais que fazem a escola acontecer
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-primary-foreground/85 sm:text-base">
            Diretoria, coordenação, professores, secretaria e demais profissionais — uma equipe
            dedicada ao aprendizado e ao acolhimento dos nossos estudantes.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Tabs
            value={cargo}
            onValueChange={(v) => setCargo(v as typeof cargo)}
            className="min-w-0"
          >
            <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-2xl p-1 sm:w-auto sm:rounded-full">
              <TabsTrigger value="todos" className="rounded-full">
                Todos
              </TabsTrigger>
              {CARGO_ORDER.map((c) => (
                <TabsTrigger key={c} value={c} className="rounded-full">
                  {CARGO_LABEL[c]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center lg:w-auto lg:max-w-md">
            <div className="relative w-full min-w-0 sm:flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome, cargo ou disciplina…"
                className="w-full rounded-full pl-9"
                maxLength={80}
              />
            </div>
            {disciplinasDisponiveis.length > 0 && (
              <Select value={disciplina} onValueChange={setDisciplina}>
                <SelectTrigger className="w-full rounded-full sm:w-48 sm:shrink-0">
                  <SelectValue placeholder="Disciplina" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas disciplinas</SelectItem>
                  {disciplinasDisponiveis.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="mt-8 grid gap-5 sm:mt-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-3xl" />
            ))}
          </div>
        ) : lista.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-dashed border-border bg-card px-4 py-12 text-center sm:mt-12 sm:py-16">
            <p className="font-display text-lg text-foreground">Nenhum profissional encontrado</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Tente outro filtro ou termo de busca.
            </p>
          </div>
        ) : (
          <div className="mt-8 space-y-10 sm:space-y-12">
            {CARGO_ORDER.map((c) => {
              const grupo = agrupados.get(c) ?? [];
              if (grupo.length === 0) return null;
              return (
                <section key={c}>
                  <div className="mb-4 flex items-baseline justify-between gap-3">
                    <h2 className="min-w-0 truncate font-display text-lg font-semibold text-foreground sm:text-2xl">
                      {CARGO_LABEL[c]}
                    </h2>
                    <span className="shrink-0 text-xs text-muted-foreground sm:text-sm">
                      {grupo.length} {grupo.length === 1 ? "profissional" : "profissionais"}
                    </span>
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
                    {grupo.map((p) => (
                      <ProfissionalCard key={p.id} p={p} onVerPerfil={abrirPerfil} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        <div className="mt-12 rounded-3xl bg-secondary px-5 py-7 text-center sm:mt-16 sm:px-8 sm:py-10">
          <p className="font-display text-base text-foreground sm:text-lg">
            Faz parte da equipe e gostaria de ajustar seus dados?
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Procure a diretoria ou a coordenação para atualizar suas informações.
          </p>
          <Link
            to="/painel"
            className="mt-4 inline-flex rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Acessar painel
          </Link>
        </div>
      </main>

      <ProfissionalPerfilDialog
        profissionalId={perfilId ?? null}
        open={!!perfilId}
        onOpenChange={(o) => {
          if (!o) fecharPerfil();
        }}
      />

      <SiteFooter />
    </div>
  );
}

function ProfissionalCard({
  p,
  onVerPerfil,
}: {
  p: Profissional;
  onVerPerfil: (p: Profissional) => void;
}) {
  const especialidade = p.disciplinas?.[0];
  const anos = tempoDeProfissao(p);

  return (
    <article className="group relative isolate flex flex-col overflow-hidden rounded-[2rem] border border-border/60 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.08)] transition-all duration-500 hover:-translate-y-1 hover:border-primary/30 hover:shadow-[0_20px_60px_-20px_rgba(15,23,42,0.25)]">
      {/* Cover: gradient + soft radial glow + gold thread */}
      <div className="relative h-32 overflow-hidden bg-gradient-to-br from-primary via-primary/85 to-primary/60">
        <div className="absolute -left-10 -top-10 size-40 rounded-full bg-gold/25 blur-3xl" />
        <div className="absolute -right-6 top-4 size-32 rounded-full bg-primary-foreground/10 blur-2xl" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />

        {p.destaque && (
          <Badge className="absolute right-4 top-4 z-10 rounded-full border border-gold-foreground/20 bg-gold/95 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-gold-foreground shadow-md hover:bg-gold">
            <Star className="size-3 fill-gold-foreground" /> Destaque
          </Badge>
        )}
      </div>

      <button
        type="button"
        onClick={() => onVerPerfil(p)}
        aria-label={`Ver detalhes de ${p.nome}`}
        className="relative -mt-14 flex flex-1 flex-col items-center px-5 pb-6 pt-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:-mt-16 sm:px-6 sm:pb-7 md:px-8"
      >
        {/* Photo with layered ring */}
        <div className="relative">
          <div className="absolute inset-0 -m-1 rounded-full bg-gradient-to-br from-gold via-gold/40 to-primary opacity-0 blur-md transition-opacity duration-500 group-hover:opacity-70" />
          {p.foto_url ? (
            <img
              src={p.foto_url}
              alt={p.nome}
              width={128}
              height={128}
              loading="lazy"
              className="relative size-24 rounded-full object-cover ring-[6px] ring-card shadow-xl transition-transform duration-500 group-hover:scale-[1.03] sm:size-28 md:size-32"
            />
          ) : (
            <div className="relative flex size-24 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 font-display text-2xl font-semibold text-primary-foreground ring-[6px] ring-card shadow-xl transition-transform duration-500 group-hover:scale-[1.03] sm:size-28 sm:text-3xl md:size-32">
              {getInitials(p.nome)}
            </div>
          )}
        </div>

        <h3 className="mt-4 break-words text-center font-display text-lg font-bold tracking-tight text-foreground transition-colors group-hover:text-primary sm:mt-5 sm:text-xl md:text-[1.4rem]">
          {p.nome}
        </h3>
        <p className="mt-1 break-words text-center text-sm font-medium text-primary/80 sm:text-[0.95rem]">
          {p.cargo_descricao || CARGO_LABEL[p.cargo as Cargo]}
        </p>

        <div className="my-4 flex items-center gap-2 self-stretch sm:my-5">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-border" />
          <div className="size-1.5 rounded-full bg-gold" />
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-border" />
        </div>

        <ul className="w-full space-y-3 text-sm">
          {p.formacao && (
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
                <GraduationCap className="size-4" />
              </span>
              <span className="min-w-0 flex-1 pt-1 leading-snug text-foreground/85 break-words">
                <span className="font-semibold text-foreground">Formação:</span> {p.formacao}
              </span>
            </li>
          )}
          {anos && (
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
                <Briefcase className="size-4" />
              </span>
              <span className="min-w-0 flex-1 pt-1 leading-snug text-foreground/85 break-words">
                <span className="font-semibold text-foreground">Experiência:</span> {anos}
              </span>
            </li>
          )}
          {especialidade && (
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold ring-1 ring-inset ring-gold/25">
                <Star className="size-4 fill-gold" />
              </span>
              <span className="min-w-0 flex-1 pt-1 leading-snug text-foreground/85 break-words">
                <span className="font-semibold text-foreground">Especialidade:</span>{" "}
                {p.disciplinas!.join(" · ")}
              </span>
            </li>
          )}
        </ul>

        {p.bio && (
          <div className="relative mt-5 w-full rounded-2xl bg-secondary/50 px-4 py-3.5 ring-1 ring-inset ring-border/50 sm:mt-6">
            <span className="absolute -top-2 left-4 rounded-full bg-card px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Sobre
            </span>
            <p className="line-clamp-4 text-sm leading-relaxed text-muted-foreground">{p.bio}</p>
          </div>
        )}
      </button>
    </article>
  );
}

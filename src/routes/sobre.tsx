import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPin, Calendar, Target, Heart, Sparkles, GraduationCap, Users } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import heroImg from "@/assets/hero-school.jpg";
import livroCapa from "@/assets/livro-memorias-povo.jpg.asset.json";

export const Route = createFileRoute("/sobre")({
  head: () => ({
    meta: [
      { title: "Sobre a Escola — U.E. Evaristo Campelo de Matos" },
      {
        name: "description",
        content:
          "Fundada em 1982 em Assunção do Piauí, a U.E. Evaristo Campelo de Matos forma gerações com ensino de qualidade e valores humanos.",
      },
      { property: "og:title", content: "Sobre a U.E. Evaristo Campelo de Matos" },
      {
        property: "og:description",
        content:
          "Conheça a história, missão, visão e valores da Unidade Escolar Evaristo Campelo de Matos — desde 1982 educando com excelência em Assunção do Piauí.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://conectaueecm.com/sobre" },
      { property: "og:image", content: "https://conectaueecm.com/og-image.jpg" },
      { property: "og:locale", content: "pt_BR" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://conectaueecm.com/og-image.jpg" },
    ],
    links: [{ rel: "canonical", href: "https://conectaueecm.com/sobre" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "AboutPage",
          name: "Sobre a U.E. Evaristo Campelo de Matos",
          url: "https://conectaueecm.com/sobre",
          inLanguage: "pt-BR",
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Início", item: "https://conectaueecm.com/" },
            {
              "@type": "ListItem",
              position: 2,
              name: "Sobre",
              item: "https://conectaueecm.com/sobre",
            },
          ],
        }),
      },
    ],
  }),
  component: SobrePage,
});

function SobrePage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <SiteHeader />

      <main className="mx-auto w-full max-w-6xl px-4 pb-20 pt-10 sm:px-6 lg:px-8">
        {/* Hero */}
        <section className="mb-14 grid gap-8 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-accent">
              Nossa história
            </p>
            <h1 className="font-display text-3xl leading-tight text-primary sm:text-4xl lg:text-5xl">
              Educando gerações em Assunção do Piauí desde 1982
            </h1>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
              A{" "}
              <strong className="text-foreground">Unidade Escolar Evaristo Campelo de Matos</strong>{" "}
              é uma instituição pública de ensino situada em Assunção do Piauí, dedicada à formação
              integral de crianças e adolescentes há 44 anos. Nascida de duas simples salas de aula
              em 1982, tornou-se referência de acolhimento, disciplina e compromisso pedagógico na
              cidade e região — patrimônio afetivo de gerações que aqui construíram memórias, sonhos
              e caminhos.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/equipe"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-transform hover:-translate-y-0.5 hover:bg-primary/90"
              >
                <Users className="size-4" />
                Conheça nossa equipe
              </Link>
              <Link
                to="/posts"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-accent hover:text-accent"
              >
                Ver publicações
              </Link>
            </div>
          </div>
          <div className="overflow-hidden rounded-3xl border border-border shadow-sm">
            <img
              src={heroImg}
              alt="Fachada da U.E. Evaristo Campelo de Matos"
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </div>
        </section>

        {/* Identidade */}
        <section aria-labelledby="identidade-heading" className="mb-14">
          <h2 id="identidade-heading" className="sr-only">Identidade</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <IdentityCard
            icon={Calendar}
            title="Fundada em 1982"
            text="44 anos formando cidadãos comprometidos com o conhecimento, o respeito e a vida em comunidade."
          />
          <IdentityCard
            icon={MapPin}
            title="Coração de Assunção do Piauí"
            text="Rua Pedro Lacerda Cavalcante, s/n — Assunção do Piauí – PI, CEP 64333-000."
          />
          <IdentityCard
            icon={GraduationCap}
            title="Ensino público de qualidade"
            text="Educação Infantil, Anos Iniciais e Anos Finais do Ensino Fundamental, com projetos pedagógicos e culturais durante todo o ano."
          />
          </div>
        </section>

        {/* Missão, Visão, Valores */}
        <section aria-labelledby="pilares-heading" className="mb-14">
          <h2 id="pilares-heading" className="sr-only">Missão, visão e valores</h2>
          <div className="grid gap-6 lg:grid-cols-3">
          <PillarCard
            icon={Target}
            title="Missão"
            text="Oferecer educação pública gratuita, inclusiva e de qualidade, promovendo o desenvolvimento intelectual, social e emocional dos estudantes, em parceria com as famílias e a comunidade."
          />
          <PillarCard
            icon={Sparkles}
            title="Visão"
            text="Ser reconhecida como referência de excelência no ensino público de Assunção do Piauí, formando estudantes protagonistas, éticos e preparados para os desafios do século XXI."
          />
          <PillarCard
            icon={Heart}
            title="Valores"
            text="Respeito, responsabilidade, empatia, disciplina, valorização do saber, cuidado com o outro e compromisso com a transformação social pela educação."
          />
          </div>
        </section>

        {/* História */}
        <section className="mb-14 rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-10">
          <h2 className="font-display text-2xl text-primary sm:text-3xl">Nossa trajetória</h2>
          <div className="mt-5 grid gap-8 lg:grid-cols-[1fr_18rem] lg:items-start">
          <div className="space-y-4 text-base leading-relaxed text-muted-foreground">
            <p>
              Segundo relatos preservados pela comunidade, a{" "}
              <strong className="text-foreground">Unidade Escolar Evaristo Campelo de Matos</strong>{" "}
              foi construída em <strong className="text-foreground">1982</strong>, inicialmente com
              apenas <strong className="text-foreground">duas salas de aula</strong>, durante a
              administração de <strong className="text-foreground">Nilo Campelo de Matos</strong>,
              então gestor de São Miguel do Tapuio — município ao qual Assunção do Piauí pertencia
              antes de sua emancipação.
            </p>
            <p>
              Pouco tempo depois, sob a administração do prefeito{" "}
              <strong className="text-foreground">Paulo Frota</strong>, a escola foi ampliada com{" "}
              <strong className="text-foreground">mais duas salas de aula</strong>, atendendo à
              crescente demanda por ensino público na região.
            </p>
            <p>
              O nome da instituição é uma homenagem a{" "}
              <strong className="text-foreground">Evaristo Campelo</strong>, irmão de Nilo Campelo,
              que havia sido vereador e cujo <em>curral</em>, em tempos passados, ocupava o terreno
              onde a escola viria a ser erguida — uma memória local que ligou definitivamente o seu
              nome àquele espaço de aprendizado.
            </p>
            <p>
              Já como escola do recém-criado município de Assunção do Piauí, a UEECM passou por nova
              reconstrução no mandato do primeiro prefeito da cidade,{" "}
              <strong className="text-foreground">José Alves dos Reis</strong>, ganhando estrutura
              ampliada para receber mais estudantes e novas etapas de ensino. Sua primeira diretora
              foi a professora{" "}
              <strong className="text-foreground">Rosaura Fernandes de Macedo</strong>, pioneira na
              organização pedagógica da instituição.
            </p>
            <p>
              Ao longo das décadas, a escola modernizou práticas, fortaleceu vínculos com famílias,
              docentes e parceiros, e consolidou projetos culturais, esportivos e de leitura que
              marcam sua identidade — sempre com compromisso inegociável com a aprendizagem, o
              respeito e a formação cidadã.
            </p>
            <p>
              Hoje, a UEECM é mais que uma escola: é patrimônio afetivo de gerações que construíram,
              dentro dela, memórias, sonhos e caminhos.
            </p>
          </div>
          <figure className="lg:sticky lg:top-6">
            <div className="overflow-hidden rounded-2xl border border-border shadow-sm">
              <img
                src={livroCapa.url}
                alt="Capa do livro Assunção do Piauí: Memórias de um Povo, de Maria Augusta Lima"
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </div>
            <figcaption className="mt-3 rounded-xl border border-border/70 bg-background/60 p-3 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
                Capa do livro
              </p>
              <p className="mt-1 font-display text-sm font-semibold text-foreground">
                "Assunção do Piauí — Memórias de um Povo"
              </p>
              <p className="mt-0.5 text-xs italic text-muted-foreground">
                Obra de autoria de Maria Augusta Lima
              </p>
            </figcaption>
          </figure>
          </div>
        </section>

        {/* Endereço */}
        <section className="rounded-3xl border border-border bg-primary p-6 text-primary-foreground shadow-sm sm:p-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-gold">
                Onde estamos
              </p>
              <h2 className="mt-2 font-display text-2xl sm:text-3xl">Venha nos visitar</h2>
              <p className="mt-3 max-w-md text-primary-foreground/80">
                Rua Pedro Lacerda Cavalcante, s/n — Assunção do Piauí – PI, CEP 64333-000.
              </p>
            </div>
            <Link
              to="/agendar"
              className="inline-flex items-center gap-2 self-start rounded-full bg-gold px-6 py-3 text-sm font-semibold text-gold-foreground transition-transform hover:-translate-y-0.5 sm:self-auto"
            >
              Agendar atendimento
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

function IdentityCard({
  icon: Icon,
  title,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="grid size-10 place-items-center rounded-full bg-accent/15 text-accent">
        <Icon className="size-5" />
      </div>
      <h3 className="mt-4 font-display text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{text}</p>
    </div>
  );
}

function PillarCard({
  icon: Icon,
  title,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-gradient-to-b from-card to-background p-6 shadow-sm">
      <div className="grid size-11 place-items-center rounded-full bg-primary text-primary-foreground">
        <Icon className="size-5" />
      </div>
      <h3 className="mt-4 font-display text-xl text-primary">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
    </div>
  );
}

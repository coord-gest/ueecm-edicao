import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ShieldCheck, ShieldAlert, Camera, ArrowRight } from "lucide-react";

import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { AutoPresentationMode } from "@/components/AutoPresentationMode";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

type TabKey = "dados" | "incidentes" | "imagem";

export const Route = createFileRoute("/central-lgpd")({
  head: () => ({
    meta: [
      { title: "Central de Privacidade (LGPD) | UEECM" },
      {
        name: "description",
        content:
          "Solicite seus dados, reporte incidentes de segurança e gerencie o uso de imagem de alunos em conformidade com a LGPD e o ECA.",
      },
      { property: "og:title", content: "Central de Privacidade (LGPD) | UEECM" },
      {
        property: "og:description",
        content:
          "Um único ponto para exercer direitos LGPD, comunicar incidentes e revogar consentimento de uso de imagem.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://conectaueecm.com/central-lgpd" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://conectaueecm.com/central-lgpd" }],
  }),
  component: CentralLgpdPage,
});

function CentralLgpdPage() {
  const [tab, setTab] = useState<TabKey>("dados");

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1 py-8 md:py-12">
        <div className="container mx-auto max-w-4xl px-4">
          <header className="mb-8">
            <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4" />
              <span>LGPD · ECA · Canal oficial do titular</span>
            </div>
            <h1 className="text-3xl font-bold text-foreground md:text-4xl">
              Central de Privacidade
            </h1>
            <p className="mt-3 text-muted-foreground">
              Um único lugar para exercer seus direitos LGPD, comunicar incidentes de segurança e
              gerenciar o uso de imagem de estudantes.
            </p>
          </header>

          <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="w-full">
            <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3">
              <TabsTrigger value="dados" className="gap-2">
                <ShieldCheck className="h-4 w-4" />
                <span>Solicitar meus dados</span>
              </TabsTrigger>
              <TabsTrigger value="incidentes" className="gap-2">
                <ShieldAlert className="h-4 w-4" />
                <span>Segurança e Incidentes</span>
              </TabsTrigger>
              <TabsTrigger value="imagem" className="gap-2">
                <Camera className="h-4 w-4" />
                <span>Uso de Imagem</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dados" className="mt-6">
              <SectionCard
                icon={<ShieldCheck className="h-5 w-5" />}
                title="Solicitar meus dados (LGPD Art. 18)"
                description="Exerça os direitos garantidos pela LGPD: acesso, correção, exclusão, portabilidade, oposição, anonimização e informação sobre compartilhamento. A resposta é gratuita e ocorre em até 15 dias corridos."
                bullets={[
                  "Registro com protocolo único para acompanhamento.",
                  "Vinculação automática à sua conta se você estiver logado.",
                  "Confirmação de identidade pode ser exigida em pedidos sensíveis.",
                ]}
                to="/solicitar-dados"
                ctaLabel="Abrir formulário de solicitação"
              />
            </TabsContent>

            <TabsContent value="incidentes" className="mt-6">
              <SectionCard
                icon={<ShieldAlert className="h-5 w-5" />}
                title="Segurança e Incidentes (LGPD Art. 48)"
                description="Reporte suspeitas de vazamento, acesso indevido ou uso impróprio de dados pessoais. O Encarregado (DPO) triaga em até 24h úteis e conduz a notificação à ANPD e aos titulares quando aplicável."
                bullets={[
                  "Canal exclusivo para incidentes de segurança.",
                  "Ciclo de resposta documentado (detecção → contenção → notificação).",
                  "Contato direto com o DPO — Francisco Douglas.",
                ]}
                to="/seguranca/incidentes"
                ctaLabel="Ver política e reportar incidente"
              />
            </TabsContent>

            <TabsContent value="imagem" className="mt-6">
              <SectionCard
                icon={<Camera className="h-5 w-5" />}
                title="Uso de Imagem de Alunos (LGPD Art. 14 e ECA)"
                description="Diretrizes de captura, publicação e revogação de consentimento para imagens de crianças e adolescentes, alinhadas à LGPD, ao ECA e ao ECA Digital (Lei 15.211/2025)."
                bullets={[
                  "O que a instituição pode e não pode fazer.",
                  "Como revogar o consentimento a qualquer momento, sem custo.",
                  "Formulário para dúvidas, revogação ou denúncia de uso indevido.",
                ]}
                to="/uso-de-imagem"
                ctaLabel="Ver diretrizes e formulário"
              />
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <AutoPresentationMode />
      <SiteFooter />
    </div>
  );
}

function SectionCard({
  icon,
  title,
  description,
  bullets,
  to,
  ctaLabel,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  bullets: string[];
  to: "/solicitar-dados" | "/seguranca/incidentes" | "/uso-de-imagem";
  ctaLabel: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </span>
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-foreground">{title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
          <ul className="mt-4 space-y-2 text-sm text-foreground/90">
            {bullets.map((b) => (
              <li key={b} className="flex gap-2">
                <span aria-hidden className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6">
            <Button asChild>
              <Link to={to}>
                {ctaLabel}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
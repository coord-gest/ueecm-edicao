import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Check,
  X,
  AlertTriangle,
  ScrollText,
  Shield,
  BookOpen,
  Mail,
  FileText,
  History,
} from "lucide-react";

const POLICY_VERSION = "2.1";
const EFFECTIVE_DATE = "8 de julho de 2026";
const CONTACT_EMAIL = "coordenacao.ueecm@outlook.com";

export const Route = createFileRoute("/uso-de-imagem")({
  head: () => ({
    meta: [
      {
        title: "Uso de Imagem de Alunos | Diretrizes LGPD e ECA — U.E. Evaristo Campelo de Matos",
      },
      {
        name: "description",
        content:
          "Diretrizes de uso de imagem de alunos e menores na U.E. Evaristo Campelo de Matos: LGPD, ECA, ECA Digital, revogação de consentimento e formulário para solicitações.",
      },
      { name: "robots", content: "index, follow" },
      {
        property: "og:title",
        content: "Uso de Imagem de Alunos e Menores de Idade",
      },
      {
        property: "og:description",
        content:
          "Como protegemos a imagem dos estudantes conforme LGPD e ECA, e como revogar o consentimento.",
      },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "https://conectaueecm.com/uso-de-imagem" },
    ],
    links: [{ rel: "canonical", href: "https://conectaueecm.com/uso-de-imagem" }],
  }),
  component: ImageUsagePage,
});

const laws = [
  {
    Icon: Shield,
    title: "Art. 14 da LGPD",
    summary:
      "O tratamento de dados de crianças e adolescentes deve sempre atender ao melhor interesse do menor e exige consentimento específico e em destaque, dado por pelo menos um dos pais ou responsável legal.",
  },
  {
    Icon: BookOpen,
    title: "Art. 17 do ECA",
    summary:
      "Garante à criança e ao adolescente o direito à inviolabilidade da integridade física, psíquica e moral, incluindo a preservação da imagem, identidade, valores e crenças.",
  },
  {
    Icon: ScrollText,
    title: "ECA Digital — Lei nº 15.211/2025",
    summary:
      "Reforça a proteção de crianças e adolescentes no ambiente digital, restringe a exposição não autorizada de imagens em plataformas online e responsabiliza instituições pelo uso indevido em redes sociais.",
  },
];

const allowed = [
  "Registrar momentos pedagógicos mediante termo de autorização específico assinado pelos responsáveis.",
  "Publicar fotos e vídeos nos canais oficiais da escola (site, app, redes institucionais).",
  "Preservar o anonimato quando não houver autorização, usando enquadramentos que não identifiquem o aluno.",
  "Excluir, a qualquer momento, conteúdo cujo consentimento tenha sido revogado pelos responsáveis.",
  "Armazenar as autorizações de forma segura e por prazo determinado, conforme finalidade pedagógica.",
];

const forbidden = [
  "Publicar imagens de alunos em perfis pessoais de professores, gestores ou funcionários.",
  "Utilizar imagens de alunos para fins comerciais, publicitários ou de promoção de terceiros.",
  "Compartilhar fotos ou vídeos com identificação de menores em grupos privados sem finalidade pedagógica.",
  "Divulgar dados sensíveis (saúde, religião, condição socioeconômica) junto com a imagem do aluno.",
  "Permitir uso de imagem sem termo específico, mesmo que haja autorização verbal.",
];

const revokeSteps = [
  "Envie um e-mail para a coordenação informando o nome completo do(a) responsável e do(a) aluno(a), turma e o pedido de revogação.",
  "Você pode também preencher o formulário ao final desta página — encaminharemos sua solicitação automaticamente para a coordenação.",
  "A escola confirmará o recebimento em até 5 dias úteis e iniciará a remoção do conteúdo dos canais oficiais.",
  "Conteúdos já publicados em terceiros (compartilhamentos externos) podem demorar mais para serem removidos — atuaremos no que estiver sob nosso controle.",
  "A revogação não exige justificativa e não acarreta qualquer prejuízo pedagógico ao(à) estudante.",
];

const requestSchema = z.object({
  responsavel: z
    .string()
    .trim()
    .min(3, "Informe o nome do responsável (mínimo 3 caracteres).")
    .max(120, "Nome muito longo."),
  email: z.string().trim().email("Informe um e-mail válido.").max(255, "E-mail muito longo."),
  telefone: z.string().trim().max(30, "Telefone muito longo.").optional().or(z.literal("")),
  aluno: z.string().trim().min(3, "Informe o nome do(a) aluno(a).").max(120, "Nome muito longo."),
  turma: z.string().trim().max(60, "Turma muito longa.").optional().or(z.literal("")),
  tipo: z.enum(["revogacao", "duvida", "denuncia", "outro"], {
    message: "Selecione o tipo de solicitação.",
  }),
  mensagem: z
    .string()
    .trim()
    .min(10, "Descreva sua solicitação (mínimo 10 caracteres).")
    .max(2000, "Mensagem muito longa (máx. 2000 caracteres)."),
});

function ImageUsagePage() {
  const [submitting, setSubmitting] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = requestSchema.safeParse({
      responsavel: fd.get("responsavel"),
      email: fd.get("email"),
      telefone: fd.get("telefone") ?? "",
      aluno: fd.get("aluno"),
      turma: fd.get("turma") ?? "",
      tipo: fd.get("tipo"),
      mensagem: fd.get("mensagem"),
    });

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Verifique os campos do formulário.");
      return;
    }

    setSubmitting(true);
    const d = parsed.data;
    const tipoLabel = {
      revogacao: "Revogação de consentimento de uso de imagem",
      duvida: "Dúvida sobre uso de imagem",
      denuncia: "Denúncia de uso indevido de imagem",
      outro: "Outro assunto relacionado a uso de imagem",
    }[d.tipo];

    const subject = `[Uso de Imagem] ${tipoLabel} — ${d.aluno}`;
    const body =
      `Responsável: ${d.responsavel}\n` +
      `E-mail: ${d.email}\n` +
      `Telefone: ${d.telefone || "(não informado)"}\n` +
      `Aluno(a): ${d.aluno}\n` +
      `Turma: ${d.turma || "(não informada)"}\n` +
      `Tipo: ${tipoLabel}\n\n` +
      `Mensagem:\n${d.mensagem}\n\n` +
      `---\nEnviado pela página /uso-de-imagem (v${POLICY_VERSION}).`;

    const href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;

    window.location.href = href;
    toast.success("Abrindo seu cliente de e-mail para enviar a solicitação.");
    setTimeout(() => setSubmitting(false), 1500);
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <article className="prose prose-slate dark:prose-invert max-w-none">
          <h1>Uso de Imagem de Alunos e Menores de Idade</h1>
          <p className="lead text-lg text-muted-foreground">
            Entenda como protegemos a privacidade dos estudantes de acordo com a LGPD e o ECA.
          </p>

          {/* Versionamento / rastreabilidade */}
          <div className="not-prose mt-4 flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-3 py-1 text-muted-foreground">
              <FileText className="h-3.5 w-3.5" />
              Versão {POLICY_VERSION}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-3 py-1 text-muted-foreground">
              Vigência desde {EFFECTIVE_DATE}
            </span>
            <Link
              to="/privacidade"
              className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-3 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <History className="h-3.5 w-3.5" />
              Versão anterior (v1.0 — integrada à Política de Privacidade)
            </Link>
          </div>

          <p className="mt-6">
            Esta página complementa a nossa{" "}
            <Link to="/privacidade" className="text-primary hover:underline">
              Política de Privacidade
            </Link>{" "}
            e detalha as diretrizes adotadas pela <strong>U.E. Evaristo Campelo de Matos</strong>{" "}
            para o tratamento da imagem de crianças e adolescentes em todos os seus canais de
            comunicação.
          </p>
        </article>

        {/* Legislação aplicada */}
        <section className="mt-12">
          <h2 className="font-display text-2xl font-semibold text-foreground">
            Legislação Aplicada
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            As três principais bases legais que orientam nossas práticas.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {laws.map(({ Icon, title, summary }) => (
              <div
                key={title}
                className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-display text-base font-semibold text-foreground">
                  {title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{summary}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Permitido x Proibido */}
        <section className="mt-12">
          <h2 className="font-display text-2xl font-semibold text-foreground">
            O que a instituição PODE e NÃO PODE fazer
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Boas práticas adotadas pela escola em contraste com condutas vedadas.
          </p>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <Check className="h-4 w-4" strokeWidth={3} />
                </span>
                <h3 className="font-display text-lg font-semibold text-emerald-700 dark:text-emerald-300">
                  Permitido
                </h3>
              </div>
              <ul className="mt-4 space-y-3">
                {allowed.map((item) => (
                  <li key={item} className="flex gap-3 text-sm text-foreground/90">
                    <Check
                      className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                      strokeWidth={3}
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/15 text-destructive">
                  <X className="h-4 w-4" strokeWidth={3} />
                </span>
                <h3 className="font-display text-lg font-semibold text-destructive">Proibido</h3>
              </div>
              <ul className="mt-4 space-y-3">
                {forbidden.map((item) => (
                  <li key={item} className="flex gap-3 text-sm text-foreground/90">
                    <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" strokeWidth={3} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Como revogar o consentimento */}
        <section id="revogar" className="mt-12 scroll-mt-24">
          <h2 className="font-display text-2xl font-semibold text-foreground">
            Como revogar o consentimento
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Os pais e responsáveis podem retirar a autorização de uso de imagem a qualquer momento,
            sem custo e sem necessidade de justificativa.
          </p>
          <ol className="mt-6 space-y-3">
            {revokeSteps.map((step, i) => (
              <li
                key={step}
                className="flex gap-3 rounded-xl border border-border/70 bg-card p-4 text-sm text-foreground/90"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 font-display text-sm font-semibold text-primary">
                  {i + 1}
                </span>
                <span className="leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* Callout: revogação */}
        <aside
          role="note"
          className="mt-10 flex gap-4 rounded-2xl border-l-4 border-gold bg-gold/10 p-5 sm:p-6"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold/20 text-gold">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-base font-semibold text-foreground sm:text-lg">
              O consentimento pode ser revogado a qualquer momento
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-foreground/80">
              Envie um e-mail para{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="font-medium text-primary hover:underline"
              >
                {CONTACT_EMAIL}
              </a>{" "}
              ou utilize o formulário abaixo. A escola se compromete a remover o conteúdo dos canais
              oficiais no menor prazo possível, sem prejuízo de eventual obrigação legal de
              manutenção de registros.
            </p>
          </div>
        </aside>

        {/* Formulário de solicitação */}
        <section id="solicitar" className="mt-12 scroll-mt-24">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Mail className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-display text-2xl font-semibold text-foreground">
                  Formulário de solicitação
                </h2>
                <p className="text-sm text-muted-foreground">
                  Envie pedidos de revogação, dúvidas ou denúncias sobre uso de imagem.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-1">
                <Label htmlFor="responsavel">Nome do responsável *</Label>
                <Input
                  id="responsavel"
                  name="responsavel"
                  required
                  maxLength={120}
                  autoComplete="name"
                  className="mt-1.5"
                />
              </div>
              <div className="sm:col-span-1">
                <Label htmlFor="email">E-mail para contato *</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  maxLength={255}
                  autoComplete="email"
                  className="mt-1.5"
                />
              </div>
              <div className="sm:col-span-1">
                <Label htmlFor="telefone">Telefone (opcional)</Label>
                <Input
                  id="telefone"
                  name="telefone"
                  type="tel"
                  maxLength={30}
                  autoComplete="tel"
                  className="mt-1.5"
                />
              </div>
              <div className="sm:col-span-1">
                <Label htmlFor="tipo">Tipo de solicitação *</Label>
                <Select name="tipo" defaultValue="revogacao">
                  <SelectTrigger id="tipo" className="mt-1.5">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="revogacao">Revogar consentimento</SelectItem>
                    <SelectItem value="duvida">Tirar dúvida</SelectItem>
                    <SelectItem value="denuncia">Denunciar uso indevido</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-1">
                <Label htmlFor="aluno">Nome do(a) aluno(a) *</Label>
                <Input id="aluno" name="aluno" required maxLength={120} className="mt-1.5" />
              </div>
              <div className="sm:col-span-1">
                <Label htmlFor="turma">Turma / Ano (opcional)</Label>
                <Input id="turma" name="turma" maxLength={60} className="mt-1.5" />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="mensagem">Mensagem *</Label>
                <Textarea
                  id="mensagem"
                  name="mensagem"
                  required
                  minLength={10}
                  maxLength={2000}
                  rows={5}
                  placeholder="Descreva a solicitação. Em caso de revogação, indique se deseja a remoção de conteúdos já publicados."
                  className="mt-1.5"
                />
              </div>

              <div className="sm:col-span-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  Ao enviar, abriremos seu cliente de e-mail com a mensagem pronta para{" "}
                  <strong>{CONTACT_EMAIL}</strong>. Nenhum dado é armazenado neste site.
                </p>
                <Button type="submit" disabled={submitting} className="sm:w-auto">
                  {submitting ? "Enviando…" : "Enviar solicitação"}
                </Button>
              </div>
            </form>
          </div>
        </section>

        <p className="mt-10">
          <Link to="/privacidade" className="text-primary hover:underline">
            ← Voltar para a Política de Privacidade
          </Link>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}

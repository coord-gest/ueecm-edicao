import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { CheckCircle2, ShieldCheck, FileText, ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/solicitar-dados")({
  head: () => ({
    meta: [
      { title: "Solicitar meus dados (LGPD) | UEECM" },
      {
        name: "description",
        content:
          "Canal oficial para titulares exercerem os direitos garantidos pela LGPD (Art. 18): acesso, correção, exclusão, portabilidade, oposição e anonimização.",
      },
      { property: "og:title", content: "Solicitar meus dados (LGPD)" },
      {
        property: "og:description",
        content:
          "Envie sua solicitação de acesso, correção ou exclusão de dados pessoais em conformidade com a LGPD.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://conectaueecm.com/solicitar-dados" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://conectaueecm.com/solicitar-dados" }],
  }),
  component: SolicitarDadosPage,
});

const TIPO_OPTIONS = [
  {
    value: "acesso",
    label: "Acesso aos meus dados",
    hint: "Ver quais dados a Escola tem sobre mim.",
  },
  {
    value: "correcao",
    label: "Correção de dados",
    hint: "Corrigir dados incompletos ou desatualizados.",
  },
  {
    value: "exclusao",
    label: "Exclusão de dados",
    hint: "Remover meus dados (respeitando obrigações legais).",
  },
  {
    value: "portabilidade",
    label: "Portabilidade",
    hint: "Receber meus dados em formato estruturado.",
  },
  {
    value: "oposicao",
    label: "Oposição ao tratamento",
    hint: "Opor-me a um tratamento específico.",
  },
  {
    value: "anonimizacao",
    label: "Anonimização",
    hint: "Tornar meus dados irreversivelmente anônimos.",
  },
  {
    value: "informacao",
    label: "Informação sobre uso",
    hint: "Saber com quem meus dados foram compartilhados.",
  },
] as const;

type TipoValue = (typeof TIPO_OPTIONS)[number]["value"];

const schema = z.object({
  solicitante_nome: z.string().trim().min(2, "Informe seu nome completo").max(200),
  solicitante_email: z.string().trim().email("E-mail inválido").max(255),
  solicitante_cpf: z.string().trim().max(20).optional().or(z.literal("")),
  solicitante_telefone: z.string().trim().max(40).optional().or(z.literal("")),
  tipo: z.enum([
    "acesso",
    "correcao",
    "exclusao",
    "portabilidade",
    "oposicao",
    "anonimizacao",
    "informacao",
  ]),
  descricao: z
    .string()
    .trim()
    .min(10, "Descreva sua solicitação com pelo menos 10 caracteres.")
    .max(2000, "Máximo de 2000 caracteres."),
});

type FormState = z.infer<typeof schema>;

function SolicitarDadosPage() {
  const [form, setForm] = useState<FormState>({
    solicitante_nome: "",
    solicitante_email: "",
    solicitante_cpf: "",
    solicitante_telefone: "",
    tipo: "acesso",
    descricao: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [protocolo, setProtocolo] = useState<string | null>(null);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      toast.error("Verifique os campos", { description: first?.message ?? "Dados inválidos." });
      return;
    }

    setSubmitting(true);
    try {
      // Vincula ao user_id se estiver logado (permite ver no "meus" depois).
      const { data: sessionData } = await supabase.auth.getUser();
      const userId = sessionData.user?.id ?? null;

      const payload = {
        user_id: userId,
        solicitante_nome: parsed.data.solicitante_nome,
        solicitante_email: parsed.data.solicitante_email,
        solicitante_cpf: parsed.data.solicitante_cpf?.trim() || null,
        solicitante_telefone: parsed.data.solicitante_telefone?.trim() || null,
        tipo: parsed.data.tipo,
        descricao: parsed.data.descricao,
      };

      const { data, error } = await supabase
        .from("data_subject_requests")
        .insert(payload)
        .select("protocolo")
        .single();

      if (error) {
        // Rate limit vem como P0001 do trigger
        if (error.message?.includes("Muitas solicitações")) {
          toast.error("Limite atingido", { description: error.message });
        } else {
          toast.error("Não foi possível enviar", {
            description:
              "Tente novamente em alguns instantes. Se persistir, envie por e-mail ao DPO.",
          });
        }
        return;
      }

      setProtocolo(data.protocolo);
      toast.success("Solicitação registrada", {
        description: `Protocolo: ${data.protocolo}`,
      });
    } catch {
      toast.error("Falha inesperada", {
        description: "Verifique sua conexão e tente novamente.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (protocolo) {
    return (
      <div className="flex min-h-dvh flex-col">
        <SiteHeader />
        <main className="flex-1 py-12">
          <div className="container mx-auto max-w-2xl px-4">
            <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h1 className="text-2xl font-bold text-foreground">Solicitação recebida</h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Sua solicitação foi registrada e a equipe de proteção de dados foi notificada.
                    Você receberá uma resposta pelo e-mail informado em até{" "}
                    <strong className="text-foreground">15 dias corridos</strong> (prazo da LGPD,
                    Art. 19).
                  </p>
                  <div className="mt-6 rounded-lg border border-primary/30 bg-primary/5 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Protocolo
                    </p>
                    <p className="mt-1 font-mono text-lg font-semibold text-foreground">
                      {protocolo}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Guarde este número. Ele identifica sua solicitação em qualquer contato futuro
                      com o Encarregado de Dados (DPO).
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild variant="outline">
                  <Link to="/privacidade">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Política de Privacidade
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setProtocolo(null);
                    setForm({
                      solicitante_nome: "",
                      solicitante_email: "",
                      solicitante_cpf: "",
                      solicitante_telefone: "",
                      tipo: "acesso",
                      descricao: "",
                    });
                  }}
                >
                  Enviar outra solicitação
                </Button>
              </div>
            </div>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1 py-8 md:py-12">
        <div className="container mx-auto max-w-2xl px-4">
          <div className="mb-8">
            <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4" />
              <span>LGPD — Art. 18 · Canal oficial do titular</span>
            </div>
            <h1 className="text-3xl font-bold text-foreground md:text-4xl">Solicitar meus dados</h1>
            <p className="mt-3 text-muted-foreground">
              Este canal automatizado permite que você exerça qualquer direito garantido pela Lei
              Geral de Proteção de Dados. Sua solicitação é registrada com protocolo, e o
              Encarregado (DPO) tem até <strong>15 dias corridos</strong> para responder — sem custo
              para o titular.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-sm"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label htmlFor="nome">Nome completo *</Label>
                <Input
                  id="nome"
                  value={form.solicitante_nome}
                  onChange={(e) => update("solicitante_nome", e.target.value)}
                  maxLength={200}
                  required
                  autoComplete="name"
                />
              </div>
              <div>
                <Label htmlFor="email">E-mail para resposta *</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.solicitante_email}
                  onChange={(e) => update("solicitante_email", e.target.value)}
                  maxLength={255}
                  required
                  autoComplete="email"
                />
              </div>
              <div>
                <Label htmlFor="tel">Telefone (opcional)</Label>
                <Input
                  id="tel"
                  value={form.solicitante_telefone ?? ""}
                  onChange={(e) => update("solicitante_telefone", e.target.value)}
                  maxLength={40}
                  autoComplete="tel"
                  placeholder="(88) 99999-9999"
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="cpf">CPF (opcional)</Label>
                <Input
                  id="cpf"
                  value={form.solicitante_cpf ?? ""}
                  onChange={(e) => update("solicitante_cpf", e.target.value)}
                  maxLength={20}
                  placeholder="Somente se necessário para localizar seus dados"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Informe apenas se ajudar a localizar seus dados. Sem CPF a equipe pode solicitar
                  outra forma de identificação.
                </p>
              </div>
            </div>

            <div>
              <Label htmlFor="tipo">Direito que deseja exercer *</Label>
              <Select value={form.tipo} onValueChange={(v) => update("tipo", v as TipoValue)}>
                <SelectTrigger id="tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPO_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div>
                        <div className="font-medium">{opt.label}</div>
                        <div className="text-xs text-muted-foreground">{opt.hint}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="desc">Descrição da solicitação *</Label>
              <Textarea
                id="desc"
                rows={6}
                value={form.descricao}
                onChange={(e) => update("descricao", e.target.value)}
                maxLength={2000}
                required
                placeholder="Descreva com o máximo de clareza possível o que você deseja. Ex.: 'Gostaria de saber quais dados sobre meu filho João Silva (5º ano B) a Escola armazena e com quem foram compartilhados.'"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {form.descricao.length}/2000 caracteres
              </p>
            </div>

            <div className="rounded-lg border border-border bg-muted/40 p-4 text-xs text-muted-foreground">
              <p className="flex items-start gap-2">
                <FileText className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Ao enviar, você declara ser o titular dos dados ou seu representante legal.
                  Solicitações fraudulentas podem constituir crime (Art. 299 do Código Penal).
                  Poderemos solicitar confirmação de identidade antes de atender pedidos que
                  envolvam exclusão ou portabilidade.
                </span>
              </p>
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" asChild>
                <Link to="/privacidade">Cancelar</Link>
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Enviando..." : "Enviar solicitação"}
              </Button>
            </div>
          </form>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

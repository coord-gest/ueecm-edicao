import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, CalendarPlus, CheckCircle2, Loader2, User, Phone, Mail } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { logParentalConsent, PARENTAL_TERM_VERSION } from "@/lib/parental-consent.functions";
import { calcularIdade, formatCpf } from "@/lib/parental-consent";
import { logger } from "@/lib/logger";

export const Route = createFileRoute("/agendar")({
  head: () => ({
    meta: [
      { title: "Agendar reunião ou visita | U.E. Evaristo Campelo de Matos" },
      {
        name: "description",
        content:
          "Agende uma reunião ou visita com Diretores, Coordenadores ou Professores da U.E. Evaristo Campelo de Matos.",
      },
      { property: "og:title", content: "Agendar reunião ou visita | UEECM" },
      {
        property: "og:description",
        content:
          "Marque um horário com a Direção, Coordenação ou um professor da escola. Envie sua solicitação em minutos.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://conectaueecm.com/agendar" },
      { property: "og:image", content: "https://conectaueecm.com/og-image.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://conectaueecm.com/og-image.jpg" },
    ],
    links: [{ rel: "canonical", href: "https://conectaueecm.com/agendar" }],
  }),
  component: AgendarPage,
});

type Relacao = "aluno" | "responsavel" | "professor" | "visitante";
type AlvoTipo = "cargo" | "profissional";
type Cargo = "diretor" | "coordenador" | "professor";

const CARGOS: { value: Cargo; label: string }[] = [
  { value: "diretor", label: "Direção" },
  { value: "coordenador", label: "Coordenação" },
  { value: "professor", label: "Um professor específico" },
];

const RELACOES: { value: Relacao; label: string }[] = [
  { value: "visitante", label: "Visitante / comunidade" },
  { value: "responsavel", label: "Pai / mãe / responsável" },
  { value: "aluno", label: "Aluno(a)" },
  { value: "professor", label: "Professor(a) da escola" },
];

// Horários possíveis (turno letivo)
const HORARIOS = ["08:00", "09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00"];

function AgendarPage() {
  const { user } = useAuth();

  const [nome, setNome] = useState("");
  const [contato, setContato] = useState("");
  const [relacao, setRelacao] = useState<Relacao>("visitante");
  const [alvoTipo, setAlvoTipo] = useState<AlvoTipo>("cargo");
  const [cargo, setCargo] = useState<Cargo>("diretor");
  const [profissionalId, setProfissionalId] = useState<string>("");
  const [motivo, setMotivo] = useState("");
  const [data, setData] = useState<string>(""); // yyyy-mm-dd
  const [hora, setHora] = useState<string>("09:00");
  const [protocolo, setProtocolo] = useState<string | null>(null);
  const [aceiteLgpd, setAceiteLgpd] = useState(false);

  // --- Consentimento parental (LGPD Art. 14) ---
  const [dataNascimento, setDataNascimento] = useState<string>(""); // yyyy-mm-dd do solicitante
  const [respNome, setRespNome] = useState("");
  const [respCpf, setRespCpf] = useState("");
  const [respEmail, setRespEmail] = useState("");
  const [respTelefone, setRespTelefone] = useState("");
  const [aceiteParental, setAceiteParental] = useState(false);

  // --- Anti-bot: honeypot + tempo mínimo de preenchimento ---
  // Bots automatizados preenchem todos os campos (inclusive os ocultos) e
  // submetem em < 1s. Humanos levam mais tempo e ignoram campos escondidos.
  const [honeypot, setHoneypot] = useState("");
  const formMountedAt = useRef<number>(Date.now());
  const MIN_FILL_TIME_MS = 3000;

  const profissionaisQuery = useQuery({
    queryKey: ["agendar", "profissionais"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profissionais_publico")
        .select("id, nome, cargo")

        .order("ordem", { ascending: true })
        .order("nome", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Data mínima = hoje
  const minDate = useMemo(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }, []);

  // Data de nascimento máxima = hoje (impede datas futuras)
  const maxDobDate = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // `calcularIdade` está em `@/lib/parental-consent` (coberto por testes).

  const idadeSolicitante = useMemo(() => calcularIdade(dataNascimento), [dataNascimento]);
  const isMenor = idadeSolicitante !== null && idadeSolicitante < 18;

  const criar = useMutation({
    mutationFn: async () => {
      // Anti-bot: se o honeypot foi preenchido, silenciosamente aborta —
      // não informa ao bot que foi detectado. Também exige tempo mínimo
      // entre montagem do formulário e submissão.
      if (honeypot.trim() !== "") {
        throw new Error("Solicitação inválida.");
      }
      if (Date.now() - formMountedAt.current < MIN_FILL_TIME_MS) {
        throw new Error("Aguarde alguns segundos antes de enviar.");
      }
      if (!nome.trim()) throw new Error("Informe seu nome completo.");
      if (!contato.trim()) throw new Error("Informe um contato (telefone ou e-mail).");
      if (!motivo.trim() || motivo.trim().length < 8)
        throw new Error("Descreva brevemente o motivo (mínimo 8 caracteres).");
      if (!data) throw new Error("Escolha a data.");
      if (!hora) throw new Error("Escolha o horário.");
      if (alvoTipo === "profissional" && !profissionalId)
        throw new Error("Selecione o profissional.");
      if (!dataNascimento) throw new Error("Informe sua data de nascimento.");
      if (idadeSolicitante === null || idadeSolicitante < 0 || idadeSolicitante > 120)
        throw new Error("Data de nascimento inválida.");
      if (!aceiteLgpd)
        throw new Error(
          "É necessário concordar com o uso dos dados conforme a Política de Privacidade.",
        );

      // --- Validações específicas para menores de 18 anos (LGPD Art. 14) ---
      if (isMenor) {
        if (!respNome.trim() || respNome.trim().length < 2)
          throw new Error("Informe o nome completo do responsável legal.");
        // CPF é OPCIONAL. Se informado, precisa ter 11 dígitos.
        if (respCpf.trim()) {
          const cpfDigits = respCpf.replace(/\D/g, "");
          if (cpfDigits.length !== 11)
            throw new Error("CPF do responsável inválido (11 dígitos) ou deixe em branco.");
        }
        // Regex leve para e-mail — validação forte fica no server (Zod).
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(respEmail.trim()))
          throw new Error("Informe um e-mail válido do responsável legal.");
        if (!aceiteParental)
          throw new Error(
            "O responsável legal deve autorizar expressamente o tratamento dos dados do menor.",
          );
      }

      // Monta timestamps America/Fortaleza (UTC-3, sem horário de verão)
      const inicio = new Date(`${data}T${hora}:00-03:00`);
      const fim = new Date(inicio.getTime() + 60 * 60 * 1000); // 1h

      if (inicio.getTime() < Date.now() - 5 * 60 * 1000) {
        throw new Error("Escolha um horário futuro.");
      }

      const { data: protocoloRes, error } = await supabase.rpc("criar_agendamento", {
        p_solicitante_nome: nome.trim(),
        p_solicitante_relacao: relacao,
        p_solicitante_contato: contato.trim(),
        p_motivo: motivo.trim(),
        p_inicio_at: inicio.toISOString(),
        p_fim_at: fim.toISOString(),
        p_profissional_id: alvoTipo === "profissional" ? profissionalId : undefined,
        p_alvo_cargo: alvoTipo === "cargo" ? cargo : undefined,
      });

      if (error) throw error;
      const protocoloFinal = protocoloRes as string;

      // Registra o consentimento parental logo após o agendamento existir.
      // Falha aqui NÃO invalida o agendamento — mas é reportada ao usuário
      // para que ele saiba re-tentar (log auditável é obrigatório para menores).
      if (isMenor) {
        try {
          await logParentalConsent({
            data: {
              protocolo: protocoloFinal,
              minor_name: nome.trim(),
              minor_dob: dataNascimento,
              guardian_name: respNome.trim(),
              guardian_cpf: respCpf.trim() || null,
              guardian_email: respEmail.trim(),
              guardian_phone: respTelefone.trim() || null,
              term_version: PARENTAL_TERM_VERSION,
              website: "", // honeypot — humanos deixam vazio
            },
          });
        } catch (logErr) {
          logger.error("[agendar] falha ao registrar consentimento parental:", logErr);
          toast.warning(
            "Agendamento criado, mas houve falha ao registrar o consentimento do responsável. Guarde o protocolo e entre em contato com a escola.",
          );
        }
      }

      return { protocolo: protocoloFinal };
    },
    onSuccess: (row) => {
      setProtocolo(row.protocolo);
      toast.success("Solicitação enviada! A escola confirmará em breve.");
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Erro ao enviar solicitação.");
    },
  });

  if (protocolo) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-16">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <CardTitle>Solicitação enviada!</CardTitle>
            <CardDescription>
              Seu pedido foi registrado. A Coordenação vai revisar e confirmar em breve.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <div>
              <p className="text-sm text-muted-foreground">Protocolo</p>
              <p className="font-mono text-xl font-semibold">{protocolo}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Guarde este protocolo. Você receberá a confirmação pelo contato informado.
            </p>
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              {user && (
                <Button asChild variant="default">
                  <Link to="/meus-agendamentos">Ver meus agendamentos</Link>
                </Button>
              )}
              <Button asChild variant="outline">
                <Link to="/">Voltar ao início</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10 sm:py-16">
      <div className="mb-6">
        <Button asChild variant="ghost" size="sm" className="gap-2">
          <Link to="/">
            <ArrowLeft className="h-4 w-4" />
            Voltar ao site
          </Link>
        </Button>
      </div>
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
          <CalendarPlus className="h-8 w-8" />
        </div>
        <h1 className="text-3xl font-bold sm:text-4xl">Agendar reunião ou visita</h1>
        <p className="mx-auto mt-2 max-w-xl text-muted-foreground">
          Marque um horário com a Direção, Coordenação ou um professor. Preencha os dados abaixo e
          nossa equipe entrará em contato para confirmar.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Seus dados</CardTitle>
          <CardDescription>
            Usamos apenas para identificar sua solicitação e retornar a confirmação.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nome">
                <User className="mr-1 inline h-3.5 w-3.5" />
                Nome completo
              </Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: Maria Silva"
                autoComplete="name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contato">
                <Phone className="mr-1 inline h-3.5 w-3.5" />
                Telefone ou <Mail className="ml-1 inline h-3.5 w-3.5" /> e-mail
              </Label>
              <Input
                id="contato"
                value={contato}
                onChange={(e) => setContato(e.target.value)}
                placeholder="(86) 9xxxx-xxxx ou seu@email.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="data-nascimento">Data de nascimento</Label>
            <Input
              id="data-nascimento"
              type="date"
              max={maxDobDate}
              value={dataNascimento}
              onChange={(e) => setDataNascimento(e.target.value)}
              autoComplete="bday"
              aria-describedby="dob-help"
            />
            <p id="dob-help" className="text-xs text-muted-foreground">
              Usada para verificar se você é menor de 18 anos (LGPD, Art. 14).
              {idadeSolicitante !== null && idadeSolicitante >= 0 && (
                <>
                  {" "}
                  Idade calculada: <strong>{idadeSolicitante} anos</strong>.
                </>
              )}
            </p>
          </div>

          {isMenor && (
            <div className="space-y-4 rounded-md border-2 border-primary/40 bg-primary/5 p-4">
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  Consentimento do responsável legal
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Você tem menos de 18 anos. Nos termos do{" "}
                  <strong>Art. 14 da Lei nº 13.709/2018 (LGPD)</strong>, o tratamento dos seus dados
                  pessoais depende do consentimento específico do seu pai, mãe ou responsável legal.
                  Peça a um deles para preencher os campos abaixo.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="resp-nome">Nome completo do responsável</Label>
                  <Input
                    id="resp-nome"
                    value={respNome}
                    onChange={(e) => setRespNome(e.target.value)}
                    placeholder="Ex.: João Silva"
                    autoComplete="name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="resp-cpf">
                    CPF do responsável{" "}
                    <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
                  </Label>
                  <Input
                    id="resp-cpf"
                    value={respCpf}
                    onChange={(e) => setRespCpf(formatCpf(e.target.value))}
                    placeholder="000.000.000-00 (opcional)"
                    inputMode="numeric"
                    maxLength={14}
                    aria-describedby="cpf-help"
                  />
                  <p id="cpf-help" className="text-[11px] text-muted-foreground">
                    Você decide se deseja informar. Deixe em branco se preferir.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="resp-email">E-mail do responsável</Label>
                  <Input
                    id="resp-email"
                    type="email"
                    value={respEmail}
                    onChange={(e) => setRespEmail(e.target.value)}
                    placeholder="responsavel@email.com"
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="resp-telefone">Telefone do responsável (opcional)</Label>
                  <Input
                    id="resp-telefone"
                    value={respTelefone}
                    onChange={(e) => setRespTelefone(e.target.value)}
                    placeholder="(86) 9xxxx-xxxx"
                    autoComplete="tel"
                  />
                </div>
              </div>

              <label
                htmlFor="aceite-parental"
                className="flex items-start gap-2 rounded-md border border-primary/40 bg-background p-3 text-sm"
              >
                <Checkbox
                  id="aceite-parental"
                  checked={aceiteParental}
                  onCheckedChange={(v) => setAceiteParental(v === true)}
                  className="mt-0.5"
                />
                <span>
                  Declaro que sou pai, mãe ou responsável legal pelo(a) menor identificado(a) acima
                  e <strong>autorizo expressamente</strong> o tratamento dos dados informados neste
                  formulário para fins de agendamento escolar, nos termos da LGPD (Lei 13.709/2018,
                  Art. 14). Estou ciente de que este consentimento será registrado com data, hora e
                  endereço IP, e que posso revogá-lo a qualquer momento pelo canal do Encarregado.
                </span>
              </label>

              <p className="text-[11px] text-muted-foreground">
                Versão do termo: <code>{PARENTAL_TERM_VERSION}</code>
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Você é:</Label>
            <RadioGroup
              value={relacao}
              onValueChange={(v) => setRelacao(v as Relacao)}
              className="grid gap-2 sm:grid-cols-2"
            >
              {RELACOES.map((r) => (
                <label
                  key={r.value}
                  htmlFor={`rel-${r.value}`}
                  className="flex items-center gap-2 rounded-md border border-border p-3 hover:bg-accent"
                >
                  <RadioGroupItem id={`rel-${r.value}`} value={r.value} />
                  <span className="text-sm">{r.label}</span>
                </label>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-3">
            <Label>Com quem você quer falar?</Label>
            <RadioGroup
              value={alvoTipo}
              onValueChange={(v) => setAlvoTipo(v as AlvoTipo)}
              className="grid gap-2 sm:grid-cols-2"
            >
              <label
                htmlFor="alvo-cargo"
                className="flex items-center gap-2 rounded-md border border-border p-3 hover:bg-accent"
              >
                <RadioGroupItem id="alvo-cargo" value="cargo" />
                <span className="text-sm">Direção / Coordenação</span>
              </label>
              <label
                htmlFor="alvo-prof"
                className="flex items-center gap-2 rounded-md border border-border p-3 hover:bg-accent"
              >
                <RadioGroupItem id="alvo-prof" value="profissional" />
                <span className="text-sm">Professor específico</span>
              </label>
            </RadioGroup>

            {alvoTipo === "cargo" ? (
              <Select value={cargo} onValueChange={(v) => setCargo(v as Cargo)}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha o setor" />
                </SelectTrigger>
                <SelectContent>
                  {CARGOS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Select value={profissionalId} onValueChange={setProfissionalId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o profissional" />
                </SelectTrigger>
                <SelectContent>
                  {(profissionaisQuery.data ?? [])
                    .filter((p) => p.id)
                    .map((p) => (
                      <SelectItem key={p.id!} value={p.id!}>
                        {p.nome}
                        {p.cargo ? ` — ${p.cargo}` : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="data">Data</Label>
              <Input
                id="data"
                type="date"
                min={minDate}
                value={data}
                onChange={(e) => setData(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hora">Horário</Label>
              <Select value={hora} onValueChange={setHora}>
                <SelectTrigger id="hora">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HORARIOS.map((h) => (
                    <SelectItem key={h} value={h}>
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo da reunião</Label>
            <Textarea
              id="motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: gostaria de falar sobre o desempenho do meu filho na turma 8º A."
              rows={4}
            />
          </div>

          {!user && (
            <p className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
              <Badge variant="outline" className="mr-2">
                Visitante
              </Badge>
              Você não precisa criar conta. Se preferir acompanhar o histórico dos seus pedidos,{" "}
              <Link to="/login" className="underline">
                entre com sua conta
              </Link>
              .
            </p>
          )}

          <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">Tratamento de dados pessoais (LGPD)</p>
            <p className="mt-1">
              As informações fornecidas (nome, contato e motivo) serão usadas exclusivamente para{" "}
              <strong>processar seu agendamento</strong>, com base legal em{" "}
              <em>execução de procedimentos preliminares a contrato / interesse legítimo</em> (art.
              7º, V e IX da Lei 13.709/2018). Os dados são acessíveis apenas à direção e à equipe
              indicada, mantidos pelo tempo necessário e podem ser removidos a seu pedido pelo canal
              do Encarregado. Consulte a{" "}
              <Link to="/privacidade" className="font-medium text-primary hover:underline">
                Política de Privacidade
              </Link>{" "}
              para detalhes.
            </p>
            <label className="mt-3 flex items-start gap-2 text-sm text-foreground">
              <Checkbox
                checked={aceiteLgpd}
                onCheckedChange={(v) => setAceiteLgpd(v === true)}
                className="mt-0.5"
                aria-describedby="lgpd-desc"
              />
              <span id="lgpd-desc">
                Li e concordo com o tratamento dos meus dados conforme descrito acima.
              </span>
            </label>
          </div>

          {/* Honeypot anti-bot: invisível para humanos, tentador para bots.
              aria-hidden + tabIndex=-1 impede navegação por teclado/leitor. */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              left: "-10000px",
              width: "1px",
              height: "1px",
              overflow: "hidden",
            }}
          >
            <label htmlFor="website-url">Website (não preencha)</label>
            <input
              id="website-url"
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
            />
          </div>

          <Button
            onClick={() => criar.mutate()}
            disabled={criar.isPending || !aceiteLgpd || (isMenor && !aceiteParental)}
            className="w-full"
            size="lg"
          >
            {criar.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              "Enviar solicitação"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

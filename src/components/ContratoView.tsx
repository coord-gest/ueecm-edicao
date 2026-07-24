import { useMemo } from "react";
import { Eye, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import logoUrl from "@/assets/logo.png";
import {
  corStatus,
  rotuloStatus,
  type Contrato,
} from "@/lib/contratos.functions";

const ESCOLA_NOME = "U.E. Evaristo Campelo de Matos";
const ESCOLA_LOCAL = "Assunção do Piauí — PI";

function fmtData(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function ContratoView({
  contrato,
  open,
  onOpenChange,
  viewer,
}: {
  contrato: Contrato | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  viewer: "professor" | "responsavel";
}) {
  const dataAtual = useMemo(
    () =>
      new Date().toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }),
    [],
  );

  if (!contrato) return null;

  const doPrint = () => {
    // Usa a impressão nativa do navegador; o CSS abaixo garante que só o
    // documento apareça. "Salvar como PDF" é a opção padrão no diálogo.
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0 print:max-h-none print:overflow-visible print:shadow-none print:border-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Termo de Parceria e Compromisso</DialogTitle>
        </DialogHeader>

        {/* Barra de ações — escondida na impressão */}
        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b bg-background/95 px-4 py-3 backdrop-blur print:hidden">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Eye className="h-4 w-4" />
            Visualização do termo
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={doPrint}>
              <Printer className="mr-1 h-4 w-4" /> Baixar / Imprimir PDF
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Instruções — só para responsáveis, escondidas na impressão */}
        {viewer === "responsavel" && (
          <div className="mx-4 mt-4 rounded-md border border-primary/30 bg-primary/5 p-4 text-sm print:hidden">
            <p className="font-semibold text-primary">O que você deve fazer 👇</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-foreground">
              <li>Leia com calma o termo abaixo, combinado com o(a) professor(a).</li>
              <li>
                Se concordar, clique em <strong>“Assinar como responsável”</strong>{" "}
                na tela anterior — a assinatura fica registrada digitalmente.
              </li>
              <li>
                Se preferir uma cópia em papel, clique em{" "}
                <strong>Baixar / Imprimir PDF</strong>, imprima, assine à mão e
                envie pela agenda do(a) seu(sua) filho(a).
              </li>
            </ol>
          </div>
        )}

        {/* Documento — área imprimível */}
        <article
          id="contrato-print-area"
          className="mx-auto w-full max-w-[820px] px-4 py-6 sm:px-10 sm:py-10 print:px-8 print:py-6"
        >
          {/* Cabeçalho */}
          <header className="flex flex-col items-center gap-3 border-b pb-6 text-center sm:flex-row sm:items-center sm:gap-4 sm:text-left">
            <img
              src={logoUrl}
              alt="Logo UEECM"
              className="h-16 w-16 shrink-0 sm:h-20 sm:w-20"
            />
            <div className="min-w-0">
              <h1 className="text-lg font-bold leading-tight sm:text-xl">
                {ESCOLA_NOME}
              </h1>
              <p className="text-xs text-muted-foreground sm:text-sm">
                {ESCOLA_LOCAL}
              </p>
              <p className="mt-1 text-xs uppercase tracking-wide text-primary">
                🤝 Termo de Parceria e Compromisso
              </p>
            </div>
          </header>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              Emitido em <strong>{dataAtual}</strong>
            </span>
            <Badge className={corStatus(contrato.status) + " print:border print:bg-transparent"}>
              {rotuloStatus(contrato.status)}
            </Badge>
          </div>

          {/* 1. Quem somos */}
          <section className="mt-6 space-y-2">
            <h2 className="text-base font-semibold">1. Quem Somos</h2>
            <dl className="grid grid-cols-1 gap-2 rounded-md border p-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase text-muted-foreground">Professor(a)</dt>
                <dd className="font-medium">{contrato.autor_nome ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted-foreground">Aluno(a)</dt>
                <dd className="font-medium">{contrato.aluno_nome ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted-foreground">Turma</dt>
                <dd className="font-medium">{contrato.turma_nome ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted-foreground">Prazo</dt>
                <dd className="font-medium">{fmtData(contrato.prazo)}</dd>
              </div>
            </dl>
          </section>

          {/* 2. Propósito */}
          <section className="mt-6 space-y-2">
            <h2 className="text-base font-semibold">2. O Nosso Propósito</h2>
            <p className="text-sm leading-relaxed text-foreground/90">
              Acreditamos que a educação e o desenvolvimento de{" "}
              <strong>{contrato.aluno_nome ?? "nosso(a) aluno(a)"}</strong>{" "}
              acontecem de verdade quando a família e o(a) professor(a) caminham
              juntos, como um time. Este documento é um pacto de carinho, respeito
              e colaboração, feito para garantir a melhor experiência de
              aprendizado e um ambiente seguro, acolhedor e incentivador em cada
              passo.
            </p>
            {contrato.motivo && (
              <p className="mt-2 rounded-md bg-muted/40 p-3 text-sm italic">
                “{contrato.motivo}”
              </p>
            )}
          </section>

          {/* 3. Objetivos combinados */}
          <section className="mt-6 space-y-2">
            <h2 className="text-base font-semibold">
              3. Objetivos combinados — <span className="font-normal">{contrato.titulo}</span>
            </h2>
            <ul className="list-disc space-y-1 pl-6 text-sm marker:text-primary">
              {contrato.objetivos.map((o, i) => (
                <li key={i}>{o.texto}</li>
              ))}
            </ul>
          </section>

          {/* 4. Papéis */}
          <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-md border p-4">
              <h3 className="text-sm font-semibold">👩‍🏫 O Papel do(a) Professor(a)</h3>
              <ul className="mt-2 space-y-1 text-sm text-foreground/90">
                <li>• Ensinar com dedicação e afeto, respeitando o tempo do(a) aluno(a).</li>
                <li>• Criar um ambiente seguro, acolhedor e estimulante.</li>
                <li>• Manter a comunicação aberta sobre progressos e dificuldades.</li>
                <li>• Estar disponível para conversas mediante agendamento.</li>
              </ul>
            </div>
            <div className="rounded-md border p-4">
              <h3 className="text-sm font-semibold">👨‍👩‍👧 O Papel da Família</h3>
              <ul className="mt-2 space-y-1 text-sm text-foreground/90">
                <li>• Incentivar a rotina de estudos e cuidar do material escolar.</li>
                <li>• Garantir assiduidade e pontualidade, avisando faltas.</li>
                <li>• Ler os recados e conversar sobre mudanças na rotina.</li>
                <li>• Resolver desafios de forma respeitosa e construtiva.</li>
              </ul>
            </div>
          </section>

          {/* 5. Comunicação */}
          <section className="mt-6 space-y-2">
            <h2 className="text-base font-semibold">5. Nossa Comunicação</h2>
            <p className="text-sm leading-relaxed text-foreground/90">
              Nossos canais oficiais de mensagens serão o aplicativo{" "}
              <strong>Conecta UEECM</strong> (chat com o(a) professor(a) e mural
              de recados) e o <strong>WhatsApp</strong> da turma para avisos
              rápidos do dia a dia. Para reuniões, combinaremos previamente um
              horário que seja bom para todos.
            </p>
          </section>

          <blockquote className="mt-6 rounded-md border-l-4 border-primary bg-primary/5 p-4 text-sm italic text-foreground/90">
            “Educar é semear com carinho e colher com paciência. Vamos juntos
            fazer deste ano uma linda jornada!”
          </blockquote>

          {/* 6. Assinaturas */}
          <section className="mt-8">
            <p className="text-right text-xs text-muted-foreground">
              {ESCOLA_LOCAL.split(" — ")[0]}, {dataAtual}.
            </p>

            <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2">
              <SignatureBlock
                label="Professor(a)"
                nome={contrato.autor_nome ?? ""}
                assinadoEm={contrato.assinado_professor_em}
              />
              <SignatureBlock
                label="Responsável Legal"
                nome=""
                assinadoEm={contrato.assinado_responsavel_em}
              />
            </div>
          </section>

          <footer className="mt-10 border-t pt-4 text-center text-[10px] uppercase tracking-wide text-muted-foreground">
            Documento gerado eletronicamente pelo Conecta UEECM ·{" "}
            {ESCOLA_NOME}
          </footer>
        </article>

        {/* Print CSS — isola a área do contrato ao imprimir */}
        <style>{`
          @media print {
            @page { size: A4; margin: 16mm; }
            html, body { background: #fff !important; }
            body * { visibility: hidden !important; }
            #contrato-print-area, #contrato-print-area * {
              visibility: visible !important;
              color: #000 !important;
            }
            #contrato-print-area {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              max-width: none !important;
              padding: 0 !important;
              margin: 0 !important;
              box-shadow: none !important;
              background: #fff !important;
              font-size: 11pt;
              line-height: 1.45;
            }
            #contrato-print-area h1 { font-size: 16pt; }
            #contrato-print-area h2 { font-size: 12.5pt; margin-top: 14pt; }
            #contrato-print-area h3 { font-size: 11.5pt; }
            #contrato-print-area header { border-color: #000 !important; }
            #contrato-print-area section,
            #contrato-print-area blockquote,
            #contrato-print-area dl,
            #contrato-print-area .rounded-md {
              page-break-inside: avoid;
              break-inside: avoid;
            }
            #contrato-print-area img { max-height: 22mm; width: auto; }
            #contrato-print-area .border,
            #contrato-print-area .border-b,
            #contrato-print-area .border-t,
            #contrato-print-area .border-l-4 {
              border-color: #000 !important;
            }
            #contrato-print-area .bg-primary\\/5,
            #contrato-print-area .bg-muted\\/40 {
              background: #f3f3f3 !important;
            }
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}

function SignatureBlock({
  label,
  nome,
  assinadoEm,
}: {
  label: string;
  nome: string;
  assinadoEm: string | null;
}) {
  return (
    <div className="text-center">
      <div className="mx-auto h-12 border-b border-foreground/60" />
      <p className="mt-1 text-sm font-medium">{nome || "_____________________"}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
      {assinadoEm ? (
        <p className="mt-1 text-[11px] text-emerald-600">
          ✓ Assinado digitalmente em{" "}
          {new Date(assinadoEm).toLocaleString("pt-BR", {
            dateStyle: "short",
            timeStyle: "short",
          })}
        </p>
      ) : (
        <p className="mt-1 text-[11px] text-muted-foreground">Aguardando assinatura</p>
      )}
    </div>
  );
}
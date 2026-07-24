import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { FileSignature, PenSquare, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  listarContratosResponsavel,
  assinarContratoResponsavel,
  corStatus,
  rotuloStatus,
  type Contrato,
} from "@/lib/contratos.functions";
import { ContratoView } from "@/components/ContratoView";

export const Route = createFileRoute("/painel-contratos-filhos")({
  ssr: false,
  component: PainelContratosFilhos,
  head: () => ({
    meta: [
      { title: "Contratos do meu filho | Conecta UEECM" },
      {
        name: "description",
        content: "Veja e assine os contratos de compromisso combinados pelo professor com seu filho.",
      },
      { property: "og:title", content: "Contratos de Compromisso — Família" },
      { property: "og:description", content: "Acordos pedagógicos entre professor, aluno e família." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function PainelContratosFilhos() {
  const qc = useQueryClient();
  const listar = useServerFn(listarContratosResponsavel);
  const assinar = useServerFn(assinarContratoResponsavel);
  const query = useQuery({ queryKey: ["contratos-responsavel"], queryFn: () => listar() });
  const [busy, setBusy] = useState<string | null>(null);
  const [viewContrato, setViewContrato] = useState<Contrato | null>(null);

  const contratos = (query.data ?? []) as Contrato[];

  const doAssinar = async (id: string) => {
    setBusy(id);
    try {
      await assinar({ data: { contratoId: id } });
      toast.success("Contrato assinado. Obrigado pelo compromisso!");
      qc.invalidateQueries({ queryKey: ["contratos-responsavel"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-6 sm:px-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
          <FileSignature className="h-7 w-7 sm:h-8 sm:w-8 text-primary shrink-0" />
          Contratos de Compromisso
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1 max-w-2xl">
          Aqui você acompanha e assina os acordos combinados entre a escola, seu filho e você. Assinar
          significa que a família está comprometida em apoiar as metas em casa.
        </p>
      </div>

      <div className="rounded-md border border-primary/30 bg-primary/5 p-4 text-sm">
        <p className="font-semibold text-primary">O que você deve fazer 👇</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Toque em <strong>Ver contrato</strong> para ler o termo completo.</li>
          <li>Se concordar, toque em <strong>Assinar como responsável</strong>.</li>
          <li>Se preferir imprimir e assinar à mão, use <strong>Baixar / Imprimir PDF</strong> dentro da visualização.</li>
        </ol>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Meus contratos ({contratos.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {query.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : contratos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum contrato pendente. Você será notificado se um professor propor um novo compromisso.
            </p>
          ) : (
            contratos.map((c) => (
              <div key={c.id} className="border rounded-md p-3 sm:p-4 space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold">{c.titulo}</h3>
                      <Badge className={corStatus(c.status)}>{rotuloStatus(c.status)}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {c.aluno_nome ?? "Aluno"} · {c.turma_nome ?? ""}
                      {c.prazo ? ` · Prazo ${new Date(c.prazo).toLocaleDateString("pt-BR")}` : ""}
                    </p>
                  </div>
                </div>

                {c.motivo && <p className="text-sm text-muted-foreground italic">{c.motivo}</p>}

                {c.objetivos.length > 0 && (
                  <div>
                    <div className="text-xs uppercase text-muted-foreground mb-1">Objetivos combinados</div>
                    <ul className="text-sm space-y-1 pl-4 list-disc marker:text-primary">
                      {c.objetivos.map((o, i) => (
                        <li key={i}>{o.texto}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex flex-col gap-2 pt-2 border-t sm:flex-row sm:flex-wrap sm:items-center">
                  <span className="text-xs text-muted-foreground">
                    Prof.: {c.assinado_professor_em ? "assinado ✓" : "pendente"} · Família:{" "}
                    {c.assinado_responsavel_em ? "assinado ✓" : "pendente"}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="sm:ml-auto"
                    onClick={() => setViewContrato(c)}
                  >
                    <Eye className="mr-1 h-4 w-4" /> Ver contrato
                  </Button>
                  {!c.assinado_responsavel_em && c.status !== "cancelado" && c.status !== "concluido" && (
                    <Button
                      size="sm"
                      onClick={() => doAssinar(c.id)}
                      disabled={busy === c.id}
                    >
                      <PenSquare className="mr-1 h-4 w-4" />
                      {busy === c.id ? "Assinando..." : "Assinar como responsável"}
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <ContratoView
        contrato={viewContrato}
        open={!!viewContrato}
        onOpenChange={(o) => !o && setViewContrato(null)}
        viewer="responsavel"
      />
    </div>
  );
}
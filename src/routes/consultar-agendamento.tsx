import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Search, Loader2, Clock, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/consultar-agendamento")({
  head: () => ({
    meta: [
      { title: "Consultar agendamento por protocolo | UEECM" },
      {
        name: "description",
        content:
          "Confira o status do seu agendamento na U.E. Evaristo Campelo de Matos informando o protocolo e o contato usado no pedido.",
      },
      { property: "og:title", content: "Consultar agendamento | UEECM" },
      {
        property: "og:description",
        content: "Acompanhe o status do seu agendamento com protocolo e contato.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://conectaueecm.com/consultar-agendamento" },
    ],
    links: [{ rel: "canonical", href: "https://conectaueecm.com/consultar-agendamento" }],
  }),
  component: ConsultarPage,
});

type Resultado = {
  protocolo: string;
  status: string;
  motivo: string;
  inicio_at: string;
  fim_at: string;
  alvo_cargo: string | null;
  profissional_nome: string | null;
  observacoes_staff: string | null;
  created_at: string;
};

const STATUS_LABEL: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  pendente: { label: "Pendente", variant: "secondary" },
  confirmado: { label: "Confirmado", variant: "default" },
  recusado: { label: "Recusado", variant: "destructive" },
  cancelado: { label: "Cancelado", variant: "outline" },
  concluido: { label: "Concluído", variant: "outline" },
};

const CARGO_LABEL: Record<string, string> = {
  diretor: "Direção",
  coordenador: "Coordenação",
  professor: "Professor",
};

function ConsultarPage() {
  const [protocolo, setProtocolo] = useState("");
  const [contato, setContato] = useState("");
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [naoEncontrado, setNaoEncontrado] = useState(false);

  const buscar = useMutation({
    mutationFn: async () => {
      const p = protocolo.trim();
      const c = contato.trim();
      if (p.length < 6) throw new Error("Informe o protocolo completo.");
      if (c.length < 4) throw new Error("Informe o e-mail ou telefone usado no pedido.");
      const { data, error } = await supabase.rpc("consultar_agendamento", {
        _protocolo: p,
        _contato: c,
      });
      if (error) throw error;
      const row = Array.isArray(data) && data.length > 0 ? (data[0] as Resultado) : null;
      return row;
    },
    onSuccess: (row) => {
      if (!row) {
        setResultado(null);
        setNaoEncontrado(true);
      } else {
        setResultado(row);
        setNaoEncontrado(false);
      }
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Erro ao consultar.");
    },
  });

  return (
    <div className="container mx-auto max-w-2xl px-4 py-10 sm:py-16">
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
          <Search className="h-8 w-8" />
        </div>
        <h1 className="text-3xl font-bold sm:text-4xl">Consultar agendamento</h1>
        <p className="mx-auto mt-2 max-w-xl text-muted-foreground">
          Informe o <strong>protocolo</strong> recebido e o <strong>e-mail ou telefone</strong> que
          você usou no pedido para verificar o status.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Buscar pelo protocolo</CardTitle>
          <CardDescription>
            Ex.: <span className="font-mono">AG-2026-000123</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="protocolo">Protocolo</Label>
            <Input
              id="protocolo"
              value={protocolo}
              onChange={(e) => setProtocolo(e.target.value.toUpperCase())}
              placeholder="AG-2026-000001"
              autoComplete="off"
              className="font-mono"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contato">E-mail ou telefone informado no pedido</Label>
            <Input
              id="contato"
              value={contato}
              onChange={(e) => setContato(e.target.value)}
              placeholder="seu@email.com ou (86) 9xxxx-xxxx"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Para telefone basta lembrar os 4 últimos dígitos.
            </p>
          </div>
          <Button
            onClick={() => buscar.mutate()}
            disabled={buscar.isPending}
            className="w-full"
            size="lg"
          >
            {buscar.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Buscando...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Consultar status
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {naoEncontrado && (
        <Card className="mt-6 border-destructive/30">
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            Nenhum agendamento encontrado com esse protocolo e contato. Verifique se digitou
            corretamente.
          </CardContent>
        </Card>
      )}

      {resultado && (
        <Card className="mt-6">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">
                  {resultado.profissional_nome
                    ? `Reunião com ${resultado.profissional_nome}`
                    : `Reunião com ${CARGO_LABEL[resultado.alvo_cargo ?? ""] ?? "a escola"}`}
                </CardTitle>
                <CardDescription className="font-mono text-xs">
                  {resultado.protocolo}
                </CardDescription>
              </div>
              <Badge variant={(STATUS_LABEL[resultado.status] ?? STATUS_LABEL.pendente).variant}>
                {(STATUS_LABEL[resultado.status] ?? { label: resultado.status }).label}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              {format(new Date(resultado.inicio_at), "EEEE, dd 'de' MMMM 'de' yyyy 'às' HH:mm", {
                locale: ptBR,
              })}
            </p>
            <p className="flex items-start gap-2 text-muted-foreground">
              <MessageSquare className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{resultado.motivo}</span>
            </p>
            {resultado.observacoes_staff && (
              <p className="rounded-md bg-muted/50 p-2 text-xs">
                <strong>Observação da escola:</strong> {resultado.observacoes_staff}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, CalendarPlus, Clock, MessageSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { PainelLayout } from "@/components/PainelLayout";

export const Route = createFileRoute("/meus-agendamentos")({
  ssr: false,
  head: () => ({ meta: [{ title: "Meus agendamentos" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: MeusAgendamentosPage,
});

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

function CargoLabel({ v }: { v: string | null }) {
  if (!v) return null;
  const map: Record<string, string> = {
    diretor: "Direção",
    coordenador: "Coordenação",
    professor: "Professor",
  };
  return <span>{map[v] ?? v}</span>;
}

function MeusAgendamentosPage() {
  const { user } = useAuth();

  const q = useQuery({
    queryKey: ["meus-agendamentos", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agendamentos")
        .select(
          "id, protocolo, status, motivo, inicio_at, fim_at, alvo_cargo, observacoes_staff, profissional_id, profissionais(nome, cargo)",
        )
        .eq("solicitante_user_id", user!.id)
        .order("inicio_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <PainelLayout>
      <div className="space-y-6 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">Meus agendamentos</h1>
            <p className="text-sm text-muted-foreground">
              Acompanhe as reuniões e visitas que você solicitou.
            </p>
          </div>
          <Button asChild>
            <Link to="/agendar">
              <CalendarPlus className="mr-2 h-4 w-4" />
              Novo agendamento
            </Link>
          </Button>
        </div>

        {q.isLoading ? (
          <div className="grid gap-4">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : (q.data ?? []).length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <Calendar className="h-10 w-10 text-muted-foreground" />
              <p className="text-muted-foreground">Você ainda não tem agendamentos.</p>
              <Button asChild>
                <Link to="/agendar">Criar meu primeiro agendamento</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {(q.data ?? []).map((a) => {
              const st = STATUS_LABEL[a.status] ?? { label: a.status, variant: "outline" as const };
              const inicio = new Date(a.inicio_at);
              return (
                <Card key={a.id}>
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-base">
                          {a.profissionais?.nome ? (
                            <>Reunião com {a.profissionais.nome}</>
                          ) : (
                            <>
                              Reunião com a <CargoLabel v={a.alvo_cargo} />
                            </>
                          )}
                        </CardTitle>
                        <CardDescription className="font-mono text-xs">
                          {a.protocolo}
                        </CardDescription>
                      </div>
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      {format(inicio, "EEEE, dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                    <p className="flex items-start gap-2 text-muted-foreground">
                      <MessageSquare className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{a.motivo}</span>
                    </p>
                    {a.observacoes_staff && (
                      <p className="rounded-md bg-muted/50 p-2 text-xs">
                        <strong>Observação da escola:</strong> {a.observacoes_staff}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </PainelLayout>
  );
}

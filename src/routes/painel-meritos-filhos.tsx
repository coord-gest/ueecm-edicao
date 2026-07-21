import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Award, Loader2, Star, TrendingUp, AlertTriangle, ShieldAlert } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listMeritosMeusFilhos, type MeritoTipo } from "@/lib/meritos.functions";

export const Route = createFileRoute("/painel-meritos-filhos")({
  head: () => ({
    meta: [
      { title: "Reconhecimentos dos meus filhos — Conecta UEECM" },
      { name: "description", content: "Acompanhe elogios, avanços e observações dos professores sobre seus filhos." },
    ],
  }),
  component: PainelMeritosFilhos,
});

const TIPO_META: Record<MeritoTipo, { label: string; icon: React.ComponentType<{ className?: string }>; bg: string; border: string }> = {
  elogio: { label: "Elogio", icon: Star, bg: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300", border: "border-emerald-500" },
  avanco: { label: "Avanço", icon: TrendingUp, bg: "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300", border: "border-blue-500" },
  atencao: { label: "Atenção", icon: AlertTriangle, bg: "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300", border: "border-amber-500" },
  ocorrencia: { label: "Ocorrência", icon: ShieldAlert, bg: "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300", border: "border-red-500" },
};

function PainelMeritosFilhos() {
  const listFn = useServerFn(listMeritosMeusFilhos);
  const q = useQuery({ queryKey: ["meritos-meus-filhos"], queryFn: () => listFn(), staleTime: 60_000 });

  return (
    <div className="container mx-auto max-w-3xl p-4 md:p-6 space-y-6">
      <header className="flex items-start gap-3">
        <div className="rounded-[5px] bg-primary/10 p-2 text-primary"><Award className="h-5 w-5" /></div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reconhecimentos & observações</h1>
          <p className="text-sm text-muted-foreground">Notas dos professores sobre seus filhos, em linguagem construtiva.</p>
        </div>
      </header>

      {q.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-6">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      ) : (q.data ?? []).length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Nenhum registro ainda. Você será notificado quando o professor enviar um.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {q.data?.map((m) => {
            const meta = TIPO_META[m.tipo];
            const Icon = meta.icon;
            return (
              <Card key={m.id} className={`border-l-4 ${meta.border}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`rounded-[5px] p-1.5 ${meta.bg}`}><Icon className="h-3.5 w-3.5" /></div>
                      <CardTitle className="text-sm font-medium truncate">{m.aluno_nome ?? "—"}</CardTitle>
                    </div>
                    <Badge variant="outline" className="text-[10px]">{meta.label}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  <p className="whitespace-pre-line">{m.nota}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(m.created_at).toLocaleString("pt-BR")}
                    {m.autor_nome ? ` • ${m.autor_nome}` : ""}
                    {m.disciplina ? ` • ${m.disciplina}` : ""}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
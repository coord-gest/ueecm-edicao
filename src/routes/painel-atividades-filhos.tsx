import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, ClipboardList, Clock, Loader2, AlertCircle } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listAtividadesDoResponsavel, type AtividadeFilho } from "@/lib/atividades.functions";

export const Route = createFileRoute("/painel-atividades-filhos")({
  head: () => ({ meta: [{ title: "Atividades dos meus filhos" }] }),
  component: PainelAtividadesFilhos,
});

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return iso;
  }
}

function isAtrasada(dataEntrega: string, entregue: boolean) {
  if (entregue) return false;
  return new Date(dataEntrega).getTime() < Date.now();
}

function StatusBadge({ item }: { item: AtividadeFilho }) {
  if (item.entregue) {
    return (
      <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white gap-1">
        <CheckCircle2 className="h-3 w-3" /> Entregue
      </Badge>
    );
  }
  if (isAtrasada(item.data_entrega, item.entregue)) {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertCircle className="h-3 w-3" /> Pendente (atrasada)
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <Clock className="h-3 w-3" /> Pendente
    </Badge>
  );
}

function AtividadeCard({ item }: { item: AtividadeFilho }) {
  return (
    <Card className="border-l-4" style={{ borderLeftColor: item.entregue ? "hsl(142 76% 36%)" : isAtrasada(item.data_entrega, item.entregue) ? "hsl(0 72% 51%)" : "hsl(215 20% 65%)" }}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base">{item.titulo}</CardTitle>
            <CardDescription className="mt-1">
              {item.aluno_nome}
              {item.turma_nome ? ` • ${item.turma_nome}` : ""}
              {item.disciplina ? ` • ${item.disciplina}` : ""}
            </CardDescription>
          </div>
          <StatusBadge item={item} />
        </div>
      </CardHeader>
      <CardContent className="text-sm space-y-2">
        {item.descricao ? <p className="text-muted-foreground whitespace-pre-line">{item.descricao}</p> : null}
        <p><span className="font-medium">Entrega até:</span> {formatDate(item.data_entrega)}</p>
        {item.entregue && item.entregue_em ? (
          <p className="text-emerald-700 dark:text-emerald-400">
            Marcado como entregue em {formatDate(item.entregue_em)}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function PainelAtividadesFilhos() {
  const listFn = useServerFn(listAtividadesDoResponsavel);
  const { data, isLoading, error } = useQuery({
    queryKey: ["atividades-responsavel"],
    queryFn: () => listFn(),
    staleTime: 60_000,
  });

  const grupos = useMemo(() => {
    const all = data ?? [];
    const pendentes = all.filter((a) => !a.entregue);
    const entregues = all.filter((a) => a.entregue);
    const atrasadas = pendentes.filter((a) => isAtrasada(a.data_entrega, false));
    return { all, pendentes, entregues, atrasadas };
  }, [data]);

  return (
    <div className="container mx-auto max-w-5xl p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-[5px] bg-primary/10 p-2 text-primary"><ClipboardList className="h-5 w-5" /></div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Atividades e Trabalhos</h1>
          <p className="text-sm text-muted-foreground">Acompanhe as atividades dos seus filhos e o que está pendente.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-6">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      ) : error ? (
        <Card><CardContent className="p-6 text-sm text-destructive">Erro ao carregar: {(error as Error).message}</CardContent></Card>
      ) : grupos.all.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Nenhuma atividade cadastrada para seus filhos ainda.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SummaryCard label="Total" value={grupos.all.length} tone="neutral" />
            <SummaryCard label="Entregues" value={grupos.entregues.length} tone="success" />
            <SummaryCard label="Pendentes" value={grupos.pendentes.length} tone="warning" />
            <SummaryCard label="Atrasadas" value={grupos.atrasadas.length} tone="danger" />
          </div>

          <Tabs defaultValue="pendentes">
            <TabsList>
              <TabsTrigger value="pendentes">Pendentes ({grupos.pendentes.length})</TabsTrigger>
              <TabsTrigger value="entregues">Entregues ({grupos.entregues.length})</TabsTrigger>
              <TabsTrigger value="todas">Todas ({grupos.all.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="pendentes" className="space-y-3 mt-4">
              {grupos.pendentes.length === 0 ? <EmptyMsg>Nenhuma atividade pendente. 🎉</EmptyMsg> :
                grupos.pendentes.map((a) => <AtividadeCard key={`${a.atividade_id}-${a.aluno_id}`} item={a} />)}
            </TabsContent>
            <TabsContent value="entregues" className="space-y-3 mt-4">
              {grupos.entregues.length === 0 ? <EmptyMsg>Nenhuma entrega registrada ainda.</EmptyMsg> :
                grupos.entregues.map((a) => <AtividadeCard key={`${a.atividade_id}-${a.aluno_id}`} item={a} />)}
            </TabsContent>
            <TabsContent value="todas" className="space-y-3 mt-4">
              {grupos.all.map((a) => <AtividadeCard key={`${a.atividade_id}-${a.aluno_id}`} item={a} />)}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

function EmptyMsg({ children }: { children: React.ReactNode }) {
  return <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">{children}</CardContent></Card>;
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: "neutral" | "success" | "warning" | "danger" }) {
  const toneClass = {
    neutral: "bg-muted/30",
    success: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300",
    warning: "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300",
    danger: "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300",
  }[tone];
  return (
    <div className={`rounded-[5px] p-3 ${toneClass}`}>
      <div className="text-xs uppercase tracking-wide opacity-80">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
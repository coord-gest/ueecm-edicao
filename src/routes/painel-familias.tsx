import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CheckCircle2, XCircle, Trash2, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { PainelLayout } from "@/components/PainelLayout";
import {
  listarDepoimentosAdmin,
  moderarDepoimento,
  excluirDepoimento,
  type DepoimentoAdmin,
} from "@/lib/familias-depoimentos.functions";

export const Route = createFileRoute("/painel-familias")({
  ssr: false,
  head: () => ({ meta: [{ title: "Famílias UEECM — Moderação | Painel" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: PainelFamiliasPage,
});

const VINCULO_LABEL: Record<string, string> = {
  mae: "Mãe",
  pai: "Pai",
  responsavel: "Responsável",
  aluno: "Aluno(a)",
  professor: "Professor(a)",
  ex_aluno: "Ex-aluno(a)",
  comunidade: "Comunidade",
};

const TIPO_LABEL: Record<string, string> = {
  elogio: "Elogio",
  comentario: "Comentário",
  sugestao: "Sugestão",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pendente: "secondary",
  aprovado: "default",
  rejeitado: "destructive",
};

function DepCard({
  d,
  onAprovar,
  onRejeitar,
  onExcluir,
  canDelete,
  busy,
}: {
  d: DepoimentoAdmin;
  onAprovar: (id: string) => void;
  onRejeitar: (id: string) => void;
  onExcluir: (id: string) => void;
  canDelete: boolean;
  busy: boolean;
}) {
  return (
    <article className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge variant={STATUS_VARIANT[d.status]}>{d.status}</Badge>
        <Badge variant="outline">{TIPO_LABEL[d.tipo] ?? d.tipo}</Badge>
        <Badge variant="outline">
          {VINCULO_LABEL[d.vinculo] ?? d.vinculo}
          {d.turma_ano ? ` — ${d.turma_ano}` : ""}
        </Badge>
        <span className="ml-auto text-xs text-muted-foreground">
          {new Date(d.created_at).toLocaleString("pt-BR")}
        </span>
      </div>

      <blockquote className="mb-3 whitespace-pre-wrap text-sm text-foreground">
        “{d.mensagem}”
      </blockquote>

      <div className="mb-3 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">{d.autor_nome || "Anônimo"}</span>
        {d.autor_idade ? ` · ${d.autor_idade} anos` : ""}
        {d.email_contato ? ` · ${d.email_contato}` : ""}
      </div>

      <div className="flex flex-wrap gap-2">
        {d.status !== "aprovado" && (
          <Button
            size="sm"
            onClick={() => onAprovar(d.id)}
            disabled={busy}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <CheckCircle2 className="mr-1 size-4" /> Aprovar
          </Button>
        )}
        {d.status !== "rejeitado" && (
          <Button size="sm" variant="outline" onClick={() => onRejeitar(d.id)} disabled={busy}>
            <XCircle className="mr-1 size-4" /> Rejeitar
          </Button>
        )}
        {canDelete && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="destructive" disabled={busy}>
                <Trash2 className="mr-1 size-4" /> Excluir
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir depoimento?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação é permanente e não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => onExcluir(d.id)}>Excluir</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </article>
  );
}

function PainelFamiliasPage() {
  const { isStaff, loading, roles } = useAuth();
  const listar = useServerFn(listarDepoimentosAdmin);
  const moderar = useServerFn(moderarDepoimento);
  const excluir = useServerFn(excluirDepoimento);
  const qc = useQueryClient();
  const [tab, setTab] = useState<"pendente" | "aprovado" | "rejeitado" | "todos">("pendente");

  const canDelete = roles.some((r) => ["desenvolvedor", "diretor", "coordenador"].includes(r));

  const { data, isLoading } = useQuery({
    queryKey: ["familias-admin", tab],
    queryFn: () => listar({ data: tab === "todos" ? {} : { status: tab } }),
    enabled: isStaff,
  });

  const moderarMut = useMutation({
    mutationFn: (v: { id: string; status: "aprovado" | "rejeitado" }) => moderar({ data: v }),
    onSuccess: (_r, v) => {
      toast.success(v.status === "aprovado" ? "Aprovado" : "Rejeitado");
      qc.invalidateQueries({ queryKey: ["familias-admin"] });
      qc.invalidateQueries({ queryKey: ["familias-depoimentos-aprovados"] });
    },
    onError: (e: Error) => toast.error("Erro ao moderar", { description: e.message }),
  });

  const excluirMut = useMutation({
    mutationFn: (id: string) => excluir({ data: { id } }),
    onSuccess: () => {
      toast.success("Excluído");
      qc.invalidateQueries({ queryKey: ["familias-admin"] });
      qc.invalidateQueries({ queryKey: ["familias-depoimentos-aprovados"] });
    },
    onError: (e: Error) => toast.error("Erro ao excluir", { description: e.message }),
  });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isStaff) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-semibold">Acesso restrito</h1>
        <p className="mt-2 text-muted-foreground">
          Você não tem permissão para acessar esta página.
        </p>
      </div>
    );
  }

  const rows = data ?? [];
  const busy = moderarMut.isPending || excluirMut.isPending;

  return (
    <PainelLayout>
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex items-center gap-3">
          <Users className="size-6 text-primary" aria-hidden />
          <div>
            <h1 className="font-display text-2xl font-semibold">Famílias UEECM</h1>
            <p className="text-sm text-muted-foreground">
              Modere comentários, elogios e sugestões antes da publicação pública.
            </p>
          </div>
        </header>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="pendente">Pendentes</TabsTrigger>
            <TabsTrigger value="aprovado">Aprovados</TabsTrigger>
            <TabsTrigger value="rejeitado">Rejeitados</TabsTrigger>
            <TabsTrigger value="todos">Todos</TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-4">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : rows.length === 0 ? (
              <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
                Nada por aqui.
              </div>
            ) : (
              <div className="grid gap-3">
                {rows.map((d) => (
                  <DepCard
                    key={d.id}
                    d={d}
                    busy={busy}
                    canDelete={canDelete}
                    onAprovar={(id) => moderarMut.mutate({ id, status: "aprovado" })}
                    onRejeitar={(id) => moderarMut.mutate({ id, status: "rejeitado" })}
                    onExcluir={(id) => excluirMut.mutate(id)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </PainelLayout>
  );
}

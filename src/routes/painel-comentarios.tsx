import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Trash2,
  Loader2,
  MessageSquare,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import {
  listarDepoimentosAdmin,
  moderarDepoimento,
  excluirDepoimento,
  type DepoimentoAdmin,
} from "@/lib/familias-depoimentos.functions";

import { PainelLayout } from "@/components/PainelLayout";

export const Route = createFileRoute("/painel-comentarios")({
  ssr: false,
  head: () => ({ meta: [{ title: "Moderação de comentários | Painel" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: PainelComentarios,
});

interface Row {
  id: string;
  post_id: string;
  user_id: string;
  autor_nome: string;
  autor_avatar: string | null;
  conteudo: string;
  status: "pendente" | "aprovado" | "rejeitado";
  created_at: string;
  posts?: { titulo: string | null } | null;
}

function iniciais(nome: string) {
  return nome
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function PainelComentarios() {
  const { isStaff, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isStaff) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-semibold">Acesso restrito</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Apenas administradores podem moderar comentários.
        </p>
        <Button asChild className="mt-6 rounded-full">
          <Link to="/painel">Voltar ao painel</Link>
        </Button>
      </div>
    );
  }

  return (
    <PainelLayout>
      <div className="min-h-dvh bg-background">
        <header className="border-b border-border/60 bg-card/40">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
            <div className="flex items-center gap-3">
              <Button asChild variant="ghost" size="sm">
                <Link to="/painel">
                  <ArrowLeft className="size-4" /> Painel
                </Link>
              </Button>
              <div>
                <h1 className="font-display text-xl font-semibold">Moderação de comentários</h1>
                <p className="text-xs text-muted-foreground">
                  Aprove, rejeite ou exclua comentários enviados pelos leitores.
                </p>
              </div>
            </div>
            <MessageSquare className="size-5 text-muted-foreground" />
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 py-8 space-y-10">
          <section>
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <MessageSquare className="size-4" /> Comentários do blog
            </div>
            <Tabs defaultValue="pendente">
              <TabsList>
                <TabsTrigger value="pendente">Pendentes</TabsTrigger>
                <TabsTrigger value="aprovado">Aprovados</TabsTrigger>
                <TabsTrigger value="rejeitado">Rejeitados</TabsTrigger>
              </TabsList>
              <TabsContent value="pendente">
                <Lista status="pendente" />
              </TabsContent>
              <TabsContent value="aprovado">
                <Lista status="aprovado" />
              </TabsContent>
              <TabsContent value="rejeitado">
                <Lista status="rejeitado" />
              </TabsContent>
            </Tabs>
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Users className="size-4" /> Famílias UEECM (comentários, elogios e sugestões)
            </div>
            <Tabs defaultValue="pendente">
              <TabsList>
                <TabsTrigger value="pendente">Pendentes</TabsTrigger>
                <TabsTrigger value="aprovado">Aprovados</TabsTrigger>
                <TabsTrigger value="rejeitado">Rejeitados</TabsTrigger>
              </TabsList>
              <TabsContent value="pendente">
                <ListaFamilias status="pendente" />
              </TabsContent>
              <TabsContent value="aprovado">
                <ListaFamilias status="aprovado" />
              </TabsContent>
              <TabsContent value="rejeitado">
                <ListaFamilias status="rejeitado" />
              </TabsContent>
            </Tabs>
          </section>
        </main>
      </div>
    </PainelLayout>
  );
}

function Lista({ status }: { status: "pendente" | "aprovado" | "rejeitado" }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["mod-comentarios", status],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from("post_comentarios")
        .select(
          "id, post_id, user_id, autor_nome, autor_avatar, conteudo, status, created_at, posts(titulo)",
        )
        .eq("status", status)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, next }: { id: string; next: "aprovado" | "rejeitado" }) => {
      const { error } = await supabase
        .from("post_comentarios")
        .update({
          status: next,
          moderado_por: user?.id ?? null,
          moderado_em: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.next === "aprovado" ? "Comentário aprovado" : "Comentário rejeitado");
      qc.invalidateQueries({ queryKey: ["mod-comentarios"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const apagar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("post_comentarios").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Comentário apagado");
      qc.invalidateQueries({ queryKey: ["mod-comentarios"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Carregando…
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
        Nenhum comentário {status}.
      </div>
    );
  }

  return (
    <ul className="mt-6 space-y-4">
      {data.map((c) => (
        <li key={c.id} className="rounded-2xl border border-border/60 bg-card/40 p-4">
          <div className="flex items-start gap-3">
            <Avatar className="size-9">
              <AvatarImage src={c.autor_avatar ?? undefined} alt="" />
              <AvatarFallback>{iniciais(c.autor_nome)}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{c.autor_nome}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(c.created_at).toLocaleString("pt-BR")}
                </span>
                <Badge variant="outline" className="rounded-full text-xs">
                  {c.status}
                </Badge>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm">{c.conteudo}</p>
              <div className="mt-2 text-xs text-muted-foreground">
                Em:{" "}
                <Link
                  to="/posts/$id"
                  params={{ id: c.post_id }}
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  {c.posts?.titulo ?? "post"}
                </Link>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {status !== "aprovado" && (
                <Button
                  size="sm"
                  className="rounded-full"
                  onClick={() => setStatus.mutate({ id: c.id, next: "aprovado" })}
                  disabled={setStatus.isPending}
                >
                  <CheckCircle2 className="size-4" /> Aprovar
                </Button>
              )}
              {status !== "rejeitado" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => setStatus.mutate({ id: c.id, next: "rejeitado" })}
                  disabled={setStatus.isPending}
                >
                  <XCircle className="size-4" /> Rejeitar
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="rounded-full text-destructive hover:text-destructive"
                onClick={() => apagar.mutate(c.id)}
                disabled={apagar.isPending}
              >
                <Trash2 className="size-4" /> Apagar
              </Button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

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

function ListaFamilias({ status }: { status: "pendente" | "aprovado" | "rejeitado" }) {
  const qc = useQueryClient();
  const { roles } = useAuth();
  const listar = useServerFn(listarDepoimentosAdmin);
  const moderar = useServerFn(moderarDepoimento);
  const excluir = useServerFn(excluirDepoimento);
  const canDelete = roles.some((r) =>
    ["desenvolvedor", "developer", "diretor", "director", "coordenador", "coordinator"].includes(r),
  );

  const { data, isLoading } = useQuery({
    queryKey: ["mod-familias", status],
    queryFn: () => listar({ data: { status } }),
  });

  const setStatus = useMutation({
    mutationFn: (v: { id: string; next: "aprovado" | "rejeitado" }) =>
      moderar({ data: { id: v.id, status: v.next } }),
    onSuccess: (_d, v) => {
      toast.success(v.next === "aprovado" ? "Aprovado" : "Rejeitado");
      qc.invalidateQueries({ queryKey: ["mod-familias"] });
      qc.invalidateQueries({ queryKey: ["familias-depoimentos-aprovados"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const apagar = useMutation({
    mutationFn: (id: string) => excluir({ data: { id } }),
    onSuccess: () => {
      toast.success("Depoimento apagado");
      qc.invalidateQueries({ queryKey: ["mod-familias"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Carregando…
      </div>
    );
  }

  const rows = (data ?? []) as DepoimentoAdmin[];
  if (rows.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
        Nenhum depoimento {status}.
      </div>
    );
  }

  return (
    <ul className="mt-6 space-y-4">
      {rows.map((d) => (
        <li key={d.id} className="rounded-2xl border border-border/60 bg-card/40 p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="outline">{TIPO_LABEL[d.tipo] ?? d.tipo}</Badge>
            <Badge variant="outline">
              {VINCULO_LABEL[d.vinculo] ?? d.vinculo}
              {d.turma_ano ? ` — ${d.turma_ano}` : ""}
            </Badge>
            <span className="ml-auto text-muted-foreground">
              {new Date(d.created_at).toLocaleString("pt-BR")}
            </span>
          </div>
          <p className="whitespace-pre-wrap text-sm">{d.mensagem}</p>
          <div className="mt-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{d.autor_nome || "Anônimo"}</span>
            {d.autor_idade ? ` · ${d.autor_idade} anos` : ""}
            {d.email_contato ? ` · ${d.email_contato}` : ""}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {status !== "aprovado" && (
              <Button
                size="sm"
                className="rounded-full"
                onClick={() => setStatus.mutate({ id: d.id, next: "aprovado" })}
                disabled={setStatus.isPending}
              >
                <CheckCircle2 className="size-4" /> Aprovar
              </Button>
            )}
            {status !== "rejeitado" && (
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                onClick={() => setStatus.mutate({ id: d.id, next: "rejeitado" })}
                disabled={setStatus.isPending}
              >
                <XCircle className="size-4" /> Rejeitar
              </Button>
            )}
            {canDelete && (
              <Button
                size="sm"
                variant="ghost"
                className="rounded-full text-destructive hover:text-destructive"
                onClick={() => apagar.mutate(d.id)}
                disabled={apagar.isPending}
              >
                <Trash2 className="size-4" /> Apagar
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

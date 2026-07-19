import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Pencil, FileText, Trash2, CalendarRange } from "lucide-react";
import { toast } from "sonner";
import { format, startOfDay, startOfWeek, startOfMonth, startOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import { ListSkeleton } from "@/components/TableRowsSkeleton";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { cn } from "@/lib/utils";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";

import { PainelLayout } from "@/components/PainelLayout";

const statusLabels: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  rascunho: { label: "Rascunho", variant: "secondary" },
  em_revisao: { label: "Em revisão", variant: "outline" },
  publicado: { label: "Publicado", variant: "default" },
  rejeitado: { label: "Rejeitado", variant: "destructive" },
};

export const Route = createFileRoute("/painel-posts/")({
  ssr: false,
  head: () => ({ meta: [{ title: "Publicações | Painel" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: PainelPosts,
});

type PeriodKey = "hoje" | "semana" | "mes" | "ano" | "tudo";
type GroupKey = "dia" | "semana" | "mes" | "ano";

const PERIODS: { key: PeriodKey; label: string; suggestGroup: GroupKey }[] = [
  { key: "hoje", label: "Hoje", suggestGroup: "dia" },
  { key: "semana", label: "Semana", suggestGroup: "dia" },
  { key: "mes", label: "Mês", suggestGroup: "semana" },
  { key: "ano", label: "Ano", suggestGroup: "mes" },
  { key: "tudo", label: "Tudo", suggestGroup: "ano" },
];

function periodStart(p: PeriodKey): Date | null {
  const now = new Date();
  switch (p) {
    case "hoje":
      return startOfDay(now);
    case "semana":
      return startOfWeek(now, { weekStartsOn: 1 });
    case "mes":
      return startOfMonth(now);
    case "ano":
      return startOfYear(now);
    default:
      return null;
  }
}

function groupLabelFor(date: Date, group: GroupKey): string {
  switch (group) {
    case "dia":
      return format(date, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    case "semana": {
      const s = startOfWeek(date, { weekStartsOn: 1 });
      return `Semana de ${format(s, "dd 'de' MMM", { locale: ptBR })}`;
    }
    case "mes":
      return format(date, "MMMM 'de' yyyy", { locale: ptBR });
    case "ano":
      return format(date, "yyyy");
  }
}

function PainelPosts() {
  const { isStaff, hasRole, user } = useAuth();
  const canDelete =
    hasRole("desenvolvedor") || hasRole("admin") || hasRole("diretor") || hasRole("coordenador");
  const [filter, setFilter] = useState<string>("todos");
  const [period, setPeriod] = useState<PeriodKey>("tudo");
  const [group, setGroup] = useState<GroupKey>("ano");
  const [page, setPage] = useState(0);
  const pageSize = 30;
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["painel-posts", filter, period, page],
    queryFn: async () => {
      let q = supabase
        .from("posts")
        .select("id, titulo, resumo, autor, autor_id, data, status, updated_at", { count: "exact" })
        .order("updated_at", { ascending: false })
        .range(page * pageSize, page * pageSize + pageSize - 1);
      if (filter !== "todos")
        q = q.eq("status", filter as "rascunho" | "em_revisao" | "publicado" | "rejeitado");
      const from = periodStart(period);
      if (from) q = q.gte("updated_at", from.toISOString());
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: data ?? [], total: count ?? 0 };
    },
    enabled: isStaff,
  });

  const posts = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Agrupa por chave temporal
  const grouped = useMemo(() => {
    const map = new Map<string, { label: string; items: typeof posts }>();
    for (const p of posts) {
      const d = new Date(p.updated_at ?? p.data ?? Date.now());
      let key: string;
      if (group === "dia") key = format(d, "yyyy-MM-dd");
      else if (group === "semana") key = format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-'W'II");
      else if (group === "mes") key = format(d, "yyyy-MM");
      else key = format(d, "yyyy");
      const cur = map.get(key) ?? { label: groupLabelFor(d, group), items: [] };
      cur.items.push(p);
      map.set(key, cur);
    }
    return Array.from(map.values());
  }, [posts, group]);

  const deletePost = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("posts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Post excluído");
      qc.invalidateQueries({ queryKey: ["painel-posts"] });
    },
    onError: (e: unknown) =>
      toast.error("Erro ao excluir", { description: e instanceof Error ? e.message : undefined }),
  });

  if (!isStaff) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-secondary px-4 text-center">
        <div>
          <h1 className="font-display text-xl font-semibold">Acesso restrito</h1>
          <p className="mt-2 text-sm text-muted-foreground">Apenas membros da equipe.</p>
          <Button asChild className="mt-4 rounded-full">
            <Link to="/painel">Voltar</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <PainelLayout>
      <div className="min-h-dvh bg-secondary">
        <header className="border-b border-border/60 bg-background/85 backdrop-blur-lg">
          <div className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <FileText className="size-6 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="truncate font-display text-base font-semibold text-primary sm:text-lg">
                  Publicações
                </p>
                <p className="hidden text-xs text-muted-foreground sm:block">
                  Criar, editar e enviar para aprovação
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button asChild variant="outline" size="sm" className="rounded-full">
                <Link to="/painel" aria-label="Voltar ao painel">
                  <ArrowLeft className="size-4" /> <span className="hidden sm:inline">Painel</span>
                </Link>
              </Button>
              <Button asChild size="sm" className="rounded-full">
                <Link to="/painel-posts/novo">
                  <Plus className="size-4" /> <span className="hidden sm:inline">Novo post</span>
                  <span className="sm:hidden">Novo</span>
                </Link>
              </Button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
          <Breadcrumbs
            className="mb-3"
            items={[{ label: "Painel", to: "/painel" }, { label: "Publicações" }]}
          />
          <div className="mb-4 space-y-3">
            {/* Chips de período */}
            <div className="flex flex-wrap items-center gap-1.5">
              <CalendarRange className="size-4 text-muted-foreground" />
              <span className="mr-1 text-xs font-medium text-muted-foreground">Período:</span>
              {PERIODS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => {
                    setPeriod(p.key);
                    setGroup(p.suggestGroup);
                    setPage(0);
                  }}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    period === p.key
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border/60 bg-background text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Filtro por status + agrupamento */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-medium text-muted-foreground">Status:</span>
              <Select
                value={filter}
                onValueChange={(v) => {
                  setFilter(v);
                  setPage(0);
                }}
              >
                <SelectTrigger className="w-40 rounded-full sm:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="rascunho">Rascunhos</SelectItem>
                  <SelectItem value="em_revisao">Em revisão</SelectItem>
                  <SelectItem value="publicado">Publicados</SelectItem>
                  <SelectItem value="rejeitado">Rejeitados</SelectItem>
                </SelectContent>
              </Select>

              <span className="text-xs font-medium text-muted-foreground">Agrupar por:</span>
              <Select value={group} onValueChange={(v) => setGroup(v as GroupKey)}>
                <SelectTrigger className="w-32 rounded-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dia">Dia</SelectItem>
                  <SelectItem value="semana">Semana</SelectItem>
                  <SelectItem value="mes">Mês</SelectItem>
                  <SelectItem value="ano">Ano</SelectItem>
                </SelectContent>
              </Select>

              <span className="ml-auto text-xs text-muted-foreground">
                {total} {total === 1 ? "publicação" : "publicações"}
              </span>
            </div>
          </div>

          {isLoading ? (
            <ListSkeleton rows={4} />
          ) : posts.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Nenhuma publicação neste período"
              description="Ajuste o filtro de período ou crie uma nova publicação."
              action={
                <Button asChild size="sm" className="rounded-full">
                  <Link to="/painel-posts/novo">
                    <Plus className="size-4" /> Novo post
                  </Link>
                </Button>
              }
            />
          ) : (
            <div className="space-y-6">
              {grouped.map((g) => (
                <section key={g.label}>
                  <div className="mb-2 flex items-center gap-2">
                    <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      {g.label}
                    </h3>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {g.items.length}
                    </span>
                    <div className="h-px flex-1 bg-border/60" />
                  </div>
                  <ul className="space-y-3">
                    {g.items.map((p) => {
                      const s = statusLabels[p.status] ?? statusLabels.rascunho;
                      return (
                        <li
                          key={p.id}
                          className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <Badge variant={s.variant}>{s.label}</Badge>
                              <span className="text-xs text-muted-foreground">por {p.autor}</span>
                              <span className="text-xs text-muted-foreground">
                                · {format(new Date(p.updated_at), "dd/MM/yyyy 'às' HH:mm")}
                              </span>
                            </div>
                            <p className="mt-1 truncate font-medium text-foreground">{p.titulo}</p>
                            <p className="line-clamp-1 text-sm text-muted-foreground">{p.resumo}</p>
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <Button asChild variant="outline" size="sm" className="rounded-full">
                              <Link to="/painel-posts/$id" params={{ id: p.id }}>
                                <Pencil className="size-4" /> Editar
                              </Link>
                            </Button>
                            {(canDelete || p.autor_id === user?.id) && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                                  >
                                    <Trash2 className="size-4" /> Excluir
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Excluir este post?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      "{p.titulo}" será removido permanentemente. Esta ação não pode
                                      ser desfeita.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deletePost.mutate(p.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Excluir
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                Anterior
              </Button>
              <span className="text-xs text-muted-foreground">
                Página {page + 1} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                disabled={page + 1 >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </Button>
            </div>
          )}
        </main>
      </div>
    </PainelLayout>
  );
}

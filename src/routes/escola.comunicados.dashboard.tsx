import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Eye, Megaphone, Users, User, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { EscolaShell } from "@/components/escola/EscolaShell";

const PAGE_SIZE = 10;

export const Route = createFileRoute("/escola/comunicados/dashboard")({
  ssr: false,
  head: () => ({ meta: [{ title: "Leitura de comunicados | Escola" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: DashboardLeiturasPage,
});

type ComunicadoRow = {
  id: string;
  tipo: "turma" | "individual";
  titulo: string;
  turma_id: string | null;
  aluno_id: string | null;
  created_at: string;
};

function DashboardLeiturasPage() {
  const { user, hasRole, loading } = useAuth();
  const [page, setPage] = useState(0);
  const [expandido, setExpandido] = useState<string | null>(null);

  const isStaff =
    hasRole("professor") ||
    hasRole("admin") ||
    hasRole("diretor") ||
    hasRole("coordenador") ||
    hasRole("secretario") ||
    hasRole("desenvolvedor");

  const lista = useQuery({
    queryKey: ["escola", "comunicados-dashboard", user?.id, page],
    enabled: !!user && isStaff,
    queryFn: async () => {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error, count } = await supabase
        .from("comunicados")
        .select("id, tipo, titulo, turma_id, aluno_id, created_at", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) throw error;
      const rows = (data ?? []) as ComunicadoRow[];
      if (rows.length === 0)
        return {
          rows: [],
          total: count ?? 0,
          stats: {} as Record<string, { lidos: number; publico: number }>,
        };

      const ids = rows.map((r) => r.id);
      const turmaIds = Array.from(
        new Set(rows.map((r) => r.turma_id).filter((x): x is string => !!x)),
      );
      const alunoIdsIndiv = Array.from(
        new Set(rows.map((r) => r.aluno_id).filter((x): x is string => !!x)),
      );

      // Leituras de todos os comunicados da página
      const { data: leituras } = await supabase
        .from("comunicado_leituras")
        .select("comunicado_id, usuario_id")
        .in("comunicado_id", ids);
      const leiturasPorComunicado = new Map<string, Set<string>>();
      for (const l of leituras ?? []) {
        const s = leiturasPorComunicado.get(l.comunicado_id) ?? new Set<string>();
        s.add(l.usuario_id);
        leiturasPorComunicado.set(l.comunicado_id, s);
      }

      // Público: responsáveis distintos vinculados aos alunos da turma ou ao aluno individual
      const alunosPorTurma = new Map<string, string[]>();
      if (turmaIds.length) {
        const { data: alunosT } = await supabase
          .from("alunos")
          .select("id, turma_id")
          .in("turma_id", turmaIds);
        for (const a of alunosT ?? []) {
          const arr = alunosPorTurma.get(a.turma_id!) ?? [];
          arr.push(a.id);
          alunosPorTurma.set(a.turma_id!, arr);
        }
      }

      const allAlunoIds = Array.from(
        new Set([...alunoIdsIndiv, ...Array.from(alunosPorTurma.values()).flat()]),
      );
      const respByAluno = new Map<string, string[]>();
      const userByResp = new Map<string, string | null>();
      if (allAlunoIds.length) {
        const { data: links } = await supabase
          .from("aluno_responsavel")
          .select("aluno_id, responsavel_id")
          .in("aluno_id", allAlunoIds);
        const respIds = Array.from(new Set((links ?? []).map((l) => l.responsavel_id)));
        if (respIds.length) {
          const { data: resps } = await supabase
            .from("responsaveis")
            .select("id, user_id")
            .in("id", respIds);
          for (const r of resps ?? []) userByResp.set(r.id, r.user_id);
        }
        for (const l of links ?? []) {
          const arr = respByAluno.get(l.aluno_id) ?? [];
          arr.push(l.responsavel_id);
          respByAluno.set(l.aluno_id, arr);
        }
      }

      const stats: Record<string, { lidos: number; publico: number }> = {};
      for (const r of rows) {
        const alunoIds =
          r.tipo === "turma" && r.turma_id
            ? (alunosPorTurma.get(r.turma_id) ?? [])
            : r.aluno_id
              ? [r.aluno_id]
              : [];
        const users = new Set<string>();
        for (const aid of alunoIds) {
          for (const rid of respByAluno.get(aid) ?? []) {
            const uid = userByResp.get(rid);
            if (uid) users.add(uid);
          }
        }
        stats[r.id] = { lidos: leiturasPorComunicado.get(r.id)?.size ?? 0, publico: users.size };
      }
      return { rows, total: count ?? 0, stats };
    },
  });

  if (loading) return null;
  if (!isStaff) {
    return (
      <EscolaShell title="Acesso negado">
        <p className="text-sm text-muted-foreground">Esta área é exclusiva para equipe escolar.</p>
      </EscolaShell>
    );
  }

  const total = lista.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <EscolaShell
      title="Leitura de comunicados"
      description="Acompanhe quem leu cada comunicado"
      actions={
        <Button asChild variant="outline" size="sm" className="rounded-full">
          <Link to="/escola/comunicados">Voltar à lista</Link>
        </Button>
      }
    >
      {lista.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
      ) : !lista.data?.rows.length ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <Megaphone className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Nenhum comunicado enviado ainda.</p>
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {lista.data.rows.map((c) => {
              const s = lista.data!.stats[c.id] ?? { lidos: 0, publico: 0 };
              const pct = s.publico > 0 ? Math.round((s.lidos / s.publico) * 100) : 0;
              const exp = expandido === c.id;
              return (
                <li
                  key={c.id}
                  className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display text-base font-semibold text-foreground">
                        {c.titulo}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(c.created_at), "dd 'de' MMM 'de' yyyy 'às' HH:mm", {
                          locale: ptBR,
                        })}
                      </p>
                    </div>
                    <Badge variant="secondary" className="gap-1">
                      {c.tipo === "turma" ? (
                        <Users className="size-3" />
                      ) : (
                        <User className="size-3" />
                      )}
                      {c.tipo === "turma" ? "Turma" : "Individual"}
                    </Badge>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                    <div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {s.lidos} de {s.publico} leram
                        </span>
                        <span className="font-semibold text-foreground">{pct}%</span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full"
                      onClick={() => setExpandido(exp ? null : c.id)}
                    >
                      <Eye className="size-3.5" /> {exp ? "Ocultar" : "Ver leitores"}
                    </Button>
                  </div>

                  {exp && <LeitoresList comunicadoId={c.id} />}
                </li>
              );
            })}
          </ul>

          <div className="mt-6 flex items-center justify-between gap-2 text-sm">
            <p className="text-muted-foreground">
              Página {page + 1} de {totalPages} • {total} comunicado{total === 1 ? "" : "s"}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft className="size-4" /> Anterior
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page + 1 >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                Próxima <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </EscolaShell>
  );
}

function LeitoresList({ comunicadoId }: { comunicadoId: string }) {
  const q = useQuery({
    queryKey: ["escola", "comunicado-leitores", comunicadoId],
    queryFn: async () => {
      const { data: leituras } = await supabase
        .from("comunicado_leituras")
        .select("usuario_id, lido_em")
        .eq("comunicado_id", comunicadoId)
        .order("lido_em", { ascending: false });
      const userIds = Array.from(new Set((leituras ?? []).map((l) => l.usuario_id)));
      if (userIds.length === 0) return [];
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name, email")
        .in("user_id", userIds);
      const byId = new Map((profs ?? []).map((p) => [p.user_id, p]));
      return (leituras ?? []).map((l) => ({
        usuario_id: l.usuario_id,
        lido_em: l.lido_em,
        nome: byId.get(l.usuario_id)?.display_name || byId.get(l.usuario_id)?.email || "Usuário",
      }));
    },
  });

  if (q.isLoading) {
    return (
      <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" /> Carregando leitores…
      </div>
    );
  }
  if (!q.data?.length) {
    return <p className="mt-4 text-xs text-muted-foreground">Ninguém leu ainda.</p>;
  }
  return (
    <ul className="mt-4 space-y-1 rounded-xl bg-secondary/50 p-3 text-xs">
      {q.data.map((l) => (
        <li key={l.usuario_id} className="flex justify-between gap-2">
          <span className="truncate text-foreground">{l.nome}</span>
          <span className="text-muted-foreground">
            {format(new Date(l.lido_em), "dd/MM HH:mm", { locale: ptBR })}
          </span>
        </li>
      ))}
    </ul>
  );
}

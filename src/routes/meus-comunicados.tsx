import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Megaphone,
  Users,
  User,
  CheckCircle2,
  Circle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Paperclip,
  Download,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { EscolaShell } from "@/components/escola/EscolaShell";

import { PainelLayout } from "@/components/PainelLayout";

const PAGE_SIZE = 10;

export const Route = createFileRoute("/meus-comunicados")({
  ssr: false,
  head: () => ({ meta: [{ title: "Meus comunicados | Escola" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: MeusComunicadosPage,
});

type Anexo = { path: string; name: string; size?: number; type?: string };
type Comunicado = {
  id: string;
  tipo: "turma" | "individual";
  titulo: string;
  mensagem: string;
  anexos: Anexo[] | null;
  turma_id: string | null;
  aluno_id: string | null;
  created_at: string;
  requer_confirmacao: boolean;
};

function MeusComunicadosPage() {
  const { user, loading } = useAuth();
  const [filtro, setFiltro] = useState<"todos" | "nao_lidos">("todos");
  const [page, setPage] = useState(0);
  const qc = useQueryClient();

  // Buscar escopo do responsável (alunos + turmas)
  const escopo = useQuery({
    queryKey: ["meus-comunicados", "escopo", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: resps } = await supabase
        .from("responsaveis")
        .select("id")
        .eq("user_id", user!.id);
      const respIds = (resps ?? []).map((r) => r.id);
      if (respIds.length === 0) return { alunoIds: [] as string[], turmaIds: [] as string[] };
      const { data: links } = await supabase
        .from("aluno_responsavel")
        .select("aluno_id")
        .in("responsavel_id", respIds);
      const alunoIds = Array.from(new Set((links ?? []).map((l) => l.aluno_id)));
      if (alunoIds.length === 0) return { alunoIds, turmaIds: [] as string[] };
      const { data: alunos } = await supabase.from("alunos").select("turma_id").in("id", alunoIds);
      const turmaIds = Array.from(
        new Set((alunos ?? []).map((a) => a.turma_id).filter((x): x is string => !!x)),
      );
      return { alunoIds, turmaIds };
    },
  });

  const filtroExpr = useMemo(() => {
    if (!escopo.data) return null;
    const { alunoIds, turmaIds } = escopo.data;
    const parts: string[] = [];
    if (alunoIds.length) parts.push(`aluno_id.in.(${alunoIds.join(",")})`);
    if (turmaIds.length) parts.push(`turma_id.in.(${turmaIds.join(",")})`);
    return parts.length ? parts.join(",") : null;
  }, [escopo.data]);

  const lidosQuery = useQuery({
    queryKey: ["meus-comunicados", "lidos", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("comunicado_leituras")
        .select("comunicado_id, confirmado_em")
        .eq("usuario_id", user!.id);
      const lidos = new Set((data ?? []).map((d) => d.comunicado_id));
      const confirmados = new Set(
        (data ?? []).filter((d) => d.confirmado_em).map((d) => d.comunicado_id),
      );
      return { lidos, confirmados };
    },
  });

  const lista = useQuery({
    queryKey: [
      "meus-comunicados",
      "lista",
      user?.id,
      page,
      filtro,
      filtroExpr,
      lidosQuery.data?.lidos.size ?? 0,
    ],
    enabled: !!user && !!filtroExpr && !!lidosQuery.data,
    queryFn: async () => {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let q = supabase
        .from("comunicados")
        .select(
          "id, tipo, titulo, mensagem, anexos, turma_id, aluno_id, created_at, requer_confirmacao",
          { count: "exact" },
        )
        .or(filtroExpr!)
        .order("created_at", { ascending: false });
      if (filtro === "nao_lidos" && lidosQuery.data && lidosQuery.data.lidos.size > 0) {
        q = q.not("id", "in", `(${Array.from(lidosQuery.data.lidos).join(",")})`);
      }
      const { data, error, count } = await q.range(from, to);
      if (error) throw error;
      return { rows: (data ?? []) as Comunicado[], total: count ?? 0 };
    },
  });

  const marcarLido = useMutation({
    mutationFn: async (comunicadoId: string) => {
      const { error } = await supabase
        .from("comunicado_leituras")
        .upsert(
          { comunicado_id: comunicadoId, usuario_id: user!.id },
          { onConflict: "comunicado_id,usuario_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meus-comunicados"] });
      qc.invalidateQueries({ queryKey: ["meus-filhos"] });
    },
    onError: (e: Error) => toast.error("Falha ao marcar como lido", { description: e.message }),
  });

  const confirmarCompreensao = useMutation({
    mutationFn: async (comunicadoId: string) => {
      const { error } = await supabase
        .from("comunicado_leituras")
        .upsert(
          {
            comunicado_id: comunicadoId,
            usuario_id: user!.id,
            confirmado_em: new Date().toISOString(),
          },
          { onConflict: "comunicado_id,usuario_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Confirmação registrada. Obrigado!");
      qc.invalidateQueries({ queryKey: ["meus-comunicados"] });
    },
    onError: (e: Error) => toast.error("Falha ao confirmar", { description: e.message }),
  });

  if (loading) return null;

  const total = lista.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const lidos = lidosQuery.data?.lidos ?? new Set<string>();
  const confirmados = lidosQuery.data?.confirmados ?? new Set<string>();
  const naoLidosCount = (lista.data?.rows ?? []).filter((r) => !lidos.has(r.id)).length;

  return (
    <PainelLayout>
      <EscolaShell
        title="Meus comunicados"
        description="Mensagens da escola para você e seus filhos"
        actions={
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={filtro === "todos" ? "default" : "outline"}
              onClick={() => {
                setFiltro("todos");
                setPage(0);
              }}
              className="rounded-full"
            >
              Todos
            </Button>
            <Button
              size="sm"
              variant={filtro === "nao_lidos" ? "default" : "outline"}
              onClick={() => {
                setFiltro("nao_lidos");
                setPage(0);
              }}
              className="rounded-full"
            >
              Não lidos{" "}
              {naoLidosCount > 0 && (
                <span className="ml-1 rounded-full bg-primary/20 px-1.5 text-xs">
                  {naoLidosCount}
                </span>
              )}
            </Button>
          </div>
        }
      >
        {escopo.isLoading || lista.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
          </div>
        ) : !filtroExpr ? (
          <EmptyState text="Nenhum aluno vinculado à sua conta. Procure a secretaria da escola." />
        ) : !lista.data?.rows.length ? (
          <EmptyState
            text={
              filtro === "nao_lidos" ? "Tudo lido por aqui! 🎉" : "Nenhum comunicado encontrado."
            }
          />
        ) : (
          <>
            <ul className="space-y-3">
              {lista.data.rows.map((c) => (
                <ComunicadoItem
                  key={c.id}
                  c={c}
                  lido={lidos.has(c.id)}
                  confirmado={confirmados.has(c.id)}
                  onMarcarLido={() => marcarLido.mutate(c.id)}
                  onConfirmar={() => confirmarCompreensao.mutate(c.id)}
                  marcando={marcarLido.isPending && marcarLido.variables === c.id}
                  confirmando={
                    confirmarCompreensao.isPending && confirmarCompreensao.variables === c.id
                  }
                />
              ))}
            </ul>

            <Pager page={page} totalPages={totalPages} total={total} onChange={setPage} />
          </>
        )}
      </EscolaShell>
    </PainelLayout>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
      <Megaphone className="mx-auto size-8 text-muted-foreground" />
      <p className="mt-3 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function ComunicadoItem({
  c,
  lido,
  onMarcarLido,
  marcando,
}: {
  c: Comunicado;
  lido: boolean;
  onMarcarLido: () => void;
  marcando: boolean;
}) {
  return (
    <li
      className={`rounded-2xl border p-5 shadow-sm transition ${lido ? "border-border/70 bg-card" : "border-primary/40 bg-primary/5"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-3">
          {lido ? (
            <CheckCircle2 className="mt-1 size-4 text-muted-foreground" />
          ) : (
            <Circle className="mt-1 size-4 fill-primary text-primary" />
          )}
          <div>
            <p className="font-display text-base font-semibold text-foreground">{c.titulo}</p>
            <p className="text-xs text-muted-foreground">
              {format(new Date(c.created_at), "dd 'de' MMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!lido && <Badge className="bg-primary text-primary-foreground">Novo</Badge>}
          <Badge variant="secondary" className="gap-1">
            {c.tipo === "turma" ? <Users className="size-3" /> : <User className="size-3" />}
            {c.tipo === "turma" ? "Turma" : "Individual"}
          </Badge>
        </div>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm text-foreground/90">{c.mensagem}</p>

      {Array.isArray(c.anexos) && c.anexos.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {c.anexos.map((a) => (
            <AnexoLink key={a.path} anexo={a} />
          ))}
        </div>
      )}

      {!lido && (
        <div className="mt-4">
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            onClick={onMarcarLido}
            disabled={marcando}
          >
            {marcando ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <CheckCircle2 className="size-3" />
            )}
            Marcar como lido
          </Button>
        </div>
      )}
    </li>
  );
}

function AnexoLink({ anexo }: { anexo: Anexo }) {
  const [loading, setLoading] = useState(false);
  const open = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.storage
        .from("comunicados-anexos")
        .createSignedUrl(anexo.path, 600);
      if (error || !data) throw error ?? new Error("URL inválida");
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error("Não foi possível abrir o anexo", { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };
  return (
    <button
      type="button"
      onClick={open}
      className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs font-medium hover:bg-accent"
    >
      {loading ? <Loader2 className="size-3 animate-spin" /> : <Paperclip className="size-3" />}
      {anexo.name}
      <Download className="size-3 opacity-60" />
    </button>
  );
}

function Pager({
  page,
  totalPages,
  total,
  onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onChange: (p: number) => void;
}) {
  if (total === 0) return null;
  return (
    <div className="mt-6 flex items-center justify-between gap-2 text-sm">
      <p className="text-muted-foreground">
        Página {page + 1} de {totalPages} • {total} comunicado{total === 1 ? "" : "s"}
      </p>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={page === 0}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft className="size-4" /> Anterior
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={page + 1 >= totalPages}
          onClick={() => onChange(page + 1)}
        >
          Próxima <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

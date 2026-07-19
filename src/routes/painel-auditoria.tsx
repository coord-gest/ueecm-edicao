import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2, ShieldAlert, History, Trash2, Download, FileText } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { useRealtimeInvalidate } from "@/lib/use-realtime-invalidate";
import { clearAuditLogs } from "@/lib/audit-admin.functions";
import { exportAuditPdf } from "@/lib/audit-export.functions";

import { PainelLayout } from "@/components/PainelLayout";

export const Route = createFileRoute("/painel-auditoria")({
  ssr: false,
  head: () => ({ meta: [{ title: "Log de Auditoria | Painel" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: PainelAuditoria,
});

type AuditRow = {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  table_name: string;
  record_id: string | null;
  action: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  created_at: string;
};

const TABLES = [
  "todas",
  "turmas",
  "disciplinas",
  "horarios",
  "alunos",
  "notas",
  "frequencia",
  "comunicados",
  "aluno_responsavel",
  "turmas_escolares",
  "user_roles",
] as const;
const ACTIONS = ["todas", "insert", "update", "delete"] as const;

const actionLabel: Record<
  string,
  { label: string; tone: "default" | "secondary" | "destructive" }
> = {
  insert: { label: "Criou", tone: "default" },
  update: { label: "Editou", tone: "secondary" },
  delete: { label: "Excluiu", tone: "destructive" },
};

function PainelAuditoria() {
  const { isDeveloper, loading } = useAuth();
  const qc = useQueryClient();
  const [tableFilter, setTableFilter] = useState<(typeof TABLES)[number]>("todas");
  const [actionFilter, setActionFilter] = useState<(typeof ACTIONS)[number]>("todas");
  const [actorFilter, setActorFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useRealtimeInvalidate("audit-logs", [{ table: "audit_logs", queryKey: ["audit-logs"] }]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["audit-logs", tableFilter, actionFilter, actorFilter, fromDate, toDate],
    queryFn: async () => {
      let q = supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);
      if (tableFilter !== "todas") q = q.eq("table_name", tableFilter);
      if (actionFilter !== "todas") q = q.eq("action", actionFilter);
      if (actorFilter.trim()) q = q.ilike("actor_email", `%${actorFilter.trim()}%`);
      if (fromDate) q = q.gte("created_at", new Date(fromDate).toISOString());
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        q = q.lte("created_at", end.toISOString());
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as AuditRow[];
    },
    enabled: !loading && isDeveloper,
  });

  const clearFn = useServerFn(clearAuditLogs);
  const clearMutation = useMutation({
    mutationFn: () => clearFn({ data: { confirm: true } }),
    onSuccess: (r) => {
      toast.success("Log de auditoria limpo", { description: `${r.deleted} registros removidos` });
      qc.invalidateQueries({ queryKey: ["audit-logs"] });
    },
    onError: (e: unknown) =>
      toast.error("Erro ao limpar", {
        description: e instanceof Error ? e.message : undefined,
      }),
  });

  const pdfFn = useServerFn(exportAuditPdf);
  const pdfMutation = useMutation({
    mutationFn: () =>
      pdfFn({
        data: {
          tableName: tableFilter,
          action: actionFilter,
          actor: actorFilter || undefined,
          from: fromDate ? new Date(fromDate).toISOString() : undefined,
          to: toDate ? new Date(`${toDate}T23:59:59.999`).toISOString() : undefined,
        },
      }),
    onSuccess: (res) => {
      const blob = new Blob([Uint8Array.from(atob(res.base64), (c) => c.charCodeAt(0))], {
        type: "application/pdf",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(url);
    },
    onError: (e: unknown) =>
      toast.error("Falha ao gerar PDF", {
        description: e instanceof Error ? e.message : undefined,
      }),
  });

  function exportCsv() {
    if (rows.length === 0) {
      toast.info("Nenhum registro para exportar.");
      return;
    }
    const headers = ["quando", "ator", "tabela", "acao", "registro_id"];
    const lines = rows.map((r) =>
      [
        new Date(r.created_at).toISOString(),
        r.actor_email ?? r.actor_id ?? "",
        r.table_name,
        r.action,
        r.record_id ?? "",
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const csv = "\uFEFF" + [headers.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `auditoria-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isDeveloper) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <ShieldAlert className="mx-auto size-10 text-destructive" />
        <h1 className="mt-3 text-xl font-semibold">Acesso restrito</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Apenas o Desenvolvedor pode visualizar o log de auditoria.
        </p>
        <Button asChild className="mt-6 rounded-full">
          <Link to="/painel">Voltar ao painel</Link>
        </Button>
      </div>
    );
  }

  return (
    <PainelLayout>
      <div className="min-h-dvh bg-secondary">
        <header className="border-b border-border/60 bg-background/85 backdrop-blur-lg">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4 sm:px-6">
            <Button asChild variant="ghost" size="sm" className="rounded-full">
              <Link to="/painel">
                <ArrowLeft className="size-4" /> Painel
              </Link>
            </Button>
            <div>
              <h1 className="flex items-center gap-2 font-display text-lg font-semibold">
                <History className="size-5 text-primary" /> Log de Auditoria
              </h1>
              <p className="text-xs text-muted-foreground">
                Histórico de alterações em Turmas, Disciplinas e Horários
              </p>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6 items-end">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Tabela</label>
              <Select
                value={tableFilter}
                onValueChange={(v) => setTableFilter(v as typeof tableFilter)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TABLES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t === "todas" ? "Todas" : t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Ação</label>
              <Select
                value={actionFilter}
                onValueChange={(v) => setActionFilter(v as typeof actionFilter)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTIONS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a === "todas" ? "Todas" : (actionLabel[a]?.label ?? a)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="actor" className="mb-1 block text-xs text-muted-foreground">
                Usuário (e-mail)
              </Label>
              <Input
                id="actor"
                placeholder="ex: maria@..."
                value={actorFilter}
                onChange={(e) => setActorFilter(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="from" className="mb-1 block text-xs text-muted-foreground">
                De
              </Label>
              <Input
                id="from"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="to" className="mb-1 block text-xs text-muted-foreground">
                Até
              </Label>
              <Input
                id="to"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <Button variant="outline" size="sm" className="rounded-full" onClick={exportCsv}>
                <Download className="size-4" /> CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => pdfMutation.mutate()}
                disabled={pdfMutation.isPending}
              >
                {pdfMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <FileText className="size-4" />
                )}
                PDF
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    disabled={clearMutation.isPending || rows.length === 0}
                  >
                    {clearMutation.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                    Limpar log
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Limpar log de auditoria?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação remove permanentemente <strong>todos</strong> os registros de
                      auditoria. Não é possível desfazer.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => clearMutation.mutate()}>
                      Limpar tudo
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : rows.length === 0 ? (
              <p className="p-10 text-center text-sm text-muted-foreground">
                Nenhum registro encontrado.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Quando</th>
                      <th className="px-3 py-2">Ator</th>
                      <th className="px-3 py-2">Tabela</th>
                      <th className="px-3 py-2">Ação</th>
                      <th className="px-3 py-2">Resumo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const info = actionLabel[r.action] ?? {
                        label: r.action,
                        tone: "secondary" as const,
                      };
                      return (
                        <tr key={r.id} className="border-t border-border/60 align-top">
                          <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                            {new Date(r.created_at).toLocaleString("pt-BR")}
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {r.actor_email ?? r.actor_id?.slice(0, 8) ?? "—"}
                          </td>
                          <td className="px-3 py-2">
                            <Badge variant="outline">{r.table_name}</Badge>
                          </td>
                          <td className="px-3 py-2">
                            <Badge variant={info.tone}>{info.label}</Badge>
                          </td>
                          <td className="px-3 py-2 text-xs">
                            <Summary before={r.before} after={r.after} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>
    </PainelLayout>
  );
}

function Summary({
  before,
  after,
}: {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}) {
  if (!before && after) {
    return <span>{describe(after)}</span>;
  }
  if (before && !after) {
    return <span className="text-muted-foreground line-through">{describe(before)}</span>;
  }
  if (before && after) {
    const diffs: string[] = [];
    for (const key of Object.keys(after)) {
      if (["id", "created_at", "updated_at"].includes(key)) continue;
      if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
        diffs.push(`${key}: "${String(before[key] ?? "")}" → "${String(after[key] ?? "")}"`);
      }
    }
    return <span>{diffs.length ? diffs.join("; ") : "—"}</span>;
  }
  return <span>—</span>;
}

function describe(row: Record<string, unknown>): string {
  const nome = row.nome ?? row.titulo ?? row.professor;
  if (nome) return String(nome);
  return Object.entries(row)
    .filter(([k]) => !["id", "created_at", "updated_at"].includes(k))
    .slice(0, 3)
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join(", ");
}

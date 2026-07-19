import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Bug, RefreshCw, ShieldAlert, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { PainelLayout } from "@/components/PainelLayout";
import { cleanupSystemErrors } from "@/lib/system-errors.functions";
import { captureException } from "@/lib/sentry";

type Severity = "info" | "warning" | "error" | "critical";

type ErrorRow = {
  id: string;
  source: string;
  severity: Severity;
  message: string;
  stack: string | null;
  context: Record<string, unknown> | null;
  actor_id: string | null;
  request_path: string | null;
  created_at: string;
};

const severityTone: Record<Severity, "default" | "secondary" | "destructive" | "outline"> = {
  info: "outline",
  warning: "secondary",
  error: "default",
  critical: "destructive",
};

export const Route = createFileRoute("/painel-erros")({
  ssr: false,
  head: () => ({ meta: [{ title: "Erros do sistema | Painel" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: PainelErros,
});

function PainelErros() {
  const [severity, setSeverity] = useState<Severity | "todas">("todas");
  const [cleanupScope, setCleanupScope] = useState<"older_than_days" | "severity" | "all">(
    "older_than_days",
  );
  const [cleanupDays, setCleanupDays] = useState<number>(30);
  const [cleanupSeverity, setCleanupSeverity] = useState<Severity>("info");
  const [cleaning, setCleaning] = useState(false);
  const cleanup = useServerFn(cleanupSystemErrors);
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["system-errors", severity],
    queryFn: async () => {
      let query = supabase
        .from("system_errors")
        .select("id, source, severity, message, stack, context, actor_id, request_path, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (severity !== "todas") query = query.eq("severity", severity);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as ErrorRow[];
    },
    refetchInterval: 30_000,
  });

  async function runCleanup() {
    setCleaning(true);
    try {
      const payload =
        cleanupScope === "older_than_days"
          ? { scope: "older_than_days" as const, days: cleanupDays }
          : cleanupScope === "severity"
            ? { scope: "severity" as const, severity: cleanupSeverity }
            : { scope: "all" as const };
      const res = await cleanup({ data: payload });
      toast.success(`${res.deleted} registro(s) removido(s).`);
      await qc.invalidateQueries({ queryKey: ["system-errors"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao limpar erros.");
    } finally {
      setCleaning(false);
    }
  }

  return (
    <PainelLayout>
      <div className="space-y-6 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
              <ShieldAlert className="h-6 w-6 text-destructive" />
              Erros do sistema
            </h1>
            <p className="text-sm text-muted-foreground">
              Registros automáticos de falhas em rotas de API e possíveis violações de RLS. Retidos
              por 30 dias.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={severity} onValueChange={(v) => setSeverity(v as typeof severity)}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Severidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="critical">Crítico</SelectItem>
                <SelectItem value="error">Erro</SelectItem>
                <SelectItem value="warning">Aviso</SelectItem>
                <SelectItem value="info">Info</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => q.refetch()} aria-label="Atualizar lista de erros">
              <RefreshCw className={q.isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => {
                const err = new Error(
                  `Sentry test error @ ${new Date().toISOString()}`,
                );
                captureException(err, { source: "painel-erros:test-button" });
                toast.success("Erro de teste enviado ao Sentry.");
                // Também dispara um erro assíncrono não tratado, capturado pelo listener global
                setTimeout(() => {
                  throw new Error("Sentry test — unhandled async error");
                }, 0);
              }}
            >
              <Bug className="h-4 w-4" /> Disparar erro de teste
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="gap-1">
                  <Trash2 className="h-4 w-4" /> Limpar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Limpar registros de erros</AlertDialogTitle>
                  <AlertDialogDescription>
                    Escolha o critério de limpeza. A ação é irreversível.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-3">
                  <Select
                    value={cleanupScope}
                    onValueChange={(v) => setCleanupScope(v as typeof cleanupScope)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="older_than_days">Mais antigos que N dias</SelectItem>
                      <SelectItem value="severity">Por severidade</SelectItem>
                      <SelectItem value="all">Todos os registros</SelectItem>
                    </SelectContent>
                  </Select>
                  {cleanupScope === "older_than_days" && (
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-muted-foreground">Dias:</label>
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={cleanupDays}
                        onChange={(e) => setCleanupDays(Number(e.target.value))}
                        className="w-24 rounded border bg-background px-2 py-1 text-sm"
                      />
                    </div>
                  )}
                  {cleanupScope === "severity" && (
                    <Select
                      value={cleanupSeverity}
                      onValueChange={(v) => setCleanupSeverity(v as Severity)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="info">Info</SelectItem>
                        <SelectItem value="warning">Aviso</SelectItem>
                        <SelectItem value="error">Erro</SelectItem>
                        <SelectItem value="critical">Crítico</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction disabled={cleaning} onClick={runCleanup}>
                    {cleaning ? "Limpando..." : "Confirmar limpeza"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {q.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : q.error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            Não foi possível carregar os erros. Este painel é restrito à equipe escolar.
          </div>
        ) : (q.data ?? []).length === 0 ? (
          <div className="rounded-md border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
            <AlertTriangle className="mx-auto mb-2 h-6 w-6" />
            Nenhum erro registrado no período.
          </div>
        ) : (
          <ul className="space-y-3">
            {q.data!.map((row) => (
              <li key={row.id} className="rounded-md border bg-card p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={severityTone[row.severity]}>{row.severity}</Badge>
                  <span className="font-mono text-xs text-muted-foreground">{row.source}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {new Date(row.created_at).toLocaleString("pt-BR")}
                  </span>
                </div>
                <p className="mt-2 text-sm font-medium">{row.message}</p>
                {row.request_path && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Rota: <code>{row.request_path}</code>
                  </p>
                )}
                {row.stack && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-muted-foreground">
                      Stack trace
                    </summary>
                    <pre className="mt-2 overflow-x-auto rounded bg-muted p-3 text-xs">
                      {row.stack}
                    </pre>
                  </details>
                )}
                {row.context && Object.keys(row.context).length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-muted-foreground">
                      Contexto
                    </summary>
                    <pre className="mt-2 overflow-x-auto rounded bg-muted p-3 text-xs">
                      {JSON.stringify(row.context, null, 2)}
                    </pre>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </PainelLayout>
  );
}

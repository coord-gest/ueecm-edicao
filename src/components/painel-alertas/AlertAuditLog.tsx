import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ClipboardList, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { listAlertAuditLogs } from "@/lib/alert-management.functions";

const actionLabels: Record<string, string> = {
  created: "Criado",
  updated: "Editado",
  deleted: "Excluído",
  activated: "Ativado",
  deactivated: "Desativado",
  resend_push: "Reenvio de push",
  burst_scheduled: "Rajada agendada",
  burst_cancelled: "Rajada cancelada",
  burst_tick: "Envio da rajada",
  rate_limited: "Bloqueado (rate-limit)",
};

const resultTone: Record<string, string> = {
  success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  failed: "bg-red-500/15 text-red-700 dark:text-red-300",
  rate_limited: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
};

export function AlertAuditLog() {
  const [action, setAction] = useState<string>("all");
  const list = useServerFn(listAlertAuditLogs);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["alert-audit", action],
    queryFn: () => list({ data: { action: action === "all" ? undefined : action, limit: 200 } }),
  });

  return (
    <section className="rounded-3xl border border-border/70 bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <ClipboardList className="size-5 text-primary" />
        <h2 className="font-display text-lg font-semibold">Histórico de auditoria</h2>
        <div className="ml-auto flex items-center gap-2">
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger className="h-9 w-48 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as ações</SelectItem>
              {Object.entries(actionLabels).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            onClick={() => refetch()}
            disabled={isFetching}
            className="rounded-full"
          >
            <RefreshCw className={"size-3.5" + (isFetching ? " animate-spin" : "")} />
          </Button>
        </div>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Registro imutável de tudo que administradores fizeram em alertas — criações, edições,
        reenvios, rajadas e bloqueios por rate-limit.
      </p>

      <div className="mt-4 max-h-[480px] space-y-2 overflow-y-auto pr-1">
        {isLoading && (
          <>
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
          </>
        )}
        {!isLoading && (data ?? []).length === 0 && (
          <p className="rounded-xl border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
            Sem registros para o filtro selecionado.
          </p>
        )}
        {(data ?? []).map((r) => {
          const details =
            r.details && typeof r.details === "object" && !Array.isArray(r.details)
              ? (r.details as Record<string, unknown>)
              : {};
          const short = Object.entries(details)
            .slice(0, 3)
            .map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`)
            .join(" · ");
          return (
            <div
              key={r.id}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-background/40 p-3 text-xs"
            >
              <Badge variant="outline">{actionLabels[r.action] ?? r.action}</Badge>
              <Badge className={resultTone[r.result] ?? ""} variant="outline">
                {r.result}
              </Badge>
              <span className="text-muted-foreground">
                {new Date(r.created_at).toLocaleString("pt-BR")}
              </span>
              <span className="text-muted-foreground">
                por <span className="font-medium text-foreground">{r.actor_email ?? "—"}</span>
              </span>
              {short && (
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{short}</span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

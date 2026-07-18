import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, Shield, ShieldCheck, ShieldAlert, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useRolePainelGuard } from "@/lib/use-role-guard";
import { useAdminAccessAudit } from "@/lib/use-admin-access-audit";
import { PainelLayout } from "@/components/PainelLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/painel-acessos")({
  ssr: false,
  head: () => ({ meta: [{ title: "Acessos administrativos | Painel" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: PainelAcessosPage,
});

type AccessLog = {
  id: string;
  user_id: string;
  user_email: string | null;
  route: string;
  area: string | null;
  outcome: "granted" | "denied";
  roles: string[];
  required_roles: string[];
  user_agent: string | null;
  created_at: string;
};

function PainelAcessosPage() {
  useRolePainelGuard(["desenvolvedor"]);
  useAdminAccessAudit("/painel-acessos");

  const [filtroOutcome, setFiltroOutcome] = useState<"todos" | "granted" | "denied">("todos");
  const [busca, setBusca] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-access-logs"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("admin_access_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as AccessLog[];
    },
    refetchInterval: 30_000,
  });

  const filtrado = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (data ?? []).filter((r) => {
      if (filtroOutcome !== "todos" && r.outcome !== filtroOutcome) return false;
      if (!q) return true;
      return (
        (r.user_email ?? "").toLowerCase().includes(q) ||
        r.route.toLowerCase().includes(q) ||
        (r.area ?? "").toLowerCase().includes(q)
      );
    });
  }, [data, filtroOutcome, busca]);

  const totais = useMemo(() => {
    const all = data ?? [];
    return {
      total: all.length,
      granted: all.filter((r) => r.outcome === "granted").length,
      denied: all.filter((r) => r.outcome === "denied").length,
    };
  }, [data]);

  return (
    <PainelLayout>
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-foreground flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              Acessos administrativos
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Registro de acessos e tentativas negadas nas áreas administrativas do sistema.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/painel-desenvolvedor">
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
            </Link>
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-border/70 bg-card p-4">
            <p className="text-xs text-muted-foreground">Total (últimos 500)</p>
            <p className="mt-1 font-display text-2xl font-semibold">{totais.total}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/40 dark:bg-emerald-950/20 p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Concedidos
            </p>
            <p className="mt-1 font-display text-2xl font-semibold text-emerald-700 dark:text-emerald-400">
              {totais.granted}
            </p>
          </div>
          <div className="rounded-2xl border border-red-200/60 bg-red-50/40 dark:bg-red-950/20 p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <ShieldAlert className="h-3.5 w-3.5 text-red-600" /> Negados
            </p>
            <p className="mt-1 font-display text-2xl font-semibold text-red-700 dark:text-red-400">
              {totais.denied}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            placeholder="Filtrar por e-mail, rota ou área..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="sm:max-w-sm"
          />
          <Select
            value={filtroOutcome}
            onValueChange={(v) => setFiltroOutcome(v as typeof filtroOutcome)}
          >
            <SelectTrigger className="sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="granted">Concedidos</SelectItem>
              <SelectItem value="denied">Negados</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card overflow-hidden">
          {isLoading ? (
            <div className="p-6 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          ) : filtrado.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 opacity-0" />
              Nenhum registro encontrado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[760px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Quando</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Área</TableHead>
                    <TableHead>Rota</TableHead>
                    <TableHead>Papéis</TableHead>
                    <TableHead>Resultado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrado.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {new Date(r.created_at).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.user_email ?? r.user_id.slice(0, 8)}
                      </TableCell>
                      <TableCell className="text-xs">{r.area ?? "—"}</TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {r.route}
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="flex flex-wrap gap-1">
                          {(r.roles ?? []).map((role) => (
                            <Badge key={role} variant="secondary" className="text-[10px]">
                              {role}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {r.outcome === "granted" ? (
                          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 whitespace-nowrap">
                            <ShieldCheck className="h-3 w-3 mr-1" /> Concedido
                          </Badge>
                        ) : (
                          <Badge className="bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30 whitespace-nowrap">
                            <ShieldAlert className="h-3 w-3 mr-1" /> Negado
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </PainelLayout>
  );
}

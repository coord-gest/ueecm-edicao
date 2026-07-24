import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { ArrowLeft, ScrollText, CheckCircle2, Download } from "lucide-react";

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
import { CODE_OF_ETHICS_VERSION } from "@/lib/code-of-ethics";
import { listEthicsAcceptances, type EthicsAcceptanceRow } from "@/lib/ethics-acceptances.functions";
import { exportRowsAsCsv } from "@/lib/csv-export";
import { roleLabels, normalizeRole } from "@/lib/roles";

export const Route = createFileRoute("/painel-etica")({
  ssr: false,
  head: () => ({ meta: [{ title: "Código de Ética — Aceites | Painel" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: PainelEticaPage,
});

function PainelEticaPage() {
  useRolePainelGuard(["desenvolvedor", "admin", "diretor", "coordenador"]);
  useAdminAccessAudit("/painel-etica");

  const fetchList = useServerFn(listEthicsAcceptances);
  const [busca, setBusca] = useState("");
  const [filtroVersao, setFiltroVersao] = useState<string>("todas");
  const [filtroPapel, setFiltroPapel] = useState<string>("todos");

  const { data, isLoading } = useQuery({
    queryKey: ["ethics-acceptances"],
    queryFn: () => fetchList(),
    refetchInterval: 60_000,
  });

  const versoesDisponiveis = useMemo(() => {
    const s = new Set<number>();
    (data ?? []).forEach((r) => s.add(r.version));
    return Array.from(s).sort((a, b) => b - a);
  }, [data]);

  const papeisDisponiveis = useMemo(() => {
    const s = new Set<string>();
    (data ?? []).forEach((r) => r.roles.forEach((role) => s.add(role)));
    return Array.from(s).sort();
  }, [data]);

  const filtrado = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (data ?? []).filter((r) => {
      if (filtroVersao !== "todas" && String(r.version) !== filtroVersao) return false;
      if (filtroPapel !== "todos" && !r.roles.includes(filtroPapel)) return false;
      if (!q) return true;
      return (
        (r.email ?? "").toLowerCase().includes(q) ||
        (r.display_name ?? "").toLowerCase().includes(q) ||
        (r.full_name ?? "").toLowerCase().includes(q) ||
        (r.cargo ?? "").toLowerCase().includes(q)
      );
    });
  }, [data, busca, filtroVersao, filtroPapel]);

  const totais = useMemo(() => {
    const all = data ?? [];
    const atual = all.filter((r) => r.version === CODE_OF_ETHICS_VERSION).length;
    const desatualizados = all.filter((r) => r.version < CODE_OF_ETHICS_VERSION).length;
    return { total: all.length, atual, desatualizados };
  }, [data]);

  function exportar() {
    const rows = filtrado.map((r) => ({
      nome: r.display_name ?? r.full_name ?? "",
      email: r.email ?? "",
      cargo: r.cargo ?? "",
      papeis: r.roles.join(", "),
      versao: r.version,
      aceito_em: new Date(r.accepted_at).toLocaleString("pt-BR"),
      ip: r.ip ?? "",
    }));
    exportRowsAsCsv(
      `codigo-etica-aceites-${new Date().toISOString().slice(0, 10)}.csv`,
      rows,
      [
        { key: "nome", label: "Nome" },
        { key: "email", label: "E-mail" },
        { key: "cargo", label: "Cargo" },
        { key: "papeis", label: "Papéis" },
        { key: "versao", label: "Versão" },
        { key: "aceito_em", label: "Aceito em" },
        { key: "ip", label: "IP" },
      ],
    );
  }

  return (
    <PainelLayout>
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-2xl font-semibold text-foreground flex items-center gap-2">
              <ScrollText className="h-6 w-6 text-primary" />
              Código de Ética — Aceites
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Auditoria de quem aceitou o Código de Ética. Versão atual em vigor:{" "}
              <strong>v{CODE_OF_ETHICS_VERSION}</strong>.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportar} disabled={filtrado.length === 0}>
              <Download className="h-4 w-4 mr-1" /> Exportar CSV
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/painel">
                <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-border/70 bg-card p-4">
            <p className="text-xs text-muted-foreground">Total de aceites</p>
            <p className="mt-1 font-display text-2xl font-semibold">{totais.total}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/40 dark:bg-emerald-950/20 p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Na versão atual (v{CODE_OF_ETHICS_VERSION})
            </p>
            <p className="mt-1 font-display text-2xl font-semibold text-emerald-700 dark:text-emerald-400">
              {totais.atual}
            </p>
          </div>
          <div className="rounded-2xl border border-amber-200/60 bg-amber-50/40 dark:bg-amber-950/20 p-4">
            <p className="text-xs text-muted-foreground">Em versão anterior</p>
            <p className="mt-1 font-display text-2xl font-semibold text-amber-700 dark:text-amber-400">
              {totais.desatualizados}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            placeholder="Filtrar por nome, e-mail ou cargo..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="sm:max-w-sm"
          />
          <Select value={filtroVersao} onValueChange={setFiltroVersao}>
            <SelectTrigger className="sm:w-40">
              <SelectValue placeholder="Versão" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as versões</SelectItem>
              {versoesDisponiveis.map((v) => (
                <SelectItem key={v} value={String(v)}>
                  Versão {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filtroPapel} onValueChange={setFiltroPapel}>
            <SelectTrigger className="sm:w-48">
              <SelectValue placeholder="Papel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os papéis</SelectItem>
              {papeisDisponiveis.map((p) => {
                const n = normalizeRole(p);
                return (
                  <SelectItem key={p} value={p}>
                    {n ? roleLabels[n] : p}
                  </SelectItem>
                );
              })}
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
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nenhum aceite encontrado com os filtros atuais.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[860px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Papéis</TableHead>
                    <TableHead>Versão</TableHead>
                    <TableHead>Aceito em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrado.map((r: EthicsAcceptanceRow) => {
                    const atual = r.version === CODE_OF_ETHICS_VERSION;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs">
                          <div className="font-medium text-foreground">
                            {r.display_name ?? r.full_name ?? r.user_id.slice(0, 8)}
                          </div>
                          {r.cargo && (
                            <div className="text-muted-foreground">{r.cargo}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">{r.email ?? "—"}</TableCell>
                        <TableCell className="text-xs">
                          <div className="flex flex-wrap gap-1">
                            {r.roles.length === 0 ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              r.roles.map((role) => {
                                const n = normalizeRole(role);
                                return (
                                  <Badge key={role} variant="secondary" className="text-[10px]">
                                    {n ? roleLabels[n] : role}
                                  </Badge>
                                );
                              })
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          {atual ? (
                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 whitespace-nowrap">
                              v{r.version} (atual)
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 whitespace-nowrap">
                              v{r.version}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {new Date(r.accepted_at).toLocaleString("pt-BR")}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </PainelLayout>
  );
}
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BarChart3, Eye, MousePointerClick, Users, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { supabase } from "@/integrations/supabase/client";
import { PainelLayout } from "@/components/PainelLayout";

export const Route = createFileRoute("/painel-analytics")({
  ssr: false,
  head: () => ({ meta: [{ title: "Analytics | Painel" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: PainelAnalytics,
});

type AnalyticsRow = {
  id: string;
  event_type: string;
  path: string | null;
  user_id: string | null;
  session_id: string | null;
  created_at: string;
};

const RANGES = [
  { value: "1", label: "Últimas 24h" },
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
] as const;

function PainelAnalytics() {
  const [days, setDays] = useState<string>("7");

  const since = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - Number(days));
    return d.toISOString();
  }, [days]);

  const { data: events, isLoading } = useQuery({
    queryKey: ["analytics-events", days],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("analytics_events")
        .select("id, event_type, path, user_id, session_id, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(10000);
      if (error) throw error;
      return (data ?? []) as AnalyticsRow[];
    },
  });

  const stats = useMemo(() => {
    const rows = events ?? [];
    const pageviews = rows.filter((r) => r.event_type === "pageview");
    const uniqueSessions = new Set(rows.map((r) => r.session_id).filter(Boolean)).size;
    const uniqueUsers = new Set(rows.map((r) => r.user_id).filter(Boolean)).size;

    const pathCounts = new Map<string, { views: number; sessions: Set<string> }>();
    for (const r of pageviews) {
      const p = r.path ?? "(unknown)";
      const entry = pathCounts.get(p) ?? { views: 0, sessions: new Set() };
      entry.views += 1;
      if (r.session_id) entry.sessions.add(r.session_id);
      pathCounts.set(p, entry);
    }
    const topPages = Array.from(pathCounts.entries())
      .map(([path, v]) => ({ path, views: v.views, sessions: v.sessions.size }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 20);

    const eventTypeCounts = new Map<string, number>();
    for (const r of rows) {
      eventTypeCounts.set(r.event_type, (eventTypeCounts.get(r.event_type) ?? 0) + 1);
    }
    const topEvents = Array.from(eventTypeCounts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);

    return {
      totalEvents: rows.length,
      totalPageviews: pageviews.length,
      uniqueSessions,
      uniqueUsers,
      topPages,
      topEvents,
    };
  }, [events]);

  return (
    <PainelLayout>
      <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/painel">
                <ArrowLeft className="mr-1 size-4" />
                Voltar
              </Link>
            </Button>
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
                <BarChart3 className="size-6 text-primary" />
                Analytics
              </h1>
              <p className="text-sm text-muted-foreground">
                Páginas mais acessadas e eventos-chave do sistema.
              </p>
            </div>
          </div>
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard icon={Eye} label="Visualizações" value={stats.totalPageviews} />
              <StatCard icon={MousePointerClick} label="Eventos totais" value={stats.totalEvents} />
              <StatCard icon={Users} label="Sessões únicas" value={stats.uniqueSessions} />
              <StatCard icon={Users} label="Usuários logados" value={stats.uniqueUsers} />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Páginas mais acessadas</CardTitle>
              </CardHeader>
              <CardContent>
                {stats.topPages.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Nenhum dado no período selecionado.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Página</TableHead>
                        <TableHead className="text-right">Views</TableHead>
                        <TableHead className="text-right">Sessões</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.topPages.map((p) => (
                        <TableRow key={p.path}>
                          <TableCell className="font-mono text-sm">{p.path}</TableCell>
                          <TableCell className="text-right font-medium">{p.views}</TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {p.sessions}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Distribuição por tipo de evento</CardTitle>
              </CardHeader>
              <CardContent>
                {stats.topEvents.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Nenhum evento registrado.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {stats.topEvents.map((e) => (
                      <Badge key={e.type} variant="secondary" className="text-sm">
                        {e.type}: <span className="ml-1 font-bold">{e.count}</span>
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </PainelLayout>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Eye;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <Icon className="size-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value.toLocaleString("pt-BR")}</p>
        </div>
      </CardContent>
    </Card>
  );
}

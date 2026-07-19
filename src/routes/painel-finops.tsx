import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  DollarSign,
  Cpu,
  Bell,
  AlertTriangle,
  Activity,
  TrendingUp,
  Loader2,
} from "lucide-react";

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

export const Route = createFileRoute("/painel-finops")({
  ssr: false,
  head: () => ({ meta: [{ title: "FinOps — Custos e Uso | Painel" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: PainelFinops,
});

// Estimated pricing per 1M tokens (USD). Adjust as gateway pricing evolves.
// Blended input+output average — conservative estimate for budget planning.
const MODEL_PRICING_USD_PER_M: Record<string, number> = {
  "gemini-flash-lite-latest": 0.25,
  "gemini-2.5-flash-lite": 0.25,
  "gemini-2.5-flash": 0.60,
  "gemini-2.5-pro": 3.50,
  "llama-3.1-8b-instant": 0.10,
  "llama-3.3-70b-versatile": 0.80,
  "gpt-5-mini": 1.00,
  "gpt-5": 5.00,
};
const DEFAULT_PRICE_PER_M = 0.30;
const USD_TO_BRL = 5.30;

const RANGES = [
  { value: "1", label: "Últimas 24h" },
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
] as const;

type GroqRow = {
  id: string;
  model: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  duration_ms: number | null;
  status: string | null;
  session_id: string | null;
  created_at: string;
};

type DispatchRow = {
  id: string;
  sent: number | null;
  tokens_total: number | null;
  errors_count: number | null;
  duration_ms: number | null;
  ok: boolean | null;
  created_at: string;
};

function estimateCostUSD(model: string | null, tokens: number): number {
  const price = (model ? MODEL_PRICING_USD_PER_M[model] : undefined) ?? DEFAULT_PRICE_PER_M;
  return (tokens / 1_000_000) * price;
}

function fmtUSD(v: number) {
  return v.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 4 });
}
function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtInt(v: number) {
  return v.toLocaleString("pt-BR");
}

function PainelFinops() {
  const [days, setDays] = useState<string>("30");
  // Monthly budget in USD (persisted locally per admin)
  const [budgetUSD, setBudgetUSD] = useState<number>(() => {
    if (typeof window === "undefined") return 10;
    return Number(window.localStorage.getItem("finops_budget_usd") ?? "10");
  });

  const since = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - Number(days));
    return d.toISOString();
  }, [days]);

  const groqQ = useQuery({
    queryKey: ["finops-groq", since],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groq_usage")
        .select("id,model,prompt_tokens,completion_tokens,total_tokens,duration_ms,status,session_id,created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as GroqRow[];
    },
  });

  const dispatchQ = useQuery({
    queryKey: ["finops-dispatch", since],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fcm_dispatch_logs")
        .select("id,sent,tokens_total,errors_count,duration_ms,ok,created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as DispatchRow[];
    },
  });

  const errorsQ = useQuery({
    queryKey: ["finops-errors", since],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("system_errors")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const analyticsQ = useQuery({
    queryKey: ["finops-analytics", since],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("analytics_events")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const groqRows = groqQ.data ?? [];
  const dispatchRows = dispatchQ.data ?? [];

  // Aggregate AI usage by model
  const byModel = useMemo(() => {
    const map = new Map<
      string,
      { model: string; calls: number; tokens: number; errors: number; costUSD: number; avgMs: number; totalMs: number }
    >();
    for (const r of groqRows) {
      const key = r.model ?? "desconhecido";
      const cur = map.get(key) ?? { model: key, calls: 0, tokens: 0, errors: 0, costUSD: 0, avgMs: 0, totalMs: 0 };
      cur.calls += 1;
      cur.tokens += r.total_tokens ?? 0;
      cur.totalMs += r.duration_ms ?? 0;
      if (r.status && r.status !== "success" && r.status !== "ok") cur.errors += 1;
      cur.costUSD += estimateCostUSD(r.model, r.total_tokens ?? 0);
      map.set(key, cur);
    }
    return Array.from(map.values())
      .map((m) => ({ ...m, avgMs: m.calls ? Math.round(m.totalMs / m.calls) : 0 }))
      .sort((a, b) => b.costUSD - a.costUSD);
  }, [groqRows]);

  // Top sessions (potential abusers)
  const topSessions = useMemo(() => {
    const map = new Map<string, { session: string; calls: number; tokens: number; costUSD: number }>();
    for (const r of groqRows) {
      const key = r.session_id ?? "sem sessão";
      const cur = map.get(key) ?? { session: key, calls: 0, tokens: 0, costUSD: 0 };
      cur.calls += 1;
      cur.tokens += r.total_tokens ?? 0;
      cur.costUSD += estimateCostUSD(r.model, r.total_tokens ?? 0);
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.costUSD - a.costUSD).slice(0, 10);
  }, [groqRows]);

  const totalTokens = groqRows.reduce((acc, r) => acc + (r.total_tokens ?? 0), 0);
  const totalCostUSD = byModel.reduce((acc, m) => acc + m.costUSD, 0);
  const totalCalls = groqRows.length;
  const totalErrorsAI = groqRows.filter((r) => r.status && r.status !== "success" && r.status !== "ok").length;

  // Push notification aggregates
  const pushSent = dispatchRows.reduce((acc, r) => acc + (r.sent ?? 0), 0);
  const pushErrors = dispatchRows.reduce((acc, r) => acc + (r.errors_count ?? 0), 0);
  const pushRuns = dispatchRows.length;

  // Budget projection (monthly)
  const daysNum = Number(days);
  const projectedMonthlyUSD = daysNum > 0 ? (totalCostUSD / daysNum) * 30 : 0;
  const budgetPct = budgetUSD > 0 ? Math.min(100, (projectedMonthlyUSD / budgetUSD) * 100) : 0;
  const budgetStatus = budgetPct >= 100 ? "danger" : budgetPct >= 75 ? "warn" : "ok";

  const isLoading = groqQ.isLoading || dispatchQ.isLoading;

  function saveBudget(v: number) {
    setBudgetUSD(v);
    if (typeof window !== "undefined") window.localStorage.setItem("finops_budget_usd", String(v));
  }

  return (
    <PainelLayout>
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/painel">
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">FinOps — Custos & Uso</h1>
              <p className="text-sm text-muted-foreground">
                Visibilidade financeira do AI Gateway, notificações push e sinais operacionais.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-44">
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
        </div>

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Custo AI estimado</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{fmtUSD(totalCostUSD)}</div>
              <p className="text-xs text-muted-foreground">≈ {fmtBRL(totalCostUSD * USD_TO_BRL)} no período</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Tokens consumidos</CardTitle>
              <Cpu className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{fmtInt(totalTokens)}</div>
              <p className="text-xs text-muted-foreground">{fmtInt(totalCalls)} chamadas · {totalErrorsAI} erros</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Push notifications</CardTitle>
              <Bell className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{fmtInt(pushSent)}</div>
              <p className="text-xs text-muted-foreground">{pushRuns} disparos · {pushErrors} falhas</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Sinais operacionais</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{fmtInt(analyticsQ.data ?? 0)}</div>
              <p className="text-xs text-muted-foreground">
                {fmtInt(errorsQ.data ?? 0)} erros registrados
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Budget card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Projeção mensal & orçamento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Projeção mensal (AI)</p>
                <p className="text-xl font-semibold">{fmtUSD(projectedMonthlyUSD)}</p>
                <p className="text-xs text-muted-foreground">≈ {fmtBRL(projectedMonthlyUSD * USD_TO_BRL)}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground" htmlFor="budget">
                  Orçamento mensal (USD)
                </label>
                <input
                  id="budget"
                  type="number"
                  min={0}
                  step={1}
                  value={budgetUSD}
                  onChange={(e) => saveBudget(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Consumo do orçamento</p>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={
                        "h-full rounded-full transition-all " +
                        (budgetStatus === "danger"
                          ? "bg-destructive"
                          : budgetStatus === "warn"
                            ? "bg-yellow-500"
                            : "bg-green-500")
                      }
                      style={{ width: `${budgetPct}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium tabular-nums">{budgetPct.toFixed(0)}%</span>
                </div>
                {budgetStatus !== "ok" && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-yellow-600">
                    <AlertTriangle className="h-3 w-3" />
                    {budgetStatus === "danger"
                      ? "Projeção acima do orçamento"
                      : "Aproximando-se do limite"}
                  </div>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Estimativa baseada no consumo médio do período selecionado extrapolado para 30 dias. Preços em USD por 1M tokens são aproximados —
              revise em <code className="rounded bg-muted px-1">MODEL_PRICING_USD_PER_M</code> para refletir a tabela atual do Lovable AI Gateway.
            </p>
          </CardContent>
        </Card>

        {/* Cost by model */}
        <Card>
          <CardHeader>
            <CardTitle>Custo por modelo</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
              </div>
            ) : byModel.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma chamada no período.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Modelo</TableHead>
                    <TableHead className="text-right">Chamadas</TableHead>
                    <TableHead className="text-right">Tokens</TableHead>
                    <TableHead className="text-right">Latência méd.</TableHead>
                    <TableHead className="text-right">Erros</TableHead>
                    <TableHead className="text-right">Custo (USD)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byModel.map((m) => (
                    <TableRow key={m.model}>
                      <TableCell className="font-medium">{m.model}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtInt(m.calls)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtInt(m.tokens)}</TableCell>
                      <TableCell className="text-right tabular-nums">{m.avgMs} ms</TableCell>
                      <TableCell className="text-right">
                        {m.errors > 0 ? (
                          <Badge variant="destructive">{m.errors}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{fmtUSD(m.costUSD)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Top sessions */}
        <Card>
          <CardHeader>
            <CardTitle>Top sessões por custo</CardTitle>
          </CardHeader>
          <CardContent>
            {topSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados no período.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sessão</TableHead>
                    <TableHead className="text-right">Chamadas</TableHead>
                    <TableHead className="text-right">Tokens</TableHead>
                    <TableHead className="text-right">Custo (USD)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topSessions.map((s) => (
                    <TableRow key={s.session}>
                      <TableCell className="font-mono text-xs">{s.session.slice(0, 32)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtInt(s.calls)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtInt(s.tokens)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtUSD(s.costUSD)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </PainelLayout>
  );
}
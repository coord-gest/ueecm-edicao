import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getMetricsPercentiles } from "@/lib/observability.functions";

type Row = {
  kind: string;
  name: string;
  samples: number;
  p50: number;
  p95: number;
  p99: number;
  avg_ms: number;
  max_ms: number;
  error_rate: number;
};

const HOURS_OPTS = [1, 6, 24, 72, 168] as const;
const KIND_LABEL: Record<string, string> = {
  server_fn: "Server function",
  api_route: "API route",
  web_vital: "Web Vital",
  client_nav: "Navegação",
  custom: "Custom",
};

function fmt(v: number, unit = "ms") {
  if (v == null || Number.isNaN(v)) return "—";
  if (v >= 1000 && unit === "ms") return (v / 1000).toFixed(2) + "s";
  return v.toFixed(0) + unit;
}

function badge(p95: number, kind: string) {
  const thr = kind === "web_vital" ? 2500 : 800;
  if (p95 < thr * 0.5) return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
  if (p95 < thr) return "bg-amber-500/10 text-amber-700 dark:text-amber-400";
  return "bg-red-500/10 text-red-700 dark:text-red-400";
}

export function MetricsPanel() {
  const fn = useServerFn(getMetricsPercentiles);
  const [hours, setHours] = useState<number>(24);
  const [kind, setKind] = useState<string>("");

  const q = useQuery({
    queryKey: ["metrics-p50p95", hours, kind],
    queryFn: () =>
      fn({
        data: {
          hours,
          kind: (kind || undefined) as
            | "server_fn"
            | "api_route"
            | "web_vital"
            | "client_nav"
            | "custom"
            | undefined,
        },
      }),
    refetchOnWindowFocus: false,
    refetchInterval: 30000,
  });

  const rows = (q.data ?? []) as Row[];

  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Observabilidade — p50 / p95 / p99</h2>
          <p className="text-xs text-muted-foreground">
            Latência agregada de server functions, rotas de API, Web Vitals e navegação. Atualiza a cada 30s.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <label className="flex items-center gap-1">
            Janela:
            <select
              className="rounded-md border bg-background px-2 py-1"
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
            >
              {HOURS_OPTS.map((h) => (
                <option key={h} value={h}>
                  {h < 24 ? `${h}h` : `${h / 24}d`}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1">
            Tipo:
            <select
              className="rounded-md border bg-background px-2 py-1"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              <option value="">Todos</option>
              {Object.entries(KIND_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      {q.isLoading && <p className="text-sm text-muted-foreground">Carregando métricas…</p>}
      {q.error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
          {q.error.message}
        </p>
      )}
      {!q.isLoading && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhuma métrica registrada nesta janela. Navegue pela aplicação para gerar amostras.
        </p>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2 pr-3">Tipo</th>
                <th className="py-2 pr-3">Métrica / rota</th>
                <th className="py-2 pr-3 text-right">Amostras</th>
                <th className="py-2 pr-3 text-right">p50</th>
                <th className="py-2 pr-3 text-right">p95</th>
                <th className="py-2 pr-3 text-right">p99</th>
                <th className="py-2 pr-3 text-right">Máx.</th>
                <th className="py-2 pr-3 text-right">Erros</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-2 pr-3">
                    <span className="rounded-md bg-muted px-2 py-0.5 text-xs">{KIND_LABEL[r.kind] ?? r.kind}</span>
                  </td>
                  <td className="py-2 pr-3 font-mono text-xs">{r.name}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.samples}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{fmt(r.p50)}</td>
                  <td className="py-2 pr-3 text-right">
                    <span className={`rounded-md px-2 py-0.5 text-xs tabular-nums ${badge(r.p95, r.kind)}`}>
                      {fmt(r.p95)}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{fmt(r.p99)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">{fmt(r.max_ms)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {r.error_rate > 0 ? (
                      <span className="rounded-md bg-red-500/10 px-2 py-0.5 text-xs text-red-700 dark:text-red-400">
                        {(r.error_rate * 100).toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-muted-foreground">0%</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-[11px] text-muted-foreground">
        Alertas críticos: erros não capturados no cliente e falhas com severidade{" "}
        <code className="rounded bg-muted px-1">critical</code> vão para <code>system_errors</code>, disparando push +
        notificação in-app para admins automaticamente.
      </p>
    </section>
  );
}

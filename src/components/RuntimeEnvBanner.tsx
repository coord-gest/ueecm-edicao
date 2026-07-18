import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { checkRuntimeEnv } from "@/lib/runtime-check.functions";

/**
 * Banner mostrado no Painel para o Desenvolvedor.
 * Verifica em tempo real se os secrets de runtime do Supabase externo e do
 * VAPID estão configurados — se faltar algo, linka pra página de instruções.
 */
export function RuntimeEnvBanner() {
  const fn = useServerFn(checkRuntimeEnv);
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["runtime-env-check"],
    queryFn: () => fn(),
    refetchOnWindowFocus: false,
  });

  if (isLoading || !data) return null;

  if (data.ok) {
    return (
      <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 className="size-4 shrink-0" />
        <span>
          Secrets de runtime ok ({data.status.filter((s) => s.configured).length}/
          {data.status.length}).
        </span>
        <Link
          to="/painel-runtime"
          className="ml-auto rounded-md border border-emerald-500/30 bg-background px-2 py-0.5 text-[11px] font-medium hover:bg-accent"
        >
          Detalhes
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
        <div className="flex-1">
          <p className="font-medium text-destructive">
            Secrets de runtime faltando ({data.missingCritical.length})
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Sem estes secrets as server functions (auth, push, dispatcher) vão falhar.
          </p>
          <ul className="mt-2 space-y-0.5 text-xs">
            {data.missingCritical.map((name) => (
              <li key={name} className="font-mono text-destructive">
                · {name}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              to="/painel-runtime"
              className="rounded-md bg-destructive px-3 py-1 text-xs font-medium text-destructive-foreground hover:bg-destructive/90"
            >
              Como corrigir
            </Link>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="rounded-md border border-input bg-background px-3 py-1 text-xs font-medium hover:bg-accent disabled:opacity-50"
            >
              {isFetching ? "Verificando..." : "Re-verificar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

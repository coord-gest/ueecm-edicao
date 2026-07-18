import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, RefreshCw, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { getCurrentUserRoles } from "@/lib/auth.functions";
import { roleLabels } from "@/lib/roles";
import { primaryRole, painelPathForRoles } from "@/lib/role-panels";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/painel-diagnostico")({
  ssr: false,
  head: () => ({ meta: [{ title: "Diagnóstico de Papéis | Painel" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: PainelDiagnostico,
});

type ServerFnResult =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; roles: string[]; raw: string }
  | { status: "error"; message: string; raw?: string };

function PainelDiagnostico() {
  const { user, roles, loading, rolesError, isDeveloper, isAdmin, refreshRoles } = useAuth();
  const fetchRoles = useServerFn(getCurrentUserRoles);
  const [serverFn, setServerFn] = useState<ServerFnResult>({ status: "idle" });
  const [refreshing, setRefreshing] = useState(false);
  const [session, setSession] = useState<{
    access_token_prefix?: string;
    expires_at?: number | null;
  }>({});

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const tok = data.session?.access_token;
      setSession({
        access_token_prefix: tok ? `${tok.slice(0, 12)}…${tok.slice(-6)}` : undefined,
        expires_at: data.session?.expires_at ?? null,
      });
    });
  }, []);

  const isAllowed = isDeveloper || isAdmin;

  const callServerFn = async () => {
    setServerFn({ status: "loading" });
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.access_token) {
        setServerFn({
          status: "error",
          message: "Sem sessão ativa no navegador. Faça login novamente.",
        });
        return;
      }
      const result = await fetchRoles();
      const list: string[] = Array.isArray(result?.roles) ? result.roles : [];
      setServerFn({ status: "ok", roles: list, raw: JSON.stringify(result, null, 2) });
    } catch (err) {
      setServerFn({
        status: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  useEffect(() => {
    if (isAllowed) void callServerFn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAllowed]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshRoles();
      await callServerFn();
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Skeleton className="h-64 w-full rounded-3xl" />
      </main>
    );
  }

  if (!isAllowed) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="rounded-3xl border border-destructive/40 bg-destructive/10 p-6">
          <h1 className="font-display text-lg font-semibold text-destructive">Acesso restrito</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Esta página de diagnóstico é acessível apenas para Desenvolvedor ou Administrador.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-4 rounded-full">
            <Link to="/painel">
              <ArrowLeft className="size-4" /> Voltar ao painel
            </Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <div className="flex items-center gap-2">
        <Stethoscope className="size-6 text-primary" />
        <h1 className="font-display text-2xl font-semibold text-foreground">
          Diagnóstico de papéis
        </h1>
      </div>

      <section className="rounded-3xl border border-border/70 bg-card p-6 shadow-sm">
        <h2 className="font-display text-lg font-semibold text-foreground">Sessão</h2>
        <dl className="mt-3 space-y-1 text-sm">
          <div className="flex gap-2">
            <dt className="w-40 shrink-0 text-muted-foreground">Usuário</dt>
            <dd className="break-all font-medium text-foreground">{user?.email}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-40 shrink-0 text-muted-foreground">User ID</dt>
            <dd className="break-all font-mono text-xs text-foreground">{user?.id}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-40 shrink-0 text-muted-foreground">Access token</dt>
            <dd className="break-all font-mono text-xs text-foreground">
              {session.access_token_prefix ?? "(nenhum)"}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-40 shrink-0 text-muted-foreground">Expira em</dt>
            <dd className="text-foreground">
              {session.expires_at
                ? new Date(session.expires_at * 1000).toLocaleString("pt-BR")
                : "—"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-3xl border border-border/70 bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-foreground">
            Papéis no navegador (useAuth)
          </h2>
          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            size="sm"
            variant="outline"
            className="rounded-full"
          >
            <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Atualizando…" : "Recarregar"}
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {roles.length === 0 ? (
            <span className="text-sm text-muted-foreground">Nenhum papel</span>
          ) : (
            roles.map((r) => (
              <Badge key={r} variant="secondary">
                {roleLabels[r]}
              </Badge>
            ))
          )}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Papel principal: <strong>{primaryRole(roles) ?? "(nenhum)"}</strong> — painel destino:{" "}
          <code className="font-mono">{painelPathForRoles(roles)}</code>
        </p>
        {rolesError && (
          <div className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
            <p className="text-xs font-semibold text-destructive">Erro na última chamada:</p>
            <pre className="mt-1 whitespace-pre-wrap break-all text-xs text-destructive">
              {rolesError}
            </pre>
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-border/70 bg-card p-6 shadow-sm">
        <h2 className="font-display text-lg font-semibold text-foreground">
          Resposta bruta de{" "}
          <code className="font-mono text-sm">/_serverFn/getCurrentUserRoles</code>
        </h2>
        {serverFn.status === "loading" && (
          <p className="mt-2 text-sm text-muted-foreground">Consultando…</p>
        )}
        {serverFn.status === "ok" && (
          <>
            <div className="mt-3 flex flex-wrap gap-2">
              {serverFn.roles.length === 0 ? (
                <span className="text-sm text-muted-foreground">Nenhum papel retornado</span>
              ) : (
                serverFn.roles.map((r) => (
                  <Badge key={r} variant="outline">
                    {r}
                  </Badge>
                ))
              )}
            </div>
            <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-muted p-3 text-xs">
              {serverFn.raw}
            </pre>
          </>
        )}
        {serverFn.status === "error" && (
          <div className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
            <p className="text-xs font-semibold text-destructive">{serverFn.message}</p>
            {serverFn.raw && (
              <pre className="mt-1 whitespace-pre-wrap break-all text-xs text-destructive">
                {serverFn.raw}
              </pre>
            )}
          </div>
        )}
      </section>

      <Button asChild variant="outline" className="rounded-full">
        <Link to="/painel">
          <ArrowLeft className="size-4" /> Voltar ao painel
        </Link>
      </Button>
    </main>
  );
}

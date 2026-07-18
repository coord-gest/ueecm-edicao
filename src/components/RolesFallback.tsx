import { useState } from "react";
import { AlertTriangle, LogOut, RefreshCw, Stethoscope } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/use-auth";

/**
 * Estado de fallback quando o usuário está autenticado mas `roles` está vazio.
 * Mostra o erro (se houver), botão para reatualizar papéis, logout e diagnóstico.
 */
export function RolesFallback() {
  const { user, rolesError, refreshRoles, signOut } = useAuth();
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshRoles();
    } finally {
      setRefreshing(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/login", replace: true });
  };

  return (
    <div className="mx-auto mt-16 max-w-lg rounded-3xl border border-amber-500/40 bg-amber-50 p-6 shadow-sm dark:bg-amber-950/30">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-6 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="flex-1">
          <h2 className="font-display text-lg font-semibold text-foreground">
            Sem papéis atribuídos
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Você entrou como <strong className="break-all">{user?.email}</strong> mas o sistema não
            conseguiu carregar seus papéis. Isso pode acontecer quando a sessão está antiga ou
            quando o servidor rejeitou a consulta.
          </p>
          {rolesError && (
            <div className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
              <p className="text-xs font-semibold text-destructive">Detalhes do erro:</p>
              <pre className="mt-1 whitespace-pre-wrap break-all text-xs text-destructive">
                {rolesError}
              </pre>
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              onClick={handleRefresh}
              disabled={refreshing}
              size="sm"
              className="rounded-full"
            >
              <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Atualizando…" : "Atualizar papéis"}
            </Button>
            <Button onClick={handleSignOut} variant="outline" size="sm" className="rounded-full">
              <LogOut className="size-4" /> Sair e entrar de novo
            </Button>
            <Button asChild variant="ghost" size="sm" className="rounded-full">
              <Link to="/painel-diagnostico">
                <Stethoscope className="size-4" /> Diagnóstico
              </Link>
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Se o problema persistir, contate o Desenvolvedor ou Diretor.
          </p>
        </div>
      </div>
    </div>
  );
}

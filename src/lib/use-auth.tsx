import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { isStaffRole, normalizeRoles, type AppRole } from "@/lib/roles";

export type { AppRole } from "@/lib/roles";
import { logger } from "@/lib/logger";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  /** true enquanto a sessão inicial e os roles ainda estão sendo carregados */
  loading: boolean;
  /** Última mensagem de erro ao carregar papéis (null quando OK). */
  rolesError: string | null;
  isStaff: boolean;
  isAdmin: boolean;
  isDeveloper: boolean;
  hasRole: (role: AppRole) => boolean;
  /** Recarrega os papéis do usuário a partir do servidor (mostra toast em caso de erro). */
  refreshRoles: () => Promise<AppRole[]>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [rolesError, setRolesError] = useState<string | null>(null);
  // loading permanece true até que a sessão inicial E os roles sejam resolvidos
  const [loading, setLoading] = useState(true);

  // Marca no window que o Provider já foi montado no cliente — usado pelo
  // fallback SSR-safe do useAuth() para diferenciar "SSR/streaming" de
  // "bug real: componente fora do Provider".
  useEffect(() => {
    (window as unknown as { __authProviderMounted?: boolean }).__authProviderMounted = true;
    return () => {
      (window as unknown as { __authProviderMounted?: boolean }).__authProviderMounted = false;
    };
  }, []);

  const refreshRoles = useCallback(async (showEmptyWarning = false): Promise<AppRole[]> => {
    // Não chame a server fn protegida sem sessão — evita 401 e blank screen.
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session?.access_token) {
      setRoles([]);
      setRolesError(null);
      return [];
    }
    const userId = sessionData.session.user.id;

    let nextRoles: AppRole[] = [];
    let firstError: string | null = null;

    // Carrega papéis diretamente pelo cliente autenticado. A RLS da tabela
    // continua protegendo para `auth.uid() = user_id`, e evita falhas de
    // server function que impediam o painel de aparecer em produção/preview.
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      if (error) throw error;
      nextRoles = normalizeRoles((data ?? []).map((r) => r.role as string));
    } catch (error) {
      firstError = error instanceof Error ? error.message : String(error);
      logger.error("[useAuth] Query de user_roles falhou:", error);
    }

    setRoles(nextRoles);
    setRolesError(nextRoles.length === 0 ? firstError : null);

    if (showEmptyWarning && nextRoles.length === 0) {
      if (firstError) {
        toast.error("Não foi possível verificar seus papéis", {
          description: firstError,
          duration: 8000,
        });
      } else {
        toast.warning("Nenhum papel atribuído à sua conta", {
          description:
            "Você entrou com sucesso, mas não tem permissões atribuídas. Contate o Desenvolvedor ou Diretor.",
          duration: 8000,
        });
      }
    }
    return nextRoles;
  }, []);

  useEffect(() => {
    let isMounted = true;

    // Carrega a sessão inicial e os roles antes de liberar o loading
    supabase.auth.getSession().then(async ({ data }) => {
      if (!isMounted) return;
      const currentSession = data.session;
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      if (currentSession?.user) await refreshRoles(false);
      if (isMounted) setLoading(false);
    });

    // Escuta mudanças de estado de autenticação (login, logout, refresh de token)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!isMounted) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      // Vincula identidade ao Sentry (não bloqueia o fluxo de auth).
      void import("@/lib/sentry")
        .then((m) =>
          m.setSentryUser(
            nextSession?.user
              ? { id: nextSession.user.id, email: nextSession.user.email ?? undefined }
              : null,
          ),
        )
        .catch(() => undefined);
      if (nextSession?.user) {
        // Só reseta loading em eventos que realmente trocam de usuário.
        // TOKEN_REFRESHED dispara ao voltar o foco na aba — se resetássemos
        // loading aqui, componentes que fazem `if (loading) return null`
        // desmontariam formulários em edição.
        const isUserChange = event === "SIGNED_IN" || event === "USER_UPDATED";
        if (isUserChange) setLoading(true);
        setTimeout(async () => {
          if (!isMounted) return;
          await refreshRoles(event === "SIGNED_IN");
          if (isMounted && isUserChange) setLoading(false);
          // Re-vincula o token FCM existente ao user_id atual, se o usuário
          // já concedeu permissão em uma sessão anterior. Silencioso.
          if (event === "SIGNED_IN") {
            void import("@/lib/push")
              .then((m) => m.reattachPushTokenToUser())
              .catch(() => undefined);
          }
        }, 0);
      } else {
        setRoles([]);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [refreshRoles]);

  const value = useMemo<AuthContextValue>(() => {
    const hasRole = (role: AppRole) => roles.includes(role);
    return {
      user,
      session,
      roles,
      loading,
      rolesError,
      isStaff: roles.some(isStaffRole),
      isAdmin: roles.includes("admin") || roles.includes("desenvolvedor"),
      isDeveloper: roles.includes("desenvolvedor"),
      hasRole,
      refreshRoles: () => refreshRoles(true),

      signIn: async (email, password) => {
        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) {
          setLoading(false);
          return { error: error.message };
        }
        const { data } = await supabase.auth.getSession();
        setSession(data.session);
        setUser(data.session?.user ?? null);
        if (data.session?.user) await refreshRoles(true);
        setLoading(false);
        return { error: null };
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
    };
  }, [user, session, roles, loading, rolesError, refreshRoles]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    // Fallback SSR-safe: evita derrubar o streaming quando o componente
    // é renderizado transitoriamente fora do AuthProvider (ex.: React
    // "switched to client rendering" após um Suspense abortar).
    // No cliente hidratado, o Provider é montado logo em seguida e o
    // componente re-renderiza com o contexto real.
    if (typeof window === "undefined" || !(window as unknown as { __authProviderMounted?: boolean }).__authProviderMounted) {
      return {
        user: null,
        session: null,
        roles: [],
        loading: true,
        rolesError: null,
        isStaff: false,
        isAdmin: false,
        isDeveloper: false,
        hasRole: () => false,
        refreshRoles: async () => [],
        signIn: async () => ({ error: "AuthProvider ainda não montado" }),
        signOut: async () => undefined,
      } satisfies AuthContextValue;
    }
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}

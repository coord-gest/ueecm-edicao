import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  LogOut,
  Shield,
  FileText,
  Calendar,
  Clock,
  BookOpen,
  Users,
  CheckCircle2,
  History,
  GraduationCap,
  NotebookPen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SeedAcademicCard } from "@/components/SeedAcademicCard";
import { TestPushButton } from "@/components/TestPushButton";
import { BroadcastTestPushButton } from "@/components/BroadcastTestPushButton";
import { RuntimeEnvBanner } from "@/components/RuntimeEnvBanner";
import { useAuth } from "@/lib/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { roleLabels } from "@/lib/roles";
import { RolesFallback } from "@/components/RolesFallback";

export const Route = createFileRoute("/painel")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Painel | U.E. - Evaristo Campelo de Matos" }],
  }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/login" });
    }
  },
  component: Painel,
});

function Painel() {
  const {
    user,
    roles,
    loading,
    isStaff,
    isAdmin,
    isDeveloper,
    hasRole,
    signOut,
    refreshRoles,
    rolesError,
  } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const forcedRefreshRef = useRef(false);

  const navigate = useNavigate();

  // Ao entrar em /painel, força uma releitura dos papéis para descartar
  // cache antigo (ex.: sessão criada antes dos GRANTs serem aplicados).
  useEffect(() => {
    if (loading) return;
    if (forcedRefreshRef.current) return;
    forcedRefreshRef.current = true;
    void refreshRoles();
  }, [loading, refreshRoles]);

  // Detecta se o usuário logado é responsável por algum aluno consultando a
  // tabela `responsaveis` (protegida por RLS: user_id = auth.uid()).
  // Isso é necessário porque não há papel "responsavel" no enum app_role.
  const { data: isResponsavel } = useQuery({
    queryKey: ["is-responsavel", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("responsaveis")
        .select("id")
        .eq("user_id", user!.id)
        .limit(1);
      if (error) throw error;
      return (data?.length ?? 0) > 0;
    },
    staleTime: 60_000,
  });

  // Redireciona usuários não-desenvolvedor/admin para o painel específico do perfil.
  // O Desenvolvedor (e Admin) mantêm acesso ao painel geral com visão completa.
  useEffect(() => {
    if (loading) return;
    if (isDeveloper || isAdmin) return;
    if (hasRole("diretor")) {
      navigate({ to: "/painel-diretor", replace: true });
    } else if (hasRole("coordenador")) {
      navigate({ to: "/painel-coordenador", replace: true });
    } else if (hasRole("secretario")) {
      navigate({ to: "/painel-secretario", replace: true });
    } else if (hasRole("professor")) {
      navigate({ to: "/painel-professor", replace: true });
    } else if (isResponsavel) {
      // Responsável por aluno: prioriza o painel do responsável mesmo sem
      // papel formal no enum. Também cobre o caso "roles.length === 0".
      navigate({ to: "/painel-responsavel", replace: true });
    }
  }, [loading, isDeveloper, isAdmin, hasRole, roles, isResponsavel, navigate]);

  // Quando o carregamento terminou e o usuário está sem papéis, mostra
  // fallback claro com detalhes do erro e ações (refresh/logout/diagnóstico).
  const showRolesFallback = !loading && roles.length === 0 && !isResponsavel;

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ["painel-stats"],
    queryFn: async () => {
      const [posts, eventos, turmas, disciplinas, rascunhos, revisao, publicados] =
        await Promise.all([
          supabase.from("posts").select("id", { count: "exact", head: true }),
          supabase.from("eventos").select("id", { count: "exact", head: true }),
          supabase.from("turmas").select("id", { count: "exact", head: true }),
          supabase.from("disciplinas").select("id", { count: "exact", head: true }),
          supabase
            .from("posts")
            .select("id", { count: "exact", head: true })
            .eq("status", "rascunho"),
          supabase
            .from("posts")
            .select("id", { count: "exact", head: true })
            .eq("status", "em_revisao"),
          supabase
            .from("posts")
            .select("id", { count: "exact", head: true })
            .eq("status", "publicado"),
        ]);
      return {
        posts: posts.count ?? 0,
        eventos: eventos.count ?? 0,
        turmas: turmas.count ?? 0,
        disciplinas: disciplinas.count ?? 0,
        rascunhos: rascunhos.count ?? 0,
        revisao: revisao.count ?? 0,
        publicados: publicados.count ?? 0,
      };
    },
  });

  const { data: ultimasAtividades } = useQuery({
    queryKey: ["painel-recent-audit"],
    enabled: isDeveloper,
    queryFn: async () => {
      const { data } = await supabase
        .from("audit_logs")
        .select("id, action, table_name, actor_email, created_at")
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/", replace: true });
  };

  const cards = [
    { label: "Posts", value: stats?.posts, icon: FileText, tone: "text-primary" },
    { label: "Publicados", value: stats?.publicados, icon: CheckCircle2, tone: "text-emerald-600" },
    { label: "Em revisão", value: stats?.revisao, icon: Clock, tone: "text-amber-600" },
    { label: "Rascunhos", value: stats?.rascunhos, icon: FileText, tone: "text-muted-foreground" },
    { label: "Eventos", value: stats?.eventos, icon: Calendar, tone: "text-primary" },
    { label: "Turmas", value: stats?.turmas, icon: Users, tone: "text-primary" },
    { label: "Disciplinas", value: stats?.disciplinas, icon: BookOpen, tone: "text-primary" },
  ];

  return (
    <>
      <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b border-border/60 bg-background/85 pl-14 pr-4 backdrop-blur-lg sm:pl-6 sm:pr-6">
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm font-semibold text-foreground sm:text-base">
            Painel administrativo
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <ThemeToggle className="rounded-full" />
          <Link
            to="/"
            className="hidden h-9 items-center justify-center rounded-full px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground sm:inline-flex"
          >
            Ver blog
          </Link>
          <Button onClick={handleSignOut} variant="outline" size="sm" className="rounded-full">
            <LogOut className="size-4" /> <span className="hidden sm:inline">Sair</span>
          </Button>
        </div>
      </header>

      <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {showRolesFallback ? (
          <RolesFallback />
        ) : (
          <div className="mx-auto max-w-6xl">
            <Breadcrumbs
              className="mb-3"
              items={[{ label: "Início", to: "/" }, { label: "Painel" }]}
            />

            <div className="rounded-3xl border border-border/70 bg-card p-6 shadow-sm">
              <h1 className="font-display text-lg font-semibold leading-tight text-foreground break-all sm:text-xl">
                Olá,{" "}
                <span className="break-all font-medium">
                  {user?.user_metadata?.display_name ?? user?.email}
                </span>
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">{user?.email}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Shield className="size-4 text-primary" />
                {loading ? (
                  <Skeleton className="h-5 w-36" />
                ) : roles.length === 0 ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-muted-foreground">Sem papéis atribuídos</span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full"
                      disabled={refreshing}
                      onClick={async () => {
                        setRefreshing(true);
                        try {
                          await refreshRoles();
                        } finally {
                          setRefreshing(false);
                        }
                      }}
                    >
                      {refreshing ? "Atualizando…" : "Atualizar papéis"}
                    </Button>
                  </div>
                ) : (
                  roles.map((r) => (
                    <Badge key={r} variant={r === "admin" ? "default" : "secondary"}>
                      {roleLabels[r]}
                    </Badge>
                  ))
                )}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <TestPushButton />
                <span className="text-xs text-muted-foreground">
                  Envia um push só para este usuário (todos os dispositivos inscritos).
                </span>
                {isAdmin && (
                  <>
                    <BroadcastTestPushButton />
                    <span className="text-xs text-muted-foreground">
                      Envia para TODAS as subscrições ativas, inclusive visitantes anônimos.
                    </span>
                  </>
                )}
              </div>
              {isDeveloper && <RuntimeEnvBanner />}
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
              {cards.map((c) => (
                <div
                  key={c.label}
                  className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
                >
                  <c.icon className={`size-5 ${c.tone}`} />
                  {loadingStats ? (
                    <Skeleton className="mt-3 h-7 w-12" />
                  ) : (
                    <p className="mt-3 text-2xl font-semibold text-foreground">{c.value ?? "—"}</p>
                  )}
                  <p className="text-sm text-muted-foreground">{c.label}</p>
                </div>
              ))}
            </div>

            {isDeveloper && ultimasAtividades && ultimasAtividades.length > 0 && (
              <div className="mt-6 rounded-3xl border border-border/70 bg-card p-6 shadow-sm">
                <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
                  <History className="size-5 text-primary" /> Atividade recente
                </h2>
                <ul className="mt-4 divide-y divide-border/60">
                  {ultimasAtividades.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">
                          {a.action}
                        </Badge>
                        <span className="font-medium text-foreground">{a.table_name}</span>
                        <span className="text-muted-foreground">
                          — {a.actor_email ?? "sistema"}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(a.created_at).toLocaleString("pt-BR")}
                      </span>
                    </li>
                  ))}
                </ul>
                <Button asChild variant="link" className="mt-2 h-auto p-0">
                  <Link to="/painel-auditoria">Ver tudo →</Link>
                </Button>
              </div>
            )}

            {(isDeveloper || hasRole("diretor")) && (
              <div className="mt-6 rounded-3xl border border-primary/30 bg-primary/5 p-6 shadow-sm">
                <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
                  <Users className="size-5 text-primary" /> Gerenciamento de usuários e turmas
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Cadastre contas administrativas, cadastre professores e vincule-os às turmas.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button asChild className="rounded-full">
                    <Link to="/usuarios">
                      <Users className="size-4" /> Gerenciar usuários
                    </Link>
                  </Button>
                  <Button asChild variant="secondary" className="rounded-full">
                    <Link to="/escola/professores">
                      <GraduationCap className="size-4" /> Professores e vínculos
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="rounded-full">
                    <Link to="/escola/turmas">
                      <BookOpen className="size-4" /> Turmas
                    </Link>
                  </Button>
                </div>
              </div>
            )}

            {isDeveloper && <SeedAcademicCard />}

            <div className="mt-6 rounded-3xl border border-primary/20 bg-card p-6 shadow-sm">
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
                <GraduationCap className="size-5 text-primary" /> Área dos responsáveis
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Acompanhe notas, frequência e comunicados dos seus filhos.
              </p>
              <Button asChild className="mt-4 rounded-full" variant="outline">
                <Link to="/meus-filhos">
                  <GraduationCap className="size-4" /> Meus filhos
                </Link>
              </Button>
              <Button asChild className="ml-2 mt-4 rounded-full" variant="outline">
                <Link to="/meus-comunicados">
                  <FileText className="size-4" /> Meus comunicados
                </Link>
              </Button>
            </div>

            {isStaff ? (
              <div className="mt-6 rounded-3xl border border-border/70 bg-card p-6 shadow-sm">
                <h2 className="font-display text-lg font-semibold text-foreground">
                  Acesso rápido
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Como {isAdmin ? "administrador" : "membro da equipe"}, use a barra lateral para
                  navegar entre as áreas. Aqui ficam os atalhos principais.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Button asChild variant="outline" className="justify-start rounded-xl">
                    <Link to="/painel-anotacoes">
                      <NotebookPen className="size-4" /> Anotações & Lembretes
                    </Link>
                  </Button>
                  <Button asChild className="justify-start rounded-xl">
                    <Link to="/painel-posts">
                      <FileText className="size-4" /> Publicações
                    </Link>
                  </Button>
                  {(hasRole("desenvolvedor") || hasRole("diretor") || hasRole("coordenador")) && (
                    <Button asChild variant="secondary" className="justify-start rounded-xl">
                      <Link to="/painel-aprovacao">
                        <CheckCircle2 className="size-4" /> Fila de aprovação
                      </Link>
                    </Button>
                  )}
                  <Button asChild variant="outline" className="justify-start rounded-xl">
                    <Link to="/calendario">
                      <Calendar className="size-4" /> Calendário
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="justify-start rounded-xl">
                    <Link to="/horarios">
                      <Clock className="size-4" /> Horários
                    </Link>
                  </Button>
                  {hasRole("professor") && (
                    <Button asChild variant="outline" className="justify-start rounded-xl">
                      <Link to="/minhas-turmas">
                        <BookOpen className="size-4" /> Minhas turmas
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-3xl border border-border/70 bg-card p-6 shadow-sm">
                <p className="text-sm text-muted-foreground">
                  Sua conta ainda não possui permissões de equipe. Entre em contato com um
                  administrador para receber acesso de professor ou diretor.
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
}

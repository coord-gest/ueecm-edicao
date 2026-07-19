import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2, UserPlus, ShieldAlert, Eye, EyeOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input as SearchInput } from "@/components/ui/input";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  assignUserRole,
  createSchoolUser,
  deleteSchoolUser,
  listSchoolUsers,
} from "@/lib/admin-users.functions";
import { useAuth } from "@/lib/use-auth";
import logo from "@/assets/logo.png";

import { PainelLayout } from "@/components/PainelLayout";

export const Route = createFileRoute("/usuarios")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Gerenciar Usuários | U.E. - Evaristo Campelo de Matos" }],
  }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/login" });
    }
  },
  component: Usuarios,
});

const roleOptions = [
  { value: "diretor", label: "Diretor" },
  { value: "coordenador", label: "Coordenador" },
  { value: "secretario", label: "Secretário" },
] as const;

const roleLabels: Record<string, string> = {
  desenvolvedor: "Desenvolvedor",
  admin: "Administrador",
  diretor: "Diretor",
  coordenador: "Coordenador",
  professor: "Professor",
  secretario: "Secretário",
  leitor: "Leitor",
};

function AcessoRestrito() {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-secondary px-4 text-center">
      <ShieldAlert className="size-10 text-destructive" />
      <h1 className="font-display text-xl font-semibold text-foreground">Acesso restrito</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Apenas Desenvolvedor ou Diretor podem cadastrar e gerenciar usuários.
      </p>
      <Button
        onClick={() => navigate({ to: "/painel" })}
        variant="outline"
        className="rounded-full"
      >
        Voltar ao painel
      </Button>
    </div>
  );
}

function Usuarios() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const listFn = useServerFn(listSchoolUsers);
  const createFn = useServerFn(createSchoolUser);
  const deleteFn = useServerFn(deleteSchoolUser);
  const assignRoleFn = useServerFn(assignUserRole);

  // Guard de role no cliente: bloqueia antes mesmo de chamar o servidor
  const {
    isDeveloper,
    hasRole,
    user,
    roles,
    rolesError,
    refreshRoles,
    loading: authLoading,
  } = useAuth();
  const canManage = isDeveloper || hasRole("diretor");

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [nome, setNome] = useState("");
  const [role, setRole] = useState<(typeof roleOptions)[number]["value"]>("diretor");
  const [activeTab, setActiveTab] = useState<
    "gestao" | "professores" | "funcionarios" | "familias" | "sem-cargo"
  >("gestao");
  const [searchTerm, setSearchTerm] = useState("");

  const {
    data: users,
    isLoading,
    error: listError,
  } = useQuery({
    queryKey: ["school-users"],
    queryFn: () => listFn(),
    retry: false,
    // Só executa quando o auth já carregou e o usuário é gestor (dev ou diretor)
    enabled: !authLoading && canManage,
  });

  const mutation = useMutation({
    mutationFn: (vars: {
      email: string;
      password: string;
      displayName: string;
      role: (typeof roleOptions)[number]["value"];
    }) => createFn({ data: vars }),
    onSuccess: (res) => {
      if (res?.error) {
        toast.error("Não foi possível cadastrar", { description: res.error });
        return;
      }
      toast.success("Usuário cadastrado com sucesso!");
      setEmail("");
      setSenha("");
      setNome("");
      setRole("diretor");
      queryClient.invalidateQueries({ queryKey: ["school-users"] });
    },
    onError: (e: unknown) => {
      toast.error("Erro ao cadastrar", {
        description: e instanceof Error ? e.message : "Tente novamente.",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => deleteFn({ data: { userId } }),
    onSuccess: (res) => {
      if (res?.error) {
        toast.error("Não foi possível excluir", { description: res.error });
        return;
      }
      toast.success("Usuário excluído com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["school-users"] });
    },
    onError: (e: unknown) => {
      toast.error("Erro ao excluir", {
        description: e instanceof Error ? e.message : "Tente novamente.",
      });
    },
  });

  type AssignableRole =
    "desenvolvedor" | "admin" | "diretor" | "coordenador" | "professor" | "secretario" | "family";

  const assignRoleMutation = useMutation({
    mutationFn: (vars: { userId: string; role: AssignableRole }) => assignRoleFn({ data: vars }),
    onSuccess: (res) => {
      if (res?.error) {
        toast.error("Não foi possível atribuir o papel", { description: res.error });
        return;
      }
      toast.success("Papel atualizado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["school-users"] });
    },
    onError: (e: unknown) => {
      toast.error("Erro ao atribuir papel", {
        description: e instanceof Error ? e.message : "Tente novamente.",
      });
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      email: email.trim(),
      password: senha,
      displayName: nome.trim(),
      role,
    });
  };

  // Aguarda o auth carregar antes de decidir o que renderizar
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Se os papéis não chegaram (sessão antiga, GRANT recém aplicado, falha de rede),
  // NÃO mostre "Acesso restrito" — mostre um fallback com retry e diagnóstico.
  if (roles.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-secondary px-4 text-center">
        <ShieldAlert className="size-10 text-amber-500" />
        <h1 className="font-display text-xl font-semibold text-foreground">
          Não conseguimos carregar seus papéis
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Sua sessão pode estar desatualizada. Clique em <strong>Atualizar papéis</strong> ou saia e
          entre novamente.
        </p>
        {rolesError && (
          <p className="max-w-md rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {rolesError}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button onClick={() => refreshRoles()} className="rounded-full">
            Atualizar papéis
          </Button>
          <Button
            variant="outline"
            className="rounded-full"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/login" });
            }}
          >
            Sair e entrar de novo
          </Button>
          <Button
            variant="ghost"
            className="rounded-full"
            onClick={() => navigate({ to: "/painel-diagnostico" })}
          >
            Diagnóstico
          </Button>
        </div>
      </div>
    );
  }

  // Bloqueia no cliente se não for desenvolvedor ou diretor (agora com certeza dos papéis)
  if (!canManage) {
    return <AcessoRestrito />;
  }

  // Erro do servidor (ex: token expirado, problema de rede)
  if (listError) {
    return <AcessoRestrito />;
  }

  return (
    <PainelLayout>
      <div className="min-h-screen bg-secondary">
        <header className="border-b border-border/60 bg-background/85 backdrop-blur-lg">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <img src={logo} alt="Logo" className="h-10 w-10" width={512} height={512} />
              <div className="leading-tight">
                <p className="font-display text-lg font-semibold text-primary">
                  Gerenciar Usuários
                </p>
                <p className="text-xs text-muted-foreground">U.E. - Evaristo Campelo de Matos</p>
              </div>
            </div>
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/painel">
                <ArrowLeft className="size-4" /> Painel
              </Link>
            </Button>
          </div>
        </header>

        <main className="mx-auto grid max-w-5xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[360px_1fr]">
          <section className="rounded-3xl border border-border/70 bg-card p-6 shadow-sm">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
              <UserPlus className="size-5 text-primary" /> Cadastrar usuário
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Contas administrativas: Diretor, Coordenador ou Secretário. Professores e Pais são
              cadastrados na aba Acadêmica.
            </p>
            <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <Label htmlFor="nome">Nome completo</Label>
                <Input
                  id="nome"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Nome do usuário"
                  className="rounded-full"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@email.com"
                  className="rounded-full"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="senha">Senha provisória</Label>
                <div className="relative">
                  <Input
                    id="senha"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="rounded-full pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Cargo</Label>
                <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
                  <SelectTrigger className="rounded-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full rounded-full" type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="size-4 animate-spin" />} Cadastrar
                usuário
              </Button>
            </form>
          </section>

          <section className="rounded-3xl border border-border/70 bg-card p-6 shadow-sm">
            <h2 className="font-display text-lg font-semibold text-foreground">
              Usuários cadastrados
            </h2>
            {isLoading ? (
              <div className="mt-6 flex justify-center">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              (() => {
                const allUsers = users ?? [];
                const categorize = (
                  roles: string[],
                ): "gestao" | "professores" | "funcionarios" | "familias" | "sem-cargo" => {
                  if (roles.length === 0) return "sem-cargo";
                  if (
                    roles.some((r) =>
                      ["desenvolvedor", "admin", "diretor", "coordenador"].includes(r),
                    )
                  )
                    return "gestao";
                  if (roles.includes("professor")) return "professores";
                  if (roles.includes("secretario")) return "funcionarios";
                  if (roles.includes("leitor")) return "familias";
                  return "sem-cargo";
                };
                const term = searchTerm.trim().toLowerCase();
                const matchesSearch = (u: (typeof allUsers)[number]) => {
                  if (!term) return true;
                  return (
                    (u.displayName ?? "").toLowerCase().includes(term) ||
                    (u.email ?? "").toLowerCase().includes(term)
                  );
                };
                const byCategory = {
                  gestao: allUsers.filter((u) => categorize(u.roles) === "gestao"),
                  professores: allUsers.filter((u) => categorize(u.roles) === "professores"),
                  funcionarios: allUsers.filter((u) => categorize(u.roles) === "funcionarios"),
                  familias: allUsers.filter((u) => categorize(u.roles) === "familias"),
                  "sem-cargo": allUsers.filter((u) => categorize(u.roles) === "sem-cargo"),
                } as const;

                const renderRow = (u: (typeof allUsers)[number]) => {
                  const isSelf = u.userId === user?.id;
                  const targetIsDev = u.roles.includes("desenvolvedor");
                  const canDelete = !isSelf && (isDeveloper || !targetIsDev);
                  return (
                    <li
                      key={u.userId}
                      className="flex flex-wrap items-center justify-between gap-2 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">
                          {u.displayName ?? u.email}
                        </p>
                        <p className="truncate text-sm text-muted-foreground">{u.email}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {u.roles.length === 0 ? (
                          <Badge variant="secondary">Sem cargo</Badge>
                        ) : (
                          u.roles.map((r) => (
                            <Badge
                              key={r}
                              variant={r === "desenvolvedor" ? "default" : "secondary"}
                            >
                              {roleLabels[r] ?? r}
                            </Badge>
                          ))
                        )}
                        {isDeveloper && !isSelf && (
                          <Select
                            value={u.roles[0] ?? ""}
                            onValueChange={(v) =>
                              assignRoleMutation.mutate({
                                userId: u.userId,
                                role: v as AssignableRole,
                              })
                            }
                            disabled={assignRoleMutation.isPending}
                          >
                            <SelectTrigger
                              className="h-8 w-[170px] rounded-full text-xs"
                              aria-label="Atribuir papel"
                            >
                              <SelectValue placeholder="Atribuir papel" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="desenvolvedor">Desenvolvedor</SelectItem>
                              <SelectItem value="admin">Administrador</SelectItem>
                              <SelectItem value="diretor">Diretor</SelectItem>
                              <SelectItem value="coordenador">Coordenador</SelectItem>
                              <SelectItem value="secretario">Secretário</SelectItem>
                              <SelectItem value="professor">Professor</SelectItem>
                              <SelectItem value="family">Responsável</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                        {canDelete && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                aria-label={`Excluir ${u.displayName ?? u.email}`}
                                disabled={deleteMutation.isPending}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta ação não pode ser desfeita. O acesso de{" "}
                                  <strong>{u.displayName ?? u.email}</strong> será removido
                                  permanentemente.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => deleteMutation.mutate(u.userId)}
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </li>
                  );
                };

                const renderList = (
                  list: readonly (typeof allUsers)[number][],
                  emptyMsg: string,
                ) => {
                  const filtered = list.filter(matchesSearch);
                  if (filtered.length === 0) {
                    return (
                      <p className="py-6 text-center text-sm text-muted-foreground">
                        {term ? "Nenhum resultado para a busca." : emptyMsg}
                      </p>
                    );
                  }
                  return <ul className="divide-y divide-border/60">{filtered.map(renderRow)}</ul>;
                };

                return (
                  <div className="mt-4 space-y-4">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <SearchInput
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar por nome ou e-mail…"
                        className="rounded-full pl-9"
                      />
                    </div>
                    <Tabs
                      value={activeTab}
                      onValueChange={(v) => setActiveTab(v as typeof activeTab)}
                    >
                      <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-muted/60 p-1">
                        <TabsTrigger value="gestao" className="rounded-full">
                          Gestão Escolar ({byCategory.gestao.length})
                        </TabsTrigger>
                        <TabsTrigger value="professores" className="rounded-full">
                          Professores ({byCategory.professores.length})
                        </TabsTrigger>
                        <TabsTrigger value="funcionarios" className="rounded-full">
                          Demais Funcionários ({byCategory.funcionarios.length})
                        </TabsTrigger>
                        <TabsTrigger value="familias" className="rounded-full">
                          Pais e Responsáveis ({byCategory.familias.length})
                        </TabsTrigger>
                        {byCategory["sem-cargo"].length > 0 && (
                          <TabsTrigger value="sem-cargo" className="rounded-full">
                            Sem cargo ({byCategory["sem-cargo"].length})
                          </TabsTrigger>
                        )}
                      </TabsList>
                      <TabsContent value="gestao" className="mt-4">
                        {renderList(
                          byCategory.gestao,
                          "Nenhum usuário de gestão cadastrado ainda.",
                        )}
                      </TabsContent>
                      <TabsContent value="professores" className="mt-4">
                        {renderList(byCategory.professores, "Nenhum professor cadastrado ainda.")}
                      </TabsContent>
                      <TabsContent value="funcionarios" className="mt-4">
                        {renderList(
                          byCategory.funcionarios,
                          "Nenhum funcionário cadastrado ainda.",
                        )}
                      </TabsContent>
                      <TabsContent value="familias" className="mt-4">
                        {renderList(
                          byCategory.familias,
                          "Nenhum responsável cadastrado ainda.",
                        )}
                      </TabsContent>
                      <TabsContent value="sem-cargo" className="mt-4">
                        {renderList(byCategory["sem-cargo"], "Nenhum usuário sem cargo.")}
                      </TabsContent>
                    </Tabs>
                  </div>
                );
              })()
            )}
          </section>
        </main>
      </div>
    </PainelLayout>
  );
}

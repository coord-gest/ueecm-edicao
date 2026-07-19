import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Users,
  Link2,
  X,
  UserPlus,
  Eye,
  EyeOff,
  Search,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { AccessDenied, EscolaShell, useIsSchoolAdmin } from "@/components/escola/EscolaShell";
import { EmptyState } from "@/components/EmptyState";
import { TableRowsSkeleton } from "@/components/TableRowsSkeleton";
import { createSchoolUser } from "@/lib/admin-users.functions";
import { useRolePainelGuard } from "@/lib/use-role-guard";
import { useAdminAccessAudit } from "@/lib/use-admin-access-audit";

export const Route = createFileRoute("/escola/responsaveis")({
  ssr: false,
  head: () => ({ meta: [{ title: "Responsáveis | Escola" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: ResponsaveisPage,
});

type Responsavel = {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  user_id: string | null;
};
type Aluno = { id: string; nome_completo: string; matricula: string; turma_id: string | null };
type Turma = { id: string; nome: string };
type Vinculo = {
  id: string;
  aluno_id: string;
  responsavel_id: string;
  parentesco: string | null;
  principal: boolean;
};

function ResponsaveisPage() {
  useRolePainelGuard(["diretor", "coordenador", "desenvolvedor"]);
  useAdminAccessAudit("/escola/responsaveis");
  const qc = useQueryClient();
  const { hasRole, loading } = useAuth();
  const isAdmin = useIsSchoolAdmin(hasRole);

  const [editing, setEditing] = useState<Responsavel | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Responsavel | null>(null);
  const [linking, setLinking] = useState<Responsavel | null>(null);
  const [creatingLogin, setCreatingLogin] = useState(false);

  const createUserFn = useServerFn(createSchoolUser);

  const { data: resps, isLoading } = useQuery({
    queryKey: ["escola-responsaveis"],
    queryFn: async () => {
      const { data, error } = await supabase.from("responsaveis").select("*").order("nome");
      if (error) throw error;
      return (data ?? []) as Responsavel[];
    },
    enabled: isAdmin,
  });

  const { data: alunos } = useQuery({
    queryKey: ["escola-alunos-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alunos")
        .select("id, nome_completo, matricula, turma_id")
        .order("nome_completo");
      if (error) throw error;
      return (data ?? []) as Aluno[];
    },
    enabled: isAdmin,
  });

  const { data: turmas } = useQuery({
    queryKey: ["escola-turmas-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("turmas_escolares")
        .select("id, nome")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Turma[];
    },
    enabled: isAdmin,
  });

  const { data: vinculos } = useQuery({
    queryKey: ["escola-vinculos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("aluno_responsavel").select("*");
      if (error) throw error;
      return (data ?? []) as Vinculo[];
    },
    enabled: isAdmin,
  });

  const vinculosByResp = useMemo(() => {
    const m = new Map<string, Vinculo[]>();
    vinculos?.forEach((v) => {
      if (!m.has(v.responsavel_id)) m.set(v.responsavel_id, []);
      m.get(v.responsavel_id)!.push(v);
    });
    return m;
  }, [vinculos]);

  const alunoById = useMemo(() => {
    const m = new Map<string, Aluno>();
    alunos?.forEach((a) => m.set(a.id, a));
    return m;
  }, [alunos]);

  const turmaById = useMemo(() => {
    const m = new Map<string, Turma>();
    turmas?.forEach((t) => m.set(t.id, t));
    return m;
  }, [turmas]);

  const [search, setSearch] = useState("");
  const [filterTurma, setFilterTurma] = useState<string>("__all__");

  const filteredResps = useMemo(() => {
    if (!resps) return [];
    const q = search.trim().toLowerCase();
    return resps.filter((r) => {
      const vs = vinculosByResp.get(r.id) ?? [];
      const alunosVinc = vs.map((v) => alunoById.get(v.aluno_id)).filter(Boolean) as Aluno[];

      // Filtro por turma: pelo menos um aluno vinculado precisa ser da turma
      if (filterTurma !== "__all__") {
        if (!alunosVinc.some((a) => a.turma_id === filterTurma)) return false;
      }

      if (!q) return true;
      const respHit =
        r.nome.toLowerCase().includes(q) ||
        (r.email ?? "").toLowerCase().includes(q) ||
        (r.telefone ?? "").toLowerCase().includes(q);
      const alunoHit = alunosVinc.some((a) =>
        `${a.nome_completo} ${a.matricula}`.toLowerCase().includes(q),
      );
      return respHit || alunoHit;
    });
  }, [resps, search, filterTurma, vinculosByResp, alunoById]);

  const saveMut = useMutation({
    mutationFn: async (payload: Partial<Responsavel> & { id?: string }) => {
      if (payload.id) {
        const { id, ...rest } = payload;
        const { error } = await supabase.from("responsaveis").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("responsaveis").insert(payload as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Responsável salvo.");
      qc.invalidateQueries({ queryKey: ["escola-responsaveis"] });
      setEditing(null);
      setCreating(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("responsaveis").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Responsável removido.");
      qc.invalidateQueries({ queryKey: ["escola-responsaveis"] });
      qc.invalidateQueries({ queryKey: ["escola-vinculos"] });
      setDeleting(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addVinculo = useMutation({
    mutationFn: async (p: {
      responsavel_id: string;
      aluno_id: string;
      parentesco: string;
      principal: boolean;
    }) => {
      const { error } = await supabase.from("aluno_responsavel").insert(p as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vínculo criado.");
      qc.invalidateQueries({ queryKey: ["escola-vinculos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delVinculo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("aluno_responsavel").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["escola-vinculos"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const createLoginMut = useMutation({
    mutationFn: (vars: {
      displayName: string;
      email: string;
      password: string;
      telefone?: string;
      alunoIds: string[];
      parentesco: string;
    }) =>
      createUserFn({
        data: {
          displayName: vars.displayName,
          email: vars.email,
          password: vars.password,
          telefone: vars.telefone,
          role: "family",
          alunoIds: vars.alunoIds,
          parentesco: vars.parentesco,
        },
      }),
    onSuccess: (res) => {
      if (res?.error) {
        toast.error("Não foi possível criar conta", { description: res.error });
        return;
      }
      toast.success("Conta de responsável criada e vinculada ao aluno.");
      qc.invalidateQueries({ queryKey: ["escola-responsaveis"] });
      qc.invalidateQueries({ queryKey: ["escola-vinculos"] });
      setCreatingLogin(false);
    },
    onError: (e: unknown) =>
      toast.error("Erro ao criar conta", {
        description: e instanceof Error ? e.message : "Tente novamente.",
      }),
  });

  if (loading) return null;
  if (!isAdmin) return <AccessDenied />;

  return (
    <EscolaShell
      title="Pais e responsáveis"
      description="Cadastre responsáveis e vincule-os aos alunos. O acesso de cada pai é restrito aos próprios filhos."
      current="Responsáveis"
      actions={
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setCreatingLogin(true)} className="rounded-full">
            <UserPlus className="size-4" /> Novo responsável com login
          </Button>
          <Button variant="outline" onClick={() => setCreating(true)} className="rounded-full">
            <Plus className="size-4" /> Sem login (apenas contato)
          </Button>
        </div>
      }
    >
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por responsável, aluno, e-mail ou telefone…"
            className="pl-9"
          />
        </div>
        <div className="sm:w-64">
          <Select value={filterTurma} onValueChange={setFilterTurma}>
            <SelectTrigger>
              <SelectValue placeholder="Todas as turmas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas as turmas</SelectItem>
              {turmas?.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {(search || filterTurma !== "__all__") && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              setFilterTurma("__all__");
            }}
          >
            Limpar
          </Button>
        )}
      </div>
      {!isLoading && resps && resps.length > 0 && (
        <p className="mb-2 text-xs text-muted-foreground">
          {filteredResps.length} de {resps.length} responsável(is)
        </p>
      )}

      <div className="rounded-2xl border border-border/70 bg-card shadow-sm">
        {!isLoading && resps?.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Nenhum responsável cadastrado"
            description="Cadastre um responsável e vincule-o aos alunos correspondentes."
            action={
              <Button onClick={() => setCreating(true)} size="sm" className="rounded-full">
                <Plus className="size-4" /> Novo responsável
              </Button>
            }
            className="border-0"
          />
        ) : !isLoading && filteredResps.length === 0 ? (
          <EmptyState
            icon={Search}
            title="Nenhum resultado"
            description="Ajuste a busca ou o filtro de turma para encontrar o responsável."
            className="border-0"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Contato</th>
                  <th className="px-4 py-3">Filhos vinculados</th>
                  <th className="px-4 py-3">Conta</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              {isLoading ? (
                <TableRowsSkeleton rows={5} cols={5} />
              ) : (
                <tbody>
                  {filteredResps.map((r) => {
                    const vs = vinculosByResp.get(r.id) ?? [];
                    return (
                      <tr key={r.id} className="border-b last:border-0 align-top">
                        <td className="px-4 py-3 font-medium">{r.nome}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <span>{r.email ?? "—"}</span>
                            {r.email && (
                              <a
                                href={`mailto:${r.email}`}
                                className="text-xs text-primary underline"
                                title="Enviar e-mail"
                              >
                                e-mail
                              </a>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span>{r.telefone ?? ""}</span>
                            {r.telefone && (
                              <a
                                href={`https://wa.me/${r.telefone.replace(/\D/g, "")}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary underline"
                                title="Abrir conversa no WhatsApp"
                              >
                                WhatsApp
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {vs.length === 0 ? (
                            <span className="text-xs text-muted-foreground">Sem vínculos</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {vs.map((v) => {
                                const a = alunoById.get(v.aluno_id);
                                const turmaNome = a?.turma_id
                                  ? turmaById.get(a.turma_id)?.nome
                                  : null;
                                return (
                                  <Badge key={v.id} variant="secondary" className="gap-1">
                                    {a?.nome_completo ?? v.aluno_id.slice(0, 6)}
                                    {turmaNome && (
                                      <span className="text-[10px] text-muted-foreground">
                                        · {turmaNome}
                                      </span>
                                    )}
                                    {v.principal && (
                                      <span className="text-[10px]">(principal)</span>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => delVinculo.mutate(v.id)}
                                      className="ml-1 opacity-60 hover:opacity-100"
                                    >
                                      <X className="size-3" />
                                    </button>
                                  </Badge>
                                );
                              })}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {r.user_id ? (
                            <span className="text-emerald-600">Vinculada</span>
                          ) : (
                            <span className="text-muted-foreground">Sem login</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <Button size="icon" variant="ghost" aria-label={`Vincular alunos ao responsável ${r.nome}`} onClick={() => setLinking(r)}>
                            <Link2 className="size-4" />
                          </Button>
                          <Button size="icon" variant="ghost" aria-label={`Editar responsável ${r.nome}`} onClick={() => setEditing(r)}>
                            <Pencil className="size-4" />
                          </Button>
                          <Button size="icon" variant="ghost" aria-label={`Excluir responsável ${r.nome}`} onClick={() => setDeleting(r)}>
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              )}
            </table>
          </div>
        )}
      </div>

      <RespFormDialog
        open={creating || !!editing}
        resp={editing}
        onClose={() => {
          setEditing(null);
          setCreating(false);
        }}
        onSave={(p) => saveMut.mutate(p)}
        saving={saveMut.isPending}
      />

      <LinkDialog
        resp={linking}
        alunos={alunos ?? []}
        existing={linking ? (vinculosByResp.get(linking.id) ?? []) : []}
        onClose={() => setLinking(null)}
        onAdd={(p) => addVinculo.mutate(p)}
        adding={addVinculo.isPending}
      />

      <NovoRespComLoginDialog
        open={creatingLogin}
        alunos={alunos ?? []}
        turmas={turmas ?? []}
        onClose={() => setCreatingLogin(false)}
        onSave={(p) => createLoginMut.mutate(p)}
        saving={createLoginMut.isPending}
      />

      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover responsável</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove <strong>{deleting?.nome}</strong> e todos os vínculos com alunos. A
              conta de login (se houver) não é apagada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleting && delMut.mutate(deleting.id)}
              className="bg-destructive text-destructive-foreground"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </EscolaShell>
  );
}

function RespFormDialog({
  open,
  resp,
  onClose,
  onSave,
  saving,
}: {
  open: boolean;
  resp: Responsavel | null;
  onClose: () => void;
  onSave: (p: Partial<Responsavel> & { id?: string }) => void;
  saving: boolean;
}) {
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    onSave({
      id: resp?.id,
      nome: String(f.get("nome") ?? "").trim(),
      email: String(f.get("email") ?? "").trim() || null,
      telefone: String(f.get("telefone") ?? "").trim() || null,
    });
  }
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{resp ? "Editar responsável" : "Novo responsável"}</DialogTitle>
          <DialogDescription>
            O e-mail usado aqui deve ser o mesmo do login para conceder acesso ao app.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label htmlFor="nome">Nome</Label>
            <Input id="nome" name="nome" required defaultValue={resp?.nome ?? ""} />
          </div>
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" defaultValue={resp?.email ?? ""} />
          </div>
          <div>
            <Label htmlFor="telefone">Telefone</Label>
            <Input id="telefone" name="telefone" defaultValue={resp?.telefone ?? ""} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LinkDialog({
  resp,
  alunos,
  existing,
  onClose,
  onAdd,
  adding,
}: {
  resp: Responsavel | null;
  alunos: Aluno[];
  existing: Vinculo[];
  onClose: () => void;
  onAdd: (p: {
    responsavel_id: string;
    aluno_id: string;
    parentesco: string;
    principal: boolean;
  }) => void;
  adding: boolean;
}) {
  const [alunoId, setAlunoId] = useState<string>("");
  const [parentesco, setParentesco] = useState("Mãe");
  const [principal, setPrincipal] = useState(false);

  const existingIds = new Set(existing.map((e) => e.aluno_id));
  const available = alunos.filter((a) => !existingIds.has(a.id));

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!resp || !alunoId) return;
    onAdd({ responsavel_id: resp.id, aluno_id: alunoId, parentesco, principal });
    setAlunoId("");
  }

  return (
    <Dialog open={!!resp} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Vincular filho a {resp?.nome}</DialogTitle>
          <DialogDescription>O responsável passa a ver dados deste aluno.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label>Aluno</Label>
            <Select value={alunoId} onValueChange={setAlunoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um aluno" />
              </SelectTrigger>
              <SelectContent>
                {available.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.nome_completo} ({a.matricula})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Parentesco</Label>
              <Select value={parentesco} onValueChange={setParentesco}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Mãe">Mãe</SelectItem>
                  <SelectItem value="Pai">Pai</SelectItem>
                  <SelectItem value="Responsável legal">Responsável legal</SelectItem>
                  <SelectItem value="Avó/Avô">Avó/Avô</SelectItem>
                  <SelectItem value="Tio/Tia">Tio/Tia</SelectItem>
                  <SelectItem value="Outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={principal}
                  onChange={(e) => setPrincipal(e.target.checked)}
                />
                Contato principal
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Fechar
            </Button>
            <Button type="submit" disabled={adding || !alunoId}>
              {adding && <Loader2 className="size-4 animate-spin" />} Vincular
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type NovaContaResp = {
  displayName: string;
  email: string;
  password: string;
  telefone?: string;
  alunoIds: string[];
  parentesco: string;
};

function NovoRespComLoginDialog({
  open,
  alunos,
  turmas,
  onClose,
  onSave,
  saving,
}: {
  open: boolean;
  alunos: Aluno[];
  turmas: Turma[];
  onClose: () => void;
  onSave: (p: NovaContaResp) => void;
  saving: boolean;
}) {
  const [turmaId, setTurmaId] = useState<string>("");
  const [selected, setSelected] = useState<string[]>([]);
  const [parentesco, setParentesco] = useState("Mãe");
  const [showPassword, setShowPassword] = useState(false);

  const turmaNome = useMemo(() => {
    const m = new Map<string, string>();
    turmas.forEach((t) => m.set(t.id, t.nome));
    return m;
  }, [turmas]);
  const alunoById = useMemo(() => {
    const m = new Map<string, Aluno>();
    alunos.forEach((a) => m.set(a.id, a));
    return m;
  }, [alunos]);
  const alunosDaTurma = useMemo(() => {
    if (!turmaId) return [];
    return alunos.filter((a) => a.turma_id === turmaId);
  }, [alunos, turmaId]);

  function toggleAluno(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (selected.length === 0) {
      toast.error("Selecione pelo menos um aluno para vincular.");
      return;
    }
    onSave({
      displayName: String(f.get("nome") ?? "").trim(),
      email: String(f.get("email") ?? "").trim(),
      password: String(f.get("senha") ?? ""),
      telefone: String(f.get("telefone") ?? "").trim() || undefined,
      alunoIds: selected,
      parentesco,
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          onClose();
          setSelected([]);
          setTurmaId("");
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo responsável com login</DialogTitle>
          <DialogDescription>
            Cria uma conta de acesso vinculada a um ou mais alunos. O responsável só verá dados
            dos filhos vinculados.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label htmlFor="resp-nome">Nome completo</Label>
            <Input id="resp-nome" name="nome" required />
          </div>
          <div>
            <Label htmlFor="resp-email">E-mail (login)</Label>
            <Input id="resp-email" name="email" type="email" required />
          </div>
          <div>
            <Label htmlFor="resp-senha">Senha provisória</Label>
            <div className="relative">
              <Input
                id="resp-senha"
                name="senha"
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                className="pr-10"
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
          <div>
            <Label htmlFor="resp-tel">Telefone (opcional)</Label>
            <Input id="resp-tel" name="telefone" />
          </div>
          <div>
            <Label>1. Turma</Label>
            <Select value={turmaId} onValueChange={setTurmaId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a turma" />
              </SelectTrigger>
              <SelectContent>
                {turmas.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>
              2. Alunos vinculados{" "}
              <span className="text-xs text-muted-foreground">
                (marque um ou mais — pode trocar de turma para adicionar de outras)
              </span>
            </Label>
            {!turmaId ? (
              <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                Selecione uma turma para listar os alunos.
              </p>
            ) : alunosDaTurma.length === 0 ? (
              <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                Nenhum aluno nesta turma.
              </p>
            ) : (
              <div className="max-h-48 overflow-y-auto rounded-md border p-2 space-y-1">
                {alunosDaTurma.map((a) => (
                  <label
                    key={a.id}
                    className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted/50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(a.id)}
                      onChange={() => toggleAluno(a.id)}
                    />
                    <span className="flex-1">{a.nome_completo}</span>
                    <span className="text-xs text-muted-foreground">{a.matricula}</span>
                  </label>
                ))}
              </div>
            )}
            {selected.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {selected.map((id) => {
                  const a = alunoById.get(id);
                  if (!a) return null;
                  return (
                    <Badge key={id} variant="secondary" className="gap-1">
                      {a.nome_completo}
                      <span className="text-[10px] text-muted-foreground">
                        {a.turma_id ? turmaNome.get(a.turma_id) : ""}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleAluno(id)}
                        className="ml-1 opacity-60 hover:opacity-100"
                        aria-label="Remover"
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>
          <div>
            <Label>Parentesco</Label>
            <Select value={parentesco} onValueChange={setParentesco}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Mãe">Mãe</SelectItem>
                <SelectItem value="Pai">Pai</SelectItem>
                <SelectItem value="Responsável legal">Responsável legal</SelectItem>
                <SelectItem value="Avó/Avô">Avó/Avô</SelectItem>
                <SelectItem value="Tio/Tia">Tio/Tia</SelectItem>
                <SelectItem value="Outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || selected.length === 0}>
              {saving && <Loader2 className="size-4 animate-spin" />} Criar conta
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

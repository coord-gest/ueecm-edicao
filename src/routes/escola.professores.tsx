import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { UserCog, Plus, Loader2, Eye, EyeOff, Link2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { AccessDenied, EscolaShell, useIsSchoolAdmin } from "@/components/escola/EscolaShell";
import { EmptyState } from "@/components/EmptyState";
import { TableRowsSkeleton } from "@/components/TableRowsSkeleton";
import { listTeacherProfiles, type TeacherProfile } from "@/lib/school-access.functions";
import { createSchoolUser } from "@/lib/admin-users.functions";

export const Route = createFileRoute("/escola/professores")({
  ssr: false,
  head: () => ({ meta: [{ title: "Professores | Escola" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: ProfessoresPage,
});

type Turma = {
  id: string;
  nome: string;
  ano_letivo: number;
  professor_responsavel_id: string | null;
};

function ProfessoresPage() {
  const { hasRole, loading } = useAuth();
  const isAdmin = useIsSchoolAdmin(hasRole);
  const listTeachers = useServerFn(listTeacherProfiles);
  const createFn = useServerFn(createSchoolUser);
  const qc = useQueryClient();

  const [openNew, setOpenNew] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [linkFor, setLinkFor] = useState<TeacherProfile | null>(null);
  const [selectedTurmas, setSelectedTurmas] = useState<Set<string>>(new Set());

  const { data: professores, isLoading } = useQuery({
    queryKey: ["escola-professores"],
    queryFn: () => listTeachers() as Promise<TeacherProfile[]>,
    enabled: isAdmin,
  });

  const { data: turmas } = useQuery({
    queryKey: ["escola-turmas-prof"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("turmas_escolares")
        .select("id, nome, ano_letivo, professor_responsavel_id");
      if (error) throw error;
      return (data ?? []) as Turma[];
    },
    enabled: isAdmin,
  });

  const createMut = useMutation({
    mutationFn: (vars: { email: string; password: string; displayName: string }) =>
      createFn({ data: { ...vars, role: "professor" } }),
    onSuccess: (res) => {
      if (res?.error) {
        toast.error("Não foi possível cadastrar", { description: res.error });
        return;
      }
      toast.success("Professor cadastrado com sucesso!");
      setNome("");
      setEmail("");
      setSenha("");
      setOpenNew(false);
      qc.invalidateQueries({ queryKey: ["escola-professores"] });
    },
    onError: (e: unknown) =>
      toast.error("Erro ao cadastrar", {
        description: e instanceof Error ? e.message : "Tente novamente.",
      }),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    createMut.mutate({
      email: email.trim(),
      password: senha,
      displayName: nome.trim(),
    });
  };

  const linkMut = useMutation({
    mutationFn: async (vars: { professorId: string; turmaIds: Set<string> }) => {
      // Turmas que devem ficar atribuídas a este professor
      const assignIds = Array.from(vars.turmaIds);
      // Turmas atualmente atribuídas a ele
      const currentIds = (turmas ?? [])
        .filter((t) => t.professor_responsavel_id === vars.professorId)
        .map((t) => t.id);
      const toUnassign = currentIds.filter((id) => !vars.turmaIds.has(id));

      if (assignIds.length > 0) {
        const { error } = await supabase
          .from("turmas_escolares")
          .update({ professor_responsavel_id: vars.professorId })
          .in("id", assignIds);
        if (error) throw error;
      }
      if (toUnassign.length > 0) {
        const { error } = await supabase
          .from("turmas_escolares")
          .update({ professor_responsavel_id: null })
          .in("id", toUnassign);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Turmas atualizadas");
      setLinkFor(null);
      qc.invalidateQueries({ queryKey: ["escola-turmas-prof"] });
      qc.invalidateQueries({ queryKey: ["escola-professores"] });
    },
    onError: (e: unknown) =>
      toast.error("Erro ao vincular turmas", {
        description: e instanceof Error ? e.message : "Tente novamente.",
      }),
  });

  useEffect(() => {
    if (!linkFor) return;
    const owned = (turmas ?? [])
      .filter((t) => t.professor_responsavel_id === linkFor.id)
      .map((t) => t.id);
    setSelectedTurmas(new Set(owned));
  }, [linkFor, turmas]);

  const turmasByProf = useMemo(() => {
    const m = new Map<string, Turma[]>();
    turmas?.forEach((t) => {
      if (!t.professor_responsavel_id) return;
      if (!m.has(t.professor_responsavel_id)) m.set(t.professor_responsavel_id, []);
      m.get(t.professor_responsavel_id)!.push(t);
    });
    return m;
  }, [turmas]);

  if (loading) return null;
  if (!isAdmin) return <AccessDenied />;

  return (
    <EscolaShell
      title="Professores"
      description="Contas de professor com acesso ao painel acadêmico. A atribuição de turmas ocorre na tela de Turmas."
      current="Professores"
      actions={
        <Button onClick={() => setOpenNew(true)} className="rounded-full">
          <Plus className="size-4" /> Novo professor
        </Button>
      }
    >
      <div className="rounded-2xl border border-border/70 bg-card shadow-sm">
        {!isLoading && professores?.length === 0 ? (
          <EmptyState
            icon={UserCog}
            title="Nenhum professor cadastrado"
            description="Clique em “Novo professor” para criar uma conta com o papel de professor."
            action={
              <Button onClick={() => setOpenNew(true)} size="sm" className="rounded-full">
                <Plus className="size-4" /> Novo professor
              </Button>
            }
            className="border-0"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">E-mail</th>
                  <th className="px-4 py-3">Turmas vinculadas</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              {isLoading ? (
                <TableRowsSkeleton rows={4} cols={4} />
              ) : (
                <tbody>
                  {professores?.map((p) => {
                    const ts = turmasByProf.get(p.id) ?? [];
                    return (
                      <tr key={p.id} className="border-b last:border-0 align-top">
                        <td className="px-4 py-3 font-medium">{p.display_name ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{p.email ?? "—"}</td>
                        <td className="px-4 py-3">
                          {ts.length === 0 ? (
                            <span className="text-xs text-muted-foreground">Sem turmas</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {ts.map((t) => (
                                <Badge key={t.id} variant="secondary">
                                  {t.nome} <span className="ml-1 opacity-60">({t.ano_letivo})</span>
                                </Badge>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-full"
                            onClick={() => setLinkFor(p)}
                          >
                            <Link2 className="size-4" /> Vincular turmas
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

      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo professor</DialogTitle>
            <DialogDescription>
              A conta receberá automaticamente o papel “professor” e acesso ao painel acadêmico.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="prof-nome">Nome completo</Label>
              <Input
                id="prof-nome"
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="rounded-full"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prof-email">E-mail</Label>
              <Input
                id="prof-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-full"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prof-senha">Senha provisória</Label>
              <div className="relative">
                <Input
                  id="prof-senha"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
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
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpenNew(false)}
                className="rounded-full"
              >
                Cancelar
              </Button>
              <Button type="submit" className="rounded-full" disabled={createMut.isPending}>
                {createMut.isPending && <Loader2 className="size-4 animate-spin" />} Cadastrar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!linkFor} onOpenChange={(open) => !open && setLinkFor(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vincular turmas</DialogTitle>
            <DialogDescription>
              Selecione as turmas em que <strong>{linkFor?.display_name ?? linkFor?.email}</strong>{" "}
              será o professor responsável. Marcar uma turma que já tem outro responsável irá
              substituí-lo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {(turmas ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma turma cadastrada. Crie turmas primeiro em <em>Escola → Turmas</em>.
              </p>
            ) : (
              (turmas ?? [])
                .slice()
                .sort((a, b) => a.nome.localeCompare(b.nome))
                .map((t) => {
                  const owner = t.professor_responsavel_id;
                  const isMine = owner === linkFor?.id;
                  const isOther = !!owner && !isMine;
                  const checked = selectedTurmas.has(t.id);
                  return (
                    <label
                      key={t.id}
                      className="flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 hover:bg-accent/40"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => {
                          setSelectedTurmas((prev) => {
                            const next = new Set(prev);
                            if (v) next.add(t.id);
                            else next.delete(t.id);
                            return next;
                          });
                        }}
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {t.nome}{" "}
                          <span className="text-xs text-muted-foreground">({t.ano_letivo})</span>
                        </p>
                        {isOther && (
                          <p className="text-xs text-amber-600">
                            Atualmente atribuída a outro professor
                          </p>
                        )}
                      </div>
                    </label>
                  );
                })
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              className="rounded-full"
              onClick={() => setLinkFor(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="rounded-full"
              disabled={linkMut.isPending}
              onClick={() =>
                linkFor && linkMut.mutate({ professorId: linkFor.id, turmaIds: selectedTurmas })
              }
            >
              {linkMut.isPending && <Loader2 className="size-4 animate-spin" />} Salvar vínculos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </EscolaShell>
  );
}

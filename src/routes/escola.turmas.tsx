import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Pencil, Trash2, Loader2, Upload, BookOpen } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { AccessDenied, EscolaShell, useIsSchoolAdmin } from "@/components/escola/EscolaShell";
import { EmptyState } from "@/components/EmptyState";
import { TableRowsSkeleton } from "@/components/TableRowsSkeleton";
import { ImportDialog } from "@/components/escola/ImportDialog";
import { turmaRowSchema, TURMA_TEMPLATE, type TurmaRow } from "@/lib/escola-import";
import { listTeacherProfiles } from "@/lib/school-access.functions";

export const Route = createFileRoute("/escola/turmas")({
  ssr: false,
  head: () => ({ meta: [{ title: "Turmas escolares | Escola" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: TurmasPage,
});

type Turma = {
  id: string;
  nome: string;
  ano_serie: string;
  turno: string;
  ano_letivo: number;
  professor_responsavel_id: string | null;
  observacoes: string | null;
};

type Professor = { id: string; display_name: string | null; email: string | null };

function TurmasPage() {
  const qc = useQueryClient();
  const { hasRole, loading } = useAuth();
  const isAdmin = useIsSchoolAdmin(hasRole);
  const listTeachers = useServerFn(listTeacherProfiles);

  const [editing, setEditing] = useState<Turma | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Turma | null>(null);
  const [importing, setImporting] = useState(false);

  const { data: turmas, isLoading } = useQuery({
    queryKey: ["escola-turmas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("turmas_escolares")
        .select("*")
        .order("ano_letivo", { ascending: false })
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Turma[];
    },
    enabled: isAdmin,
  });

  const { data: professores } = useQuery({
    queryKey: ["escola-professores-select"],
    queryFn: () => listTeachers() as Promise<Professor[]>,
    enabled: isAdmin,
  });

  const profMap = useMemo(() => {
    const m = new Map<string, Professor>();
    professores?.forEach((p) => m.set(p.id, p));
    return m;
  }, [professores]);

  const saveMut = useMutation({
    mutationFn: async (payload: Partial<Turma> & { id?: string }) => {
      if (payload.id) {
        const { id, ...rest } = payload;
        const { error } = await supabase.from("turmas_escolares").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("turmas_escolares").insert(payload as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Turma salva.");
      qc.invalidateQueries({ queryKey: ["escola-turmas"] });
      setEditing(null);
      setCreating(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("turmas_escolares").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Turma removida.");
      qc.invalidateQueries({ queryKey: ["escola-turmas"] });
      setDeleting(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function importCommit(rows: TurmaRow[]) {
    const errors: string[] = [];
    let inserted = 0;
    for (const r of rows) {
      const { error } = await supabase.from("turmas_escolares").insert(r as never);
      if (error) errors.push(`${r.nome}: ${error.message}`);
      else inserted++;
    }
    qc.invalidateQueries({ queryKey: ["escola-turmas"] });
    return { inserted, errors };
  }

  if (loading) return null;
  if (!isAdmin) return <AccessDenied />;

  return (
    <EscolaShell
      title="Turmas escolares"
      description="Cadastro manual ou importação em massa"
      current="Turmas"
      actions={
        <>
          <Button onClick={() => setCreating(true)} className="rounded-full">
            <Plus className="size-4" /> Nova turma
          </Button>
          <Button onClick={() => setImporting(true)} variant="outline" className="rounded-full">
            <Upload className="size-4" /> Importar CSV/Excel
          </Button>
        </>
      }
    >
      <div className="rounded-2xl border border-border/70 bg-card shadow-sm">
        {!isLoading && turmas?.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="Nenhuma turma cadastrada"
            description="Comece criando uma turma ou importe via planilha."
            action={
              <Button onClick={() => setCreating(true)} size="sm" className="rounded-full">
                <Plus className="size-4" /> Nova turma
              </Button>
            }
            className="border-0"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Ano/Série</th>
                  <th className="px-4 py-3">Turno</th>
                  <th className="px-4 py-3">Ano letivo</th>
                  <th className="px-4 py-3">Professor</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              {isLoading ? (
                <TableRowsSkeleton rows={5} cols={6} />
              ) : (
                <tbody>
                  {turmas?.map((t) => {
                    const prof = t.professor_responsavel_id
                      ? profMap.get(t.professor_responsavel_id)
                      : null;
                    return (
                      <tr key={t.id} className="border-b last:border-0">
                        <td className="px-4 py-3 font-medium">{t.nome}</td>
                        <td className="px-4 py-3">{t.ano_serie}</td>
                        <td className="px-4 py-3 capitalize">{t.turno}</td>
                        <td className="px-4 py-3">{t.ano_letivo}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {prof?.display_name ?? prof?.email ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button size="icon" variant="ghost" aria-label={`Editar turma ${t.nome}`} onClick={() => setEditing(t)}>
                            <Pencil className="size-4" />
                          </Button>
                          <Button size="icon" variant="ghost" aria-label={`Excluir turma ${t.nome}`} onClick={() => setDeleting(t)}>
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

      <TurmaFormDialog
        open={creating || !!editing}
        turma={editing}
        professores={professores ?? []}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSave={(payload) => saveMut.mutate(payload)}
        saving={saveMut.isPending}
      />

      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover turma</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove permanentemente a turma <strong>{deleting?.nome}</strong>. Alunos
              vinculados ficarão sem turma.
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

      <ImportDialog
        open={importing}
        onOpenChange={setImporting}
        title="Importar turmas"
        schema={turmaRowSchema}
        templateName="modelo-turmas.csv"
        templateHeaders={TURMA_TEMPLATE.headers}
        templateExample={TURMA_TEMPLATE.example}
        onCommit={importCommit}
        dedupeKey="nome"
        keyOf={(r) => `${String(r.nome).trim().toLowerCase()}|${r.ano_letivo}`}
        loadExistingKeys={async () => {
          const { data, error } = await supabase
            .from("turmas_escolares")
            .select("nome, ano_letivo");
          if (error) throw error;
          return new Set(
            (data ?? []).map((r) => `${String(r.nome).trim().toLowerCase()}|${r.ano_letivo}`),
          );
        }}
      />
    </EscolaShell>
  );
}

function TurmaFormDialog({
  open,
  turma,
  professores,
  onClose,
  onSave,
  saving,
}: {
  open: boolean;
  turma: Turma | null;
  professores: Professor[];
  onClose: () => void;
  onSave: (payload: Partial<Turma> & { id?: string }) => void;
  saving: boolean;
}) {
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const prof = String(f.get("professor") ?? "");
    onSave({
      id: turma?.id,
      nome: String(f.get("nome") ?? "").trim(),
      ano_serie: String(f.get("ano_serie") ?? "").trim(),
      turno: String(f.get("turno") ?? "manha"),
      ano_letivo: Number(f.get("ano_letivo") ?? new Date().getFullYear()),
      professor_responsavel_id: prof && prof !== "__none__" ? prof : null,
      observacoes: String(f.get("observacoes") ?? "").trim() || null,
    });
  }
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{turma ? "Editar turma" : "Nova turma"}</DialogTitle>
          <DialogDescription>Defina turno, série e professor responsável.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label htmlFor="nome">Nome</Label>
            <Input id="nome" name="nome" required defaultValue={turma?.nome ?? ""} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ano_serie">Ano / Série</Label>
              <Input
                id="ano_serie"
                name="ano_serie"
                required
                defaultValue={turma?.ano_serie ?? ""}
              />
            </div>
            <div>
              <Label htmlFor="ano_letivo">Ano letivo</Label>
              <Input
                id="ano_letivo"
                name="ano_letivo"
                type="number"
                min={2000}
                max={2100}
                defaultValue={turma?.ano_letivo ?? new Date().getFullYear()}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="turno">Turno</Label>
              <Select name="turno" defaultValue={turma?.turno ?? "manha"}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manha">Manhã</SelectItem>
                  <SelectItem value="tarde">Tarde</SelectItem>
                  <SelectItem value="noite">Noite</SelectItem>
                  <SelectItem value="integral">Integral</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="professor">Professor responsável</Label>
              <Select name="professor" defaultValue={turma?.professor_responsavel_id ?? "__none__"}>
                <SelectTrigger>
                  <SelectValue placeholder="Sem responsável" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Nenhum —</SelectItem>
                  {professores.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.display_name || p.email || p.id.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="observacoes">Observações</Label>
            <Input id="observacoes" name="observacoes" defaultValue={turma?.observacoes ?? ""} />
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

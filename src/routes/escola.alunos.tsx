import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Upload,
  GraduationCap,
  Search,
  Download,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { AccessDenied, EscolaShell, useIsSchoolAdmin } from "@/components/escola/EscolaShell";
import { ImportDialog } from "@/components/escola/ImportDialog";
import { EmptyState } from "@/components/EmptyState";
import { TableRowsSkeleton } from "@/components/TableRowsSkeleton";
import { alunoRowSchema, ALUNO_TEMPLATE, type AlunoRow } from "@/lib/escola-import";
import { exportRowsAsCsv } from "@/lib/csv-export";
import {
  calcularIdade,
  cpfDigits,
  formatCpf,
  validateParentalConsent,
} from "@/lib/parental-consent";
import {
  logAlunoParentalConsent,
  hasAlunoParentalConsent,
  listAlunoConsentBadges,
  notifyGuardianConsent,
  type ConsentBadge,
} from "@/lib/aluno-parental-consent.functions";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const Route = createFileRoute("/escola/alunos")({
  ssr: false,
  head: () => ({ meta: [{ title: "Alunos | Escola" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: AlunosPage,
});

type Aluno = {
  id: string;
  nome_completo: string;
  matricula: string;
  turma_id: string | null;
  data_nascimento: string | null;
  observacoes: string | null;
  ativo: boolean;
};
type Turma = { id: string; nome: string; ano_letivo: number };

function AlunosPage() {
  const qc = useQueryClient();
  const { hasRole, loading } = useAuth();
  const isAdmin = useIsSchoolAdmin(hasRole);
  const logConsent = useServerFn(logAlunoParentalConsent);
  const checkConsent = useServerFn(hasAlunoParentalConsent);
  const listBadges = useServerFn(listAlunoConsentBadges);
  const notifyGuardian = useServerFn(notifyGuardianConsent);

  const [editing, setEditing] = useState<Aluno | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Aluno | null>(null);
  const [importing, setImporting] = useState(false);
  const [filter, setFilter] = useState("");
  const [filterTurma, setFilterTurma] = useState<string>("__all__");

  const { data: turmas } = useQuery({
    queryKey: ["escola-turmas-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("turmas_escolares")
        .select("id, nome, ano_letivo")
        .order("ano_letivo", { ascending: false })
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Turma[];
    },
    enabled: isAdmin,
  });

  const turmaByName = useMemo(() => {
    const m = new Map<string, Turma>();
    turmas?.forEach((t) => m.set(t.nome.trim().toLowerCase(), t));
    return m;
  }, [turmas]);

  const turmaById = useMemo(() => {
    const m = new Map<string, Turma>();
    turmas?.forEach((t) => m.set(t.id, t));
    return m;
  }, [turmas]);

  const { data: alunos, isLoading } = useQuery({
    queryKey: ["escola-alunos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("alunos").select("*").order("nome_completo");
      if (error) throw error;
      return (data ?? []) as Aluno[];
    },
    enabled: isAdmin,
  });

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return (alunos ?? []).filter((a) => {
      if (filterTurma !== "__all__" && a.turma_id !== filterTurma) return false;
      if (!q) return true;
      return a.nome_completo.toLowerCase().includes(q) || a.matricula.toLowerCase().includes(q);
    });
  }, [alunos, filter, filterTurma]);

  // Consulta em lote dos badges de consentimento parental para os alunos
  // atualmente carregados. Alimenta o indicador visual "OK" / "Pendente".
  const alunoIds = useMemo(() => (alunos ?? []).map((a) => a.id), [alunos]);
  const { data: consentByAluno } = useQuery({
    queryKey: ["parental-consent-badges", alunoIds],
    queryFn: async () => {
      if (alunoIds.length === 0) return {} as Record<string, ConsentBadge>;
      const r = await listBadges({ data: { aluno_ids: alunoIds } });
      return r.byAluno;
    },
    enabled: isAdmin && alunoIds.length > 0,
  });

  const saveMut = useMutation({
    mutationFn: async (
      payload: Partial<Aluno> & {
        id?: string;
        __consent?: {
          respNome: string;
          respCpf: string;
          respEmail: string;
          respTelefone: string;
        } | null;
      },
    ) => {
      const { __consent, ...alunoPayload } = payload;
      let alunoId = alunoPayload.id;
      if (alunoId) {
        const { id: _id, ...rest } = alunoPayload;
        void _id;
        const { error } = await supabase.from("alunos").update(rest).eq("id", alunoId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("alunos")
          .insert(alunoPayload as never)
          .select("id")
          .single();
        if (error) throw error;
        alunoId = (data as { id: string }).id;
      }
      // Registra o consentimento parental (LGPD Art. 14) quando aplicável.
      if (__consent && alunoId && alunoPayload.nome_completo && alunoPayload.data_nascimento) {
        await logConsent({
          data: {
            aluno_id: alunoId,
            minor_name: alunoPayload.nome_completo,
            minor_dob: alunoPayload.data_nascimento,
            guardian_name: __consent.respNome,
            guardian_cpf: __consent.respCpf || null,
            guardian_email: __consent.respEmail,
            guardian_phone: __consent.respTelefone || null,
          },
        });
      }
    },
    onSuccess: () => {
      toast.success("Aluno salvo.");
      qc.invalidateQueries({ queryKey: ["escola-alunos"] });
      qc.invalidateQueries({ queryKey: ["aluno-consent"] });
      setCreating(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("alunos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Aluno removido.");
      qc.invalidateQueries({ queryKey: ["escola-alunos"] });
      setDeleting(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function importCommit(rows: AlunoRow[]) {
    const errors: string[] = [];
    let inserted = 0;
    for (const r of rows) {
      const turma = turmaByName.get(r.turma.trim().toLowerCase());
      if (!turma) {
        errors.push(`${r.matricula}: turma "${r.turma}" não encontrada`);
        continue;
      }
      const { error } = await supabase.from("alunos").insert({
        matricula: r.matricula,
        nome_completo: r.nome_completo,
        turma_id: turma.id,
        data_nascimento: r.data_nascimento ?? null,
      } as never);
      if (error) errors.push(`${r.matricula}: ${error.message}`);
      else inserted++;
    }
    qc.invalidateQueries({ queryKey: ["escola-alunos"] });
    return { inserted, errors };
  }

  if (loading) return null;
  if (!isAdmin) return <AccessDenied />;

  function exportarAlunosCsv() {
    const rows = filtered.map((a) => ({
      matricula: a.matricula,
      nome_completo: a.nome_completo,
      turma: a.turma_id ? (turmaById.get(a.turma_id)?.nome ?? "") : "",
      data_nascimento: a.data_nascimento ?? "",
      ativo: a.ativo ? "sim" : "não",
      observacoes: a.observacoes ?? "",
    }));
    if (rows.length === 0) {
      toast.info("Nenhum aluno para exportar");
      return;
    }
    exportRowsAsCsv(`alunos-${new Date().toISOString().slice(0, 10)}.csv`, rows, [
      { key: "matricula", label: "Matrícula" },
      { key: "nome_completo", label: "Nome completo" },
      { key: "turma", label: "Turma" },
      { key: "data_nascimento", label: "Data de nascimento" },
      { key: "ativo", label: "Ativo" },
      { key: "observacoes", label: "Observações" },
    ]);
    toast.success(`${rows.length} aluno(s) exportado(s)`);
  }

  return (
    <EscolaShell
      title="Alunos"
      description="Cadastro individual ou importação em massa"
      current="Alunos"
      actions={
        <>
          <Button onClick={() => setCreating(true)} className="rounded-full">
            <Plus className="size-4" /> Novo aluno
          </Button>
          <Button onClick={() => setImporting(true)} variant="outline" className="rounded-full">
            <Upload className="size-4" /> Importar CSV/Excel
          </Button>
          <Button asChild variant="outline" className="rounded-full">
            <Link to="/escola/alunos-importar">
              <Upload className="size-4" /> Importar por documentos
            </Link>
          </Button>
          <Button onClick={exportarAlunosCsv} variant="outline" className="rounded-full">
            <Download className="size-4" /> Exportar CSV
          </Button>
        </>
      }
    >
      <div className="mb-3 flex flex-wrap gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou matrícula"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterTurma} onValueChange={setFilterTurma}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Todas as turmas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas as turmas</SelectItem>
            {turmas?.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.nome} ({t.ano_letivo})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-2xl border border-border/70 bg-card shadow-sm">
        {!isLoading && filtered.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="Nenhum aluno encontrado"
            description={
              filter || filterTurma !== "__all__"
                ? "Ajuste os filtros ou cadastre um novo aluno."
                : "Cadastre o primeiro aluno ou importe via planilha."
            }
            action={
              <Button onClick={() => setCreating(true)} size="sm" className="rounded-full">
                <Plus className="size-4" /> Novo aluno
              </Button>
            }
            className="border-0"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Matrícula</th>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Turma</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Consentimento</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              {isLoading ? (
                <TableRowsSkeleton rows={5} cols={6} />
              ) : (
                <tbody>
                  {filtered.map((a) => (
                    <tr key={a.id} className="border-b last:border-0">
                      <td className="px-4 py-3 font-mono text-xs">{a.matricula}</td>
                      <td className="px-4 py-3 font-medium">{a.nome_completo}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {a.turma_id ? (turmaById.get(a.turma_id)?.nome ?? "—") : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={a.ativo ? "text-emerald-600" : "text-muted-foreground"}>
                          {a.ativo ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <ConsentBadgePill
                          idade={
                            a.data_nascimento ? calcularIdade(a.data_nascimento) : null
                          }
                          badge={consentByAluno?.[a.id] ?? null}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button size="icon" variant="ghost" onClick={() => setEditing(a)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setDeleting(a)}>
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              )}
            </table>
          </div>
        )}
      </div>

      <AlunoFormDialog
        open={creating || !!editing}
        aluno={editing}
        turmas={turmas ?? []}
        checkConsent={checkConsent}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSave={(p) => saveMut.mutate(p)}
        saving={saveMut.isPending}
      />

      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover aluno</AlertDialogTitle>
            <AlertDialogDescription>
              Remover <strong>{deleting?.nome_completo}</strong> também apaga notas, frequência e
              vínculos com responsáveis.
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
        title="Importar alunos"
        schema={alunoRowSchema}
        templateName="modelo-alunos.csv"
        templateHeaders={ALUNO_TEMPLATE.headers}
        templateExample={ALUNO_TEMPLATE.example}
        onCommit={importCommit}
        dedupeKey="matricula"
        loadExistingKeys={async () => {
          const { data, error } = await supabase.from("alunos").select("matricula");
          if (error) throw error;
          return new Set((data ?? []).map((r) => String(r.matricula).trim().toLowerCase()));
        }}
      />
    </EscolaShell>
  );
}

function AlunoFormDialog({
  open,
  aluno,
  turmas,
  checkConsent,
  onClose,
  onSave,
  saving,
}: {
  open: boolean;
  aluno: Aluno | null;
  turmas: Turma[];
  checkConsent: (opts: { data: { aluno_id: string } }) => Promise<{ hasConsent: boolean }>;
  onClose: () => void;
  onSave: (
    p: Partial<Aluno> & {
      id?: string;
      __consent?: {
        respNome: string;
        respCpf: string;
        respEmail: string;
        respTelefone: string;
      } | null;
    },
  ) => void;
  saving: boolean;
}) {
  const [ativo, setAtivo] = useState(aluno?.ativo ?? true);
  const [dob, setDob] = useState(aluno?.data_nascimento ?? "");
  const [nome, setNome] = useState(aluno?.nome_completo ?? "");
  const [respNome, setRespNome] = useState("");
  const [respCpf, setRespCpf] = useState("");
  const [respEmail, setRespEmail] = useState("");
  const [respTelefone, setRespTelefone] = useState("");
  const [aceite, setAceite] = useState(false);
  const [existingConsent, setExistingConsent] = useState<boolean | null>(null);

  // Ao abrir para edição, verificamos se já existe consentimento — evita
  // exigir novamente dados que já foram registrados.
  useEffect(() => {
    if (!open) return;
    if (aluno?.id) {
      setExistingConsent(null);
      checkConsent({ data: { aluno_id: aluno.id } })
        .then((r) => setExistingConsent(r.hasConsent))
        .catch(() => setExistingConsent(null));
    } else {
      setExistingConsent(null);
      setRespNome("");
      setRespCpf("");
      setRespEmail("");
      setRespTelefone("");
      setAceite(false);
    }
  }, [open, aluno, checkConsent]);

  const idade = calcularIdade(dob);
  const isMenor = idade !== null && idade < 18;
  const precisaConsentimento = isMenor && existingConsent !== true;

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const turma = String(f.get("turma_id") ?? "");
    const nomeCompleto = String(f.get("nome_completo") ?? "").trim();
    const dataNasc = String(f.get("data_nascimento") ?? "").trim() || null;

    // LGPD Art. 14: para menores de 18, exige registro de consentimento do
    // responsável legal. Se ainda não há consentimento no banco, valida os
    // dados do responsável antes de gravar o aluno.
    let consentPayload: null | {
      respNome: string;
      respCpf: string;
      respEmail: string;
      respTelefone: string;
    } = null;
    if (precisaConsentimento) {
      if (!dataNasc) {
        toast.error("Informe a data de nascimento do aluno.");
        return;
      }
      const check = validateParentalConsent({
        nome: nomeCompleto,
        dataNascimento: dataNasc,
        respNome,
        respCpf,
        respEmail,
        aceiteParental: aceite,
        aceiteLgpd: true,
      });
      if (!check.ok) {
        toast.error(check.error);
        return;
      }
      consentPayload = { respNome, respCpf, respEmail, respTelefone };
    }

    onSave({
      id: aluno?.id,
      matricula: String(f.get("matricula") ?? "").trim(),
      nome_completo: nomeCompleto,
      turma_id: turma && turma !== "__none__" ? turma : null,
      data_nascimento: dataNasc,
      observacoes: String(f.get("observacoes") ?? "").trim() || null,
      ativo,
      __consent: consentPayload,
    });
  }
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{aluno ? "Editar aluno" : "Novo aluno"}</DialogTitle>
          <DialogDescription>
            Matrícula e turma são essenciais para vínculo dos pais.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="matricula">Matrícula</Label>
              <Input
                id="matricula"
                name="matricula"
                required
                defaultValue={aluno?.matricula ?? ""}
              />
            </div>
            <div>
              <Label htmlFor="data_nascimento">Data de nascimento</Label>
              <Input
                id="data_nascimento"
                name="data_nascimento"
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="nome_completo">Nome completo</Label>
            <Input
              id="nome_completo"
              name="nome_completo"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="turma_id">Turma</Label>
            <Select name="turma_id" defaultValue={aluno?.turma_id ?? "__none__"}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Sem turma —</SelectItem>
                {turmas.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.nome} ({t.ano_letivo})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              name="observacoes"
              rows={2}
              defaultValue={aluno?.observacoes ?? ""}
            />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label htmlFor="ativo">Aluno ativo</Label>
            <Switch id="ativo" checked={ativo} onCheckedChange={setAtivo} />
          </div>

          {isMenor && existingConsent === true && (
            <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" />
              <span>Consentimento parental já registrado para este aluno.</span>
            </div>
          )}

          {precisaConsentimento && (
            <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50/60 p-4 dark:border-amber-800/50 dark:bg-amber-950/20">
              <div className="flex items-start gap-2 text-sm text-amber-900 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <div>
                  <p className="font-medium">Consentimento do responsável legal</p>
                  <p className="text-xs opacity-90">
                    Aluno menor de 18 anos ({idade} anos). A LGPD (Art. 14) exige registro do
                    consentimento de um dos pais ou responsáveis.
                  </p>
                </div>
              </div>
              <div>
                <Label htmlFor="respNome">Nome do responsável</Label>
                <Input
                  id="respNome"
                  value={respNome}
                  onChange={(e) => setRespNome(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="respCpf">CPF (opcional)</Label>
                  <Input
                    id="respCpf"
                    value={respCpf}
                    inputMode="numeric"
                    placeholder="000.000.000-00"
                    onChange={(e) => setRespCpf(formatCpf(e.target.value))}
                    autoComplete="off"
                  />
                </div>
                <div>
                  <Label htmlFor="respTelefone">Telefone (opcional)</Label>
                  <Input
                    id="respTelefone"
                    value={respTelefone}
                    onChange={(e) => setRespTelefone(e.target.value)}
                    autoComplete="off"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="respEmail">E-mail do responsável</Label>
                <Input
                  id="respEmail"
                  type="email"
                  value={respEmail}
                  onChange={(e) => setRespEmail(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <label className="flex items-start gap-2 text-xs leading-relaxed">
                <Checkbox
                  checked={aceite}
                  onCheckedChange={(v) => setAceite(v === true)}
                  className="mt-0.5"
                />
                <span>
                  Declaro, na qualidade de responsável legal, que autorizo o tratamento dos dados
                  pessoais do(a) menor {nome ? <strong>{nome}</strong> : "aluno(a)"} pela escola,
                  conforme a{" "}
                  <a
                    href="/privacidade"
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2"
                  >
                    Política de Privacidade
                  </a>{" "}
                  e a LGPD (Lei 13.709/2018).
                </span>
              </label>
              <p className="text-[10px] text-muted-foreground">
                CPF é opcional. O consentimento fica registrado com data, hora e endereço IP para
                auditoria (
                {(() => {
                  const d = cpfDigits(respCpf);
                  return d ? "CPF será armazenado apenas em dígitos" : "sem CPF armazenado";
                })()}
                ).
              </p>
            </div>
          )}

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

/**
 * Badge de status de consentimento parental (LGPD Art. 14).
 * - Adulto: "N/A" (não aplicável)
 * - Menor + consentimento: pill verde com tooltip mostrando responsável e data
 * - Menor sem consentimento: pill âmbar de pendência
 */
function ConsentBadgePill({
  idade,
  badge,
}: {
  idade: number | null;
  badge: ConsentBadge | null;
}) {
  const isMenor = idade !== null && idade < 18;
  if (!isMenor) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  if (badge) {
    const dt = new Date(badge.consented_at);
    const label = `Registrado por ${badge.guardian_name} em ${dt.toLocaleDateString("pt-BR")} às ${dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
    return (
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/70 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-200">
              <ShieldCheck className="size-3" /> OK
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">{label}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/70 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
            <AlertTriangle className="size-3" /> Pendente
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">
          Consentimento parental não registrado. Edite o aluno para preencher os dados do
          responsável.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

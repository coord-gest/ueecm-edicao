import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState } from "react";
import {
  Award,
  CheckCircle2,
  History,
  ImageIcon,
  Loader2,
  Plus,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { PainelLayout } from "@/components/PainelLayout";
import { PhotoLightbox } from "@/components/PhotoLightbox";
import { uploadImage } from "@/lib/image-upload";
import {
  aprovarDestaque,
  excluirDestaque,
  indicarDestaque,
  listDestaquesAdmin,
  listHistoricoDestaque,
  rejeitarDestaque,
  type DestaqueAdmin,
  type HistoricoRow,
} from "@/lib/alunos-destaque.functions";

export const Route = createFileRoute("/painel-destaques-alunos")({
  ssr: false,
  head: () => ({ meta: [{ title: "Alunos de Destaque | Painel" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: PainelDestaquesAlunosPage,
});

function firstOfMonth(offset = 0) {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}
function mesLabel(iso: string) {
  const [y, m] = iso.split("-");
  const nomes = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];
  return `${nomes[Number(m) - 1]} / ${y}`;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  indicado: "secondary",
  aprovado: "default",
  rejeitado: "destructive",
};

const ACAO_LABEL: Record<string, string> = {
  indicado: "Indicado",
  editado: "Editado",
  cancelado: "Cancelado",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
  excluido: "Excluído",
};

type Turma = { id: string; nome: string; ano_serie: string | null };
type Aluno = { id: string; nome_completo: string; turma_id: string | null };
type Disciplina = { id: string; nome: string };

const CAMPOS_LEGIVEIS: Record<string, string> = {
  motivo: "Motivo",
  posicao: "Posição",
  mes: "Mês",
  exibir_foto: "Exibir foto",
  foto_url: "Foto",
  status: "Status",
  disciplina_id: "Disciplina",
  aluno_id: "Aluno",
  turma_id: "Turma",
  motivo_rejeicao: "Motivo da rejeição",
};

function formatSnapshot(raw: string | null): string {
  if (!raw) return "—";
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const lines: string[] = [];
    for (const [k, v] of Object.entries(obj)) {
      if (v === null || v === undefined || v === "") continue;
      if (["id", "created_at", "updated_at", "aprovado_por", "aprovado_em"].includes(k)) continue;
      const label = CAMPOS_LEGIVEIS[k] ?? k;
      lines.push(`${label}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`);
    }
    return lines.length > 0 ? lines.join("\n") : "—";
  } catch {
    return raw;
  }
}

/* -------------------------- Upload de foto -------------------------- */
function FotoUploader({ fotoUrl, onChange }: { fotoUrl: string; onChange: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setUploading(true);
    const res = await uploadImage(file, "alunos-destaque");
    setUploading(false);
    if (!res.ok) {
      toast.error(res.error.title, { description: res.error.description });
      return;
    }

    onChange(res.url);
    toast.success("Foto enviada");
  };

  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-3">
        {fotoUrl ? (
          <img
            src={fotoUrl}
            alt="Foto do aluno"
            className="size-20 rounded-full border-2 border-gold/50 object-cover"
          />
        ) : (
          <div className="flex size-20 items-center justify-center rounded-full border-2 border-dashed border-border bg-secondary">
            <ImageIcon className="size-6 text-muted-foreground" aria-hidden />
          </div>
        )}
        <div className="flex-1 space-y-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="mr-1 size-4 animate-spin" />
            ) : (
              <Upload className="mr-1 size-4" />
            )}
            {fotoUrl ? "Trocar foto" : "Enviar foto"}
          </Button>
          {fotoUrl && (
            <Button type="button" size="sm" variant="ghost" onClick={() => onChange("")}>
              Remover
            </Button>
          )}
          <p className="text-[11px] text-muted-foreground">JPG, PNG ou WebP. Até 5 MB.</p>
        </div>
      </div>
      <div className="grid gap-1">
        <Label className="text-xs">Ou cole uma URL</Label>
        <Input
          value={fotoUrl}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://..."
        />
      </div>
    </div>
  );
}

/* -------------------------- Indicar -------------------------- */
function IndicarDialog({ onCreated, isAdmin }: { onCreated: () => void; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const [turmaId, setTurmaId] = useState("");
  const [alunoId, setAlunoId] = useState("");
  const [disciplinaId, setDisciplinaId] = useState<string>("");
  const [mes, setMes] = useState(firstOfMonth(0));
  const [posicao, setPosicao] = useState<string>("1");
  const [motivo, setMotivo] = useState("");
  const [exibirFoto, setExibirFoto] = useState(false);
  const [fotoUrl, setFotoUrl] = useState("");

  const indicar = useServerFn(indicarDestaque);

  const { data: turmas } = useQuery({
    queryKey: ["ad-turmas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("turmas_escolares")
        .select("id, nome, ano_serie")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Turma[];
    },
    enabled: open,
  });

  const { data: alunos } = useQuery({
    queryKey: ["ad-alunos", turmaId],
    queryFn: async () => {
      if (!turmaId) return [];
      const { data, error } = await supabase
        .from("alunos")
        .select("id, nome_completo, turma_id")
        .eq("turma_id", turmaId)
        .eq("ativo", true)
        .order("nome_completo");
      if (error) throw error;
      return (data ?? []) as Aluno[];
    },
    enabled: open && !!turmaId,
  });

  const { data: disciplinas } = useQuery({
    queryKey: ["ad-disciplinas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("disciplinas")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Disciplina[];
    },
    enabled: open,
  });

  const salvar = useMutation({
    mutationFn: async () => {
      return indicar({
        data: {
          aluno_id: alunoId,
          turma_id: turmaId,
          disciplina_id: disciplinaId,
          mes,
          motivo,
          posicao: Number(posicao),
          exibir_foto: exibirFoto,
          foto_url: exibirFoto && fotoUrl ? fotoUrl : null,
        },
      });
    },
    onSuccess: () => {
      toast.success(
        isAdmin
          ? "Indicação criada. Aprove na aba Indicados."
          : "Indicação enviada para aprovação.",
      );
      setOpen(false);
      setAlunoId("");
      setMotivo("");
      setPosicao("1");
      setDisciplinaId("");
      setExibirFoto(false);
      setFotoUrl("");
      onCreated();
    },
    onError: (e: Error) => toast.error("Erro ao indicar", { description: e.message }),
  });

  const meses = useMemo(
    () => [firstOfMonth(1), firstOfMonth(0), firstOfMonth(-1), firstOfMonth(-2)],
    [],
  );

  const podeSalvar =
    !!turmaId &&
    !!alunoId &&
    !!disciplinaId &&
    motivo.trim().length >= 5 &&
    Number(posicao) >= 1 &&
    Number(posicao) <= 5;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-1 size-4" /> Indicar aluno
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Indicar aluno de destaque</DialogTitle>
          <DialogDescription>
            Preencha os dados. A indicação passará por aprovação da coordenação.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>
              Turma <span className="text-destructive">*</span>
            </Label>
            <Select
              value={turmaId}
              onValueChange={(v) => {
                setTurmaId(v);
                setAlunoId("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a turma" />
              </SelectTrigger>
              <SelectContent>
                {(turmas ?? []).map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label>
              Aluno <span className="text-destructive">*</span>
            </Label>
            <Select value={alunoId} onValueChange={setAlunoId} disabled={!turmaId}>
              <SelectTrigger>
                <SelectValue
                  placeholder={turmaId ? "Selecione o aluno" : "Escolha uma turma primeiro"}
                />
              </SelectTrigger>
              <SelectContent>
                {(alunos ?? []).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.nome_completo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>
                Disciplina <span className="text-destructive">*</span>
              </Label>
              <Select value={disciplinaId} onValueChange={setDisciplinaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {(disciplinas ?? []).map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>
                Posição <span className="text-destructive">*</span>
              </Label>
              <Select value={posicao} onValueChange={setPosicao}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}º lugar
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>
              Mês <span className="text-destructive">*</span>
            </Label>
            <Select value={mes} onValueChange={setMes}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {meses.map((m) => (
                  <SelectItem key={m} value={m}>
                    {mesLabel(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label>
              Motivo do destaque <span className="text-destructive">*</span>
            </Label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: Dedicação exemplar em Matemática e liderança positiva na turma."
              rows={3}
              maxLength={500}
            />
            <p className="text-[11px] text-muted-foreground">
              Mínimo 5 caracteres. {motivo.trim().length}/500.
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary/40 p-3">
            <Switch checked={exibirFoto} onCheckedChange={setExibirFoto} id="foto-switch" />
            <Label htmlFor="foto-switch" className="flex-1 cursor-pointer text-sm">
              O responsável autorizou a exibição da foto do aluno
            </Label>
          </div>

          {exibirFoto && (
            <div className="grid gap-1.5">
              <Label>Foto do aluno</Label>
              <FotoUploader fotoUrl={fotoUrl} onChange={setFotoUrl} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={() => salvar.mutate()} disabled={!podeSalvar || salvar.isPending}>
            {salvar.isPending ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
            Salvar indicação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------- Histórico -------------------------- */
function HistoricoDialog({ destaqueId }: { destaqueId: string }) {
  const [open, setOpen] = useState(false);
  const listar = useServerFn(listHistoricoDestaque);
  const { data, isLoading } = useQuery({
    queryKey: ["destaque-historico", destaqueId],
    queryFn: () => listar({ data: { destaque_id: destaqueId } }),
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <History className="mr-1 size-4" /> Histórico
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Histórico da indicação</DialogTitle>
          <DialogDescription>
            Todas as alterações registradas: indicação, edições, aprovações, rejeições e
            cancelamentos.
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : !data || data.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhum registro.</p>
        ) : (
          <ol className="relative space-y-4 border-l-2 border-border pl-4">
            {(data as HistoricoRow[]).map((h) => (
              <li key={h.id} className="relative">
                <span className="absolute -left-[22px] top-1 flex size-4 items-center justify-center rounded-full bg-primary" />
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{ACAO_LABEL[h.acao] ?? h.acao}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(h.created_at).toLocaleString("pt-BR")}
                  </span>
                </div>
                {h.observacao && (
                  <p className="mt-1 text-sm text-muted-foreground">Obs.: {h.observacao}</p>
                )}
                {(h.before || h.after) && (
                  <div className="mt-2 grid gap-2 rounded-md border border-border bg-secondary/40 p-2 text-xs sm:grid-cols-2">
                    <div>
                      <p className="mb-1 font-semibold text-muted-foreground">Antes</p>
                      <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-background p-2">
                        {formatSnapshot(h.before)}
                      </pre>
                    </div>
                    <div>
                      <p className="mb-1 font-semibold text-muted-foreground">Depois</p>
                      <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-background p-2">
                        {formatSnapshot(h.after)}
                      </pre>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------- Card -------------------------- */
function DestaqueCard({
  d,
  onAprovar,
  onRejeitar,
  onExcluir,
  canModerate,
  canDelete,
  busy,
}: {
  d: DestaqueAdmin;
  onAprovar: (id: string) => void;
  onRejeitar: (id: string) => void;
  onExcluir: (id: string) => void;
  canModerate: boolean;
  canDelete: boolean;
  busy: boolean;
}) {
  const showFoto = d.exibir_foto && !!d.foto_url;
  const [lightbox, setLightbox] = useState(false);
  return (
    <article className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex gap-4">
        <div className="shrink-0">
          {showFoto ? (
            <>
              <button
                type="button"
                onClick={() => setLightbox(true)}
                className="rounded-full transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                aria-label={`Ver foto de ${d.aluno_nome}`}
              >
                <img
                  src={d.foto_url!}
                  alt={d.aluno_nome}
                  className="size-16 rounded-full border-2 border-gold/50 object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              </button>
              <PhotoLightbox
                src={d.foto_url!}
                alt={d.aluno_nome}
                open={lightbox}
                onOpenChange={setLightbox}
              />
            </>
          ) : (
            <div
              className="flex size-16 items-center justify-center rounded-full border-2 border-dashed border-border bg-secondary"
              aria-hidden
            >
              <img src="/tito-avatar.webp" alt="" className="size-10 opacity-60" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant={STATUS_VARIANT[d.status]}>{d.status}</Badge>
            <Badge variant="outline">{d.posicao}º lugar</Badge>
            <Badge variant="outline">{mesLabel(d.mes)}</Badge>
            {d.disciplina_nome && (
              <Badge
                variant="outline"
                style={
                  d.disciplina_cor
                    ? { borderColor: d.disciplina_cor, color: d.disciplina_cor }
                    : undefined
                }
              >
                {d.disciplina_nome}
              </Badge>
            )}
            <span className="ml-auto text-xs text-muted-foreground">
              {new Date(d.created_at).toLocaleString("pt-BR")}
            </span>
          </div>

          <h3 className="font-display text-base font-semibold text-primary">
            {d.aluno_nome}{" "}
            <span className="text-sm font-normal text-muted-foreground">— {d.turma_nome}</span>
          </h3>
          <blockquote className="mt-2 whitespace-pre-wrap text-sm text-foreground">
            “{d.motivo}”
          </blockquote>
          <p className="mt-2 text-xs text-muted-foreground">
            {d.exibir_foto ? "Foto autorizada" : "Sem exibição de foto"}
            {d.motivo_rejeicao ? ` · Motivo rejeição: ${d.motivo_rejeicao}` : ""}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {canModerate && d.status !== "aprovado" && (
              <Button
                size="sm"
                onClick={() => onAprovar(d.id)}
                disabled={busy}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <CheckCircle2 className="mr-1 size-4" /> Aprovar
              </Button>
            )}
            {canModerate && d.status !== "rejeitado" && (
              <Button size="sm" variant="outline" onClick={() => onRejeitar(d.id)} disabled={busy}>
                <XCircle className="mr-1 size-4" /> Rejeitar
              </Button>
            )}
            <HistoricoDialog destaqueId={d.id} />
            {canDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="destructive" disabled={busy}>
                    <Trash2 className="mr-1 size-4" /> Excluir
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir indicação?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação é permanente e não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onExcluir(d.id)}>Excluir</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

/* -------------------------- Página -------------------------- */
function PainelDestaquesAlunosPage() {
  const { isStaff, loading, roles } = useAuth();
  const listar = useServerFn(listDestaquesAdmin);
  const aprovar = useServerFn(aprovarDestaque);
  const rejeitar = useServerFn(rejeitarDestaque);
  const excluir = useServerFn(excluirDestaque);
  const qc = useQueryClient();
  const [tab, setTab] = useState<"indicado" | "aprovado" | "rejeitado" | "todos">("indicado");

  const canModerate = roles.some((r) =>
    ["desenvolvedor", "diretor", "coordenador", "admin"].includes(r),
  );
  const canDelete = canModerate;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["destaques-admin", tab],
    queryFn: () => listar({ data: tab === "todos" ? {} : { status: tab } }),
    enabled: isStaff,
  });

  const aprovarMut = useMutation({
    mutationFn: (id: string) => aprovar({ data: { id } }),
    onSuccess: () => {
      toast.success("Aprovado");
      qc.invalidateQueries({ queryKey: ["destaques-admin"] });
      qc.invalidateQueries({ queryKey: ["alunos-destaque-publicos"] });
      qc.invalidateQueries({ queryKey: ["alunos-destaque-publicos-full"] });
    },
    onError: (e: Error) => toast.error("Erro ao aprovar", { description: e.message }),
  });

  const rejeitarMut = useMutation({
    mutationFn: (id: string) => rejeitar({ data: { id } }),
    onSuccess: () => {
      toast.success("Rejeitado");
      qc.invalidateQueries({ queryKey: ["destaques-admin"] });
      qc.invalidateQueries({ queryKey: ["alunos-destaque-publicos"] });
    },
    onError: (e: Error) => toast.error("Erro ao rejeitar", { description: e.message }),
  });

  const excluirMut = useMutation({
    mutationFn: (id: string) => excluir({ data: { id } }),
    onSuccess: () => {
      toast.success("Excluído");
      qc.invalidateQueries({ queryKey: ["destaques-admin"] });
      qc.invalidateQueries({ queryKey: ["alunos-destaque-publicos"] });
    },
    onError: (e: Error) => toast.error("Erro ao excluir", { description: e.message }),
  });

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isStaff) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-semibold">Acesso restrito</h1>
        <p className="mt-2 text-muted-foreground">
          Você não tem permissão para acessar esta página.
        </p>
      </div>
    );
  }

  const rows = data ?? [];
  const busy = aprovarMut.isPending || rejeitarMut.isPending || excluirMut.isPending;

  return (
    <PainelLayout>
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex flex-wrap items-center gap-3">
          <Award className="size-6 text-gold" aria-hidden />
          <div className="flex-1">
            <h1 className="font-display text-2xl font-semibold">Alunos de Destaque</h1>
            <p className="text-sm text-muted-foreground">
              Indique alunos e aprove os destaques do mês.
            </p>
          </div>
          <IndicarDialog onCreated={() => refetch()} isAdmin={canModerate} />
        </header>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="indicado">Indicados</TabsTrigger>
            <TabsTrigger value="aprovado">Aprovados</TabsTrigger>
            <TabsTrigger value="rejeitado">Rejeitados</TabsTrigger>
            <TabsTrigger value="todos">Todos</TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-4">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : rows.length === 0 ? (
              <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
                Nada por aqui.
              </div>
            ) : (
              <div className="grid gap-3">
                {rows.map((d) => (
                  <DestaqueCard
                    key={d.id}
                    d={d}
                    busy={busy}
                    canModerate={canModerate}
                    canDelete={canDelete}
                    onAprovar={(id) => aprovarMut.mutate(id)}
                    onRejeitar={(id) => rejeitarMut.mutate(id)}
                    onExcluir={(id) => excluirMut.mutate(id)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </PainelLayout>
  );
}

import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BookOpen,
  EyeOff,
  GraduationCap,
  Loader2,
  Mail,
  Pencil,
  Phone,
  Plus,
  Search,
  ShieldAlert,
  Star,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { uploadImage } from "@/lib/image-upload";
import { listProfissionaisAdmin } from "@/lib/profissionais.functions";
import {
  CARGO_LABEL,
  CARGO_OPTIONS,
  CARGO_ORDER,
  type Cargo,
  type Profissional,
  type ProfissionalInsert,
  getInitials,
} from "@/lib/profissionais";
import logo from "@/assets/logo.png";

import { PainelLayout } from "@/components/PainelLayout";

export const Route = createFileRoute("/painel-profissionais")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Gerenciar Profissionais | U.E. - Evaristo Campelo de Matos" }],
  }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: PainelProfissionais,
});

const profissionalSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome").max(120),
  cargo: z.enum(["diretor", "coordenador", "professor", "secretario", "outro"]),
  cargo_descricao: z.string().trim().max(120).optional().or(z.literal("")),
  foto_url: z.string().trim().url("URL inválida").max(500).optional().or(z.literal("")),
  disciplinas: z.string().trim().max(300).optional().or(z.literal("")),
  bio: z.string().trim().max(1000).optional().or(z.literal("")),
  formacao: z.string().trim().max(300).optional().or(z.literal("")),
  anos_experiencia: z.union([z.string().regex(/^\d{0,2}$/), z.literal("")]).optional(),
  ano_ingresso: z.union([z.string().regex(/^\d{0,4}$/), z.literal("")]).optional(),
  email: z.string().trim().email("E-mail inválido").max(255).optional().or(z.literal("")),
  telefone: z.string().trim().max(40).optional().or(z.literal("")),
  lattes_url: z.string().trim().url().max(500).optional().or(z.literal("")),
  linkedin_url: z.string().trim().url().max(500).optional().or(z.literal("")),
  site_url: z.string().trim().url().max(500).optional().or(z.literal("")),
  ordem: z.union([z.string().regex(/^\d{0,4}$/), z.literal("")]).optional(),
  destaque: z.boolean(),
  ativo: z.boolean(),
});

type FormState = z.infer<typeof profissionalSchema>;

const emptyForm: FormState = {
  nome: "",
  cargo: "professor",
  cargo_descricao: "",
  foto_url: "",
  disciplinas: "",
  bio: "",
  formacao: "",
  anos_experiencia: "",
  ano_ingresso: "",
  email: "",
  telefone: "",
  lattes_url: "",
  linkedin_url: "",
  site_url: "",
  ordem: "",
  destaque: false,
  ativo: true,
};

/** Detecta e-mails fictícios do backfill (`primeironome.ueecm.NNN@ueecm.com`). */
const FICTICIO_EMAIL_RE = /\.ueecm\.\d{3}@ueecm\.com$/i;
function isEmailFicticio(email?: string | null): boolean {
  return !!email && FICTICIO_EMAIL_RE.test(email.trim());
}

function AcessoRestrito() {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-secondary px-4 text-center">
      <ShieldAlert className="size-10 text-destructive" />
      <h1 className="font-display text-xl font-semibold text-foreground">Acesso restrito</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Apenas Desenvolvedor, Diretor e Coordenador podem gerenciar profissionais.
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

function PainelProfissionais() {
  const { loading, hasRole, user } = useAuth();
  const qc = useQueryClient();
  const fetchProfissionais = useServerFn(listProfissionaisAdmin);

  const canManage = hasRole("desenvolvedor") || hasRole("diretor") || hasRole("coordenador");
  const canDelete = hasRole("desenvolvedor") || hasRole("diretor") || hasRole("coordenador");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Profissional | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [busca, setBusca] = useState("");
  const [filtroCargo, setFiltroCargo] = useState<"todos" | Cargo>("todos");
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "ativos" | "inativos" | "destaque">(
    "todos",
  );
  const [uploading, setUploading] = useState(false);
  const [toDelete, setToDelete] = useState<Profissional | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["profissionais-admin"],
    queryFn: () => fetchProfissionais(),
    enabled: !loading && canManage,
  });

  const save = useMutation({
    mutationFn: async (values: FormState) => {
      const parsed = profissionalSchema.parse(values);
      const payload: ProfissionalInsert = {
        nome: parsed.nome,
        cargo: parsed.cargo,
        cargo_descricao: parsed.cargo_descricao || null,
        foto_url: parsed.foto_url || null,
        disciplinas: parsed.disciplinas
          ? parsed.disciplinas
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
        bio: parsed.bio || null,
        formacao: parsed.formacao || null,
        anos_experiencia: parsed.anos_experiencia ? Number(parsed.anos_experiencia) : null,
        ano_ingresso: parsed.ano_ingresso ? Number(parsed.ano_ingresso) : null,
        email: parsed.email || null,
        telefone: parsed.telefone || null,
        lattes_url: parsed.lattes_url || null,
        linkedin_url: parsed.linkedin_url || null,
        site_url: parsed.site_url || null,
        ordem: parsed.ordem ? Number(parsed.ordem) : undefined,
        destaque: parsed.destaque,
        ativo: parsed.ativo,
      };
      if (editing) {
        const { error } = await supabase.from("profissionais").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        // Ao criar manualmente, registra quem cadastrou para auditoria/rastreio.
        const insertPayload = { ...payload, created_by: user?.id ?? null };
        const { error } = await supabase.from("profissionais").insert(insertPayload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Profissional atualizado" : "Profissional cadastrado");
      qc.invalidateQueries({ queryKey: ["profissionais-admin"] });
      qc.invalidateQueries({ queryKey: ["profissionais-publico"] });
      qc.invalidateQueries({ queryKey: ["profissionais-home"] });
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
    },
    onError: (e: unknown) => {
      const msg =
        e instanceof z.ZodError
          ? (e.issues[0]?.message ?? "Dados inválidos")
          : e instanceof Error
            ? e.message
            : "Erro inesperado";
      toast.error("Não foi possível salvar", { description: msg });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("profissionais").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profissional removido");
      qc.invalidateQueries({ queryKey: ["profissionais-admin"] });
      qc.invalidateQueries({ queryKey: ["profissionais-publico"] });
      qc.invalidateQueries({ queryKey: ["profissionais-home"] });
    },
    onError: (e: unknown) =>
      toast.error("Erro ao remover", {
        description: e instanceof Error ? e.message : undefined,
      }),
  });

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(p: Profissional) {
    setEditing(p);
    setForm({
      nome: p.nome,
      cargo: p.cargo as Cargo,
      cargo_descricao: p.cargo_descricao ?? "",
      foto_url: p.foto_url ?? "",
      disciplinas: (p.disciplinas ?? []).join(", "),
      bio: p.bio ?? "",
      formacao: p.formacao ?? "",
      anos_experiencia: p.anos_experiencia?.toString() ?? "",
      ano_ingresso: p.ano_ingresso?.toString() ?? "",
      email: isEmailFicticio(p.email) ? "" : (p.email ?? ""),
      telefone: p.telefone ?? "",
      lattes_url: p.lattes_url ?? "",
      linkedin_url: p.linkedin_url ?? "",
      site_url: p.site_url ?? "",
      ordem: p.ordem != null ? String(p.ordem) : "",
      destaque: p.destaque,
      ativo: p.ativo,
    });
    setOpen(true);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    save.mutate(form);
  }

  async function handleFotoUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await uploadImage(file, "profissionais");
      if (!result.ok) throw new Error(result.error.description);
      setForm((prev) => ({ ...prev, foto_url: result.url }));
      toast.success("Foto enviada");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro no upload";
      toast.error("Falha ao enviar foto", { description: msg });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!canManage) return <AcessoRestrito />;

  const todos = data ?? [];
  const stats = {
    total: todos.length,
    ativos: todos.filter((p) => p.ativo).length,
    inativos: todos.filter((p) => !p.ativo).length,
    destaques: todos.filter((p) => p.destaque).length,
  };
  const contagemPorCargo = CARGO_ORDER.reduce<Record<Cargo, number>>(
    (acc, c) => {
      acc[c] = todos.filter((p) => p.cargo === c).length;
      return acc;
    },
    { diretor: 0, coordenador: 0, professor: 0, secretario: 0, outro: 0 },
  );

  const lista = todos.filter((p) => {
    if (filtroCargo !== "todos" && p.cargo !== filtroCargo) return false;
    if (filtroStatus === "ativos" && !p.ativo) return false;
    if (filtroStatus === "inativos" && p.ativo) return false;
    if (filtroStatus === "destaque" && !p.destaque) return false;
    const q = busca.trim().toLowerCase();
    if (!q) return true;
    const hay = [p.nome, p.cargo_descricao, p.email, p.formacao, ...(p.disciplinas ?? [])]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });

  return (
    <PainelLayout>
      <div className="min-h-screen bg-secondary">
        <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-lg">
          <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:flex sm:justify-between sm:gap-4 sm:px-6 sm:py-4">
            <div className="flex min-w-0 items-center gap-3">
              <img
                src={logo}
                alt="Logo"
                className="h-9 w-9 shrink-0 sm:h-10 sm:w-10"
                width={512}
                height={512}
              />
              <div className="min-w-0 leading-tight">
                <p className="truncate font-display text-base font-semibold text-primary sm:text-lg">
                  Profissionais
                </p>
                <p className="truncate text-[11px] text-muted-foreground sm:text-xs">
                  U.E. - Evaristo Campelo de Matos
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                asChild
                variant="outline"
                size="icon"
                className="rounded-full sm:hidden"
                aria-label="Voltar ao painel"
              >
                <Link to="/painel">
                  <ArrowLeft className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="hidden rounded-full sm:inline-flex">
                <Link to="/painel">
                  <ArrowLeft className="size-4" /> Painel
                </Link>
              </Button>
              <Button
                onClick={openNew}
                size="icon"
                className="rounded-full sm:hidden"
                aria-label="Novo profissional"
              >
                <Plus className="size-4" />
              </Button>
              <Button onClick={openNew} className="hidden rounded-full sm:inline-flex">
                <Plus className="size-4" /> Novo profissional
              </Button>
            </div>
          </div>
        </header>

        <section className="border-b border-border/60 bg-gradient-to-br from-primary via-primary/90 to-primary/70 text-primary-foreground">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
            <Badge className="mb-3 rounded-full bg-gold/90 text-gold-foreground hover:bg-gold">
              <GraduationCap className="size-3.5" /> Gestão da equipe
            </Badge>
            <h1 className="font-display text-2xl font-bold sm:text-4xl">
              Profissionais cadastrados
            </h1>
            <p className="mt-2 max-w-2xl text-xs text-primary-foreground/85 sm:text-sm">
              Mantenha os dados da equipe atualizados. As informações aparecem na página pública
              <Link to="/equipe" className="ml-1 underline-offset-2 hover:underline">
                /equipe
              </Link>{" "}
              e na home da escola.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Total" value={stats.total} icon={<Users className="size-4" />} />
              <StatCard
                label="Ativos"
                value={stats.ativos}
                icon={<GraduationCap className="size-4" />}
              />
              <StatCard
                label="Em destaque"
                value={stats.destaques}
                icon={<Star className="size-4" />}
              />
              <StatCard
                label="Inativos"
                value={stats.inativos}
                icon={<EyeOff className="size-4" />}
              />
            </div>
          </div>
        </section>

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
          <div className="mb-6 flex flex-col gap-3 rounded-3xl border border-border/70 bg-card p-3 shadow-sm sm:p-4 xl:flex-row xl:items-center xl:justify-between">
            <Tabs
              value={filtroCargo}
              onValueChange={(v) => setFiltroCargo(v as typeof filtroCargo)}
              className="-mx-1 min-w-0"
            >
              <div className="overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] xl:overflow-visible xl:pb-0 [&::-webkit-scrollbar]:hidden">
                <TabsList className="inline-flex w-max rounded-full xl:flex xl:w-auto xl:flex-wrap">
                  <TabsTrigger value="todos" className="rounded-full">
                    Todos <span className="ml-1 text-[10px] opacity-70">{stats.total}</span>
                  </TabsTrigger>
                  {CARGO_ORDER.map((c) => (
                    <TabsTrigger key={c} value={c} className="rounded-full">
                      {CARGO_LABEL[c]}
                      <span className="ml-1 text-[10px] opacity-70">{contagemPorCargo[c]}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
            </Tabs>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar nome, matéria, e-mail…"
                  className="rounded-full pl-9"
                  maxLength={80}
                />
              </div>
              <Select
                value={filtroStatus}
                onValueChange={(v) => setFiltroStatus(v as typeof filtroStatus)}
              >
                <SelectTrigger className="w-full rounded-full sm:w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos status</SelectItem>
                  <SelectItem value="ativos">Ativos</SelectItem>
                  <SelectItem value="inativos">Inativos</SelectItem>
                  <SelectItem value="destaque">Em destaque</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-56 rounded-3xl" />
              ))}
            </div>
          ) : lista.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-card py-16 text-center">
              <Users className="mx-auto mb-2 size-8 text-muted-foreground" />
              <p className="font-display text-lg text-foreground">
                {todos.length === 0
                  ? "Nenhum profissional cadastrado ainda"
                  : "Nenhum resultado para os filtros aplicados"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {todos.length === 0
                  ? "Clique em “Novo profissional” para apresentar a equipe na página inicial."
                  : "Ajuste a busca ou os filtros para localizar a pessoa."}
              </p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {lista.map((p) => (
                <ProfissionalAdminCard
                  key={p.id}
                  p={p}
                  onEdit={() => openEdit(p)}
                  onRemove={() => setToDelete(p)}
                  removing={remove.isPending}
                  canDelete={canDelete}
                />
              ))}
            </div>
          )}
        </main>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-display">
                <GraduationCap className="size-5 text-primary" />
                {editing ? "Editar profissional" : "Novo profissional"}
              </DialogTitle>
              <DialogDescription>
                Preencha as informações que serão exibidas na página da equipe.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="nome">Nome completo *</Label>
                  <Input
                    id="nome"
                    required
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                    maxLength={120}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Cargo *</Label>
                  <Select
                    value={form.cargo}
                    onValueChange={(v) => setForm({ ...form, cargo: v as Cargo })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CARGO_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cargo_descricao">Cargo (descrição livre)</Label>
                  <Input
                    id="cargo_descricao"
                    value={form.cargo_descricao}
                    onChange={(e) => setForm({ ...form, cargo_descricao: e.target.value })}
                    placeholder="Ex: Professora de Matemática"
                    maxLength={120}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="foto_url">Foto do profissional</Label>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                    {form.foto_url ? (
                      <img
                        src={form.foto_url}
                        alt="Prévia"
                        className="size-16 rounded-full object-cover ring-2 ring-border"
                      />
                    ) : (
                      <div className="flex size-16 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground ring-2 ring-border">
                        sem foto
                      </div>
                    )}
                    <div className="flex-1 space-y-2">
                      <Input
                        id="foto_url"
                        type="url"
                        value={form.foto_url}
                        onChange={(e) => setForm({ ...form, foto_url: e.target.value })}
                        placeholder="https://… ou envie um arquivo"
                        maxLength={500}
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="hidden"
                          onChange={handleFotoUpload}
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="rounded-full"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading}
                        >
                          {uploading ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Upload className="size-3.5" />
                          )}
                          {uploading ? "Enviando…" : "Enviar foto"}
                        </Button>
                        {form.foto_url && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="rounded-full text-muted-foreground"
                            onClick={() => setForm({ ...form, foto_url: "" })}
                          >
                            Remover
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="disciplinas">Disciplinas / áreas (separadas por vírgula)</Label>
                  <Input
                    id="disciplinas"
                    value={form.disciplinas}
                    onChange={(e) => setForm({ ...form, disciplinas: e.target.value })}
                    placeholder="Matemática, Física"
                    maxLength={300}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="formacao">Formação acadêmica</Label>
                  <Input
                    id="formacao"
                    value={form.formacao}
                    onChange={(e) => setForm({ ...form, formacao: e.target.value })}
                    placeholder="Licenciatura em… / Mestrado em…"
                    maxLength={300}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="anos_experiencia">Anos de profissão</Label>
                  <Input
                    id="anos_experiencia"
                    inputMode="numeric"
                    value={form.anos_experiencia}
                    onChange={(e) =>
                      setForm({ ...form, anos_experiencia: e.target.value.replace(/\D/g, "") })
                    }
                    maxLength={2}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ano_ingresso">Ano de ingresso na escola</Label>
                  <Input
                    id="ano_ingresso"
                    inputMode="numeric"
                    value={form.ano_ingresso}
                    onChange={(e) =>
                      setForm({ ...form, ano_ingresso: e.target.value.replace(/\D/g, "") })
                    }
                    maxLength={4}
                    placeholder="2018"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="bio">Bio curta</Label>
                  <Textarea
                    id="bio"
                    value={form.bio}
                    onChange={(e) => setForm({ ...form, bio: e.target.value })}
                    rows={3}
                    maxLength={1000}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    maxLength={255}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="telefone">Telefone</Label>
                  <Input
                    id="telefone"
                    value={form.telefone}
                    onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                    maxLength={40}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lattes_url">Lattes</Label>
                  <Input
                    id="lattes_url"
                    type="url"
                    value={form.lattes_url}
                    onChange={(e) => setForm({ ...form, lattes_url: e.target.value })}
                    maxLength={500}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="linkedin_url">LinkedIn</Label>
                  <Input
                    id="linkedin_url"
                    type="url"
                    value={form.linkedin_url}
                    onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })}
                    maxLength={500}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="site_url">Site pessoal</Label>
                  <Input
                    id="site_url"
                    type="url"
                    value={form.site_url}
                    onChange={(e) => setForm({ ...form, site_url: e.target.value })}
                    maxLength={500}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="ordem">Ordem de exibição (opcional)</Label>
                  <Input
                    id="ordem"
                    inputMode="numeric"
                    value={form.ordem}
                    onChange={(e) => setForm({ ...form, ordem: e.target.value.replace(/\D/g, "") })}
                    placeholder="Menor número aparece primeiro"
                    maxLength={4}
                  />
                </div>
                <label className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 px-4 py-3">
                  <span className="text-sm font-medium text-foreground">Em destaque</span>
                  <Switch
                    checked={form.destaque}
                    onCheckedChange={(v) => setForm({ ...form, destaque: v })}
                  />
                </label>
                <label className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 px-4 py-3">
                  <span className="text-sm font-medium text-foreground">Ativo (visível)</span>
                  <Switch
                    checked={form.ativo}
                    onCheckedChange={(v) => setForm({ ...form, ativo: v })}
                  />
                </label>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => setOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" className="rounded-full" disabled={save.isPending}>
                  {save.isPending && <Loader2 className="size-4 animate-spin" />}
                  {editing ? "Salvar alterações" : "Cadastrar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover profissional?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação é permanente. {toDelete?.nome} será removido(a) da vitrine pública e do
                painel. Registros históricos vinculados podem ser afetados.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  if (toDelete) remove.mutate(toDelete.id);
                  setToDelete(null);
                }}
              >
                Remover
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PainelLayout>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-primary-foreground/15 bg-primary-foreground/10 p-4 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wide text-primary-foreground/75">
          {label}
        </span>
        <span className="text-primary-foreground/80">{icon}</span>
      </div>
      <p className="mt-1 font-display text-2xl font-bold text-primary-foreground">{value}</p>
    </div>
  );
}

function ProfissionalAdminCard({
  p,
  onEdit,
  onRemove,
  removing,
  canDelete,
}: {
  p: Profissional;
  onEdit: () => void;
  onRemove: () => void;
  removing: boolean;
  canDelete: boolean;
}) {
  return (
    <article
      className={`group relative flex flex-col overflow-hidden rounded-3xl border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg ${
        p.ativo ? "border-border/70" : "border-dashed border-border opacity-80"
      }`}
    >
      <div className="relative h-20 bg-gradient-to-br from-primary/85 via-primary/60 to-primary/40">
        <div className="absolute right-3 top-3 flex gap-1">
          {p.destaque && (
            <Badge className="rounded-full bg-gold text-gold-foreground hover:bg-gold text-[10px]">
              <Star className="size-3" /> Destaque
            </Badge>
          )}
          {!p.ativo && (
            <Badge
              variant="secondary"
              className="rounded-full bg-background/90 text-[10px] text-foreground"
            >
              <EyeOff className="size-3" /> Inativo
            </Badge>
          )}
        </div>
      </div>
      <div className="-mt-10 flex flex-1 flex-col items-center px-5 pb-5 text-center">
        {p.foto_url ? (
          <img
            src={p.foto_url}
            alt={p.nome}
            width={80}
            height={80}
            loading="lazy"
            className="size-20 rounded-full object-cover ring-4 ring-card"
          />
        ) : (
          <div className="flex size-20 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 font-display text-xl font-semibold text-primary-foreground ring-4 ring-card">
            {getInitials(p.nome)}
          </div>
        )}
        <p className="mt-3 line-clamp-1 font-display text-base font-semibold text-foreground">
          {p.nome}
        </p>
        <p className="line-clamp-1 text-xs font-medium text-primary">
          {p.cargo_descricao || CARGO_LABEL[p.cargo as Cargo]}
        </p>

        {p.disciplinas?.length > 0 && (
          <div className="mt-2 flex flex-wrap justify-center gap-1">
            {p.disciplinas.slice(0, 3).map((d) => (
              <Badge key={d} variant="secondary" className="rounded-full text-[10px] font-normal">
                <BookOpen className="size-3" />
                {d}
              </Badge>
            ))}
            {p.disciplinas.length > 3 && (
              <Badge variant="secondary" className="rounded-full text-[10px] font-normal">
                +{p.disciplinas.length - 3}
              </Badge>
            )}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-[11px] text-muted-foreground">
          {p.email && !isEmailFicticio(p.email) && (
            <span className="inline-flex items-center gap-1">
              <Mail className="size-3" /> <span className="max-w-[110px] truncate">{p.email}</span>
            </span>
          )}
          {p.telefone && (
            <span className="inline-flex items-center gap-1">
              <Phone className="size-3" /> {p.telefone}
            </span>
          )}
        </div>

        {(p.anos_experiencia != null || p.ano_ingresso != null) && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            {p.anos_experiencia != null && <>{p.anos_experiencia} anos de profissão</>}
            {p.anos_experiencia != null && p.ano_ingresso != null && " · "}
            {p.ano_ingresso != null && <>na escola desde {p.ano_ingresso}</>}
          </p>
        )}

        <div className="mt-auto flex w-full gap-2 pt-4">
          <Button size="sm" variant="outline" className="flex-1 rounded-full" onClick={onEdit}>
            <Pencil className="size-3.5" /> Editar
          </Button>
          {canDelete && (
            <Button
              size="sm"
              variant="outline"
              className="rounded-full text-destructive hover:bg-destructive/10"
              onClick={onRemove}
              disabled={removing}
              aria-label={`Remover ${p.nome}`}
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

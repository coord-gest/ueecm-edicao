import { useMemo, useState } from "react";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Calendar,
  Download,
  FileText,
  Loader2,
  LogOut,
  Sparkles,
  Trash2,
  Upload,
  User,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import {
  criarPlanejamento,
  excluirPlanejamento,
  gerarPlanejamentoIA,
  listMeusPlanejamentos,
  listDisciplinasParaPlanejamento,
  listProfessoresParaPlanejamento,
  type Planejamento,
  type PlanejamentoTipo,
} from "@/lib/planejamentos.functions";

export const Route = createFileRoute("/painel-arquivos/planejamentos")({
  ssr: false,
  head: () => ({ meta: [{ title: "Planejamentos | Arquivos" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: PlanejamentosPage,
});

const TIPO_LABEL: Record<PlanejamentoTipo, string> = {
  semanal: "Semanal",
  quinzenal: "Quinzenal",
  mensal: "Mensal",
  semestral: "Semestral",
};

const TIPO_COLOR: Record<PlanejamentoTipo, string> = {
  semanal: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
  quinzenal: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  mensal: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
  semestral: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20",
};

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function PlanejamentosPage() {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const listFn = useServerFn(listMeusPlanejamentos);
  const listProfsFn = useServerFn(listProfessoresParaPlanejamento);
  const listDiscsFn = useServerFn(listDisciplinasParaPlanejamento);
  const criarFn = useServerFn(criarPlanejamento);
  const excluirFn = useServerFn(excluirPlanejamento);
  const gerarFn = useServerFn(gerarPlanejamentoIA);

  const { data: planejamentos, isLoading } = useQuery({
    queryKey: ["planejamentos", "meus"],
    queryFn: () => listFn(),
  });

  const { data: professores } = useQuery({
    queryKey: ["planejamentos", "professores"],
    queryFn: () => listProfsFn(),
    retry: false,
  });

  const { data: disciplinas } = useQuery({
    queryKey: ["planejamentos", "disciplinas"],
    queryFn: () => listDiscsFn(),
  });

  const isGestao = !!professores; // se listagem funcionou, é gestão

  const excluirMut = useMutation({
    mutationFn: (id: string) => excluirFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Planejamento excluído");
      qc.invalidateQueries({ queryKey: ["planejamentos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/", replace: true });
  };

  const [tabFiltro, setTabFiltro] = useState<PlanejamentoTipo | "todos">("todos");

  const planejamentosFiltrados = useMemo(() => {
    const list = planejamentos ?? [];
    if (tabFiltro === "todos") return list;
    return list.filter((p) => p.tipo === tabFiltro);
  }, [planejamentos, tabFiltro]);

  return (
    <>
      <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b border-border/60 bg-background/85 px-4 backdrop-blur-lg sm:px-6">
        <Link
          to="/painel-arquivos"
          className="inline-flex size-9 items-center justify-center rounded-full text-foreground hover:bg-accent"
          aria-label="Voltar para Arquivos"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div className="ml-1 min-w-0 flex-1">
          <p className="truncate font-display text-sm font-semibold text-foreground sm:text-base">
            Planejamentos Pedagógicos
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <ThemeToggle className="rounded-full" />
          <Button onClick={handleSignOut} variant="outline" size="sm" className="rounded-full">
            <LogOut className="size-4" /> <span className="hidden sm:inline">Sair</span>
          </Button>
        </div>
      </header>

      <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <Breadcrumbs
            className="mb-3"
            items={[
              { label: "Início", to: "/" },
              { label: "Painel", to: "/painel" },
              { label: "Arquivos", to: "/painel-arquivos" },
              { label: "Planejamentos" },
            ]}
          />

          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-semibold text-foreground">
                Planejamentos {isGestao ? "(Gestão)" : "(Meus)"}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {isGestao
                  ? "Gerencie planejamentos semanais, quinzenais, mensais e semestrais por professor e disciplina. Use a IA para acelerar a elaboração."
                  : "Consulte e baixe os planejamentos que a coordenação pedagógica cadastrou para você."}
              </p>
            </div>
            {isGestao && (
              <NovoPlanejamentoDialog
                professores={professores ?? []}
                disciplinas={disciplinas ?? []}
                onCreate={async (payload) => {
                  await criarFn({ data: payload });
                  qc.invalidateQueries({ queryKey: ["planejamentos"] });
                  toast.success("Planejamento criado!");
                }}
                onGerarIA={(payload) => gerarFn({ data: payload })}
              />
            )}
          </div>

          <Tabs value={tabFiltro} onValueChange={(v) => setTabFiltro(v as typeof tabFiltro)}>
            <TabsList className="mb-4 flex-wrap">
              <TabsTrigger value="todos">Todos</TabsTrigger>
              <TabsTrigger value="semanal">Semanais</TabsTrigger>
              <TabsTrigger value="quinzenal">Quinzenais</TabsTrigger>
              <TabsTrigger value="mensal">Mensais</TabsTrigger>
              <TabsTrigger value="semestral">Semestrais</TabsTrigger>
            </TabsList>

            <TabsContent value={tabFiltro} className="mt-0">
              {isLoading ? (
                <div className="grid place-items-center rounded-[5px] border border-dashed border-border/70 p-10">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
              ) : planejamentosFiltrados.length === 0 ? (
                <div className="grid place-items-center rounded-[5px] border border-dashed border-border/70 bg-muted/30 p-10 text-center">
                  <FileText className="size-10 text-muted-foreground" />
                  <p className="mt-3 font-medium text-foreground">
                    Nenhum planejamento {tabFiltro !== "todos" ? TIPO_LABEL[tabFiltro].toLowerCase() : ""} encontrado
                  </p>
                  {!isGestao && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      A coordenação pedagógica ainda não cadastrou planejamentos para você.
                    </p>
                  )}
                </div>
              ) : (
                <ul className="grid gap-4 md:grid-cols-2">
                  {planejamentosFiltrados.map((p) => (
                    <PlanejamentoCard
                      key={p.id}
                      p={p}
                      isGestao={isGestao}
                      onDelete={() => excluirMut.mutate(p.id)}
                    />
                  ))}
                </ul>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </>
  );
}

function PlanejamentoCard({
  p,
  isGestao,
  onDelete,
}: {
  p: Planejamento;
  isGestao: boolean;
  onDelete: () => void;
}) {
  const [openConteudo, setOpenConteudo] = useState(false);

  async function baixarArquivo() {
    if (!p.arquivo_url) return;
    try {
      const { data, error } = await supabase.storage
        .from("planejamentos")
        .createSignedUrl(p.arquivo_url, 300);
      if (error) throw error;
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error("Não foi possível baixar o arquivo.");
      console.error(e);
    }
  }

  return (
    <li>
      <article className="flex h-full flex-col rounded-[5px] border border-border/70 bg-card p-5 shadow-sm">
        <header className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-[5px] bg-primary/10 text-primary">
            <FileText className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={`rounded-[5px] ${TIPO_COLOR[p.tipo]}`}>
                {TIPO_LABEL[p.tipo]}
              </Badge>
              {p.ai_generated && (
                <Badge variant="outline" className="rounded-[5px] bg-primary/5 text-primary">
                  <Sparkles className="mr-1 size-3" /> IA
                </Badge>
              )}
            </div>
            <h2 className="mt-2 font-display text-base font-semibold text-foreground">
              {p.titulo}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <User className="size-3" /> {p.professor_nome}
              </span>
              <span>{p.disciplina_nome}</span>
              {(p.periodo_inicio || p.periodo_fim) && (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="size-3" />
                  {p.periodo_inicio ?? "?"} → {p.periodo_fim ?? "?"}
                </span>
              )}
            </div>
          </div>
        </header>

        {p.descricao && (
          <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{p.descricao}</p>
        )}

        <div className="mt-auto flex flex-wrap gap-2 pt-4">
          {p.arquivo_url && (
            <Button size="sm" className="rounded-[5px]" onClick={baixarArquivo}>
              <Download className="size-4" /> Baixar {formatSize(p.arquivo_tamanho)}
            </Button>
          )}
          {p.conteudo_ia && (
            <Button
              size="sm"
              variant="outline"
              className="rounded-[5px]"
              onClick={() => setOpenConteudo(true)}
            >
              <FileText className="size-4" /> Ver conteúdo
            </Button>
          )}
          {isGestao && (
            <Button
              size="sm"
              variant="outline"
              className="ml-auto rounded-[5px] text-destructive hover:bg-destructive/10"
              onClick={() => {
                if (confirm(`Excluir planejamento "${p.titulo}"?`)) onDelete();
              }}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      </article>

      <Dialog open={openConteudo} onOpenChange={setOpenConteudo}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{p.titulo}</DialogTitle>
            <DialogDescription>
              {p.professor_nome} · {p.disciplina_nome} · {TIPO_LABEL[p.tipo]}
            </DialogDescription>
          </DialogHeader>
          <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-[5px] border border-border/70 bg-muted/30 p-4 text-sm text-foreground">
            {p.conteudo_ia}
          </pre>
        </DialogContent>
      </Dialog>
    </li>
  );
}

type NovoPlanejamentoPayload = {
  professor_id: string;
  disciplina_id: string | null;
  tipo: PlanejamentoTipo;
  titulo: string;
  descricao: string | null;
  conteudo_ia: string | null;
  periodo_inicio: string | null;
  periodo_fim: string | null;
  arquivo_url: string | null;
  arquivo_nome: string | null;
  arquivo_tamanho: number | null;
  ai_generated: boolean;
};

function NovoPlanejamentoDialog({
  professores,
  disciplinas,
  onCreate,
  onGerarIA,
}: {
  professores: Array<{ id: string; nome: string; disciplinas: string[] | null; cargo: string }>;
  disciplinas: Array<{ id: string; nome: string }>;
  onCreate: (payload: NovoPlanejamentoPayload) => Promise<void>;
  onGerarIA: (payload: {
    tipo: PlanejamentoTipo;
    disciplina: string;
    turma?: string | null;
    serie?: string | null;
    tema: string;
    objetivos?: string | null;
    bncc?: string | null;
  }) => Promise<{ conteudo: string; titulo: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [gerando, setGerando] = useState(false);

  const [professorId, setProfessorId] = useState("");
  const [disciplinaId, setDisciplinaId] = useState<string>("");
  const [tipo, setTipo] = useState<PlanejamentoTipo>("semanal");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [conteudoIA, setConteudoIA] = useState("");
  const [temaIA, setTemaIA] = useState("");
  const [objetivosIA, setObjetivosIA] = useState("");
  const [periodoInicio, setPeriodoInicio] = useState("");
  const [periodoFim, setPeriodoFim] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);

  const professorNome = professores.find((p) => p.id === professorId)?.nome ?? "";
  const disciplinaNome = disciplinas.find((d) => d.id === disciplinaId)?.nome ?? "";

  function resetForm() {
    setProfessorId("");
    setDisciplinaId("");
    setTipo("semanal");
    setTitulo("");
    setDescricao("");
    setConteudoIA("");
    setTemaIA("");
    setObjetivosIA("");
    setPeriodoInicio("");
    setPeriodoFim("");
    setArquivo(null);
  }

  async function handleGerarIA() {
    if (!disciplinaNome) {
      toast.error("Selecione a disciplina primeiro.");
      return;
    }
    if (temaIA.trim().length < 5) {
      toast.error("Descreva o tema (mín. 5 caracteres).");
      return;
    }
    setGerando(true);
    try {
      const res = await onGerarIA({
        tipo,
        disciplina: disciplinaNome,
        tema: temaIA.trim(),
        objetivos: objetivosIA.trim() || null,
      });
      setConteudoIA(res.conteudo);
      if (!titulo.trim()) setTitulo(res.titulo);
      toast.success("Planejamento gerado pela IA!");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao gerar";
      toast.error(msg);
    } finally {
      setGerando(false);
    }
  }

  async function uploadArquivo(): Promise<{ path: string; size: number; name: string } | null> {
    if (!arquivo) return null;
    const safeName = arquivo.name.replace(/[^\w.\-]/g, "_");
    const path = `${professorId}/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage
      .from("planejamentos")
      .upload(path, arquivo, { upsert: false, contentType: arquivo.type });
    if (error) throw error;
    return { path, size: arquivo.size, name: arquivo.name };
  }

  async function handleSalvar() {
    if (!professorId) return toast.error("Selecione o professor.");
    if (!titulo.trim()) return toast.error("Informe o título.");
    if (!arquivo && !conteudoIA.trim() && !descricao.trim()) {
      return toast.error("Adicione conteúdo (arquivo, descrição ou conteúdo IA).");
    }
    setSaving(true);
    try {
      const up = await uploadArquivo();
      await onCreate({
        professor_id: professorId,
        disciplina_id: disciplinaId || null,
        tipo,
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        conteudo_ia: conteudoIA.trim() || null,
        periodo_inicio: periodoInicio || null,
        periodo_fim: periodoFim || null,
        arquivo_url: up?.path ?? null,
        arquivo_nome: up?.name ?? null,
        arquivo_tamanho: up?.size ?? null,
        ai_generated: !!conteudoIA.trim(),
      });
      setOpen(false);
      resetForm();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao salvar";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)} className="rounded-[5px]">
        <Upload className="size-4" /> Novo planejamento
      </Button>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo planejamento pedagógico</DialogTitle>
          <DialogDescription>
            Selecione o professor e a disciplina, faça upload do arquivo ou gere um rascunho com IA.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Professor *</Label>
              <Select value={professorId} onValueChange={setProfessorId}>
                <SelectTrigger className="rounded-[5px]">
                  <SelectValue placeholder="Selecione o professor" />
                </SelectTrigger>
                <SelectContent>
                  {professores.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Disciplina</Label>
              <Select value={disciplinaId} onValueChange={setDisciplinaId}>
                <SelectTrigger className="rounded-[5px]">
                  <SelectValue placeholder="Selecione a disciplina" />
                </SelectTrigger>
                <SelectContent>
                  {disciplinas.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Tipo *</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as PlanejamentoTipo)}>
                <SelectTrigger className="rounded-[5px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="semanal">Semanal</SelectItem>
                  <SelectItem value="quinzenal">Quinzenal</SelectItem>
                  <SelectItem value="mensal">Mensal</SelectItem>
                  <SelectItem value="semestral">Semestral</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Início</Label>
              <Input
                type="date"
                value={periodoInicio}
                onChange={(e) => setPeriodoInicio(e.target.value)}
                className="rounded-[5px]"
              />
            </div>
            <div>
              <Label>Fim</Label>
              <Input
                type="date"
                value={periodoFim}
                onChange={(e) => setPeriodoFim(e.target.value)}
                className="rounded-[5px]"
              />
            </div>
          </div>

          <div>
            <Label>Título *</Label>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Planejamento Semanal — Frações"
              className="rounded-[5px]"
            />
          </div>

          <div>
            <Label>Descrição breve</Label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={2}
              placeholder="Resumo curto sobre este planejamento (opcional)"
              className="rounded-[5px]"
            />
          </div>

          <div className="rounded-[5px] border border-primary/30 bg-primary/5 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary">
              <Sparkles className="size-4" /> Assistente Gemini
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              Gere um rascunho de planejamento estruturado a partir de um tema. Depois edite conforme sua realidade.
            </p>
            <div className="grid gap-3">
              <div>
                <Label>Tema/Conteúdo</Label>
                <Input
                  value={temaIA}
                  onChange={(e) => setTemaIA(e.target.value)}
                  placeholder="Ex.: Frações equivalentes e simplificação"
                  className="rounded-[5px]"
                />
              </div>
              <div>
                <Label>Objetivos (opcional)</Label>
                <Input
                  value={objetivosIA}
                  onChange={(e) => setObjetivosIA(e.target.value)}
                  placeholder="Ex.: reconhecer, comparar e simplificar frações"
                  className="rounded-[5px]"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="rounded-[5px]"
                onClick={handleGerarIA}
                disabled={gerando}
              >
                {gerando ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Gerando…
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" /> Gerar com Gemini
                  </>
                )}
              </Button>
              {conteudoIA && (
                <Textarea
                  value={conteudoIA}
                  onChange={(e) => setConteudoIA(e.target.value)}
                  rows={10}
                  className="rounded-[5px] font-mono text-xs"
                />
              )}
            </div>
          </div>

          <div>
            <Label>Arquivo (PDF, DOCX, XLSX)</Label>
            <Input
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.odt"
              onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
              className="rounded-[5px]"
            />
            {arquivo && (
              <p className="mt-1 text-xs text-muted-foreground">
                {arquivo.name} · {formatSize(arquivo.size)}
              </p>
            )}
          </div>

          {professorNome && (
            <p className="text-xs text-muted-foreground">
              Para: <strong>{professorNome}</strong>
              {disciplinaNome && ` · ${disciplinaNome}`}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} className="rounded-[5px]">
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={saving} className="rounded-[5px]">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            Salvar planejamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
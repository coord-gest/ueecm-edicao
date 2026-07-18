import { useEffect, useState } from "react";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FileText, Loader2, Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { getArquivoTemplate } from "@/lib/arquivo-templates";
import {
  BIMESTRES,
  createPreenchimento,
  deletePreenchimento,
  getPreenchimento,
  listPreenchimentos,
  migrarTodosLegados,
  moverLegadosParaTemplate,
  type ArquivoPreenchimentoDados,
} from "@/lib/arquivo-preenchimentos";
import { AvaliacaoBimestralEditor } from "@/components/escola/AvaliacaoBimestralEditor";
import { NotasPorAreaEditor } from "@/components/escola/NotasPorAreaEditor";

export const Route = createFileRoute("/painel-arquivos/$templateId")({
  ssr: false,
  head: () => ({ meta: [{ title: "Preencher modelo | Arquivos" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: PreencherModeloPage,
});

function PreencherModeloPage() {
  const { templateId } = Route.useParams();
  const { user, isStaff, isAdmin, isDeveloper, roles } = useAuth();
  const canDelete = isDeveloper || roles.includes("diretor") || roles.includes("coordenador");
  const navigate = useNavigate();
  const qc = useQueryClient();
  const template = getArquivoTemplate(templateId);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [migrando, setMigrando] = useState(false);
  const [movendo, setMovendo] = useState(false);
  const isLegacyTemplate = templateId === "notas-por-area";

  // Preferências persistidas
  const PREFS_KEY = `arquivos-prefs:${templateId}`;
  type SortMode = "turma-asc" | "recent";
  const [sortMode, setSortMode] = useState<SortMode>("turma-asc");
  const [groupByTurma, setGroupByTurma] = useState(true);
  const [turmaFilter, setTurmaFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(PREFS_KEY);
      if (raw) {
        const p = JSON.parse(raw) as {
          sortMode?: SortMode;
          groupByTurma?: boolean;
          turmaFilter?: string;
        };
        if (p.sortMode === "turma-asc" || p.sortMode === "recent") setSortMode(p.sortMode);
        if (typeof p.groupByTurma === "boolean") setGroupByTurma(p.groupByTurma);
        if (typeof p.turmaFilter === "string") setTurmaFilter(p.turmaFilter);
      }
    } catch {
      /* noop */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        PREFS_KEY,
        JSON.stringify({ sortMode, groupByTurma, turmaFilter }),
      );
    } catch {
      /* noop */
    }
  }, [PREFS_KEY, sortMode, groupByTurma, turmaFilter]);

  const listQuery = useQuery({
    queryKey: ["preenchimentos", templateId],
    queryFn: () => listPreenchimentos(templateId),
    enabled: !!template,
  });

  const editQuery = useQuery({
    queryKey: ["preenchimento", editingId],
    queryFn: () => getPreenchimento(editingId!),
    enabled: !!editingId,
  });

  const podeVerTodas = isAdmin || isDeveloper || isStaff;
  const turmasQuery = useQuery({
    queryKey: ["turmas-professor", user?.id, podeVerTodas],
    enabled: !!user,
    queryFn: async () => {
      let query = supabase
        .from("turmas_escolares")
        .select("id, nome, ano_serie, turno, ano_letivo")
        .order("ano_letivo", { ascending: false })
        .order("ano_serie")
        .order("nome");
      if (!podeVerTodas) {
        query = query.eq("professor_responsavel_id", user!.id);
      }
      const { data } = await query;
      return data ?? [];
    },
  });

  if (!template) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p className="text-sm text-muted-foreground">Modelo não encontrado.</p>
        <Button
          variant="outline"
          onClick={() => navigate({ to: "/painel-arquivos" })}
          className="mt-4"
        >
          Voltar
        </Button>
      </main>
    );
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este preenchimento? Esta ação não pode ser desfeita.")) return;
    try {
      await deletePreenchimento(id);
      toast.success("Excluído.");
      qc.invalidateQueries({ queryKey: ["preenchimentos", templateId] });
      if (editingId === id) setEditingId(null);
    } catch (e) {
      console.error(e);
      toast.error("Falha ao excluir.");
    }
  }

  return (
    <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <Breadcrumbs
          className="mb-3"
          items={[
            { label: "Painel", to: "/painel" },
            { label: "Arquivos", to: "/painel-arquivos" },
            { label: template.nome },
          ]}
        />

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-xl font-semibold sm:text-2xl">{template.nome}</h1>
            <p className="text-sm text-muted-foreground">{template.descricao}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link to="/painel-arquivos">
                <ArrowLeft className="size-4" /> Voltar
              </Link>
            </Button>
            {canDelete && !isLegacyTemplate && (
              <>
                <Button
                  variant="outline"
                  disabled={movendo}
                  onClick={async () => {
                    if (
                      !confirm(
                        "Mover todos os preenchimentos antigos (por Área) para o modelo\n" +
                          '"Notas Por Área de Conhecimento"?\n\n' +
                          "Nenhum dado é perdido — os alunos e notas continuam intactos, " +
                          "apenas passam a aparecer no template certo.",
                      )
                    )
                      return;
                    setMovendo(true);
                    try {
                      const r = await moverLegadosParaTemplate(templateId, "notas-por-area");
                      toast.success(
                        `${r.movidos} preenchimento(s) movido(s) para "Notas Por Área". ${r.ignorados} já eram Boletim Oficial. ${r.erros} erro(s).`,
                      );
                      qc.invalidateQueries({ queryKey: ["preenchimentos", templateId] });
                    } catch (e) {
                      console.error(e);
                      toast.error("Falha ao mover. Veja o console.");
                    } finally {
                      setMovendo(false);
                    }
                  }}
                >
                  {movendo ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <RotateCcw className="size-4" />
                  )}
                  Separar antigos → Notas Por Área
                </Button>
                <Button
                  variant="outline"
                  disabled={migrando}
                  onClick={async () => {
                    if (
                      !confirm(
                        "Migrar (converter) todos os preenchimentos antigos deste template para o Boletim Oficial?\n\n" +
                          "As notas por área serão replicadas na coluna AE de cada bimestre. " +
                          "Os dados originais ficam preservados como backup dentro do JSON.",
                      )
                    )
                      return;
                    setMigrando(true);
                    try {
                      const r = await migrarTodosLegados(templateId);
                      toast.success(
                        `Migração concluída: ${r.migrados} migrado(s), ${r.ignorados} já no formato novo, ${r.erros} erro(s).`,
                      );
                      qc.invalidateQueries({ queryKey: ["preenchimentos", templateId] });
                    } catch (e) {
                      console.error(e);
                      toast.error("Falha ao migrar. Veja o console.");
                    } finally {
                      setMigrando(false);
                    }
                  }}
                >
                  {migrando ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <RotateCcw className="size-4" />
                  )}
                  Migrar antigos → Boletim Oficial
                </Button>
              </>
            )}
            <Button onClick={() => setShowNew(true)}>
              <Plus className="size-4" /> Novo preenchimento
            </Button>
          </div>
        </div>

        {/* Lista de preenchimentos */}
        {!editingId && (
          <div className="rounded-2xl border border-border/70 bg-card p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">Preenchimentos existentes</h2>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar por turma, ano ou título"
                    className="h-9 w-64 pl-8"
                  />
                </div>
                <Select value={turmaFilter} onValueChange={setTurmaFilter}>
                  <SelectTrigger className="h-9 w-52">
                    <SelectValue placeholder="Filtrar por turma" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as turmas</SelectItem>
                    {(turmasQuery.data ?? []).map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.nome}
                        {t.ano_serie ? ` — ${t.ano_serie}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={sortMode}
                  onValueChange={(v) => setSortMode(v as "turma-asc" | "recent")}
                >
                  <SelectTrigger className="h-9 w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="turma-asc">Turma (menor → maior)</SelectItem>
                    <SelectItem value="recent">Mais recentes primeiro</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2 rounded-md border border-border/70 px-2 py-1">
                  <Switch
                    id="group-turma"
                    checked={groupByTurma}
                    onCheckedChange={setGroupByTurma}
                  />
                  <Label htmlFor="group-turma" className="text-xs">
                    Agrupar por turma
                  </Label>
                </div>
                {(search !== "" ||
                  turmaFilter !== "all" ||
                  sortMode !== "turma-asc" ||
                  !groupByTurma) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9"
                    onClick={() => {
                      setSearch("");
                      setTurmaFilter("all");
                      setSortMode("turma-asc");
                      setGroupByTurma(true);
                    }}
                  >
                    <RotateCcw className="size-4" /> Limpar
                  </Button>
                )}
              </div>
            </div>
            {listQuery.isLoading ? (
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            ) : listQuery.data && listQuery.data.length > 0 ? (
              (() => {
                const turmasMap = new Map((turmasQuery.data ?? []).map((t) => [t.id, t]));
                type Item = (typeof listQuery.data)[number];
                const anoNumOf = (t?: { ano_serie?: string | null }) =>
                  t?.ano_serie ? parseInt(String(t.ano_serie).match(/\d+/)?.[0] ?? "999", 10) : 999;
                const labelOf = (turmaId: string) => {
                  const t = turmasMap.get(turmaId);
                  return t
                    ? `${t.nome}${t.ano_serie ? ` — ${t.ano_serie}` : ""}${t.turno ? ` (${t.turno})` : ""}`
                    : "Turma não identificada";
                };
                const q = search.trim().toLowerCase();
                const filtered = listQuery.data.filter((p) => {
                  if (turmaFilter !== "all" && p.turma_id !== turmaFilter) return false;
                  if (!q) return true;
                  const label = labelOf(p.turma_id).toLowerCase();
                  return label.includes(q) || p.titulo.toLowerCase().includes(q);
                });

                if (filtered.length === 0) {
                  return (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      Nenhum preenchimento corresponde ao filtro.
                    </p>
                  );
                }

                const renderRow = (p: Item) => (
                  <li key={p.id} className="flex items-center gap-3 py-3">
                    <FileText className="size-5 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{p.titulo}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.bimestre}º Bimestre • Atualizado{" "}
                        {new Date(p.updated_at).toLocaleString()}
                      </p>
                    </div>
                    <Button size="sm" onClick={() => setEditingId(p.id)}>
                      Abrir
                    </Button>
                    {canDelete && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(p.id)}
                        title="Excluir (apenas Direção/Coordenação/Desenvolvedor)"
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    )}
                  </li>
                );

                if (!groupByTurma) {
                  const flat = filtered.slice().sort((a, b) => {
                    if (sortMode === "recent") {
                      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
                    }
                    const ta = turmasMap.get(a.turma_id);
                    const tb = turmasMap.get(b.turma_id);
                    const da = anoNumOf(ta);
                    const db = anoNumOf(tb);
                    if (da !== db) return da - db;
                    const na = ta?.nome ?? "zzz";
                    const nb = tb?.nome ?? "zzz";
                    const cmp = na.localeCompare(nb, "pt-BR", { numeric: true });
                    if (cmp !== 0) return cmp;
                    return a.bimestre - b.bimestre;
                  });
                  return <ul className="divide-y divide-border/50">{flat.map(renderRow)}</ul>;
                }

                const groups = new Map<
                  string,
                  {
                    turmaId: string;
                    label: string;
                    anoNum: number;
                    nome: string;
                    latest: number;
                    items: Item[];
                  }
                >();
                for (const p of filtered) {
                  const t = turmasMap.get(p.turma_id);
                  const updated = new Date(p.updated_at).getTime();
                  const g = groups.get(p.turma_id) ?? {
                    turmaId: p.turma_id,
                    label: labelOf(p.turma_id),
                    anoNum: anoNumOf(t),
                    nome: t?.nome ?? "zzz",
                    latest: 0,
                    items: [] as Item[],
                  };
                  g.items.push(p);
                  if (updated > g.latest) g.latest = updated;
                  groups.set(p.turma_id, g);
                }
                const sorted = Array.from(groups.values()).sort((a, b) => {
                  if (sortMode === "recent") return b.latest - a.latest;
                  if (a.anoNum !== b.anoNum) return a.anoNum - b.anoNum;
                  return a.nome.localeCompare(b.nome, "pt-BR", { numeric: true });
                });
                return (
                  <div className="space-y-5">
                    {sorted.map((g) => (
                      <div key={g.turmaId}>
                        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {g.label}
                        </h3>
                        <ul className="divide-y divide-border/50">
                          {g.items
                            .slice()
                            .sort((a, b) =>
                              sortMode === "recent"
                                ? new Date(b.updated_at).getTime() -
                                  new Date(a.updated_at).getTime()
                                : a.bimestre - b.bimestre,
                            )
                            .map(renderRow)}
                        </ul>
                      </div>
                    ))}
                  </div>
                );
              })()
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhum preenchimento ainda. Clique em "Novo preenchimento" para começar.
              </p>
            )}
          </div>
        )}

        {/* Editor ativo */}
        {editingId && editQuery.data && (
          <div className="space-y-3">
            <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
              <ArrowLeft className="size-4" /> Voltar para a lista
            </Button>
            {isLegacyTemplate ? (
              <NotasPorAreaEditor template={template} preenchimento={editQuery.data} />
            ) : (
              <AvaliacaoBimestralEditor template={template} preenchimento={editQuery.data} />
            )}
          </div>
        )}
        {editingId && editQuery.isLoading && (
          <div className="grid place-items-center py-16">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        )}

        <NovoPreenchimentoDialog
          open={showNew}
          onOpenChange={setShowNew}
          templateId={templateId}
          legacy={isLegacyTemplate}
          turmas={turmasQuery.data ?? []}
          onCreated={(id) => {
            setShowNew(false);
            qc.invalidateQueries({ queryKey: ["preenchimentos", templateId] });
            setEditingId(id);
          }}
        />
      </div>
    </main>
  );
}

function NovoPreenchimentoDialog({
  open,
  onOpenChange,
  templateId,
  legacy,
  turmas,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  templateId: string;
  legacy?: boolean;
  turmas: Array<{
    id: string;
    nome: string;
    ano_serie: string | null;
    turno: string | null;
    ano_letivo: number | null;
  }>;
  onCreated: (id: string) => void;
}) {
  const [turmaId, setTurmaId] = useState<string>("");
  const [bimestre, setBimestre] = useState<number>(1);
  const [titulo, setTitulo] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setTurmaId("");
      setBimestre(1);
      setTitulo("");
    }
  }, [open]);

  useEffect(() => {
    const t = turmas.find((x) => x.id === turmaId);
    if (t) {
      const prefix = legacy ? "Notas Por Área" : "Avaliação Bimestral";
      setTitulo(`${prefix} — ${t.nome} — ${bimestre}º Bim`);
    }
  }, [turmaId, bimestre, turmas, legacy]);

  async function handleCreate() {
    if (!turmaId) return toast.error("Selecione a turma.");
    setSaving(true);
    try {
      const { data: alunos } = await supabase
        .from("alunos")
        .select("id, nome_completo, matricula, data_nascimento")
        .eq("turma_id", turmaId)
        .order("nome_completo");
      const dados: ArquivoPreenchimentoDados = legacy
        ? {
            notasPorBimestre: {},
            alunos: (alunos ?? []).map((a) => ({
              id: a.id,
              nome: a.nome_completo,
              matricula: a.matricula,
              nascimento: a.data_nascimento
                ? new Date(a.data_nascimento).toLocaleDateString("pt-BR")
                : null,
            })),
          }
        : {
            notasBoletim: {},
            alunos: (alunos ?? []).map((a) => ({
              id: a.id,
              nome: a.nome_completo,
              matricula: a.matricula,
              nascimento: a.data_nascimento
                ? new Date(a.data_nascimento).toLocaleDateString("pt-BR")
                : null,
            })),
          };
      const { id } = await createPreenchimento({
        template_id: templateId,
        turma_id: turmaId,
        bimestre,
        titulo,
        dados,
      });
      onCreated(id);
    } catch (e) {
      console.error(e);
      toast.error("Falha ao criar preenchimento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo preenchimento</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Turma</Label>
            <Select value={turmaId} onValueChange={setTurmaId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecione a turma" />
              </SelectTrigger>
              <SelectContent>
                {turmas.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.nome} — {t.ano_serie} ({t.turno})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {turmas.length === 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                Você não é responsável por nenhuma turma.
              </p>
            )}
          </div>
          <div>
            <Label>Bimestre</Label>
            <Select value={String(bimestre)} onValueChange={(v) => setBimestre(Number(v))}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BIMESTRES.map((b) => (
                  <SelectItem key={b.value} value={String(b.value)}>
                    {b.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Título</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="mt-1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={saving || !turmaId}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Criar e abrir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

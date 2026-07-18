import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Heart,
  Plus,
  Trash2,
  Power,
  PowerOff,
  Save,
  Loader2,
  Pencil,
  X,
  Eye,
  EyeOff,
  GripVertical,
  Search,
  CheckSquare,
  Square,
  ExternalLink,
  ImageIcon,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { useRolePainelGuard } from "@/lib/use-role-guard";
import { RolePainelShell } from "@/components/RolePainelShell";
import { RolesFallback } from "@/components/RolesFallback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
} from "@/components/ui/alert-dialog";
import {
  listEventosAdmin,
  listPatrocinadoresAdmin,
  upsertEvento,
  toggleEventoAtivo,
  deleteEvento,
  upsertPatrocinador,
  togglePatrocinadorAtivo,
  setPatrocinadoresOrdem,
  bulkTogglePatrocinadoresAtivo,
  deletePatrocinador,
  getPatrocinadoresStats,
  type EventoPatrocinio,
  type Patrocinador,
  type PatroStat,
} from "@/lib/patrocinadores.functions";

export const Route = createFileRoute("/painel-patrocinadores")({
  ssr: false,
  head: () => ({ meta: [{ title: "Patrocinadores | Painel" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: PainelPatrocinadores,
});

const eventoEmpty: Partial<EventoPatrocinio> = {
  nome: "",
  descricao: "",
  data_inicio: "",
  data_fim: "",
  ativo: false,
  ordem: 0,
};

const patroEmpty: Partial<Patrocinador> = {
  nome: "",
  logo_url: "",
  link_url: "",
  tipo_apoio: "",
  descricao: "",
  ordem: 0,
  ativo: true,
  vigencia_inicio: null,
  vigencia_fim: null,
};

function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const dims = { width: img.naturalWidth, height: img.naturalHeight };
      URL.revokeObjectURL(url);
      resolve(dims);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

function PainelPatrocinadores() {
  useRolePainelGuard(["desenvolvedor", "diretor"]);
  const { roles, loading: authLoading } = useAuth();

  const fetchEventos = useServerFn(listEventosAdmin);
  const fetchPatros = useServerFn(listPatrocinadoresAdmin);
  const fetchStats = useServerFn(getPatrocinadoresStats);
  const saveEvento = useServerFn(upsertEvento);
  const toggleEvento = useServerFn(toggleEventoAtivo);
  const delEvento = useServerFn(deleteEvento);
  const savePatro = useServerFn(upsertPatrocinador);
  const togglePatro = useServerFn(togglePatrocinadorAtivo);
  const setOrdemBulk = useServerFn(setPatrocinadoresOrdem);
  const bulkToggle = useServerFn(bulkTogglePatrocinadoresAtivo);
  const delPatro = useServerFn(deletePatrocinador);

  const [eventos, setEventos] = useState<EventoPatrocinio[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [patros, setPatros] = useState<Patrocinador[]>([]);
  const [stats, setStats] = useState<Map<string, PatroStat>>(new Map());
  const [statsDays, setStatsDays] = useState(30);
  const [patrosLoading, setPatrosLoading] = useState(false);

  const [eventoForm, setEventoForm] = useState<Partial<EventoPatrocinio>>(eventoEmpty);
  const [eventoEditingId, setEventoEditingId] = useState<string | null>(null);
  const [savingEvento, setSavingEvento] = useState(false);

  const [patroForm, setPatroForm] = useState<Partial<Patrocinador>>(patroEmpty);
  const [patroEditingId, setPatroEditingId] = useState<string | null>(null);
  const [savingPatro, setSavingPatro] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoWarning, setLogoWarning] = useState<string | null>(null);

  // Busca, filtro, seleção múltipla e DnD
  const [searchTerm, setSearchTerm] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState<string>("__all__");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const originalOrderRef = useRef<Patrocinador[]>([]);

  const [patroToDelete, setPatroToDelete] = useState<Patrocinador | null>(null);

  async function handleLogoUpload(file: File) {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) {
      toast.error("Faça login novamente.");
      return;
    }
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Formato inválido. Use PNG, JPG, WebP ou SVG.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx. 5 MB).");
      return;
    }
    setLogoWarning(null);

    // Análise de dimensões e proporção (não bloqueia — só avisa)
    if (file.type !== "image/svg+xml") {
      try {
        const dims = await readImageDimensions(file);
        const warnings: string[] = [];
        if (dims.width < 300 || dims.height < 300) {
          warnings.push(`Baixa resolução (${dims.width}×${dims.height}). Ideal: 600×750 ou maior.`);
        }
        const ratio = dims.width / dims.height;
        // Card do site é 4:5 (0.8). Aceita 0.7–1.2 sem aviso.
        if (ratio < 0.7 || ratio > 1.2) {
          warnings.push(
            `Proporção ${ratio.toFixed(2)}:1 pode cortar mal. Recorte quadrado ou 4:5 (vertical) mantém o logo preenchendo ~75% do card.`,
          );
        }
        if (warnings.length) setLogoWarning(warnings.join(" "));
      } catch {
        // Ignora falha silenciosa
      }
    }

    setUploadingLogo(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `patrocinadores/${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("alert-images")
        .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("alert-images").getPublicUrl(path);
      setPatroForm((f) => ({ ...f, logo_url: pub.publicUrl }));
      toast.success("Logo enviado.");
    } catch (err) {
      toast.error("Falha no upload", { description: (err as Error).message });
    } finally {
      setUploadingLogo(false);
    }
  }

  const selected = useMemo(
    () => eventos.find((e) => e.id === selectedId) ?? null,
    [eventos, selectedId],
  );

  // Lista de tipos únicos para o filtro
  const tiposDisponiveis = useMemo(() => {
    const set = new Set<string>();
    for (const p of patros) if (p.tipo_apoio) set.add(p.tipo_apoio);
    return Array.from(set).sort();
  }, [patros]);

  // Lista visível após busca + filtro (mantém a ordem)
  const patrosVisiveis = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return patros.filter((p) => {
      if (tipoFiltro !== "__all__" && (p.tipo_apoio ?? "") !== tipoFiltro) return false;
      if (!q) return true;
      return (
        p.nome.toLowerCase().includes(q) ||
        (p.tipo_apoio ?? "").toLowerCase().includes(q) ||
        (p.descricao ?? "").toLowerCase().includes(q)
      );
    });
  }, [patros, searchTerm, tipoFiltro]);

  async function reloadEventos() {
    setLoading(true);
    try {
      const rows = await fetchEventos();
      setEventos(rows);
      if (!selectedId && rows.length > 0) setSelectedId(rows[0].id);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function reloadPatros(evId: string) {
    setPatrosLoading(true);
    try {
      const rows = await fetchPatros({ data: { evento_id: evId } });
      setPatros(rows);
      setSelectedIds(new Set());
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPatrosLoading(false);
    }
  }

  useEffect(() => {
    reloadEventos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedId) reloadPatros(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchStats({ data: { evento_id: selectedId, days: statsDays } });
        if (cancelled) return;
        const m = new Map<string, PatroStat>();
        for (const r of rows) m.set(r.patrocinador_id, r);
        setStats(m);
      } catch {
        // silencioso — analytics não deve quebrar o painel
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId, statsDays, patros.length, fetchStats]);

  if (!authLoading && roles.length === 0) {
    return (
      <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <RolesFallback />
      </main>
    );
  }

  async function handleSaveEvento(e: React.FormEvent) {
    e.preventDefault();
    if (!eventoForm.nome?.trim()) {
      toast.error("Informe o nome do evento.");
      return;
    }
    setSavingEvento(true);
    try {
      const res = await saveEvento({
        data: {
          id: eventoEditingId ?? undefined,
          nome: eventoForm.nome!,
          descricao: eventoForm.descricao || null,
          data_inicio: eventoForm.data_inicio || null,
          data_fim: eventoForm.data_fim || null,
          ativo: eventoForm.ativo ?? false,
          ordem: Number(eventoForm.ordem ?? 0),
        },
      });
      toast.success(eventoEditingId ? "Evento atualizado." : "Evento criado.");
      setEventoForm(eventoEmpty);
      setEventoEditingId(null);
      await reloadEventos();
      if (!eventoEditingId && res?.id) setSelectedId(res.id);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSavingEvento(false);
    }
  }

  async function handleToggleEvento(ev: EventoPatrocinio) {
    try {
      await toggleEvento({ data: { id: ev.id, ativo: !ev.ativo } });
      toast.success(ev.ativo ? "Evento desabilitado." : "Evento habilitado — visível na home.");
      await reloadEventos();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleDeleteEvento(ev: EventoPatrocinio) {
    if (!confirm(`Excluir o evento "${ev.nome}" e todos os seus patrocinadores?`)) return;
    try {
      await delEvento({ data: { id: ev.id } });
      toast.success("Evento removido.");
      if (selectedId === ev.id) setSelectedId(null);
      await reloadEventos();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  function editEvento(ev: EventoPatrocinio) {
    setEventoEditingId(ev.id);
    setEventoForm({
      nome: ev.nome,
      descricao: ev.descricao ?? "",
      data_inicio: ev.data_inicio ?? "",
      data_fim: ev.data_fim ?? "",
      ativo: ev.ativo,
      ordem: ev.ordem,
    });
  }

  async function handleSavePatro(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    if (!patroForm.nome?.trim()) {
      toast.error("Informe o nome do patrocinador.");
      return;
    }
    setSavingPatro(true);
    try {
      await savePatro({
        data: {
          id: patroEditingId ?? undefined,
          evento_id: selected.id,
          nome: patroForm.nome!,
          logo_url: patroForm.logo_url || "",
          link_url: patroForm.link_url || "",
          tipo_apoio: patroForm.tipo_apoio || null,
          valor: null,
          descricao: patroForm.descricao || null,
          ordem: Number(patroForm.ordem ?? 0),
          ativo: patroForm.ativo ?? true,
          vigencia_inicio: patroForm.vigencia_inicio || null,
          vigencia_fim: patroForm.vigencia_fim || null,
        },
      });
      toast.success(patroEditingId ? "Patrocinador atualizado." : "Patrocinador adicionado.");
      setPatroForm(patroEmpty);
      setPatroEditingId(null);
      await reloadPatros(selected.id);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSavingPatro(false);
    }
  }

  function editPatro(p: Patrocinador) {
    setPatroEditingId(p.id);
    setPatroForm({
      nome: p.nome,
      logo_url: p.logo_url ?? "",
      link_url: p.link_url ?? "",
      tipo_apoio: p.tipo_apoio ?? "",
      descricao: p.descricao ?? "",
      ordem: p.ordem,
      ativo: p.ativo ?? true,
      vigencia_inicio: p.vigencia_inicio ?? null,
      vigencia_fim: p.vigencia_fim ?? null,
    });
  }

  async function confirmDeletePatro() {
    if (!patroToDelete) return;
    try {
      await delPatro({ data: { id: patroToDelete.id } });
      toast.success("Patrocinador removido.");
      if (selected) await reloadPatros(selected.id);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setPatroToDelete(null);
    }
  }

  async function handleTogglePatro(p: Patrocinador) {
    try {
      await togglePatro({ data: { id: p.id, ativo: !p.ativo } });
      toast.success(p.ativo ? "Movido para rascunho." : "Publicado ao vivo.");
      if (selected) await reloadPatros(selected.id);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  // ---------- Drag and drop ----------
  function handleDragStart(id: string) {
    originalOrderRef.current = patros;
    setDragId(id);
  }

  function handleDragOver(e: React.DragEvent, overId: string) {
    e.preventDefault();
    if (!dragId || dragId === overId) return;
    setDragOverId(overId);
    setPatros((curr) => {
      const from = curr.findIndex((p) => p.id === dragId);
      const to = curr.findIndex((p) => p.id === overId);
      if (from < 0 || to < 0 || from === to) return curr;
      const next = curr.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  async function handleDragEnd() {
    const draggedId = dragId;
    setDragId(null);
    setDragOverId(null);
    if (!draggedId || !selected) return;
    const before = originalOrderRef.current;
    const after = patros;
    const changed = after.some((p, i) => before[i]?.id !== p.id);
    if (!changed) return;
    try {
      const payload = after.map((p, i) => ({ id: p.id, ordem: i * 10 }));
      await setOrdemBulk({ data: { evento_id: selected.id, ordem: payload } });
      toast.success("Ordem atualizada.");
      await reloadPatros(selected.id);
    } catch (err) {
      toast.error((err as Error).message);
      setPatros(before); // rollback visual
    }
  }

  // ---------- Ações em lote ----------
  function toggleSelectAll() {
    if (selectedIds.size === patrosVisiveis.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(patrosVisiveis.map((p) => p.id)));
    }
  }

  function toggleSelectOne(id: string) {
    setSelectedIds((curr) => {
      const next = new Set(curr);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkToggle(ativo: boolean) {
    if (selectedIds.size === 0 || !selected) return;
    setBulkBusy(true);
    try {
      const ids = Array.from(selectedIds);
      await bulkToggle({ data: { ids, ativo } });
      toast.success(
        `${ids.length} patrocinador(es) ${ativo ? "publicados ao vivo" : "movidos para rascunho"}.`,
      );
      setSelectedIds(new Set());
      await reloadPatros(selected.id);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <RolePainelShell
      title="Nossos Patrocinadores"
      subtitle="Gerencie eventos e patrocinadores. Ative um evento para exibir a seção na Home."
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        {/* Coluna esquerda: eventos */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <Heart className="size-5 text-accent" />
            <h2 className="font-display text-lg text-primary">Eventos</h2>
          </div>

          <form
            onSubmit={handleSaveEvento}
            className="mb-6 space-y-3 rounded-xl border border-dashed border-border p-3"
          >
            <div>
              <Label htmlFor="ev-nome">Nome do evento *</Label>
              <Input
                id="ev-nome"
                value={eventoForm.nome ?? ""}
                onChange={(e) => setEventoForm((f) => ({ ...f, nome: e.target.value }))}
                placeholder="Ex.: Festa Junina 2026"
                required
              />
            </div>
            <div>
              <Label htmlFor="ev-desc">Descrição</Label>
              <Textarea
                id="ev-desc"
                value={eventoForm.descricao ?? ""}
                onChange={(e) => setEventoForm((f) => ({ ...f, descricao: e.target.value }))}
                placeholder="Breve texto sobre o evento (opcional)."
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="ev-ini">Início</Label>
                <Input
                  id="ev-ini"
                  type="date"
                  value={eventoForm.data_inicio ?? ""}
                  onChange={(e) => setEventoForm((f) => ({ ...f, data_inicio: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="ev-fim">Fim</Label>
                <Input
                  id="ev-fim"
                  type="date"
                  value={eventoForm.data_fim ?? ""}
                  onChange={(e) => setEventoForm((f) => ({ ...f, data_fim: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  id="ev-ativo"
                  checked={eventoForm.ativo ?? false}
                  onCheckedChange={(v) => setEventoForm((f) => ({ ...f, ativo: v }))}
                />
                <Label htmlFor="ev-ativo" className="cursor-pointer">
                  Habilitar na home
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="ev-ordem" className="text-xs">
                  Ordem
                </Label>
                <Input
                  id="ev-ordem"
                  type="number"
                  className="w-20"
                  value={eventoForm.ordem ?? 0}
                  onChange={(e) => setEventoForm((f) => ({ ...f, ordem: Number(e.target.value) }))}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={savingEvento} className="flex-1">
                {savingEvento ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : eventoEditingId ? (
                  <Save className="mr-2 size-4" />
                ) : (
                  <Plus className="mr-2 size-4" />
                )}
                {eventoEditingId ? "Salvar alterações" : "Criar evento"}
              </Button>
              {eventoEditingId && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEventoEditingId(null);
                    setEventoForm(eventoEmpty);
                  }}
                >
                  <X className="size-4" />
                </Button>
              )}
            </div>
          </form>

          {loading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : eventos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum evento cadastrado ainda. Crie o primeiro acima.
            </p>
          ) : (
            <ul className="space-y-2">
              {eventos.map((ev) => (
                <li
                  key={ev.id}
                  className={`rounded-xl border p-3 transition-colors ${
                    selectedId === ev.id
                      ? "border-accent bg-accent/5"
                      : "border-border hover:border-accent/50"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedId(ev.id)}
                    className="flex w-full items-start justify-between gap-2 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-semibold text-primary">{ev.nome}</span>
                        {ev.ativo ? (
                          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                            Ativo
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Desabilitado</Badge>
                        )}
                      </div>
                      {ev.descricao && (
                        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                          {ev.descricao}
                        </p>
                      )}
                    </div>
                  </button>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleToggleEvento(ev)}>
                      {ev.ativo ? (
                        <>
                          <PowerOff className="mr-1 size-3.5" /> Desabilitar
                        </>
                      ) : (
                        <>
                          <Power className="mr-1 size-3.5" /> Habilitar
                        </>
                      )}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => editEvento(ev)}>
                      <Pencil className="mr-1 size-3.5" /> Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => handleDeleteEvento(ev)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Coluna direita: patrocinadores do evento selecionado */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="font-display text-lg text-primary">
              {selected ? `Patrocinadores — ${selected.nome}` : "Patrocinadores"}
            </h2>
          </div>

          {!selected ? (
            <p className="text-sm text-muted-foreground">
              Selecione um evento à esquerda para gerenciar seus patrocinadores.
            </p>
          ) : (
            <>
              <form
                onSubmit={handleSavePatro}
                className="mb-6 space-y-3 rounded-xl border border-dashed border-border p-3"
              >
                {/* Prévia em tempo real do card no site */}
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Prévia do card
                    </span>
                    <Badge
                      variant={(patroForm.ativo ?? true) ? "default" : "secondary"}
                      className={
                        (patroForm.ativo ?? true)
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                          : ""
                      }
                    >
                      {(patroForm.ativo ?? true) ? "Ao vivo" : "Rascunho"}
                    </Badge>
                  </div>
                  <div className="flex justify-center">
                    <div
                      className={`overflow-hidden rounded-xl border shadow-sm ${
                        (patroForm.ativo ?? true)
                          ? "border-border bg-card"
                          : "border-dashed border-muted-foreground/40 bg-muted/30"
                      }`}
                      style={{ width: 160, aspectRatio: "4 / 5" }}
                    >
                      <div
                        className="grid place-items-center bg-muted/40"
                        style={{ height: "75%" }}
                      >
                        {patroForm.logo_url ? (
                          <img
                            src={patroForm.logo_url}
                            alt="Prévia"
                            className={`max-h-full max-w-full object-contain p-2 ${
                              (patroForm.ativo ?? true) ? "" : "opacity-50 grayscale"
                            }`}
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-1 text-muted-foreground/60">
                            <ImageIcon className="size-8" />
                            <span className="text-[9px]">sem logo</span>
                          </div>
                        )}
                      </div>
                      <div
                        className="flex flex-col items-center justify-center bg-card px-2 text-center"
                        style={{ height: "25%" }}
                      >
                        <span className="line-clamp-1 text-xs font-semibold text-primary">
                          {patroForm.nome || "Nome do patrocinador"}
                        </span>
                        {patroForm.tipo_apoio && (
                          <span className="text-[9px] font-semibold uppercase tracking-widest text-accent">
                            {patroForm.tipo_apoio}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {patroForm.descricao && (
                    <p className="mt-2 line-clamp-2 text-center text-[11px] text-muted-foreground">
                      {patroForm.descricao}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="p-nome">Nome *</Label>
                    <Input
                      id="p-nome"
                      value={patroForm.nome ?? ""}
                      onChange={(e) => setPatroForm((f) => ({ ...f, nome: e.target.value }))}
                      placeholder="Ex.: Padaria Central"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="p-tipo">Tipo de apoio</Label>
                    <Input
                      id="p-tipo"
                      value={patroForm.tipo_apoio ?? ""}
                      onChange={(e) => setPatroForm((f) => ({ ...f, tipo_apoio: e.target.value }))}
                      placeholder="Ouro / Prata / Apoio"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="p-logo">Logo do patrocinador</Label>
                  <div className="flex items-center gap-3">
                    {patroForm.logo_url ? (
                      <img
                        src={patroForm.logo_url}
                        alt="Prévia do logo"
                        className="h-16 w-16 rounded-md border object-contain bg-white"
                      />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-md border bg-muted text-[10px] text-muted-foreground">
                        sem logo
                      </div>
                    )}
                    <div className="flex-1 space-y-2">
                      <Input
                        id="p-logo"
                        type="file"
                        accept="image/*"
                        disabled={uploadingLogo}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleLogoUpload(file);
                          e.target.value = "";
                        }}
                      />
                      <div className="flex items-center gap-2">
                        {uploadingLogo && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Loader2 className="size-3 animate-spin" /> Enviando...
                          </span>
                        )}
                        {patroForm.logo_url && !uploadingLogo && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setPatroForm((f) => ({ ...f, logo_url: "" }))}
                          >
                            <X className="size-3" /> Remover
                          </Button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        PNG, JPG, WebP ou SVG (máx. 5 MB). Recomendado: fundo transparente, recorte
                        4:5 vertical (ou quadrado) para preencher ~75% do card.
                      </p>
                      {logoWarning && (
                        <p className="flex items-start gap-1 text-xs text-amber-600 dark:text-amber-400">
                          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                          {logoWarning}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <div>
                  <Label htmlFor="p-link">Link do site</Label>
                  <Input
                    id="p-link"
                    type="url"
                    value={patroForm.link_url ?? ""}
                    onChange={(e) => setPatroForm((f) => ({ ...f, link_url: e.target.value }))}
                    placeholder="https://..."
                  />
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Label htmlFor="p-desc">Descrição curta</Label>
                    <Input
                      id="p-desc"
                      value={patroForm.descricao ?? ""}
                      onChange={(e) => setPatroForm((f) => ({ ...f, descricao: e.target.value }))}
                      placeholder="Aparece abaixo do nome no card"
                      maxLength={80}
                    />
                  </div>
                  <div className="w-24">
                    <Label htmlFor="p-ordem" className="text-xs">
                      Prioridade
                    </Label>
                    <Input
                      id="p-ordem"
                      type="number"
                      value={patroForm.ordem ?? 0}
                      onChange={(e) =>
                        setPatroForm((f) => ({ ...f, ordem: Number(e.target.value) }))
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="p-vig-ini" className="text-xs">
                      Publicar a partir de (opcional)
                    </Label>
                    <Input
                      id="p-vig-ini"
                      type="datetime-local"
                      value={
                        patroForm.vigencia_inicio ? patroForm.vigencia_inicio.slice(0, 16) : ""
                      }
                      onChange={(e) =>
                        setPatroForm((f) => ({
                          ...f,
                          vigencia_inicio: e.target.value
                            ? new Date(e.target.value).toISOString()
                            : null,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="p-vig-fim" className="text-xs">
                      Despublicar em (opcional)
                    </Label>
                    <Input
                      id="p-vig-fim"
                      type="datetime-local"
                      value={patroForm.vigencia_fim ? patroForm.vigencia_fim.slice(0, 16) : ""}
                      onChange={(e) =>
                        setPatroForm((f) => ({
                          ...f,
                          vigencia_fim: e.target.value
                            ? new Date(e.target.value).toISOString()
                            : null,
                        }))
                      }
                    />
                  </div>
                  <p className="col-span-full text-[11px] text-muted-foreground">
                    Deixe em branco para publicar imediatamente e por tempo indefinido. Útil para
                    campanhas sazonais (ex.: Festa Junina).
                  </p>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
                  <div className="flex items-center gap-2">
                    {(patroForm.ativo ?? true) ? (
                      <Eye className="size-4 text-emerald-600" />
                    ) : (
                      <EyeOff className="size-4 text-muted-foreground" />
                    )}
                    <Label htmlFor="p-ativo" className="cursor-pointer text-sm">
                      {(patroForm.ativo ?? true)
                        ? "Ao vivo (visível no site)"
                        : "Rascunho (oculto no site)"}
                    </Label>
                  </div>
                  <Switch
                    id="p-ativo"
                    checked={patroForm.ativo ?? true}
                    onCheckedChange={(v) => setPatroForm((f) => ({ ...f, ativo: v }))}
                  />
                </div>

                <div className="flex gap-2">
                  <Button type="submit" disabled={savingPatro} className="flex-1">
                    {savingPatro ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : patroEditingId ? (
                      <Save className="mr-2 size-4" />
                    ) : (
                      <Plus className="mr-2 size-4" />
                    )}
                    {patroEditingId ? "Salvar" : "Adicionar patrocinador"}
                  </Button>
                  {patroEditingId && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setPatroEditingId(null);
                        setPatroForm(patroEmpty);
                      }}
                    >
                      <X className="size-4" />
                    </Button>
                  )}
                </div>
              </form>

              {/* Barra de busca, filtro, seleção e ações em lote */}
              <div className="mb-3 flex flex-col gap-2 rounded-xl border border-border bg-muted/20 p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Buscar por nome, tipo ou descrição..."
                      className="pl-8"
                    />
                  </div>
                  <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
                    <SelectTrigger className="sm:w-52">
                      <SelectValue placeholder="Todos os tipos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Todos os tipos</SelectItem>
                      {tiposDisponiveis.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={String(statsDays)} onValueChange={(v) => setStatsDays(Number(v))}>
                    <SelectTrigger className="sm:w-40" title="Período das métricas">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">Últimos 7 dias</SelectItem>
                      <SelectItem value="30">Últimos 30 dias</SelectItem>
                      <SelectItem value="90">Últimos 90 dias</SelectItem>
                      <SelectItem value="365">Último ano</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {patros.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={toggleSelectAll}
                      disabled={patrosVisiveis.length === 0}
                    >
                      {selectedIds.size > 0 && selectedIds.size === patrosVisiveis.length ? (
                        <CheckSquare className="mr-1 size-4" />
                      ) : (
                        <Square className="mr-1 size-4" />
                      )}
                      {selectedIds.size > 0 && selectedIds.size === patrosVisiveis.length
                        ? "Desmarcar todos"
                        : "Selecionar visíveis"}
                    </Button>
                    <span className="text-muted-foreground">
                      {selectedIds.size} selecionado(s) · {patrosVisiveis.length} de {patros.length}{" "}
                      visíveis
                    </span>
                    <div className="ml-auto flex flex-wrap gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={selectedIds.size === 0 || bulkBusy}
                        onClick={() => handleBulkToggle(true)}
                      >
                        <Eye className="mr-1 size-3.5" /> Publicar ao vivo
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={selectedIds.size === 0 || bulkBusy}
                        onClick={() => handleBulkToggle(false)}
                      >
                        <EyeOff className="mr-1 size-3.5" /> Mover p/ rascunho
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {patrosLoading ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-28 w-full" />
                  ))}
                </div>
              ) : patros.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum patrocinador cadastrado para este evento.
                </p>
              ) : patrosVisiveis.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum patrocinador corresponde à busca/filtro.
                </p>
              ) : (
                <>
                  <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <GripVertical className="size-3.5" />
                    Arraste os cartões pela alça para reordenar. A ordem é salva ao soltar.
                  </p>
                  <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    {patrosVisiveis.map((p) => {
                      const isDragging = dragId === p.id;
                      const isOver = dragOverId === p.id && dragId !== p.id;
                      const checked = selectedIds.has(p.id);
                      return (
                        <li
                          key={p.id}
                          draggable
                          onDragStart={() => handleDragStart(p.id)}
                          onDragOver={(e) => handleDragOver(e, p.id)}
                          onDragEnd={handleDragEnd}
                          onDrop={(e) => e.preventDefault()}
                          className={`flex gap-3 rounded-xl border p-3 transition-all ${
                            isDragging
                              ? "opacity-50 ring-2 ring-accent"
                              : isOver
                                ? "border-accent ring-1 ring-accent/60"
                                : p.ativo
                                  ? "border-border bg-background"
                                  : "border-dashed border-muted-foreground/40 bg-muted/30"
                          }`}
                        >
                          <div className="flex flex-col items-center gap-2 pt-1">
                            <span
                              className="cursor-grab text-muted-foreground active:cursor-grabbing"
                              title="Arraste para reordenar"
                            >
                              <GripVertical className="size-4" />
                            </span>
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => toggleSelectOne(p.id)}
                              aria-label={`Selecionar ${p.nome}`}
                            />
                          </div>

                          {/* Preview do card real do site (mini) */}
                          <div
                            className={`shrink-0 overflow-hidden rounded-lg border ${
                              p.ativo ? "border-border bg-background" : "border-dashed"
                            }`}
                            style={{ width: 80, aspectRatio: "4 / 5" }}
                            title="Prévia do card no site"
                          >
                            <div
                              className="grid place-items-center bg-muted/40"
                              style={{ height: "75%" }}
                            >
                              {p.logo_url ? (
                                <img
                                  src={p.logo_url}
                                  alt={p.nome}
                                  className={`max-h-full max-w-full object-contain p-1 ${
                                    p.ativo ? "" : "opacity-50 grayscale"
                                  }`}
                                />
                              ) : (
                                <ImageIcon className="size-6 text-muted-foreground/50" />
                              )}
                            </div>
                            <div
                              className="flex flex-col justify-center bg-card px-1 text-center"
                              style={{ height: "25%" }}
                            >
                              <span className="truncate text-[8px] font-semibold text-primary">
                                {p.nome}
                              </span>
                              {p.tipo_apoio && (
                                <span className="truncate text-[6px] uppercase tracking-wider text-accent">
                                  {p.tipo_apoio}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="truncate font-semibold text-primary">{p.nome}</span>
                              {p.ativo ? (
                                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                                  Ao vivo
                                </Badge>
                              ) : (
                                <Badge variant="secondary">Rascunho</Badge>
                              )}
                              {p.link_url && (
                                <a
                                  href={p.link_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-muted-foreground hover:text-accent"
                                  title="Abrir link"
                                >
                                  <ExternalLink className="size-3.5" />
                                </a>
                              )}
                            </div>
                            {p.tipo_apoio && (
                              <div className="text-[10px] font-semibold uppercase tracking-widest text-accent">
                                {p.tipo_apoio}
                              </div>
                            )}
                            {p.descricao && (
                              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                {p.descricao}
                              </p>
                            )}
                            {(() => {
                              const now = Date.now();
                              const ini = p.vigencia_inicio
                                ? new Date(p.vigencia_inicio).getTime()
                                : null;
                              const fim = p.vigencia_fim
                                ? new Date(p.vigencia_fim).getTime()
                                : null;
                              const scheduled = ini && ini > now;
                              const expired = fim && fim < now;
                              const st = stats.get(p.id);
                              return (
                                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                                  {scheduled && (
                                    <Badge
                                      variant="outline"
                                      className="border-amber-500/40 text-amber-700 dark:text-amber-300"
                                    >
                                      Agendado
                                    </Badge>
                                  )}
                                  {expired && (
                                    <Badge
                                      variant="outline"
                                      className="border-rose-500/40 text-rose-700 dark:text-rose-300"
                                    >
                                      Expirado
                                    </Badge>
                                  )}
                                  {(ini || fim) && (
                                    <span className="text-[10px]">
                                      {ini ? new Date(ini).toLocaleDateString("pt-BR") : "—"} →{" "}
                                      {fim ? new Date(fim).toLocaleDateString("pt-BR") : "∞"}
                                    </span>
                                  )}
                                  {st && (
                                    <span className="ml-auto tabular-nums">
                                      👁 {st.views} · 🖱 {st.clicks}
                                      {st.views > 0 && (
                                        <> · CTR {((st.clicks / st.views) * 100).toFixed(1)}%</>
                                      )}
                                    </span>
                                  )}
                                </div>
                              );
                            })()}

                            <div className="mt-2 flex flex-wrap gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                title={p.ativo ? "Mover para rascunho" : "Publicar ao vivo"}
                                onClick={() => handleTogglePatro(p)}
                              >
                                {p.ativo ? (
                                  <EyeOff className="size-3.5" />
                                ) : (
                                  <Eye className="size-3.5" />
                                )}
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => editPatro(p)}>
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive hover:bg-destructive/10"
                                onClick={() => setPatroToDelete(p)}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </>
          )}
        </section>
      </div>

      <AlertDialog open={!!patroToDelete} onOpenChange={(o) => !o && setPatroToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir patrocinador?</AlertDialogTitle>
            <AlertDialogDescription>
              Você vai remover <strong>{patroToDelete?.nome}</strong> permanentemente, incluindo a
              imagem e os dados salvos. Esta ação não pode ser desfeita.
              <br />
              <br />
              Se você só quer esconder o card temporariamente, use o modo <strong>
                Rascunho
              </strong>{" "}
              (ícone do olho) em vez de excluir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeletePatro}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </RolePainelShell>
  );
}

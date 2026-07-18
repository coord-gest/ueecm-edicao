import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  ArrowLeft,
  Users,
  BookOpen,
  AlertTriangle,
  BarChart3,
} from "lucide-react";
import { RelatorioAcademico } from "@/components/painel/RelatorioAcademico";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { useRealtimeInvalidate } from "@/lib/use-realtime-invalidate";
import { getDisciplinaColor, SUGGESTED_HEX_COLORS } from "@/lib/disciplina-color";

import { PainelLayout } from "@/components/PainelLayout";

export const Route = createFileRoute("/painel-academico")({
  ssr: false,
  head: () => ({ meta: [{ title: "Gestão Acadêmica | Painel" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: PainelAcademico,
});

type Item = { id: string; nome: string; cor?: string | null; turno?: string | null };

const TURNO_LABEL: Record<string, string> = {
  manha: "Manhã",
  tarde: "Tarde",
  noite: "Noite",
};
type Table = "turmas" | "disciplinas";
const FK: Record<Table, "turma_id" | "disciplina_id"> = {
  turmas: "turma_id",
  disciplinas: "disciplina_id",
};

function PainelAcademico() {
  const { hasRole, loading } = useAuth();
  const isManager =
    hasRole("desenvolvedor") || hasRole("admin") || hasRole("diretor") || hasRole("coordenador");

  // Mantém o painel sincronizado em tempo real entre abas/usuários
  useRealtimeInvalidate("painel-academico", [
    { table: "turmas", queryKey: ["turmas"] },
    { table: "disciplinas", queryKey: ["disciplinas"] },
    { table: "horarios", queryKey: ["horarios"] },
  ]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isManager) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Acesso restrito</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Apenas gestão (Desenvolvedor, Admin, Diretor ou Coordenador) pode acessar.
        </p>
        <Button asChild className="mt-6 rounded-full">
          <Link to="/painel">Voltar ao painel</Link>
        </Button>
      </div>
    );
  }

  return (
    <PainelLayout>
      <div className="min-h-screen bg-secondary">
        <header className="border-b border-border/60 bg-background/85 backdrop-blur-lg">
          <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4 sm:px-6">
            <Button asChild variant="ghost" size="sm" className="rounded-full">
              <Link to="/painel">
                <ArrowLeft className="size-4" /> Painel
              </Link>
            </Button>
            <div>
              <h1 className="font-display text-lg font-semibold">Gestão Acadêmica</h1>
              <p className="text-xs text-muted-foreground">
                Turmas, Disciplinas e validação de vínculos
              </p>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <Tabs defaultValue="relatorio">
            <TabsList>
              <TabsTrigger value="relatorio">
                <BarChart3 className="size-4" /> Relatório
              </TabsTrigger>
              <TabsTrigger value="turmas">
                <Users className="size-4" /> Turmas
              </TabsTrigger>
              <TabsTrigger value="disciplinas">
                <BookOpen className="size-4" /> Disciplinas
              </TabsTrigger>
            </TabsList>
            <TabsContent value="relatorio" className="mt-4">
              <RelatorioAcademico />
            </TabsContent>
            <TabsContent value="turmas" className="mt-4">
              <CrudList
                title="Turmas"
                table="turmas"
                singular="turma"
                queryKey="turmas"
                placeholder="Ex: 9º Ano A"
              />
            </TabsContent>
            <TabsContent value="disciplinas" className="mt-4">
              <CrudList
                title="Disciplinas"
                table="disciplinas"
                singular="disciplina"
                queryKey="disciplinas"
                placeholder="Ex: Matemática"
              />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </PainelLayout>
  );
}

type LinkedRow = {
  id: string;
  turma_id: string;
  disciplina_id: string;
  professor: string;
  dia_semana: number;
  hora_inicio: string;
};

function CrudList({
  title,
  table,
  singular,
  queryKey,
  placeholder,
}: {
  title: string;
  table: Table;
  singular: string;
  queryKey: string;
  placeholder: string;
}) {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Diálogos de confirmação / reatribuição
  const [simpleDelete, setSimpleDelete] = useState<{ ids: string[] } | null>(null);
  const [reassignFor, setReassignFor] = useState<{
    ids: string[];
    linked: LinkedRow[];
  } | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: [queryKey],
    queryFn: async () => {
      const columns = table === "disciplinas" ? "id, nome, cor" : "id, nome, turno";
      const { data, error } = await supabase.from(table).select(columns).order("nome");
      if (error) throw error;
      return (data ?? []) as unknown as Item[];
    },
  });

  // Conta vínculos por id
  const { data: linksByItem = {} } = useQuery({
    queryKey: ["horarios-links", table],
    queryFn: async () => {
      const fk = FK[table];
      const { data, error } = await supabase.from("horarios").select(`id, ${fk}`);
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const row of (data ?? []) as Array<Record<string, string>>) {
        const k = row[fk];
        if (k) map[k] = (map[k] ?? 0) + 1;
      }
      return map;
    },
  });

  const fetchLinkedHorarios = async (ids: string[]): Promise<LinkedRow[]> => {
    if (ids.length === 0) return [];
    const fk = FK[table];
    const { data, error } = await supabase
      .from("horarios")
      .select("id, turma_id, disciplina_id, professor, dia_semana, hora_inicio")
      .in(fk, ids);
    if (error) throw error;
    return (data ?? []) as LinkedRow[];
  };

  const startDelete = async (ids: string[]) => {
    setSimpleDelete({ ids });
  };

  const remove = useMutation({
    mutationFn: async (ids: string[]) => {
      const fk = FK[table];
      // Remove horários vinculados primeiro (cascata manual)
      const { error: hErr } = await supabase.from("horarios").delete().in(fk, ids);
      if (hErr) throw hErr;
      const { error } = await supabase.from(table).delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_d, ids) => {
      toast.success(
        ids.length > 1 ? `${ids.length} ${singular}s excluídas` : `${singular} excluída`,
      );
      qc.invalidateQueries({ queryKey: [queryKey] });
      qc.invalidateQueries({ queryKey: ["horarios-links", table] });
      setSimpleDelete(null);
      setSelected(new Set());
    },
    onError: (e: unknown) =>
      toast.error("Erro ao excluir", { description: e instanceof Error ? e.message : undefined }),
  });

  const allChecked = items.length > 0 && selected.size === items.length;
  const someChecked = selected.size > 0 && !allChecked;
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(items.map((i) => i.id)));
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelected(next);
  };

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        <div className="flex gap-2">
          {selected.size > 0 && (
            <Button
              size="sm"
              variant="destructive"
              className="rounded-full"
              onClick={() => startDelete(Array.from(selected))}
            >
              <Trash2 className="size-4" /> Excluir {selected.size} selecionada
              {selected.size > 1 ? "s" : ""}
            </Button>
          )}
          <Button
            size="sm"
            className="rounded-full"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="size-4" /> Nova {singular}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          Nenhuma {singular} cadastrada.
        </p>
      ) : (
        <>
          <div className="flex items-center gap-3 border-b border-border/60 pb-2 text-xs text-muted-foreground">
            <Checkbox
              checked={allChecked || (someChecked && "indeterminate")}
              onCheckedChange={toggleAll}
              aria-label="Selecionar todas"
            />
            <span>Selecionar todas ({items.length})</span>
          </div>
          <ul className="divide-y divide-border/60">
            {items.map((it) => {
              const linkCount = linksByItem[it.id] ?? 0;
              return (
                <li key={it.id} className="flex items-center gap-3 py-2.5">
                  <Checkbox
                    checked={selected.has(it.id)}
                    onCheckedChange={() => toggleOne(it.id)}
                    aria-label={`Selecionar ${it.nome}`}
                  />
                  <div className="flex-1">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      {table === "disciplinas" && (
                        <span
                          className="inline-block size-3 rounded-full border"
                          style={{
                            backgroundColor: getDisciplinaColor(it).border,
                            borderColor: getDisciplinaColor(it).border,
                          }}
                          aria-hidden
                        />
                      )}
                      {it.nome}
                      {table === "turmas" && it.turno && (
                        <span className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-xs font-normal text-muted-foreground">
                          {TURNO_LABEL[it.turno] ?? it.turno}
                        </span>
                      )}
                    </p>
                    {linkCount > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {linkCount} horário{linkCount > 1 ? "s" : ""} vinculado
                        {linkCount > 1 ? "s" : ""}
                      </p>
                    )}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    onClick={() => {
                      setEditing(it);
                      setDialogOpen(true);
                    }}
                    aria-label="Editar"
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8 text-destructive hover:text-destructive"
                    onClick={() => startDelete([it.id])}
                    aria-label="Excluir"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <ItemDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        item={editing}
        table={table}
        singular={singular}
        placeholder={placeholder}
        queryKey={queryKey}
      />

      {/* Confirmação simples (sem vínculos) */}
      <AlertDialog open={!!simpleDelete} onOpenChange={(o) => !o && setSimpleDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Excluir{" "}
              {simpleDelete && simpleDelete.ids.length > 1
                ? `${simpleDelete.ids.length} ${singular}s`
                : singular}
              ?
            </AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => simpleDelete && remove.mutate(simpleDelete.ids)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ReassignDialog({
  open,
  onClose,
  ids,
  linked,
  items,
  table,
  singular,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  ids: string[];
  linked: LinkedRow[];
  items: Item[];
  table: Table;
  singular: string;
  onDone: (ids: string[]) => void;
}) {
  const [target, setTarget] = useState<string>("");
  const idSet = useMemo(() => new Set(ids), [ids]);
  const options = items.filter((i) => !idSet.has(i.id));

  useEffect(() => {
    if (open) setTarget(options[0]?.id ?? "");
  }, [open, options]);

  const reassign = useMutation({
    mutationFn: async () => {
      if (!target) throw new Error("Escolha um destino");
      const fk = FK[table];
      const payload = fk === "turma_id" ? { turma_id: target } : { disciplina_id: target };
      const { error } = await supabase.from("horarios").update(payload).in(fk, ids);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${linked.length} horário(s) reatribuído(s)`);
      onDone(ids);
      onClose();
    },
    onError: (e: unknown) =>
      toast.error("Erro ao reatribuir", {
        description: e instanceof Error ? e.message : undefined,
      }),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-amber-500" />
            Reatribuir antes de excluir
          </DialogTitle>
          <DialogDescription>
            {linked.length} horário{linked.length > 1 ? "s estão" : " está"} vinculado
            {linked.length > 1 ? "s" : ""} à{ids.length > 1 ? "s" : ""} {singular}
            {ids.length > 1 ? "s" : ""} selecionada{ids.length > 1 ? "s" : ""}. Escolha outra{" "}
            {singular} para receber esses horários.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-40 overflow-y-auto rounded-lg border border-border bg-muted/30 p-2 text-xs">
          {linked.slice(0, 20).map((l) => (
            <div key={l.id} className="py-0.5">
              {l.professor} — dia {l.dia_semana} às {l.hora_inicio.slice(0, 5)}
            </div>
          ))}
          {linked.length > 20 && (
            <p className="pt-1 text-muted-foreground">…e mais {linked.length - 20}</p>
          )}
        </div>

        <div>
          <Label>Nova {singular} de destino *</Label>
          {options.length === 0 ? (
            <p className="mt-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              Não há outra {singular} disponível. Cadastre uma antes de excluir.
            </p>
          ) : (
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {options.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={!target || reassign.isPending} onClick={() => reassign.mutate()}>
            {reassign.isPending && <Loader2 className="size-4 animate-spin" />}
            Reatribuir e excluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ItemDialog({
  open,
  onOpenChange,
  item,
  table,
  singular,
  placeholder,
  queryKey,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item: Item | null;
  table: Table;
  singular: string;
  placeholder: string;
  queryKey: string;
}) {
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState<string>("");
  const [turno, setTurno] = useState<string>("manha");

  useEffect(() => {
    if (open) {
      setNome(item?.nome ?? "");
      setCor(item?.cor ?? "");
      setTurno(item?.turno ?? "manha");
    }
  }, [open, item]);

  const save = useMutation({
    mutationFn: async () => {
      const value = nome.trim();
      if (!value) throw new Error("Informe o nome");
      if (table === "disciplinas") {
        const c = cor.trim();
        const corFinal = c ? (c.startsWith("#") ? c : `#${c}`) : null;
        if (item) {
          const { error } = await supabase
            .from("disciplinas")
            .update({ nome: value, cor: corFinal })
            .eq("id", item.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("disciplinas")
            .insert({ nome: value, cor: corFinal });
          if (error) throw error;
        }
      } else {
        const turmaPayload = { nome: value, turno };
        if (item) {
          const { error } = await supabase.from("turmas").update(turmaPayload).eq("id", item.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("turmas").insert(turmaPayload);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      toast.success(item ? "Atualizado" : "Criado");
      qc.invalidateQueries({ queryKey: [queryKey] });
      onOpenChange(false);
      setNome("");
      setCor("");
    },
    onError: (e: unknown) =>
      toast.error("Erro ao salvar", { description: e instanceof Error ? e.message : undefined }),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };

  const previewColor = getDisciplinaColor({ id: item?.id, nome, cor });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item ? `Editar ${singular}` : `Nova ${singular}`}</DialogTitle>
          <DialogDescription>
            {table === "disciplinas"
              ? "Informe o nome e (opcional) escolha uma cor para a grade."
              : "Informe o nome e o turno em que a turma estuda."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label htmlFor="nome">Nome *</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder={placeholder}
              required
              autoFocus
              maxLength={120}
            />
          </div>

          {table === "turmas" && (
            <div>
              <Label htmlFor="turno">Turno *</Label>
              <Select value={turno} onValueChange={setTurno}>
                <SelectTrigger id="turno" className="mt-1">
                  <SelectValue placeholder="Selecione o turno" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manha">Manhã</SelectItem>
                  <SelectItem value="tarde">Tarde</SelectItem>
                  <SelectItem value="noite">Noite</SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                Define em qual período a turma aparece na grade de horários.
              </p>
            </div>
          )}

          {table === "disciplinas" && (
            <div>
              <Label>Cor na grade</Label>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  type="color"
                  value={
                    cor && /^#?[0-9a-fA-F]{6}$/.test(cor)
                      ? cor.startsWith("#")
                        ? cor
                        : `#${cor}`
                      : "#3b82f6"
                  }
                  onChange={(e) => setCor(e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded-md border border-border bg-background"
                  aria-label="Selecionar cor"
                />
                <Input
                  value={cor}
                  onChange={(e) => setCor(e.target.value)}
                  placeholder="#3b82f6 (deixe vazio para cor automática)"
                  maxLength={7}
                />
                {cor && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setCor("")}>
                    Limpar
                  </Button>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {SUGGESTED_HEX_COLORS.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => setCor(hex)}
                    aria-label={`Usar cor ${hex}`}
                    className="size-6 rounded-full border border-border ring-offset-2 transition hover:scale-110 focus:ring-2 focus:ring-primary"
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </div>
              <div
                className="mt-3 rounded-lg border p-2"
                style={{
                  backgroundColor: previewColor.bg,
                  borderColor: previewColor.border,
                }}
              >
                <p className="text-sm font-semibold" style={{ color: previewColor.text }}>
                  {nome || "Pré-visualização"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {cor ? "Cor personalizada" : "Cor automática (paleta determinística)"}
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="size-4 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

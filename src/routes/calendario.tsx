import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  CalendarDays,
} from "lucide-react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { AutoPresentationMode } from "@/components/AutoPresentationMode";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { cn } from "@/lib/utils";

import { PainelLayout } from "@/components/PainelLayout";

export const Route = createFileRoute("/calendario")({
  head: () => ({
    meta: [
      { title: "Calendário Escolar — U.E. Evaristo Campelo de Matos" },
      {
        name: "description",
        content: "Calendário mensal interativo com provas, eventos e reuniões por turma.",
      },
      { property: "og:title", content: "Calendário Escolar" },
      {
        property: "og:description",
        content: "Provas, eventos e reuniões da U.E. Evaristo Campelo de Matos.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://conectaueecm.com/calendario" },
    ],
    links: [{ rel: "canonical", href: "https://conectaueecm.com/calendario" }],
  }),
  component: CalendarioPage,
});

type Evento = {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: string | null;
  local: string | null;
  turma: string | null;
  data_inicio: string;
  data_fim: string | null;
};

const TIPOS = [
  {
    value: "aula",
    label: "Aula",
    color: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  },
  {
    value: "prova",
    label: "Prova",
    color: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
  },
  {
    value: "reuniao",
    label: "Reunião",
    color: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  },
  {
    value: "evento",
    label: "Evento",
    color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  },
  {
    value: "feriado",
    label: "Feriado",
    color: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
  },
  {
    value: "recesso",
    label: "Recesso",
    color: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30",
  },
];
const tipoMeta = (t: string | null) => TIPOS.find((x) => x.value === t) ?? TIPOS[3];

const MESES = [
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
const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function toLocalDateStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function CalendarioPage() {
  const { isStaff } = useAuth();
  const qc = useQueryClient();
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editing, setEditing] = useState<Evento | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const monthStart = useMemo(() => new Date(cursor.getFullYear(), cursor.getMonth(), 1), [cursor]);
  const monthEnd = useMemo(
    () => new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0),
    [cursor],
  );

  const { data: eventos = [], isLoading } = useQuery({
    queryKey: ["eventos", cursor.getFullYear(), cursor.getMonth()],
    queryFn: async () => {
      const inicio = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 15).toISOString();
      const fim = new Date(cursor.getFullYear(), cursor.getMonth() + 2, 15).toISOString();
      const { data, error } = await supabase
        .from("eventos")
        .select("id, titulo, descricao, tipo, local, turma, data_inicio, data_fim")
        .gte("data_inicio", inicio)
        .lte("data_inicio", fim)
        .order("data_inicio");
      if (error) throw error;
      return data as Evento[];
    },
  });

  const { data: turmas } = useQuery({
    queryKey: ["turmas"],
    queryFn: async () => (await supabase.from("turmas").select("nome").order("nome")).data ?? [],
  });

  const eventosPorDia = useMemo(() => {
    const map = new Map<string, Evento[]>();
    for (const ev of eventos) {
      const start = new Date(ev.data_inicio);
      const end = ev.data_fim ? new Date(ev.data_fim) : start;
      const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      // safety cap of 366 iterations
      for (let i = 0; i < 366 && cur <= last; i++) {
        const key = toLocalDateStr(cur);
        const arr = map.get(key) ?? [];
        arr.push(ev);
        map.set(key, arr);
        cur.setDate(cur.getDate() + 1);
      }
    }
    return map;
  }, [eventos]);

  // 6-row month grid
  const days = useMemo(() => {
    const startWeekday = monthStart.getDay();
    const firstCell = new Date(monthStart);
    firstCell.setDate(monthStart.getDate() - startWeekday);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(firstCell);
      d.setDate(firstCell.getDate() + i);
      return d;
    });
  }, [monthStart]);

  const deleteEvent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("eventos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Evento removido");
      qc.invalidateQueries({ queryKey: ["eventos"] });
    },
    onError: (e: unknown) =>
      toast.error("Erro ao remover", { description: e instanceof Error ? e.message : undefined }),
  });

  const openCreate = (dateStr: string) => {
    setEditing(null);
    setSelectedDate(dateStr);
    setDialogOpen(true);
  };
  const openEdit = (ev: Evento) => {
    setEditing(ev);
    setSelectedDate(toLocalDateStr(new Date(ev.data_inicio)));
    setDialogOpen(true);
  };

  const todayStr = toLocalDateStr(today);
  const selectedEvents = selectedDate ? (eventosPorDia.get(selectedDate) ?? []) : [];

  return (
    <PainelLayout>
      <div className="min-h-dvh bg-background">
        <SiteHeader />
        <main className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-semibold text-foreground sm:text-3xl">
                Calendário Escolar
              </h1>
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                Provas, eventos, reuniões e feriados do mês.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="rounded-full"
                onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
                aria-label="Mês anterior"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <div className="min-w-[140px] flex-1 text-center text-sm font-medium sm:min-w-[180px] sm:flex-none">
                {MESES[cursor.getMonth()]} {cursor.getFullYear()}
              </div>
              <Button
                variant="outline"
                size="icon"
                className="rounded-full"
                onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
                aria-label="Próximo mês"
              >
                <ChevronRight className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full"
                onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}
              >
                Hoje
              </Button>
              {isStaff && (
                <Button size="sm" className="rounded-full" onClick={() => openCreate(todayStr)}>
                  <Plus className="size-4" />
                  <span className="hidden sm:inline">Novo evento</span>
                  <span className="sm:hidden">Novo</span>
                </Button>
              )}
            </div>
          </div>

          {/* Legenda */}
          <div className="mt-4 flex flex-wrap gap-1.5">
            {TIPOS.map((t) => (
              <span
                key={t.value}
                className={cn("rounded-full border px-2 py-0.5 text-[11px] sm:text-xs", t.color)}
              >
                {t.label}
              </span>
            ))}
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
            {/* Grid mensal */}
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="grid grid-cols-7 border-b border-border bg-muted/50 text-xs font-medium text-muted-foreground">
                {DIAS_SEMANA.map((d) => (
                  <div key={d} className="px-2 py-2 text-center">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {isLoading && (
                  <div className="col-span-7 flex justify-center py-20">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                  </div>
                )}
                {!isLoading &&
                  days.map((d, i) => {
                    const dStr = toLocalDateStr(d);
                    const inMonth = d.getMonth() === cursor.getMonth();
                    const isToday = dStr === todayStr;
                    const isSelected = dStr === selectedDate;
                    const list = eventosPorDia.get(dStr) ?? [];
                    const hasEvents = list.length > 0;
                    const primaryMeta = hasEvents ? tipoMeta(list[0].tipo) : null;
                    const hasProva = list.some((e) => e.tipo === "prova");
                    const hasFeriado = list.some((e) => e.tipo === "feriado");
                    const isImportant = hasProva || hasFeriado;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setSelectedDate(dStr)}
                        onDoubleClick={() => isStaff && openCreate(dStr)}
                        className={cn(
                          "group relative flex min-h-[56px] flex-col gap-1 border-b border-r border-border/60 p-1 text-left transition-all hover:bg-accent/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-[88px] sm:p-1.5",
                          !inMonth && "bg-muted/30 text-muted-foreground/60",
                          hasEvents && inMonth && "bg-accent/25",
                          hasFeriado &&
                            inMonth &&
                            "bg-gradient-to-br from-rose-500/20 via-rose-500/10 to-transparent",
                          hasProva &&
                            inMonth &&
                            !hasFeriado &&
                            "bg-gradient-to-br from-amber-500/20 via-amber-500/10 to-transparent",
                          isSelected && "bg-primary/10 ring-1 ring-inset ring-primary/40",
                          isImportant &&
                            inMonth &&
                            "shadow-[inset_0_0_0_2px_hsl(var(--primary)/0.35)]",
                          (i + 1) % 7 === 0 && "border-r-0",
                          i >= 35 && "border-b-0",
                        )}
                      >
                        {hasEvents && primaryMeta && (
                          <span
                            className={cn(
                              "pointer-events-none absolute inset-y-1 left-0 rounded-r",
                              isImportant ? "w-1.5" : "w-1",
                              primaryMeta.color,
                            )}
                            aria-hidden
                          />
                        )}
                        <span
                          className={cn(
                            "inline-flex h-5 w-5 items-center justify-center self-end rounded-full text-[11px] font-medium sm:h-6 sm:w-6 sm:text-xs",
                            hasEvents &&
                              !isToday &&
                              "font-bold ring-1 ring-primary/50 text-foreground",
                            isImportant &&
                              !isToday &&
                              "bg-primary/15 ring-2 ring-primary text-foreground",
                            isToday && "bg-primary text-primary-foreground",
                          )}
                        >
                          {d.getDate()}
                        </span>

                        {/* Mobile: pontos coloridos */}
                        <div className="flex flex-wrap gap-0.5 sm:hidden">
                          {list.slice(0, 4).map((ev) => {
                            const meta = tipoMeta(ev.tipo);
                            return (
                              <span
                                key={ev.id}
                                className={cn("h-1.5 w-1.5 rounded-full border", meta.color)}
                                aria-label={ev.titulo}
                              />
                            );
                          })}
                        </div>
                        {/* Desktop: pílulas com título */}
                        <div className="hidden flex-col gap-0.5 sm:flex">
                          {list.slice(0, 3).map((ev) => {
                            const meta = tipoMeta(ev.tipo);
                            return (
                              <span
                                key={ev.id}
                                className={cn(
                                  "truncate rounded border px-1.5 py-0.5 text-[10px] font-medium",
                                  meta.color,
                                )}
                              >
                                {ev.titulo}
                              </span>
                            );
                          })}
                          {list.length > 3 && (
                            <span className="text-[10px] text-muted-foreground">
                              +{list.length - 3} mais
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>

            {/* Painel lateral do dia */}
            <aside className="rounded-2xl border border-border bg-card p-4">
              <div className="mb-3 flex items-center gap-2">
                <CalendarDays className="size-5 text-primary" />
                <h2 className="font-medium">
                  {selectedDate
                    ? new Date(selectedDate + "T12:00:00").toLocaleDateString("pt-BR", {
                        weekday: "long",
                        day: "2-digit",
                        month: "long",
                      })
                    : "Selecione um dia"}
                </h2>
              </div>
              {selectedDate && isStaff && (
                <Button
                  size="sm"
                  className="mb-3 w-full rounded-full"
                  onClick={() => openCreate(selectedDate)}
                >
                  <Plus className="size-4" /> Adicionar evento neste dia
                </Button>
              )}
              {selectedEvents.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
                  {selectedDate
                    ? "Nenhum evento neste dia."
                    : "Clique em um dia para ver os eventos."}
                </p>
              ) : (
                <ul className="space-y-2">
                  {selectedEvents.map((ev) => {
                    const meta = tipoMeta(ev.tipo);
                    return (
                      <li key={ev.id} className="rounded-xl border border-border bg-background p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <Badge variant="outline" className={cn("mb-1", meta.color)}>
                              {meta.label}
                            </Badge>
                            <p className="truncate font-medium">{ev.titulo}</p>
                            {ev.turma && (
                              <p className="text-xs text-muted-foreground">Turma: {ev.turma}</p>
                            )}
                            {ev.local && (
                              <p className="text-xs text-muted-foreground">Local: {ev.local}</p>
                            )}
                            {ev.descricao && (
                              <p className="mt-1 text-sm text-muted-foreground">{ev.descricao}</p>
                            )}
                          </div>
                          {isStaff && (
                            <div className="flex shrink-0 gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-7"
                                onClick={() => openEdit(ev)}
                                aria-label="Editar"
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-7 text-destructive hover:text-destructive"
                                onClick={() => {
                                  if (confirm(`Remover "${ev.titulo}"?`)) deleteEvent.mutate(ev.id);
                                }}
                                aria-label="Remover"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {!isStaff && (
                <p className="mt-4 text-xs text-muted-foreground">
                  Apenas membros da equipe podem adicionar ou editar eventos.
                </p>
              )}
            </aside>
          </div>
        </main>

        <EventoDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          evento={editing}
          defaultDate={selectedDate ?? todayStr}
          turmas={(turmas ?? []).map((t) => t.nome)}
        />
        <AutoPresentationMode />
      <SiteFooter />
      </div>
    </PainelLayout>
  );
}

function EventoDialog({
  open,
  onOpenChange,
  evento,
  defaultDate,
  turmas,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  evento: Evento | null;
  defaultDate: string;
  turmas: string[];
}) {
  const qc = useQueryClient();
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState("evento");
  const [local, setLocal] = useState("");
  const [turma, setTurma] = useState("nenhuma");
  const [dataInicio, setDataInicio] = useState(defaultDate);
  const [dataFim, setDataFim] = useState(defaultDate);
  const [allDay, setAllDay] = useState(true);
  const [hora, setHora] = useState("08:00");

  // sync on open
  useMemoSync(open, () => {
    if (evento) {
      const dt = new Date(evento.data_inicio);
      const dtFim = evento.data_fim ? new Date(evento.data_fim) : dt;
      const hh = dt.getHours();
      const mm = dt.getMinutes();
      const isAll =
        hh === 0 &&
        mm === 0 &&
        (!evento.data_fim || (dtFim.getHours() === 23 && dtFim.getMinutes() >= 59));
      setTitulo(evento.titulo);
      setDescricao(evento.descricao ?? "");
      setTipo(evento.tipo ?? "evento");
      setLocal(evento.local ?? "");
      setTurma(evento.turma ?? "nenhuma");
      setDataInicio(toLocalDateStr(dt));
      setDataFim(toLocalDateStr(dtFim));
      setAllDay(isAll);
      setHora(`${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);
    } else {
      setTitulo("");
      setDescricao("");
      setTipo("evento");
      setLocal("");
      setTurma("nenhuma");
      setDataInicio(defaultDate);
      setDataFim(defaultDate);
      setAllDay(true);
      setHora("08:00");
    }
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!titulo.trim()) throw new Error("Informe o título");
      if (dataFim < dataInicio) throw new Error("Data de fim não pode ser antes da data de início");
      const startISO = allDay
        ? new Date(`${dataInicio}T00:00:00`).toISOString()
        : new Date(`${dataInicio}T${hora}:00`).toISOString();
      const multi = dataFim !== dataInicio;
      const endISO = allDay
        ? new Date(`${dataFim}T23:59:00`).toISOString()
        : multi
          ? new Date(`${dataFim}T${hora}:00`).toISOString()
          : null;
      const payload = {
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        tipo,
        local: local.trim() || null,
        turma: turma === "nenhuma" ? null : turma,
        data_inicio: startISO,
        data_fim: endISO,
      };
      if (evento) {
        const { error } = await supabase.from("eventos").update(payload).eq("id", evento.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("eventos").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(evento ? "Evento atualizado" : "Evento criado");
      qc.invalidateQueries({ queryKey: ["eventos"] });
      onOpenChange(false);
    },
    onError: (e: unknown) =>
      toast.error("Erro ao salvar", { description: e instanceof Error ? e.message : undefined }),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{evento ? "Editar evento" : "Novo evento"}</DialogTitle>
          <DialogDescription>Preencha as informações do evento.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label htmlFor="ev-titulo">Título *</Label>
            <Input
              id="ev-titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              required
              maxLength={200}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ev-data-ini">Data de início *</Label>
              <Input
                id="ev-data-ini"
                type="date"
                value={dataInicio}
                onChange={(e) => {
                  setDataInicio(e.target.value);
                  if (dataFim < e.target.value) setDataFim(e.target.value);
                }}
                required
              />
            </div>
            <div>
              <Label htmlFor="ev-data-fim">Data de fim</Label>
              <Input
                id="ev-data-fim"
                type="date"
                value={dataFim}
                min={dataInicio}
                onChange={(e) => setDataFim(e.target.value)}
              />
            </div>
          </div>
          <div className="rounded-xl border border-border p-3">
            <Label className="text-xs text-muted-foreground">Horário</Label>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={allDay ? "default" : "outline"}
                className="rounded-full"
                onClick={() => setAllDay(true)}
              >
                Todo o dia
              </Button>
              <Button
                type="button"
                size="sm"
                variant={!allDay ? "default" : "outline"}
                className="rounded-full"
                onClick={() => setAllDay(false)}
              >
                Horário fixo
              </Button>
              {!allDay && (
                <Input
                  type="time"
                  value={hora}
                  onChange={(e) => setHora(e.target.value)}
                  className="ml-auto w-32"
                />
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Turma</Label>
              <Select value={turma} onValueChange={setTurma}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhuma">Todas / Geral</SelectItem>
                  {turmas.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="ev-local">Local</Label>
            <Input
              id="ev-local"
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              placeholder="Ex.: Auditório, Sala 12"
            />
          </div>
          <div>
            <Label htmlFor="ev-desc">Descrição</Label>
            <Textarea
              id="ev-desc"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
            />
          </div>
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

// tiny helper: run effect synchronously when `trigger` flips to true
function useMemoSync(trigger: boolean, fn: () => void) {
  useMemo(() => {
    if (trigger) fn();
  }, [trigger]); // eslint-disable-line react-hooks/exhaustive-deps
}

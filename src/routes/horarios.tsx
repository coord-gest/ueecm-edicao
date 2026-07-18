import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Loader2, Clock } from "lucide-react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { useRealtimeInvalidate } from "@/lib/use-realtime-invalidate";
import { cn } from "@/lib/utils";
import { getDisciplinaColor } from "@/lib/disciplina-color";

import { PainelLayout } from "@/components/PainelLayout";

export const Route = createFileRoute("/horarios")({
  head: () => ({
    meta: [
      { title: "Grade de Horários — U.E. Evaristo Campelo de Matos" },
      {
        name: "description",
        content:
          "Grade semanal de horários organizada por turno e turma da U.E. Evaristo Campelo de Matos em Assunção do Piauí.",
      },
      { property: "og:title", content: "Grade de Horários — UEECM" },
      {
        property: "og:description",
        content: "Consulte horários das turmas e turnos da U.E. Evaristo Campelo de Matos.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://conectaueecm.com/horarios" },
      { property: "og:image", content: "https://conectaueecm.com/og-image.jpg" },
    ],
    links: [{ rel: "canonical", href: "https://conectaueecm.com/horarios" }],
  }),
  component: HorariosPage,
});

type Horario = {
  id: string;
  turma_id: string;
  disciplina_id: string | null;
  disciplina: string | null;
  professor: string;
  dia_semana: number;
  turno: string;
  hora_inicio: string | null;
  hora_fim: string | null;
  horario: string | null;
  ordem: number;
};

const DIAS = [
  { v: 1, label: "Segunda" },
  { v: 2, label: "Terça" },
  { v: 3, label: "Quarta" },
  { v: 4, label: "Quinta" },
  { v: 5, label: "Sexta" },
];
const TURNOS = [
  { v: "manha", label: "Manhã" },
  { v: "tarde", label: "Tarde" },
  { v: "integral", label: "Integral" },
  { v: "noite", label: "Noite" },
];

function HorariosPage() {
  const { hasRole } = useAuth();
  const isManager =
    hasRole("desenvolvedor") || hasRole("admin") || hasRole("diretor") || hasRole("coordenador");
  const qc = useQueryClient();
  // Atualiza a grade automaticamente quando o painel acadêmico muda
  useRealtimeInvalidate("horarios-page", [
    { table: "horarios", queryKey: ["horarios"] },
    { table: "turmas", queryKey: ["horarios-turmas"] },
    { table: "disciplinas", queryKey: ["horarios-disciplinas"] },
  ]);

  const { data: turmas = [] } = useQuery({
    queryKey: ["horarios-turmas"],
    queryFn: async () =>
      (await supabase.from("turmas").select("id, nome, turno").order("nome")).data ?? [],
  });
  const { data: disciplinas = [] } = useQuery({
    queryKey: ["horarios-disciplinas"],
    queryFn: async () =>
      (await supabase.from("disciplinas").select("id, nome, cor").order("nome")).data ?? [],
  });

  const [turmaId, setTurmaId] = useState<string>("");
  const [turno, setTurno] = useState<string>("manha");
  const turmasFiltradas = useMemo(
    () => turmas.filter((t) => !t.turno || t.turno === turno),
    [turmas, turno],
  );
  const currentTurma =
    turmasFiltradas.find((t) => t.id === turmaId)?.id || turmasFiltradas[0]?.id || "";

  const { data: horarios = [], isLoading } = useQuery({
    queryKey: ["horarios", currentTurma, turno],
    queryFn: async () => {
      if (!currentTurma) return [];
      const { data, error } = await supabase
        .from("horarios")
        .select("*")
        .eq("turma_id", currentTurma)
        .eq("turno", turno)
        .order("dia_semana")
        .order("hora_inicio");
      if (error) throw error;
      return data as Horario[];
    },
    enabled: !!currentTurma,
  });

  const disciplinasMap = useMemo(
    () => Object.fromEntries(disciplinas.map((d) => [d.id, d])),
    [disciplinas],
  );

  // Disciplinas presentes na grade atual (para a legenda colorida)
  const disciplinasNaGrade = useMemo(() => {
    const ids = new Set(horarios.map((h) => h.disciplina_id));
    return disciplinas.filter((d) => ids.has(d.id));
  }, [horarios, disciplinas]);

  // Chave do slot: usa hora_inicio/hora_fim se existirem; caso contrário, agrupa por ordem
  const slotKey = (h: Horario) =>
    h.hora_inicio && h.hora_fim
      ? `T|${h.hora_inicio}|${h.hora_fim}`
      : `O|${String(h.ordem).padStart(2, "0")}`;

  const slots = useMemo(() => {
    const set = new Set<string>();
    horarios.forEach((h) => set.add(slotKey(h)));
    return Array.from(set).sort();
  }, [horarios]);

  const grid = useMemo(() => {
    const map: Record<string, Record<number, Horario>> = {};
    horarios.forEach((h) => {
      const key = slotKey(h);
      map[key] ??= {};
      map[key][h.dia_semana] = h;
    });
    return map;
  }, [horarios]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Horario | null>(null);
  // Filtro/destaque por disciplina via legenda clicável
  const [highlightDisc, setHighlightDisc] = useState<Set<string>>(new Set());
  const toggleHighlight = (id: string) =>
    setHighlightDisc((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (h: Horario) => {
    setEditing(h);
    setDialogOpen(true);
  };

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("horarios").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Aula removida");
      qc.invalidateQueries({ queryKey: ["horarios"] });
    },
    onError: (e: unknown) =>
      toast.error("Erro", { description: e instanceof Error ? e.message : undefined }),
  });

  const [diaMobile, setDiaMobile] = useState<number>(() => {
    const hoje = new Date().getDay();
    return hoje >= 1 && hoje <= 5 ? hoje : 1;
  });

  return (
    <PainelLayout>
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="mx-auto max-w-7xl px-3 py-5 sm:px-6 sm:py-10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h1 className="font-display text-xl font-semibold text-foreground sm:text-3xl">
                Grade de Horários
              </h1>
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                Selecione turma e turno para visualizar a semana.
              </p>
            </div>
            {isManager && currentTurma && (
              <Button className="w-full rounded-full sm:w-auto" onClick={openCreate}>
                <Plus className="size-4" /> Cadastrar aula
              </Button>
            )}
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:mt-5 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="min-w-0 flex-1 sm:flex-none">
              <Label className="text-xs">Turma</Label>
              <Select value={currentTurma} onValueChange={setTurmaId}>
                <SelectTrigger className="w-full sm:w-56">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {turmasFiltradas.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0 flex-1 sm:flex-none">
              <Label className="text-xs">Turno</Label>
              <Select value={turno} onValueChange={setTurno}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TURNOS.map((t) => (
                    <SelectItem key={t.v} value={t.v}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!currentTurma ? (
            <div className="mt-8 rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground sm:p-10">
              Nenhuma turma cadastrada. Use o Painel do Desenvolvedor para criar turmas.
            </div>
          ) : isLoading ? (
            <div className="mt-10 flex justify-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : slots.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-border bg-card p-6 text-center sm:p-10">
              <Clock className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 font-medium">Nenhuma aula cadastrada</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {isManager
                  ? 'Clique em "Cadastrar aula" para começar.'
                  : "A grade ainda não foi definida."}
              </p>
            </div>
          ) : (
            <>
              {disciplinasNaGrade.length > 0 && (
                <div className="mt-5 flex flex-wrap items-center gap-1.5 sm:mt-6 sm:gap-2">
                  {disciplinasNaGrade.map((d) => {
                    const c = getDisciplinaColor(d);
                    const active = highlightDisc.has(d.id);
                    const filterOn = highlightDisc.size > 0;
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => toggleHighlight(d.id)}
                        aria-pressed={active}
                        className={cn(
                          "group inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium shadow-sm ring-0 transition hover:-translate-y-0.5 hover:shadow-md sm:px-3 sm:py-1 sm:text-xs",
                          filterOn && !active && "opacity-40 hover:opacity-80",
                          active && "ring-2 ring-offset-1 ring-offset-background",
                        )}
                        style={{
                          backgroundColor: c.bg,
                          borderColor: c.border,
                          color: c.text,
                          ...(active ? { boxShadow: `0 0 0 2px ${c.accent}` } : {}),
                        }}
                      >
                        <span
                          className="size-2.5 rounded-full ring-2 ring-white/70"
                          style={{ backgroundColor: c.accent }}
                        />
                        {d.nome}
                      </button>
                    );
                  })}
                  {highlightDisc.size > 0 && (
                    <button
                      type="button"
                      onClick={() => setHighlightDisc(new Set())}
                      className="text-[11px] text-muted-foreground underline-offset-2 hover:underline sm:text-xs"
                    >
                      Limpar filtro
                    </button>
                  )}
                </div>
              )}

              {/* MOBILE: seletor de dia + lista vertical */}
              <div className="mt-4 md:hidden">
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {DIAS.map((d) => {
                    const active = diaMobile === d.v;
                    return (
                      <button
                        key={d.v}
                        type="button"
                        onClick={() => setDiaMobile(d.v)}
                        className={cn(
                          "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3 space-y-2">
                  {slots.map((slot) => {
                    const parts = slot.split("|");
                    const isTime = parts[0] === "T";
                    const ordemLabel = !isTime ? `${Number(parts[1])}ª Aula` : "";
                    const ini = isTime ? parts[1] : "";
                    const fim = isTime ? parts[2] : "";
                    const h = grid[slot]?.[diaMobile];
                    const disc = h?.disciplina_id ? disciplinasMap[h.disciplina_id] : undefined;
                    const color = getDisciplinaColor(disc);
                    const dimmed =
                      highlightDisc.size > 0 &&
                      (!h?.disciplina_id || !highlightDisc.has(h.disciplina_id));
                    return (
                      <div
                        key={slot}
                        className={cn(
                          "flex items-stretch gap-2 rounded-2xl border border-border/70 bg-card p-2 shadow-sm transition-all",
                          dimmed && "opacity-30",
                        )}
                      >
                        <div className="flex w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-gradient-to-b from-muted/80 to-muted/40 px-1 py-2 text-center text-[11px] font-semibold leading-tight text-muted-foreground">
                          {isTime ? (
                            <>
                              <span className="tabular-nums">{ini.slice(0, 5)}</span>
                              <span className="my-0.5 h-px w-4 bg-muted-foreground/40" />
                              <span className="tabular-nums">{fim.slice(0, 5)}</span>
                            </>
                          ) : (
                            <span>{ordemLabel}</span>
                          )}
                        </div>
                        {h ? (
                          <div
                            className="relative flex min-w-0 flex-1 flex-col justify-center overflow-hidden rounded-xl border p-3 pl-4 shadow-sm"
                            style={{
                              backgroundImage: `linear-gradient(135deg, ${color.accent} 0%, ${color.accent} 60%, ${color.border} 100%)`,
                              borderColor: color.accent,
                            }}
                          >
                            <span
                              aria-hidden
                              className="absolute inset-y-0 left-0 w-1.5 rounded-l-xl bg-white/40"
                            />
                            <p className="truncate text-sm font-bold leading-tight tracking-tight text-white drop-shadow-sm">
                              {disc?.nome ?? h.disciplina ?? "—"}
                            </p>
                            <p className="mt-0.5 truncate text-xs font-medium text-white/90">
                              {h.professor || "—"}
                            </p>
                            {isManager && (
                              <div className="mt-1.5 flex gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="size-7 text-white hover:bg-white/20 hover:text-white"
                                  onClick={() => openEdit(h)}
                                  aria-label="Editar"
                                >
                                  <Pencil className="size-3.5" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="size-7 text-white hover:bg-white/20 hover:text-white"
                                  onClick={() => {
                                    if (confirm("Remover esta aula?")) remove.mutate(h.id);
                                  }}
                                  aria-label="Remover"
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex min-w-0 flex-1 items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/20 text-xs text-muted-foreground">
                            Sem aula
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* TABLET / DESKTOP: tabela grid */}
              <div className="mt-4 hidden overflow-x-auto rounded-2xl border border-border/70 bg-card shadow-md md:block">
                <table className="w-full min-w-[680px] border-collapse">
                  <thead>
                    <tr className="bg-gradient-to-b from-muted/70 to-muted/30">
                      <th className="sticky left-0 z-10 w-24 border-b border-r border-border/70 bg-muted/60 p-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground lg:w-32">
                        Horário
                      </th>
                      {DIAS.map((d) => (
                        <th
                          key={d.v}
                          className="border-b border-r border-border/70 p-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground last:border-r-0"
                        >
                          {d.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {slots.map((slot, rowIdx) => {
                      const parts = slot.split("|");
                      const isTime = parts[0] === "T";
                      const ordemLabel = !isTime ? `${Number(parts[1])}ª Aula` : "";
                      const ini = isTime ? parts[1] : "";
                      const fim = isTime ? parts[2] : "";
                      return (
                        <tr key={slot} className={rowIdx % 2 === 1 ? "bg-muted/10" : undefined}>
                          <td className="sticky left-0 z-10 border-b border-r border-border/60 bg-card p-2 align-middle">
                            <div className="mx-auto flex w-fit min-w-[68px] flex-col items-center justify-center gap-0.5 rounded-lg bg-gradient-to-b from-muted/70 to-muted/30 px-2 py-1.5 text-[11px] font-semibold leading-tight text-muted-foreground shadow-inner">
                              {isTime ? (
                                <>
                                  <span className="tabular-nums text-foreground/80">
                                    {ini.slice(0, 5)}
                                  </span>
                                  <span className="h-px w-4 bg-muted-foreground/40" />
                                  <span className="tabular-nums">{fim.slice(0, 5)}</span>
                                </>
                              ) : (
                                <span>{ordemLabel}</span>
                              )}
                            </div>
                          </td>
                          {DIAS.map((d) => {
                            const h = grid[slot]?.[d.v];
                            return (
                              <td
                                key={d.v}
                                className="border-b border-r border-border/60 p-1.5 align-top last:border-r-0"
                              >
                                {h ? (
                                  (() => {
                                    const disc = h.disciplina_id
                                      ? disciplinasMap[h.disciplina_id]
                                      : undefined;
                                    const color = getDisciplinaColor(disc);
                                    const dimmed =
                                      highlightDisc.size > 0 &&
                                      (!h.disciplina_id || !highlightDisc.has(h.disciplina_id));
                                    return (
                                      <div
                                        className={cn(
                                          "group relative h-full overflow-hidden rounded-xl border p-2.5 pl-3.5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
                                          dimmed && "opacity-25",
                                        )}
                                        style={{
                                          backgroundImage: `linear-gradient(135deg, ${color.accent} 0%, ${color.accent} 55%, ${color.border} 100%)`,
                                          borderColor: color.accent,
                                        }}
                                      >
                                        <span
                                          aria-hidden
                                          className="absolute inset-y-0 left-0 w-1.5 bg-white/40"
                                        />
                                        <p className="truncate text-sm font-bold leading-tight tracking-tight text-white drop-shadow-sm">
                                          {disc?.nome ?? h.disciplina ?? "—"}
                                        </p>
                                        <p className="mt-0.5 truncate text-xs font-medium text-white/90">
                                          {h.professor}
                                        </p>

                                        {isManager && (
                                          <div className="mt-1 flex gap-1 opacity-0 transition group-hover:opacity-100">
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              className="size-6 text-white hover:bg-white/20 hover:text-white"
                                              onClick={() => openEdit(h)}
                                              aria-label="Editar"
                                            >
                                              <Pencil className="size-3" />
                                            </Button>
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              className="size-6 text-white hover:bg-white/20 hover:text-white"
                                              onClick={() => {
                                                if (confirm("Remover esta aula?"))
                                                  remove.mutate(h.id);
                                              }}
                                              aria-label="Remover"
                                            >
                                              <Trash2 className="size-3" />
                                            </Button>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()
                                ) : (
                                  <div className="flex h-full min-h-[68px] items-center justify-center rounded-xl border border-dashed border-border/50 bg-muted/10 text-[11px] text-muted-foreground/60">
                                    —
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {!isManager && (
            <p className="mt-3 text-xs text-muted-foreground">
              Apenas gestores podem cadastrar ou editar horários.
            </p>
          )}
        </main>

        <HorarioDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          horario={editing}
          defaultTurmaId={currentTurma}
          defaultTurno={turno}
          turmas={turmas}
          disciplinas={disciplinas}
        />
        <SiteFooter />
      </div>
    </PainelLayout>
  );
}

function HorarioDialog({
  open,
  onOpenChange,
  horario,
  defaultTurmaId,
  defaultTurno,
  turmas,
  disciplinas,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  horario: Horario | null;
  defaultTurmaId: string;
  defaultTurno: string;
  turmas: { id: string; nome: string }[];
  disciplinas: { id: string; nome: string }[];
}) {
  const qc = useQueryClient();
  const [turmaId, setTurmaId] = useState(defaultTurmaId);
  const [turno, setTurno] = useState(defaultTurno);
  const [diaSemana, setDiaSemana] = useState("1");
  const [disciplinaId, setDisciplinaId] = useState("");
  const [professor, setProfessor] = useState("");
  const [horaInicio, setHoraInicio] = useState("07:30");
  const [horaFim, setHoraFim] = useState("08:20");

  useMemoSync(open, () => {
    if (horario) {
      setTurmaId(horario.turma_id);
      setTurno(horario.turno);
      setDiaSemana(String(horario.dia_semana));
      setDisciplinaId(horario.disciplina_id ?? "");
      setProfessor(horario.professor);
      setHoraInicio((horario.hora_inicio ?? "07:30").slice(0, 5));
      setHoraFim((horario.hora_fim ?? "08:20").slice(0, 5));
    } else {
      setTurmaId(defaultTurmaId);
      setTurno(defaultTurno);
      setDiaSemana("1");
      setDisciplinaId(disciplinas[0]?.id ?? "");
      setProfessor("");
      setHoraInicio(
        defaultTurno === "tarde" ? "13:30" : defaultTurno === "noite" ? "19:00" : "07:30",
      );
      setHoraFim(defaultTurno === "tarde" ? "14:20" : defaultTurno === "noite" ? "19:50" : "08:20");
    }
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!turmaId || !disciplinaId || !professor.trim())
        throw new Error("Preencha turma, disciplina e professor");
      const payload = {
        turma_id: turmaId,
        disciplina_id: disciplinaId,
        professor: professor.trim(),
        dia_semana: Number(diaSemana),
        turno,
        hora_inicio: horaInicio,
        hora_fim: horaFim,
      };
      if (horario) {
        const { error } = await supabase.from("horarios").update(payload).eq("id", horario.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("horarios").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(horario ? "Aula atualizada" : "Aula cadastrada");
      qc.invalidateQueries({ queryKey: ["horarios"] });
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
          <DialogTitle>{horario ? "Editar aula" : "Cadastrar aula"}</DialogTitle>
          <DialogDescription>Defina turma, dia, horário, disciplina e professor.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Turma *</Label>
              <Select value={turmaId} onValueChange={setTurmaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {turmas.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Turno *</Label>
              <Select value={turno} onValueChange={setTurno}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TURNOS.map((t) => (
                    <SelectItem key={t.v} value={t.v}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Dia *</Label>
              <Select value={diaSemana} onValueChange={setDiaSemana}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIAS.map((d) => (
                    <SelectItem key={d.v} value={String(d.v)}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Início *</Label>
              <Input
                type="time"
                value={horaInicio}
                onChange={(e) => setHoraInicio(e.target.value)}
                required
              />
            </div>
            <div>
              <Label>Fim *</Label>
              <Input
                type="time"
                value={horaFim}
                onChange={(e) => setHoraFim(e.target.value)}
                required
              />
            </div>
          </div>
          <div>
            <Label>Disciplina *</Label>
            <Select value={disciplinaId} onValueChange={setDisciplinaId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {disciplinas.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {disciplinas.length === 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                Cadastre disciplinas no Painel do Desenvolvedor.
              </p>
            )}
          </div>
          <div>
            <Label>Professor *</Label>
            <Input
              value={professor}
              onChange={(e) => setProfessor(e.target.value)}
              placeholder="Nome do professor"
              required
              maxLength={120}
            />
          </div>
          {/* Badges */}
          <div className="flex flex-wrap gap-1">
            <Badge variant="outline">{TURNOS.find((t) => t.v === turno)?.label}</Badge>
            <Badge variant="outline">{DIAS.find((d) => String(d.v) === diaSemana)?.label}</Badge>
            <Badge variant="outline">
              {horaInicio} – {horaFim}
            </Badge>
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

function useMemoSync(trigger: boolean, fn: () => void) {
  useMemo(() => {
    if (trigger) fn();
  }, [trigger]); // eslint-disable-line react-hooks/exhaustive-deps
}

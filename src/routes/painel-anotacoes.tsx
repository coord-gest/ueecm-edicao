import { useMemo, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, StickyNote, BellRing, Search } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { RolePainelShell } from "@/components/RolePainelShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  listNotes,
  upsertNote,
  deleteNote,
  toggleNotePin,
  listReminders,
  upsertReminder,
  deleteReminder,
  toggleReminderDone,
  type Note,
  type Reminder,
} from "@/lib/notes-reminders.functions";

import { NoteCard } from "@/components/anotacoes/NoteCard";
import { NoteEditorDialog } from "@/components/anotacoes/NoteEditorDialog";
import { NoteViewerDialog } from "@/components/anotacoes/NoteViewerDialog";
import { ReminderCard } from "@/components/anotacoes/ReminderCard";
import { ReminderEditorDialog } from "@/components/anotacoes/ReminderEditorDialog";
import { ReminderViewerDialog } from "@/components/anotacoes/ReminderViewerDialog";
import { NotificationsToggleCard } from "@/components/anotacoes/NotificationsToggleCard";

export const Route = createFileRoute("/painel-anotacoes")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Anotações e Lembretes | U.E. - Evaristo Campelo de Matos" }],
  }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: PainelAnotacoes,
});

type ReminderFilter = "pendentes" | "concluidos" | "todos";

function PainelAnotacoes() {
  const qc = useQueryClient();

  // Server-fn wrappers
  const fnListNotes = useServerFn(listNotes);
  const fnUpsertNote = useServerFn(upsertNote);
  const fnDeleteNote = useServerFn(deleteNote);
  const fnToggleNotePin = useServerFn(toggleNotePin);
  const fnListReminders = useServerFn(listReminders);
  const fnUpsertReminder = useServerFn(upsertReminder);
  const fnDeleteReminder = useServerFn(deleteReminder);
  const fnToggleReminderDone = useServerFn(toggleReminderDone);

  // ---------- Notes state ----------
  const [noteEditorOpen, setNoteEditorOpen] = useState(false);
  const [noteEditing, setNoteEditing] = useState<Note | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);
  const [noteViewing, setNoteViewing] = useState<Note | null>(null);
  const [noteQuery, setNoteQuery] = useState("");

  const notesQuery = useQuery({
    queryKey: ["notes"],
    queryFn: () => fnListNotes(),
  });

  const filteredNotes = useMemo(() => {
    const q = noteQuery.trim().toLowerCase();
    const rows = notesQuery.data ?? [];
    if (!q) return rows;
    return rows.filter(
      (n) => n.titulo.toLowerCase().includes(q) || n.conteudo.toLowerCase().includes(q),
    );
  }, [notesQuery.data, noteQuery]);

  type NoteInput = {
    id?: string;
    titulo: string;
    conteudo: string;
    cor: Note["cor"];
    fixado: boolean;
  };

  const saveNote = useMutation({
    mutationFn: (payload: NoteInput) => fnUpsertNote({ data: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notes"] });
      setNoteEditorOpen(false);
      setNoteEditing(null);
      toast.success("Anotação salva.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar"),
  });

  const removeNote = useMutation({
    mutationFn: (id: string) => fnDeleteNote({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notes"] });
      setNoteToDelete(null);
      toast.success("Anotação apagada.");
    },
  });

  const togglePin = useMutation({
    mutationFn: (n: Note) => fnToggleNotePin({ data: { id: n.id, fixado: !n.fixado } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notes"] }),
  });

  // ---------- Reminders state ----------
  const [reminderFilter, setReminderFilter] = useState<ReminderFilter>("pendentes");
  const [reminderEditorOpen, setReminderEditorOpen] = useState(false);
  const [reminderEditing, setReminderEditing] = useState<Reminder | null>(null);
  const [reminderToDelete, setReminderToDelete] = useState<Reminder | null>(null);
  const [reminderViewing, setReminderViewing] = useState<Reminder | null>(null);

  const remindersQuery = useQuery({
    queryKey: ["reminders", reminderFilter],
    queryFn: () => fnListReminders({ data: { filter: reminderFilter } }),
  });

  type ReminderInput = {
    id?: string;
    texto: string;
    data_hora: string;
    prioridade: Reminder["prioridade"];
  };

  const saveReminder = useMutation({
    mutationFn: (payload: ReminderInput) => fnUpsertReminder({ data: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reminders"] });
      setReminderEditorOpen(false);
      setReminderEditing(null);
      toast.success("Lembrete salvo.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar"),
  });

  const removeReminder = useMutation({
    mutationFn: (id: string) => fnDeleteReminder({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reminders"] });
      setReminderToDelete(null);
      toast.success("Lembrete apagado.");
    },
  });

  const toggleDone = useMutation({
    mutationFn: (r: Reminder) =>
      fnToggleReminderDone({ data: { id: r.id, concluido: !r.concluido } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reminders"] }),
  });

  return (
    <RolePainelShell
      title="Anotações & Lembretes"
      subtitle="Suas anotações pessoais e lembretes agendados com notificação push."
    >
      <NotificationsToggleCard />

      <Tabs defaultValue="notas" className="mt-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="notas" className="gap-2">
            <StickyNote className="size-4" /> Anotações
          </TabsTrigger>
          <TabsTrigger value="lembretes" className="gap-2">
            <BellRing className="size-4" /> Lembretes
          </TabsTrigger>
        </TabsList>

        {/* ================= NOTAS ================= */}
        <TabsContent value="notas" className="mt-4 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={noteQuery}
                onChange={(e) => setNoteQuery(e.target.value)}
                placeholder="Buscar anotações..."
                className="pl-9"
              />
            </div>
            <Button
              onClick={() => {
                setNoteEditing(null);
                setNoteEditorOpen(true);
              }}
              className="rounded-full"
            >
              <Plus className="size-4" /> Nova anotação
            </Button>
          </div>

          {notesQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : filteredNotes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 bg-muted/30 p-8 text-center">
              <StickyNote className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">Nenhuma anotação ainda</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Clique em "Nova anotação" para começar.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredNotes.map((n) => (
                <NoteCard
                  key={n.id}
                  note={n}
                  onEdit={(x) => {
                    setNoteEditing(x);
                    setNoteEditorOpen(true);
                  }}
                  onDelete={(x) => setNoteToDelete(x)}
                  onTogglePin={(x) => togglePin.mutate(x)}
                  onView={(x) => setNoteViewing(x)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ================= LEMBRETES ================= */}
        <TabsContent value="lembretes" className="mt-4 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Tabs
              value={reminderFilter}
              onValueChange={(v) => setReminderFilter(v as ReminderFilter)}
            >
              <TabsList>
                <TabsTrigger value="pendentes">Pendentes</TabsTrigger>
                <TabsTrigger value="concluidos">Concluídos</TabsTrigger>
                <TabsTrigger value="todos">Todos</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button
              onClick={() => {
                setReminderEditing(null);
                setReminderEditorOpen(true);
              }}
              className="rounded-full"
            >
              <Plus className="size-4" /> Novo lembrete
            </Button>
          </div>

          {remindersQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (remindersQuery.data ?? []).length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 bg-muted/30 p-8 text-center">
              <BellRing className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">Sem lembretes por aqui</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Crie um lembrete e receba uma notificação na hora agendada.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {(remindersQuery.data ?? []).map((r) => (
                <ReminderCard
                  key={r.id}
                  reminder={r}
                  onEdit={(x) => {
                    setReminderEditing(x);
                    setReminderEditorOpen(true);
                  }}
                  onDelete={(x) => setReminderToDelete(x)}
                  onToggleDone={(x) => toggleDone.mutate(x)}
                  onView={(x) => setReminderViewing(x)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <NoteEditorDialog
        open={noteEditorOpen}
        onOpenChange={(v) => {
          setNoteEditorOpen(v);
          if (!v) setNoteEditing(null);
        }}
        initial={noteEditing}
        onSave={(data) => saveNote.mutate(data)}
        saving={saveNote.isPending}
      />

      <ReminderEditorDialog
        open={reminderEditorOpen}
        onOpenChange={(v) => {
          setReminderEditorOpen(v);
          if (!v) setReminderEditing(null);
        }}
        initial={reminderEditing}
        onSave={(data) => saveReminder.mutate(data)}
        saving={saveReminder.isPending}
      />

      <NoteViewerDialog
        open={!!noteViewing}
        onOpenChange={(v) => !v && setNoteViewing(null)}
        note={noteViewing}
        onEdit={(n) => {
          setNoteEditing(n);
          setNoteEditorOpen(true);
        }}
      />

      <ReminderViewerDialog
        open={!!reminderViewing}
        onOpenChange={(v) => !v && setReminderViewing(null)}
        reminder={reminderViewing}
        onEdit={(r) => {
          setReminderEditing(r);
          setReminderEditorOpen(true);
        }}
      />

      <AlertDialog open={!!noteToDelete} onOpenChange={(v) => !v && setNoteToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar anotação?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => noteToDelete && removeNote.mutate(noteToDelete.id)}>
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!reminderToDelete} onOpenChange={(v) => !v && setReminderToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar lembrete?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => reminderToDelete && removeReminder.mutate(reminderToDelete.id)}
            >
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </RolePainelShell>
  );
}

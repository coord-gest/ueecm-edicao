import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Tipos das novas tabelas (types.ts será regenerado após a migration).
export type NoteColor = "default" | "amber" | "rose" | "sky" | "violet" | "emerald";
export type ReminderPriority = "alta" | "media" | "baixa";

export type Note = {
  id: string;
  user_id: string;
  titulo: string;
  conteudo: string;
  cor: NoteColor;
  fixado: boolean;
  icone_url: string | null;
  icone_tamanho: number;
  created_at: string;
  updated_at: string;
};


export type Reminder = {
  id: string;
  user_id: string;
  texto: string;
  data_hora: string;
  prioridade: ReminderPriority;
  notificado: boolean;
  concluido: boolean;
  created_at: string;
  updated_at: string;
};

const CORS: NoteColor[] = ["default", "amber", "rose", "sky", "violet", "emerald"];
const PRIORIDADES: ReminderPriority[] = ["alta", "media", "baixa"];

// ============================================================
// NOTES
// ============================================================

export const listNotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from("notes" as any)
      .select("*")
      .order("fixado", { ascending: false })
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as Note[];
  });

const upsertNoteSchema = z.object({
  id: z.string().uuid().optional(),
  titulo: z.string().trim().max(200).default(""),
  conteudo: z.string().max(10_000).default(""),
  cor: z.enum(CORS as [NoteColor, ...NoteColor[]]).default("default"),
  fixado: z.boolean().default(false),
  icone_url: z.string().max(500_000).nullable().default(null),
  icone_tamanho: z.number().int().min(16).max(256).default(48),
});

export const upsertNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => upsertNoteSchema.parse(input))
  .handler(async ({ data, context }) => {
    const payload = {
      user_id: context.userId,
      titulo: data.titulo,
      conteudo: data.conteudo,
      cor: data.cor,
      fixado: data.fixado,
      icone_url: data.icone_url,
      icone_tamanho: data.icone_tamanho,
    };


    if (data.id) {
      const { data: row, error } = await context.supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from("notes" as any)
        .update(payload)
        .eq("id", data.id)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(error.message);
      return row as unknown as Note;
    }

    const { data: row, error } = await context.supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from("notes" as any)
      .insert(payload)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row as unknown as Note;
  });

export const deleteNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from("notes" as any)
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const toggleNotePin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), fixado: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from("notes" as any)
      .update({ fixado: data.fixado })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ============================================================
// REMINDERS
// ============================================================

const reminderFilterSchema = z.object({
  filter: z.enum(["pendentes", "concluidos", "todos"]).default("pendentes"),
});

export const listReminders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => reminderFilterSchema.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = context.supabase.from("reminders" as any).select("*");
    if (data.filter === "pendentes") q = q.eq("concluido", false);
    else if (data.filter === "concluidos") q = q.eq("concluido", true);
    const { data: rows, error } = await q.order("data_hora", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []) as unknown as Reminder[];
  });

const upsertReminderSchema = z.object({
  id: z.string().uuid().optional(),
  texto: z.string().trim().min(1).max(500),
  data_hora: z.string().datetime(),
  prioridade: z.enum(PRIORIDADES as [ReminderPriority, ...ReminderPriority[]]).default("media"),
});

export const upsertReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => upsertReminderSchema.parse(input))
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { data: row, error } = await context.supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from("reminders" as any)
        .update({
          texto: data.texto,
          data_hora: data.data_hora,
          prioridade: data.prioridade,
          // Se o usuário alterou a data para o futuro, permite reenviar
          notificado: false,
        })
        .eq("id", data.id)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(error.message);
      return row as unknown as Reminder;
    }

    const { data: row, error } = await context.supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from("reminders" as any)
      .insert({
        user_id: context.userId,
        texto: data.texto,
        data_hora: data.data_hora,
        prioridade: data.prioridade,
      })
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row as unknown as Reminder;
  });

export const toggleReminderDone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), concluido: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from("reminders" as any)
      .update({ concluido: data.concluido })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from("reminders" as any)
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

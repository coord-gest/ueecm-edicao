import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------- Server publishable client (leituras públicas) ----------
function getServerPublicClient() {
  const url = process.env.SUPABASE_URL || process.env.PROJECT_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.PROJECT_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase env não configurado no servidor.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

// ---------- Tipos ----------
export type EventoPatrocinio = {
  id: string;
  nome: string;
  descricao: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  ativo: boolean;
  ordem: number;
  created_at: string;
  updated_at: string;
};

export type Patrocinador = {
  id: string;
  evento_id: string;
  nome: string;
  logo_url: string | null;
  link_url: string | null;
  tipo_apoio: string | null;
  valor: number | null;
  descricao: string | null;
  ordem: number;
  ativo: boolean;
  vigencia_inicio: string | null;
  vigencia_fim: string | null;
};

// ---------- PÚBLICO: eventos ativos + seus patrocinadores ----------
export const listPatrocinadoresPublicos = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ eventos: EventoPatrocinio[]; patrocinadores: Patrocinador[] }> => {
    const supabase = getServerPublicClient();
    const { data: eventos } = await supabase
      .from("eventos_patrocinio")
      .select("*")
      .eq("ativo", true)
      .order("ordem", { ascending: true });

    const ids = ((eventos ?? []) as EventoPatrocinio[]).map((e) => e.id);
    if (ids.length === 0) return { eventos: [], patrocinadores: [] };

    const { data: patros } = await supabase
      .from("patrocinadores_public")
      .select("*")
      .in("evento_id", ids)
      .order("ordem", { ascending: true })
      .order("nome", { ascending: true });

    return {
      eventos: (eventos ?? []) as EventoPatrocinio[],
      patrocinadores: (patros ?? []) as Patrocinador[],
    };
  },
);

// ---------- ADMIN ----------
async function assertGestor(context: {
  supabase: ReturnType<typeof createClient>;
  userId: string;
}) {
  const allowed = ["desenvolvedor", "developer", "diretor", "director", "admin"];
  const client = context.supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (
          k: string,
          v: string,
        ) => {
          in: (k: string, v: string[]) => { limit: (n: number) => Promise<{ data: unknown }> };
        };
      };
    };
  };
  const { data } = await client
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .in("role", allowed)
    .limit(1);
  if (Array.isArray(data) && data.length > 0) return;
  throw new Error("Acesso restrito a Diretor ou Desenvolvedor.");
}

export const listEventosAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EventoPatrocinio[]> => {
    const ctx = context as unknown as {
      supabase: ReturnType<typeof createClient>;
      userId: string;
    };
    await assertGestor(ctx);
    const { data, error } = await (ctx.supabase as any)
      .from("eventos_patrocinio")
      .select("*")
      .order("ordem", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as EventoPatrocinio[];
  });

export const listPatrocinadoresAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ evento_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<Patrocinador[]> => {
    const ctx = context as unknown as {
      supabase: ReturnType<typeof createClient>;
      userId: string;
    };
    await assertGestor(ctx);
    const { data: rows, error } = await (ctx.supabase as any)
      .from("patrocinadores")
      .select("*")
      .eq("evento_id", data.evento_id)
      .order("ordem", { ascending: true })
      .order("nome", { ascending: true });

    if (error) throw new Error(error.message);
    return (rows ?? []) as Patrocinador[];
  });

const eventoUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().min(2, "Nome do evento é obrigatório."),
  descricao: z.string().nullable().optional(),
  data_inicio: z.string().nullable().optional(),
  data_fim: z.string().nullable().optional(),
  ativo: z.boolean().optional(),
  ordem: z.number().int().optional(),
});

export const upsertEvento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => eventoUpsertSchema.parse(data))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as {
      supabase: ReturnType<typeof createClient>;
      userId: string;
    };
    await assertGestor(ctx);
    const payload = {
      nome: data.nome.trim(),
      descricao: data.descricao ?? null,
      data_inicio: data.data_inicio || null,
      data_fim: data.data_fim || null,
      ativo: data.ativo ?? false,
      ordem: data.ordem ?? 0,
      created_by: ctx.userId,
    };
    if (data.id) {
      const { error } = await (ctx.supabase as any)
        .from("eventos_patrocinio")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await (ctx.supabase as any)
      .from("eventos_patrocinio")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (row as { id: string }).id };
  });

export const toggleEventoAtivo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ id: z.string().uuid(), ativo: z.boolean() }).parse(data))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as {
      supabase: ReturnType<typeof createClient>;
      userId: string;
    };
    await assertGestor(ctx);
    const { error } = await (ctx.supabase as any)
      .from("eventos_patrocinio")
      .update({ ativo: data.ativo })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteEvento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as {
      supabase: ReturnType<typeof createClient>;
      userId: string;
    };
    await assertGestor(ctx);
    const { error } = await (ctx.supabase as any)
      .from("eventos_patrocinio")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const patroUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  evento_id: z.string().uuid(),
  nome: z.string().min(1, "Nome é obrigatório."),
  logo_url: z.string().url().nullable().optional().or(z.literal("")),
  link_url: z.string().url().nullable().optional().or(z.literal("")),
  tipo_apoio: z.string().nullable().optional(),
  valor: z.number().nullable().optional(),
  descricao: z.string().nullable().optional(),
  ordem: z.number().int().optional(),
  ativo: z.boolean().optional(),
  vigencia_inicio: z.string().nullable().optional(),
  vigencia_fim: z.string().nullable().optional(),
});

export const upsertPatrocinador = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => patroUpsertSchema.parse(data))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as {
      supabase: ReturnType<typeof createClient>;
      userId: string;
    };
    await assertGestor(ctx);
    const payload = {
      evento_id: data.evento_id,
      nome: data.nome.trim(),
      logo_url: data.logo_url || null,
      link_url: data.link_url || null,
      tipo_apoio: data.tipo_apoio || null,
      valor: data.valor ?? null,
      descricao: data.descricao || null,
      ordem: data.ordem ?? 0,
      ativo: data.ativo ?? true,
      vigencia_inicio: data.vigencia_inicio || null,
      vigencia_fim: data.vigencia_fim || null,
    };
    if (data.id) {
      const { error } = await (ctx.supabase as any)
        .from("patrocinadores")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await (ctx.supabase as any)
      .from("patrocinadores")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (row as { id: string }).id };
  });

export const togglePatrocinadorAtivo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ id: z.string().uuid(), ativo: z.boolean() }).parse(data))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as {
      supabase: ReturnType<typeof createClient>;
      userId: string;
    };
    await assertGestor(ctx);
    const { error } = await (ctx.supabase as any)
      .from("patrocinadores")
      .update({ ativo: data.ativo })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reorderPatrocinador = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) =>
    z
      .object({
        id: z.string().uuid(),
        direction: z.enum(["up", "down"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as {
      supabase: ReturnType<typeof createClient>;
      userId: string;
    };
    await assertGestor(ctx);
    const client = ctx.supabase as any;
    // Fetch current row
    const { data: current, error: e1 } = await client
      .from("patrocinadores")
      .select("id, evento_id, ordem")
      .eq("id", data.id)
      .single();
    if (e1) throw new Error(e1.message);
    const asc = data.direction === "up";
    // Find neighbour by ordem in same evento
    const { data: neighbours, error: e2 } = await client
      .from("patrocinadores")
      .select("id, ordem")
      .eq("evento_id", (current as any).evento_id)
      .order("ordem", { ascending: !asc })
      .limit(50);
    if (e2) throw new Error(e2.message);
    const list = (neighbours ?? []) as Array<{ id: string; ordem: number }>;
    const neighbour = asc
      ? list.find(
          (n) =>
            n.ordem < (current as any).ordem ||
            (n.ordem === (current as any).ordem && n.id !== data.id),
        )
      : list.find(
          (n) =>
            n.ordem > (current as any).ordem ||
            (n.ordem === (current as any).ordem && n.id !== data.id),
        );
    if (!neighbour) return { ok: true };
    // Swap ordem values
    const currentOrdem = (current as any).ordem as number;
    const neighbourOrdem = neighbour.ordem;
    const nextCurrent =
      neighbourOrdem === currentOrdem ? currentOrdem + (asc ? -1 : 1) : neighbourOrdem;
    const nextNeighbour = neighbourOrdem === currentOrdem ? currentOrdem : currentOrdem;
    await client.from("patrocinadores").update({ ordem: nextCurrent }).eq("id", data.id);
    await client.from("patrocinadores").update({ ordem: nextNeighbour }).eq("id", neighbour.id);
    return { ok: true };
  });

export const setPatrocinadoresOrdem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) =>
    z
      .object({
        evento_id: z.string().uuid(),
        ordem: z
          .array(z.object({ id: z.string().uuid(), ordem: z.number().int() }))
          .min(1)
          .max(200),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as {
      supabase: ReturnType<typeof createClient>;
      userId: string;
    };
    await assertGestor(ctx);
    const client = ctx.supabase as any;
    for (const item of data.ordem) {
      const { error } = await client
        .from("patrocinadores")
        .update({ ordem: item.ordem })
        .eq("id", item.id)
        .eq("evento_id", data.evento_id);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const bulkTogglePatrocinadoresAtivo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) =>
    z
      .object({
        ids: z.array(z.string().uuid()).min(1).max(100),
        ativo: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as {
      supabase: ReturnType<typeof createClient>;
      userId: string;
    };
    await assertGestor(ctx);
    const { error } = await (ctx.supabase as any)
      .from("patrocinadores")
      .update({ ativo: data.ativo })
      .in("id", data.ids);
    if (error) throw new Error(error.message);
    return { ok: true, count: data.ids.length };
  });

export const deletePatrocinador = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as {
      supabase: ReturnType<typeof createClient>;
      userId: string;
    };
    await assertGestor(ctx);
    const { error } = await (ctx.supabase as any).from("patrocinadores").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- ANALYTICS ----------
export type PatroStat = {
  patrocinador_id: string;
  views: number;
  clicks: number;
};

export const getPatrocinadoresStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) =>
    z
      .object({
        evento_id: z.string().uuid(),
        days: z.number().int().min(1).max(365).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<PatroStat[]> => {
    const ctx = context as unknown as {
      supabase: ReturnType<typeof createClient>;
      userId: string;
    };
    await assertGestor(ctx);
    const client = ctx.supabase as any;
    const since = new Date(Date.now() - (data.days ?? 30) * 86400_000).toISOString();

    // Buscar IDs de patrocinadores do evento
    const { data: patros, error: e1 } = await client
      .from("patrocinadores")
      .select("id")
      .eq("evento_id", data.evento_id);
    if (e1) throw new Error(e1.message);
    const ids = ((patros ?? []) as Array<{ id: string }>).map((p) => p.id);
    if (ids.length === 0) return [];

    // Buscar eventos de analytics
    const { data: events, error: e2 } = await client
      .from("analytics_events")
      .select("event_type, metadata")
      .in("event_type", ["patrocinador_view", "patrocinador_click"])
      .gte("created_at", since)
      .limit(10000);
    if (e2) throw new Error(e2.message);

    const stats = new Map<string, PatroStat>();
    for (const id of ids) stats.set(id, { patrocinador_id: id, views: 0, clicks: 0 });
    for (const row of (events ?? []) as Array<{
      event_type: string;
      metadata: Record<string, unknown> | null;
    }>) {
      const pid = (row.metadata as { patrocinador_id?: string } | null)?.patrocinador_id;
      if (!pid || !stats.has(pid)) continue;
      const s = stats.get(pid)!;
      if (row.event_type === "patrocinador_view") s.views += 1;
      else if (row.event_type === "patrocinador_click") s.clicks += 1;
    }
    return Array.from(stats.values());
  });

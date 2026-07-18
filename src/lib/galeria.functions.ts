import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

export type GaleriaAlbum = {
  id: string;
  titulo: string;
  descricao: string | null;
  evento_id: string | null;
  data_evento: string | null;
  capa_url: string | null;
  publicado: boolean;
  created_at: string;
  updated_at: string;
};

export type GaleriaFoto = {
  id: string;
  galeria_id: string;
  url: string;
  storage_path: string | null;
  legenda: string | null;
  largura: number | null;
  altura: number | null;
  tamanho_bytes: number | null;
  ordem: number;
};

// ---------- Público ----------
export const listAlbunsPublicos = createServerFn({ method: "GET" }).handler(
  async (): Promise<Array<GaleriaAlbum & { total_fotos: number }>> => {
    const sb = getServerPublicClient();
    const { data: albuns } = await sb
      .from("galerias_eventos")
      .select("*")
      .eq("publicado", true)
      .order("data_evento", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (!albuns || albuns.length === 0) return [];
    const ids = albuns.map((a) => (a as GaleriaAlbum).id);
    const { data: fotos } = await sb
      .from("galeria_fotos")
      .select("galeria_id")
      .in("galeria_id", ids);
    const counts = new Map<string, number>();
    ((fotos ?? []) as Array<{ galeria_id: string }>).forEach((f) =>
      counts.set(f.galeria_id, (counts.get(f.galeria_id) ?? 0) + 1),
    );
    return (albuns as GaleriaAlbum[]).map((a) => ({
      ...a,
      total_fotos: counts.get(a.id) ?? 0,
    }));
  },
);

export const getAlbumPublico = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }): Promise<{ album: GaleriaAlbum | null; fotos: GaleriaFoto[] }> => {
    const sb = getServerPublicClient();
    const { data: album } = await sb
      .from("galerias_eventos")
      .select("*")
      .eq("id", data.id)
      .eq("publicado", true)
      .maybeSingle();
    if (!album) return { album: null, fotos: [] };
    const { data: fotos } = await sb
      .from("galeria_fotos")
      .select("*")
      .eq("galeria_id", data.id)
      .order("ordem", { ascending: true })
      .order("created_at", { ascending: true });
    return {
      album: album as GaleriaAlbum,
      fotos: (fotos ?? []) as GaleriaFoto[],
    };
  });

// ---------- Admin ----------
async function assertStaff(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId)
    .in("role", [
      "desenvolvedor",
      "developer",
      "diretor",
      "director",
      "coordenador",
      "coordinator",
      "secretario",
      "professor",
      "admin",
    ])
    .limit(1);
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("Acesso restrito à equipe da escola.");
  }
}

export const listAlbunsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Array<GaleriaAlbum & { total_fotos: number }>> => {
    const ctx = context as unknown as { supabase: any; userId: string };
    await assertStaff(ctx);
    const { data: albuns, error } = await ctx.supabase
      .from("galerias_eventos")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const list = (albuns ?? []) as GaleriaAlbum[];
    if (list.length === 0) return [];
    const { data: fotos } = await ctx.supabase
      .from("galeria_fotos")
      .select("galeria_id")
      .in(
        "galeria_id",
        list.map((a) => a.id),
      );
    const counts = new Map<string, number>();
    ((fotos ?? []) as Array<{ galeria_id: string }>).forEach((f) =>
      counts.set(f.galeria_id, (counts.get(f.galeria_id) ?? 0) + 1),
    );
    return list.map((a) => ({ ...a, total_fotos: counts.get(a.id) ?? 0 }));
  });

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  titulo: z.string().min(2).max(240),
  descricao: z.string().max(4000).nullable().optional(),
  evento_id: z.string().uuid().nullable().optional(),
  data_evento: z.string().nullable().optional(),
  publicado: z.boolean().default(true),
});

export const upsertAlbum = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => upsertSchema.parse(data))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as { supabase: any; userId: string };
    await assertStaff(ctx);
    const payload = {
      titulo: data.titulo.trim(),
      descricao: data.descricao?.trim() || null,
      evento_id: data.evento_id || null,
      data_evento: data.data_evento || null,
      publicado: data.publicado,
      criado_por: ctx.userId,
    };
    if (data.id) {
      const { error } = await ctx.supabase
        .from("galerias_eventos")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await ctx.supabase
      .from("galerias_eventos")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (row as { id: string }).id };
  });

export const deleteAlbum = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as { supabase: any; userId: string };
    await assertStaff(ctx);
    // remove storage objects
    const { data: fotos } = await ctx.supabase
      .from("galeria_fotos")
      .select("storage_path")
      .eq("galeria_id", data.id);
    const paths = ((fotos ?? []) as Array<{ storage_path: string | null }>)
      .map((f) => f.storage_path)
      .filter((p): p is string => !!p);
    if (paths.length > 0) {
      await ctx.supabase.storage.from("galeria-eventos").remove(paths);
    }
    const { error } = await ctx.supabase.from("galerias_eventos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const fotoInsertSchema = z.object({
  galeria_id: z.string().uuid(),
  fotos: z
    .array(
      z.object({
        url: z.string().url(),
        storage_path: z.string(),
        legenda: z.string().max(500).nullable().optional(),
        largura: z.number().int().nullable().optional(),
        altura: z.number().int().nullable().optional(),
        tamanho_bytes: z.number().int().nullable().optional(),
      }),
    )
    .min(1)
    .max(100),
});

export const registrarFotos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => fotoInsertSchema.parse(data))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as { supabase: any; userId: string };
    await assertStaff(ctx);
    // pega maior ordem existente
    const { data: last } = await ctx.supabase
      .from("galeria_fotos")
      .select("ordem")
      .eq("galeria_id", data.galeria_id)
      .order("ordem", { ascending: false })
      .limit(1)
      .maybeSingle();
    let base = ((last as { ordem: number } | null)?.ordem ?? -1) + 1;
    const rows = data.fotos.map((f) => ({
      galeria_id: data.galeria_id,
      url: f.url,
      storage_path: f.storage_path,
      legenda: f.legenda ?? null,
      largura: f.largura ?? null,
      altura: f.altura ?? null,
      tamanho_bytes: f.tamanho_bytes ?? null,
      ordem: base++,
      criado_por: ctx.userId,
    }));
    const { error } = await ctx.supabase.from("galeria_fotos").insert(rows);
    if (error) throw new Error(error.message);

    // Se álbum não tem capa, define a primeira foto como capa
    const { data: album } = await ctx.supabase
      .from("galerias_eventos")
      .select("capa_url")
      .eq("id", data.galeria_id)
      .maybeSingle();
    if (album && !(album as { capa_url: string | null }).capa_url) {
      await ctx.supabase
        .from("galerias_eventos")
        .update({ capa_url: rows[0].url })
        .eq("id", data.galeria_id);
    }
    return { ok: true, count: rows.length };
  });

export const deleteFoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as { supabase: any; userId: string };
    await assertStaff(ctx);
    const { data: foto } = await ctx.supabase
      .from("galeria_fotos")
      .select("storage_path")
      .eq("id", data.id)
      .maybeSingle();
    const path = (foto as { storage_path: string | null } | null)?.storage_path;
    if (path) {
      await ctx.supabase.storage.from("galeria-eventos").remove([path]);
    }
    const { error } = await ctx.supabase.from("galeria_fotos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const definirCapa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ album_id: z.string().uuid(), url: z.string().url() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as { supabase: any; userId: string };
    await assertStaff(ctx);
    const { error } = await ctx.supabase
      .from("galerias_eventos")
      .update({ capa_url: data.url })
      .eq("id", data.album_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

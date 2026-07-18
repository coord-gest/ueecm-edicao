/**
 * E2E: criar comunicado autenticado
 *
 * Loga com E2E_TEST_EMAIL (deve ter role admin/coordenador/secretario),
 * insere um comunicado via RLS e confirma leitura. Limpa ao fim.
 */
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL!;
const SUPABASE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
const EMAIL = process.env.E2E_TEST_EMAIL;
const PASSWORD = process.env.E2E_TEST_PASSWORD;

test.describe("Criar comunicado", () => {
  test.skip(
    !SUPABASE_URL || !SUPABASE_KEY || !EMAIL || !PASSWORD,
    "E2E_TEST_EMAIL/E2E_TEST_PASSWORD/SUPABASE_URL ausentes",
  );

  test("admin insere comunicado e recupera pelo id", async () => {
    const client = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: authErr } = await client.auth.signInWithPassword({
      email: EMAIL!,
      password: PASSWORD!,
    });
    expect(authErr).toBeNull();

    const titulo = `[E2E] Comunicado ${Date.now()}`;
    const { data: inserted, error: insErr } = await client
      .from("comunicados")
      .insert({
        titulo,
        conteudo: "Comunicado gerado por teste E2E — pode ser removido.",
        tipo: "geral",
        publicado: false,
      })
      .select("id")
      .single();

    expect(insErr).toBeNull();
    expect(inserted?.id).toBeTruthy();

    const { data: fetched, error: fErr } = await client
      .from("comunicados")
      .select("id, titulo")
      .eq("id", inserted!.id)
      .maybeSingle();
    expect(fErr).toBeNull();
    expect(fetched?.titulo).toBe(titulo);

    // Cleanup
    await client.from("comunicados").delete().eq("id", inserted!.id);
    await client.auth.signOut();
  });
});

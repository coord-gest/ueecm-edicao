/**
 * E2E: justificar falta
 *
 * Loga com E2E_RESP_EMAIL (responsável) e insere uma justificativa para
 * E2E_RESP_ALUNO_ID. Confirma leitura sob RLS e limpa. Skip se envs ausentes.
 */
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL!;
const SUPABASE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
const EMAIL = process.env.E2E_RESP_EMAIL;
const PASSWORD = process.env.E2E_RESP_PASSWORD;
const ALUNO_ID = process.env.E2E_RESP_ALUNO_ID;

test.describe("Justificar falta", () => {
  test.skip(
    !SUPABASE_URL || !SUPABASE_KEY || !EMAIL || !PASSWORD || !ALUNO_ID,
    "E2E_RESP_EMAIL/PASSWORD/ALUNO_ID/SUPABASE_URL ausentes",
  );

  test("responsável cria justificativa e recupera", async () => {
    const client = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: authErr } = await client.auth.signInWithPassword({
      email: EMAIL!,
      password: PASSWORD!,
    });
    expect(authErr).toBeNull();

    const data_falta = new Date().toISOString().slice(0, 10);
    const motivo = `[E2E] Justificativa ${Date.now()}`;

    const { data: ins, error: insErr } = await client
      .from("justificativas_faltas")
      .insert({
        aluno_id: ALUNO_ID!,
        data_falta,
        motivo,
      })
      .select("id")
      .single();

    expect(insErr).toBeNull();
    expect(ins?.id).toBeTruthy();

    const { data: fetched, error: fErr } = await client
      .from("justificativas_faltas")
      .select("id, motivo")
      .eq("id", ins!.id)
      .maybeSingle();
    expect(fErr).toBeNull();
    expect(fetched?.motivo).toBe(motivo);

    await client.from("justificativas_faltas").delete().eq("id", ins!.id);
    await client.auth.signOut();
  });
});

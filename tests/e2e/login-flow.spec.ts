/**
 * E2E: login (Supabase Auth)
 *
 * Valida que credenciais válidas autenticam e emitem uma sessão utilizável.
 * Skip automático quando E2E_TEST_EMAIL/E2E_TEST_PASSWORD ausentes — o job
 * de CI ainda passa (skip = pass) mas fica visível nos logs.
 */
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL!;
const SUPABASE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
const EMAIL = process.env.E2E_TEST_EMAIL;
const PASSWORD = process.env.E2E_TEST_PASSWORD;

test.describe("Login flow", () => {
  test.skip(
    !SUPABASE_URL || !SUPABASE_KEY || !EMAIL || !PASSWORD,
    "E2E_TEST_EMAIL/E2E_TEST_PASSWORD/SUPABASE_URL ausentes",
  );

  test("signInWithPassword devolve sessão válida", async () => {
    const client = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.auth.signInWithPassword({
      email: EMAIL!,
      password: PASSWORD!,
    });
    expect(error).toBeNull();
    expect(data.session?.access_token).toBeTruthy();
    expect(data.user?.email).toBe(EMAIL);
  });

  test("credenciais inválidas são rejeitadas", async () => {
    const client = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.auth.signInWithPassword({
      email: EMAIL!,
      password: "senha-errada-" + Date.now(),
    });
    expect(data.session).toBeNull();
    expect(error).not.toBeNull();
  });
});

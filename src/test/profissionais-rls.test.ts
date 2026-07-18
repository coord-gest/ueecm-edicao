import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * Integração: garante que anon NÃO consegue ler colunas sensíveis
 * (email, telefone) da tabela `profissionais`, enquanto colunas
 * públicas continuam acessíveis.
 *
 * Executa apenas quando as variáveis do Supabase estão presentes.
 */
const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const anonKey =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  process.env.SUPABASE_PUBLISHABLE_KEY ??
  process.env.VITE_SUPABASE_ANON_KEY;

const hasEnv = Boolean(url && anonKey);
const d = hasEnv ? describe : describe.skip;

d("RLS: profissionais (anon)", () => {
  const anon = createClient(url!, anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  it("permite leitura de colunas públicas", async () => {
    const { data, error } = await anon
      .from("profissionais")
      .select("id, nome, cargo, ativo, foto_url, bio, formacao")
      .limit(1);
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  it("bloqueia leitura de email para anon", async () => {
    const { data, error } = await anon.from("profissionais").select("id, email").limit(1);
    // PostgREST retorna erro de permissão (42501) quando falta GRANT na coluna
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });

  it("bloqueia leitura de telefone para anon", async () => {
    const { data, error } = await anon.from("profissionais").select("id, telefone").limit(1);
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });

  it("bloqueia select * (que expandiria para colunas sensíveis)", async () => {
    const { data, error } = await anon.from("profissionais").select("*").limit(1);
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });

  it("bloqueia leitura mista com uma coluna sensível", async () => {
    // Basta uma coluna sensível na projeção para PostgREST negar tudo.
    const { data, error } = await anon.from("profissionais").select("id, nome, email").limit(1);
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });
});

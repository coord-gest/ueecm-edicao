import { defineConfig } from "@playwright/test";

/**
 * Config E2E. Roda specs em tests/e2e/ em Chromium headless.
 * Não sobe webServer aqui — em CI usamos os testes de backend (Supabase +
 * dispatcher) que dispensam navegador. Localmente, subir `bun run dev` antes.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:8080",
    trace: "retain-on-failure",
  },
});

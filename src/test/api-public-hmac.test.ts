import { describe, it, expect } from "vitest";

/**
 * Testes de segurança para endpoints /api/public/*.
 *
 * Confirma que:
 *  - Sem header HMAC → 401.
 *  - Com header incorreto → 401.
 *
 * Roda apenas quando `E2E_BASE_URL` está definido (ex.: em CI/staging).
 * Localmente é ignorado para não exigir um servidor de pé.
 */
const baseUrl = process.env.E2E_BASE_URL;
const d = baseUrl ? describe : describe.skip;

const endpoints = [
  "/api/public/backup-semanal",
  "/api/public/dispatch-push",
  "/api/public/agendamentos-lembretes",
  "/api/public/comunicados-agendados",
  "/api/public/comunicados-lembretes",
  "/api/public/reminders-dispatch",
];

d("/api/public/* HMAC guard", () => {
  for (const path of endpoints) {
    it(`${path} → 401 sem HMAC`, async () => {
      const res = await fetch(`${baseUrl}${path}`, { method: "POST" });
      expect(res.status).toBe(401);
    });

    it(`${path} → 401 com HMAC inválido`, async () => {
      const res = await fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: { "x-dispatch-secret": "invalido-000" },
      });
      expect(res.status).toBe(401);
    });
  }
});

/**
 * E2E: fluxo APK → FCM → tela bloqueada
 *
 * Este teste roda com Playwright + Chromium headless e valida o pipeline
 * observável do lado do servidor:
 *
 *   1. Enfileira uma notificação em `push_notifications_queue`
 *   2. Chama o dispatcher autenticado (mesma rota que o pg_cron usa)
 *   3. Confirma que `fcm_dispatch_logs` registrou a execução
 *   4. Confirma que o item da fila foi marcado como `processed_at`
 *
 * O envio real para APK/Android em tela bloqueada é validado manualmente
 * (ver `docs/relatorios/Checklist_Release_Producao.md`, seção 3) porque
 * exige um dispositivo físico. Este spec é a rede de proteção que garante
 * que o backend do fluxo continua saudável.
 *
 * Pré-requisitos:
 *   - Dev server rodando em http://localhost:8080
 *   - Variáveis: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DISPATCH_SECRET
 *   - Ao menos 1 token em `fcm_tokens` (para validar o caminho real de envio;
 *     se estiver vazio, o teste apenas valida que o dispatcher grava log com
 *     `tokens_total=0` e `ok=true`).
 */
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL!;
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY!;
const DISPATCH_SECRET = process.env.DISPATCH_SECRET!;
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:8080";

test.describe("FCM dispatch pipeline", () => {
  test.skip(
    !SUPABASE_URL || !SERVICE_KEY || !DISPATCH_SECRET,
    "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / DISPATCH_SECRET obrigatórios",
  );

  test("enfileira → dispatcher → log telemetria", async ({ request }) => {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    const title = `E2E ${Date.now()}`;
    const { data: enq, error: enqErr } = await admin
      .from("push_notifications_queue")
      .insert({
        title,
        body: "E2E dispatch flow",
        url: "/",
        source: "e2e",
      })
      .select("id")
      .single();
    expect(enqErr).toBeNull();
    expect(enq?.id).toBeTruthy();

    const before = new Date().toISOString();

    const res = await request.post(`${BASE_URL}/api/public/dispatch-push`, {
      headers: {
        Authorization: `Bearer ${DISPATCH_SECRET}`,
        "Content-Type": "application/json",
      },
      data: {},
    });
    expect(res.ok(), `dispatcher status=${res.status()}`).toBeTruthy();

    // Espera log aparecer (até 8s)
    let log: Record<string, unknown> | null = null;
    for (let i = 0; i < 8; i++) {
      const { data } = await admin
        .from("fcm_dispatch_logs")
        .select("*")
        .gte("created_at", before)
        .order("created_at", { ascending: false })
        .limit(1);
      if (data && data.length > 0) {
        log = data[0] as Record<string, unknown>;
        break;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    expect(log, "nenhum registro em fcm_dispatch_logs").not.toBeNull();
    expect(log!.ok).toBe(true);
    expect(Number(log!.queue_processed)).toBeGreaterThanOrEqual(1);

    const { data: queueRow } = await admin
      .from("push_notifications_queue")
      .select("processed_at")
      .eq("id", enq!.id)
      .single();
    expect(queueRow?.processed_at).toBeTruthy();

    // Cleanup
    await admin.from("push_notifications_queue").delete().eq("id", enq!.id);
  });
});

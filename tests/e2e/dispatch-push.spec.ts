import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { handleDispatchPush } from "./dispatch-push";

// Mock do dispatcher (não queremos abrir conexão com Supabase nos testes)
vi.mock("@/lib/push-dispatcher.server", () => ({
  drainPushQueue: vi.fn(async () => ({ processed: 0, sent: 0, pruned: 0, errors: [] })),
}));

const ORIGINAL_SECRET = process.env.DISPATCH_SECRET;

describe("handleDispatchPush (S2 — Authorization Bearer)", () => {
  beforeEach(() => {
    process.env.DISPATCH_SECRET = "test-secret-abc123";
  });
  afterEach(() => {
    process.env.DISPATCH_SECRET = ORIGINAL_SECRET;
    vi.clearAllMocks();
  });

  it("retorna 401 quando nenhum header é enviado", async () => {
    const res = await handleDispatchPush(
      new Request("https://x/api/public/dispatch-push", { method: "POST" }),
    );
    expect(res.status).toBe(401);
  });

  it("retorna 401 quando o Bearer está incorreto", async () => {
    const res = await handleDispatchPush(
      new Request("https://x/api/public/dispatch-push", {
        method: "POST",
        headers: { authorization: "Bearer wrong-secret" },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("retorna 401 quando x-dispatch-secret está incorreto", async () => {
    const res = await handleDispatchPush(
      new Request("https://x/api/public/dispatch-push", {
        method: "POST",
        headers: { "x-dispatch-secret": "nope" },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("retorna 200 com Authorization Bearer válido", async () => {
    const res = await handleDispatchPush(
      new Request("https://x/api/public/dispatch-push", {
        method: "POST",
        headers: { authorization: "Bearer test-secret-abc123" },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ processed: 0, sent: 0 });
  });

  it("aceita x-dispatch-secret legado com o valor correto", async () => {
    const res = await handleDispatchPush(
      new Request("https://x/api/public/dispatch-push", {
        method: "POST",
        headers: { "x-dispatch-secret": "test-secret-abc123" },
      }),
    );
    expect(res.status).toBe(200);
  });

  it("fail-closed: retorna 500 quando DISPATCH_SECRET não está configurado", async () => {
    delete process.env.DISPATCH_SECRET;
    const res = await handleDispatchPush(
      new Request("https://x/api/public/dispatch-push", {
        method: "POST",
        headers: { authorization: "Bearer anything" },
      }),
    );
    expect(res.status).toBe(500);
  });
});

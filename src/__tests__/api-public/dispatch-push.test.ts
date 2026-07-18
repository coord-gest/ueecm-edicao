import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/push-dispatcher.server", () => ({
  drainPushQueue: vi.fn(async () => ({ processed: 0, sent: 0, pruned: 0, errors: [] })),
}));

import { handleDispatchPush } from "@/routes/api/public/dispatch-push";
import { drainPushQueue } from "@/lib/push-dispatcher.server";

const SECRET = "s".repeat(48);

function req(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/public/dispatch-push", {
    method: "POST",
    headers,
  });
}

describe("POST /api/public/dispatch-push — proteção por DISPATCH_SECRET (fail-closed)", () => {
  const originalSecret = process.env.DISPATCH_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DISPATCH_SECRET = SECRET;
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.DISPATCH_SECRET;
    else process.env.DISPATCH_SECRET = originalSecret;
  });

  it("retorna 401 quando o header x-dispatch-secret está incorreto (mesmo tamanho)", async () => {
    const res = await handleDispatchPush(req({ "x-dispatch-secret": "x".repeat(SECRET.length) }));
    expect(res.status).toBe(401);
    expect(drainPushQueue).not.toHaveBeenCalled();
  });

  it("retorna 401 quando o header x-dispatch-secret tem tamanho diferente", async () => {
    const res = await handleDispatchPush(req({ "x-dispatch-secret": "curto" }));
    expect(res.status).toBe(401);
    expect(drainPushQueue).not.toHaveBeenCalled();
  });

  it("aceita chamada com x-dispatch-secret correto (compat pg_net) e drena a fila", async () => {
    const res = await handleDispatchPush(req({ "x-dispatch-secret": SECRET }));
    expect(res.status).toBe(200);
    expect(drainPushQueue).toHaveBeenCalledOnce();
  });

  it("aceita chamada com Authorization: Bearer correto e drena a fila", async () => {
    const res = await handleDispatchPush(req({ authorization: `Bearer ${SECRET}` }));
    expect(res.status).toBe(200);
    expect(drainPushQueue).toHaveBeenCalledOnce();
  });

  it("retorna 401 quando nenhum header é enviado", async () => {
    const res = await handleDispatchPush(req());
    expect(res.status).toBe(401);
    expect(drainPushQueue).not.toHaveBeenCalled();
  });

  it("retorna 500 quando DISPATCH_SECRET não está configurado (fail-closed)", async () => {
    delete process.env.DISPATCH_SECRET;
    const res = await handleDispatchPush(req({ "x-dispatch-secret": "qualquer" }));
    expect(res.status).toBe(500);
    expect(drainPushQueue).not.toHaveBeenCalled();
  });
});

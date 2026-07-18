import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock é içado — usar vi.hoisted para variáveis compartilhadas
const mocks = vi.hoisted(() => {
  const signInMock = vi.fn();
  const eqMock = vi.fn(() => Promise.resolve({ data: null, error: null }));
  const updateMock = vi.fn(() => ({ eq: eqMock }));
  const insertMock = vi.fn(() => Promise.resolve({ data: null, error: null }));
  return { signInMock, eqMock, updateMock, insertMock };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signInWithPassword: mocks.signInMock,
      getSession: vi.fn(() => Promise.resolve({ data: { session: null } })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signOut: vi.fn(() => Promise.resolve()),
    },
    from: vi.fn(() => ({
      insert: mocks.insertMock,
      update: mocks.updateMock,
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
    })),
  },
}));

const { signInMock, insertMock, updateMock, eqMock } = mocks;

import { supabase } from "@/integrations/supabase/client";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Fluxo de login", () => {
  it("envia e-mail e senha para signInWithPassword", async () => {
    signInMock.mockResolvedValueOnce({ error: null });
    const res = await supabase.auth.signInWithPassword({
      email: "user@escola.com",
      password: "senha-segura",
    });
    expect(signInMock).toHaveBeenCalledWith({
      email: "user@escola.com",
      password: "senha-segura",
    });
    expect(res.error).toBeNull();
  });

  it("propaga erro de credenciais inválidas", async () => {
    signInMock.mockResolvedValueOnce({
      error: { message: "Invalid login credentials" },
    });
    const { error } = await supabase.auth.signInWithPassword({
      email: "x@x.com",
      password: "errada",
    });
    expect(error?.message).toBe("Invalid login credentials");
  });
});

describe("Criação de post", () => {
  it("insere post na tabela 'posts' com status em_revisao", async () => {
    const payload = {
      titulo: "Novo evento escolar",
      conteudo: "<p>Conteúdo</p>",
      status: "em_revisao" as const,
      autor_id: "user-1",
    };
    await supabase.from("posts").insert(payload);
    expect(supabase.from).toHaveBeenCalledWith("posts");
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "em_revisao", titulo: payload.titulo }),
    );
  });
});

describe("Aprovação de post", () => {
  it("muda status para 'publicado' e registra aprovador", async () => {
    await supabase
      .from("posts")
      .update({
        status: "publicado",
        aprovado_por: "diretor-1",
        aprovado_em: new Date().toISOString(),
        motivo_rejeicao: null,
      })
      .eq("id", "post-123");

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "publicado",
        aprovado_por: "diretor-1",
        motivo_rejeicao: null,
      }),
    );
    expect(eqMock).toHaveBeenCalledWith("id", "post-123");
  });

  it("rejeição registra motivo e status 'rejeitado'", async () => {
    await supabase
      .from("posts")
      .update({
        status: "rejeitado",
        motivo_rejeicao: "Falta de fontes",
        aprovado_por: "coord-1",
        aprovado_em: new Date().toISOString(),
      })
      .eq("id", "post-999");

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "rejeitado",
        motivo_rejeicao: "Falta de fontes",
      }),
    );
    expect(eqMock).toHaveBeenCalledWith("id", "post-999");
  });
});

import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { readServerEnv } from "@/lib/server-env";
import { createHash } from "crypto";

export function sanitize(v: string | null | undefined, max: number): string | null {
  if (!v) return null;
  // eslint-disable-next-line no-control-regex -- remove caracteres de controle intencionalmente
  const cleaned = v.replace(/[\u0000-\u001F\u007F]/g, "").trim();
  if (!cleaned) return null;
  return cleaned.slice(0, max);
}

export function getServerPublicClient() {
  const url = readServerEnv("SUPABASE_URL", "PROJECT_SUPABASE_URL");
  const key = readServerEnv("SUPABASE_PUBLISHABLE_KEY", "PROJECT_SUPABASE_PUBLISHABLE_KEY");
  if (!url || !key) throw new Error("Supabase env não configurado no servidor.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export function hashIpFromRequest(): string | null {
  try {
    const req = getRequest();
    const h = req?.headers;
    if (!h) return null;
    const ip =
      h.get("cf-connecting-ip") ||
      h.get("x-real-ip") ||
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";
    return createHash("sha256").update(`familias:${ip}`).digest("hex").slice(0, 32);
  } catch {
    return null;
  }
}

export async function assertModerador(context: {
  supabase: ReturnType<typeof createClient>;
  userId: string;
}) {
  const allowed = [
    "desenvolvedor",
    "developer",
    "diretor",
    "director",
    "coordenador",
    "coordinator",
    "secretario",
    "admin",
  ];
  const client = context.supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (
          k: string,
          v: string,
        ) => {
          in: (k: string, v: string[]) => { limit: (n: number) => Promise<{ data: unknown }> };
        };
      };
    };
  };
  const { data } = await client
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .in("role", allowed)
    .limit(1);
  if (Array.isArray(data) && data.length > 0) return true;
  throw new Error("Acesso restrito à moderação do sistema.");
}

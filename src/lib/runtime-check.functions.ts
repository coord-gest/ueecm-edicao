import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Diagnóstico de variáveis de ambiente do runtime do servidor.
 * NÃO usa middleware de auth de propósito — precisa funcionar mesmo quando
 * o Supabase ainda não está configurado, senão o erro vira 401 e fica opaco.
 */

type RequiredEnv = {
  name: string;
  aliases: string[];
  purpose: string;
  critical: boolean;
};

const REQUIRED: RequiredEnv[] = [
  {
    name: "SUPABASE_URL",
    aliases: ["PROJECT_SUPABASE_URL"],
    purpose: "URL do projeto Supabase externo (cliente publishable e admin).",
    critical: true,
  },
  {
    name: "SUPABASE_PUBLISHABLE_KEY",
    aliases: ["PROJECT_SUPABASE_PUBLISHABLE_KEY"],
    purpose: "Anon/publishable key usada pelo auth-middleware das server functions.",
    critical: true,
  },
  {
    name: "SUPABASE_SERVICE_ROLE_KEY",
    aliases: ["SERVICE_ROLE_KEY"],
    purpose: "Service role key para o dispatcher de push (bypass de RLS).",
    critical: true,
  },
  {
    name: "FIREBASE_PROJECT_ID",
    aliases: [],
    purpose: "Project ID do Firebase (FCM) — usado pelo dispatcher e pelo client.",
    critical: true,
  },
  {
    name: "FIREBASE_CLIENT_EMAIL",
    aliases: [],
    purpose: "Service account email do Firebase Admin para assinar envios FCM.",
    critical: true,
  },
  {
    name: "FIREBASE_PRIVATE_KEY",
    aliases: [],
    purpose: "Chave privada do service account do Firebase Admin (FCM v1).",
    critical: true,
  },
  {
    name: "FIREBASE_VAPID_PUBLIC_KEY",
    aliases: [],
    purpose: "Chave pública VAPID do Firebase Web Push (usada no getToken do client).",
    critical: true,
  },
  {
    name: "FIREBASE_WEB_API_KEY",
    aliases: [],
    purpose: "Web API key do Firebase (config do SDK no client).",
    critical: true,
  },
  {
    name: "DISPATCH_SECRET",
    aliases: [],
    purpose: "Protege /api/public/dispatch-push contra chamadas não autorizadas.",
    critical: true,
  },
  {
    name: "GEMINI_API_KEY",
    aliases: [],
    purpose: "Chave do Google Gemini para o chat e embeddings do RAG.",
    critical: true,
  },
];

export type EnvVarStatus = {
  name: string;
  aliases: string[];
  purpose: string;
  critical: boolean;
  configured: boolean;
  resolvedFrom: string | null;
};

export const checkRuntimeEnv = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Restringe a Desenvolvedor/Admin — evita reconhecimento por qualquer usuário logado.
    const { data: allowed, error: roleErr } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .in("role", ["desenvolvedor", "developer", "admin"])
      .maybeSingle();
    if (roleErr) throw roleErr;
    if (!allowed) {
      throw new Response("Forbidden", { status: 403 });
    }
    const status: EnvVarStatus[] = REQUIRED.map((r) => {
    const candidates = [r.name, ...r.aliases];
    const resolvedFrom = candidates.find((n) => Boolean(process.env[n])) ?? null;
    return {
      name: r.name,
      aliases: r.aliases,
      purpose: r.purpose,
      critical: r.critical,
      configured: Boolean(resolvedFrom),
      resolvedFrom,
    };
  });
  const missingCritical = status.filter((s) => s.critical && !s.configured).map((s) => s.name);
  return {
    ok: missingCritical.length === 0,
    missingCritical,
    status,
    checkedAt: new Date().toISOString(),
  };
});

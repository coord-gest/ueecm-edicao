import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { logger } from "@/lib/logger";

const registerSchema = z.object({
  token: z.string().min(20).max(4096),
  platform: z.enum(["web", "android-web", "ios-web", "android", "ios"]).default("web"),
  user_agent: z.string().max(500).nullable().optional(),
});

const deleteSchema = z.object({
  token: z.string().min(20).max(4096),
});

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

function getBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

export const Route = createFileRoute("/api/push/fcm-register")({
  server: {
    handlers: {
      // POST: salva/atualiza um token FCM. Se autenticado, associa ao user_id.
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return jsonError("JSON inválido.", 400);
        }
        const parsed = registerSchema.safeParse(body);
        if (!parsed.success) return jsonError("Dados inválidos.", 422);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const bearer = getBearerToken(request);
        let userId: string | null = null;
        if (bearer) {
          const { data, error } = await supabaseAdmin.auth.getUser(bearer);
          if (!error && data.user) userId = data.user.id;
        }

        const { error } = await supabaseAdmin.from("fcm_tokens").upsert(
          {
            token: parsed.data.token,
            platform: parsed.data.platform,
            user_agent: parsed.data.user_agent ?? null,
            user_id: userId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "token" },
        );

        if (error) {
          logger.error("[fcm-register] erro upsert:", error);
          return jsonError("Falha ao salvar token.", 500);
        }
        return Response.json({ ok: true });
      },

      // DELETE: remove o token do banco (unsubscribe).
      DELETE: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return jsonError("JSON inválido.", 400);
        }
        const parsed = deleteSchema.safeParse(body);
        if (!parsed.success) return jsonError("Dados inválidos.", 422);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.from("fcm_tokens").delete().eq("token", parsed.data.token);
        return Response.json({ ok: true });
      },
    },
  },
});

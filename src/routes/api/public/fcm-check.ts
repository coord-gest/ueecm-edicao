import { createFileRoute } from "@tanstack/react-router";
import { importPKCS8, SignJWT } from "jose";
import { normalizeFirebasePrivateKey } from "@/lib/push-dispatcher.server";

/**
 * Diagnóstico das credenciais FCM sem vazar a chave privada.
 * GET /api/public/fcm-check
 *
 * SEGURANÇA:
 * - Endpoint fica sob /api/public/* (sem auth Supabase), portanto exige o
 *   header `x-dispatch-secret` com o valor de DISPATCH_SECRET para responder.
 * - Nunca ecoa a FIREBASE_PRIVATE_KEY nem o FIREBASE_CLIENT_EMAIL na resposta.
 * - Sanitiza mensagens de erro do parser PKCS8 para não vazar bytes da chave.
 */
export const Route = createFileRoute("/api/public/fcm-check")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const expected = process.env.DISPATCH_SECRET;
        const provided = request.headers.get("x-dispatch-secret");
        if (!expected || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const projectId = process.env.FIREBASE_PROJECT_ID ?? "";
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL ?? "";
        const rawKey = process.env.FIREBASE_PRIVATE_KEY ?? "";

        // Apenas metadados booleanos/estruturais — nunca o conteúdo.
        const base = {
          projectIdPresent: projectId.length > 0,
          clientEmailPresent: clientEmail.length > 0,
          clientEmailIsServiceAccount: /@[^.]+\.iam\.gserviceaccount\.com$/i.test(clientEmail),
          privateKeyPresent: rawKey.length > 0,
          privateKeyLength: rawKey.length,
          privateKeyHasLiteralBackslashN: rawKey.includes("\\n"),
          privateKeyHasRealNewline: rawKey.includes("\n"),
          privateKeyWrappedInQuotes:
            (rawKey.startsWith('"') && rawKey.endsWith('"')) ||
            (rawKey.startsWith("'") && rawKey.endsWith("'")),
          privateKeyHasBeginHeader: rawKey.includes("-----BEGIN"),
          privateKeyHasCarriageReturn: rawKey.includes("\r"),
        };

        if (!projectId || !clientEmail || !rawKey) {
          return Response.json(
            { ok: false, error: "Faltam credenciais FIREBASE_*.", ...base },
            { status: 200 },
          );
        }

        try {
          const normalized = normalizeFirebasePrivateKey(rawKey);
          const pk = await importPKCS8(normalized, "RS256");
          await new SignJWT({ scope: "https://www.googleapis.com/auth/firebase.messaging" })
            .setProtectedHeader({ alg: "RS256", typ: "JWT" })
            .setIssuer(clientEmail)
            .setAudience("https://oauth2.googleapis.com/token")
            .setIssuedAt()
            .setExpirationTime("1h")
            .sign(pk);
          return Response.json({
            ok: true,
            message: "Credenciais FCM válidas. JWT assinado com sucesso.",
            ...base,
          });
        } catch (e) {
          // Sanitiza a mensagem: mantém apenas a categoria do erro reportada
          // pelo `jose` (ex.: "PKCS8 encoded key expected") e descarta o
          // resto — algumas mensagens podem incluir bytes decodificados
          // da chave em runtimes específicos.
          const raw = e instanceof Error ? e.message : String(e);
          const safeMsg = raw
            .split("\n")[0]
            .replace(/[^A-Za-z0-9 :.,'"()-]/g, "")
            .slice(0, 160);
          return Response.json(
            {
              ok: false,
              error: "Falha ao carregar/assinar com FIREBASE_PRIVATE_KEY.",
              errorCategory: safeMsg || "erro desconhecido",
              hint: "Cole o valor exato do campo 'private_key' do JSON do service account, incluindo -----BEGIN PRIVATE KEY----- e -----END PRIVATE KEY-----. Não envolva em aspas. Se copiar do JSON, mantenha os \\n literais.",
              ...base,
            },
            { status: 200 },
          );
        }
      },
    },
  },
});

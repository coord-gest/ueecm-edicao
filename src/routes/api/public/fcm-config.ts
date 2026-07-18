import { createFileRoute } from "@tanstack/react-router";

/**
 * GET /api/public/fcm-config
 *
 * Devolve a config pública do Firebase Web + VAPID public key.
 * Todos esses valores são seguros para expor ao navegador — a segurança
 * do Firebase Web depende das restrições de domínio configuradas no Console
 * e das regras do Cloud Messaging. Colocamos atrás de um endpoint para
 * evitar bake em bundle e permitir rotação sem redeploy.
 */
export const Route = createFileRoute("/api/public/fcm-config")({
  server: {
    handlers: {
      GET: async () => {
        const apiKey = process.env.FIREBASE_WEB_API_KEY;
        const vapidKey = process.env.FIREBASE_VAPID_PUBLIC_KEY;
        const projectId = process.env.FIREBASE_PROJECT_ID ?? "ueecm-d7290";

        if (!apiKey || !vapidKey) {
          return Response.json({ error: "FCM não configurado no servidor." }, { status: 503 });
        }

        return Response.json(
          {
            apiKey,
            authDomain: `${projectId}.firebaseapp.com`,
            projectId,
            storageBucket: `${projectId}.firebasestorage.app`,
            messagingSenderId: "500651108640",
            appId: "1:500651108640:web:6181a1dc73e17ce5040f45",
            // measurementId (Firebase Analytics) intencionalmente omitido:
            // não usamos Analytics no cliente e evitamos qualquer sinal de GA
            // pré-consentimento (LGPD art. 8º).
            vapidKey,
          },
          {
            headers: {
              // Cacheia por 5min no browser — reduz round-trips
              "cache-control": "public, max-age=300",
            },
          },
        );
      },
    },
  },
});

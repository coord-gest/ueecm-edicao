import { createFileRoute } from "@tanstack/react-router";

/**
 * GET /api/debug/fcm-diagnostics
 *
 * Endpoint de diagnóstico para verificar a configuração de FCM.
 * Retorna um relatório detalhado sobre:
 * - Configuração do Firebase
 * - Estado do Service Worker
 * - Status do IndexedDB
 * - Permissões de notificação
 *
 * ⚠️ APENAS USE EM DESENVOLVIMENTO!
 */
export const Route = createFileRoute("/api/debug/fcm-diagnostics")({
  server: {
    handlers: {
      GET: async () => {
        // PROTEÇÃO: desabilitar em produção
        if (process.env.NODE_ENV === "production") {
          return Response.json({ error: "Endpoint desabilitado em produção" }, { status: 403 });
        }

        const checks = {
          timestamp: new Date().toISOString(),
          environment: {
            firebase_project_id: !!process.env.FIREBASE_PROJECT_ID,
            firebase_client_email: !!process.env.FIREBASE_CLIENT_EMAIL,
            firebase_private_key: !!process.env.FIREBASE_PRIVATE_KEY,
            firebase_vapid_public_key: !!process.env.FIREBASE_VAPID_PUBLIC_KEY,
            firebase_web_api_key: !!process.env.FIREBASE_WEB_API_KEY,
          },
          fcm_config_endpoint: "/api/public/fcm-config",
          sw_registration: {
            path: "/sw.js",
            scope: "/",
            precache_files: ["/offline", "/manifest.json", "/favicon.png", "/icon-192.png"],
          },
          recommendations: [
            "1. Abra o DevTools (F12) → Application → Service Workers",
            "2. Verifique se '/sw.js' está 'activated and running'",
            "3. Acesse Application → Cookies e verifique se cookies estão bloqueados",
            "4. Acesse Application → Storage → IndexedDB",
            "5. Procure por 'firebase-messaging-database' e 'firebase-installations-database'",
            "6. Se vazio, o IndexedDB pode estar bloqueado",
            "7. Teste em: https://conectaueecm.com (não em preview/iframe)",
          ],
        };

        return Response.json(checks);
      },
    },
  },
});

/* Firebase Cloud Messaging service worker — recebe pushes em background.
 * Este arquivo é carregado pelo FCM Web SDK a partir da RAIZ do site
 * (nome e localização são convenção do SDK). Coexiste com /sw.js (PWA).
 *
 * IMPORTANTE: usamos os scripts "compat" via importScripts porque o SW
 * não suporta módulos ES em todos os browsers (Safari).
 */

importScripts("https://www.gstatic.com/firebasejs/12.15.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.15.0/firebase-messaging-compat.js");

// Config PÚBLICA é passada via query params ao registrar o SW no client
// (ex.: /firebase-messaging-sw.js?apiKey=...&senderId=...&appId=...&projectId=...).
// Isso evita hardcode no repositório e permite rotação sem redeploy.
const params = new URL(self.location.href).searchParams;

firebase.initializeApp({
  apiKey: params.get("apiKey") || "",
  authDomain: (params.get("projectId") || "") + ".firebaseapp.com",
  projectId: params.get("projectId") || "",
  storageBucket: (params.get("projectId") || "") + ".firebasestorage.app",
  messagingSenderId: params.get("senderId") || "",
  appId: params.get("appId") || "",
});

const messaging = firebase.messaging();

// Handler de mensagens em BACKGROUND (app fechado ou em outra aba).
// Mensagens em foreground são tratadas no client (getFirebaseMessaging + onMessage).
messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};
  const notif = payload.notification || {};
  const title = data.title || notif.title || "Nova notificação";
  const body = data.body || notif.body || "";
  const url = data.url || "/";

  // IMPORTANTE: retornar a Promise para que o FCM SDK a passe ao
  // event.waitUntil interno do 'push' event. Sem isso, o SW é encerrado
  // antes da notificação ser exibida e o Chrome mostra a mensagem
  // genérica "Este site foi atualizado em segundo plano".
  return self.registration.showNotification(title, {
    body,
    icon: "/icon-192.png",
    // O badge é o ícone monocromático exibido na status bar do Android.
    // Precisa ser branco em fundo transparente — o SO usa apenas o canal
    // alpha e pinta tudo de branco. Usar o icon colorido aqui resulta num
    // quadrado/círculo branco chapado sem forma reconhecível.
    badge: "/badge-96.png",
    tag: data.tag || "ecm-fcm",
    renotify: Boolean(data.tag),
    data: { url },
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    }),
  );
});

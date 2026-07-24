/* Service worker único do app — PWA + Firebase Cloud Messaging.
 *
 * Motivo: no Android/PWA/APK só pode existir 1 Service Worker controlando o
 * escopo raiz (/). Se o PWA registra /sw.js e o FCM tenta registrar
 * /firebase-messaging-sw.js também em /, o Chrome/TWA pode retornar
 * "Registration failed - storage error" ao criar o token. Por isso o SDK do
 * Firebase Messaging roda aqui, no mesmo /sw.js que controla o app.
 */

importScripts("https://www.gstatic.com/firebasejs/12.15.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.15.0/firebase-messaging-compat.js");

const VERSION = "v10-android-6-16-fcm";
const STATIC_CACHE = `static-${VERSION}`;
const PAGES_CACHE = `pages-${VERSION}`;
const IMG_CACHE = `images-${VERSION}`;
const DATA_CACHE = `data-${VERSION}`;
const OFFLINE_URL = "/offline";

// Tabelas do Supabase que ficam em cache SWR para leitura offline.
const OFFLINE_TABLES = ["posts", "comunicados", "horarios", "eventos", "alerts"];
const SUPABASE_REST_MATCH = /^https:\/\/[a-z0-9-]+\.supabase\.co\/rest\/v1\/([a-z_]+)/i;

// Fila de sincronização em background (comentários, justificativas, etc.)
const SYNC_TAG = "ecm-offline-queue";
const SYNC_DB = "ecm-offline";
const SYNC_STORE = "queue";
const APP_ORIGIN = new URL(self.location.href).origin;
const NOTIFICATION_ICON = new URL("/icon-192.png", APP_ORIGIN).href;
const NOTIFICATION_BADGE = new URL("/badge-96.png", APP_ORIGIN).href;

const PRECACHE = [
  OFFLINE_URL,
  "/manifest.json",
  "/favicon.png",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-192.png",
  "/icon-maskable-512.png",
];

let messaging = null;
let runtimeFcmConfig = null;
let backgroundMessageHandlerAttached = false;

function readFcmConfigFromUrl() {
  const params = new URL(self.location.href).searchParams;
  const apiKey = params.get("apiKey") || "";
  const projectId = params.get("projectId") || "";
  const senderId = params.get("senderId") || "";
  const appId = params.get("appId") || "";
  return { apiKey, projectId, senderId, appId };
}

function normalizeFcmConfig(config) {
  const cfg = config || {};
  return {
    apiKey: cfg.apiKey || "",
    projectId: cfg.projectId || "",
    senderId: cfg.senderId || cfg.messagingSenderId || "",
    appId: cfg.appId || "",
  };
}

function initFirebaseMessaging() {
  if (messaging) return messaging;

  const { apiKey, projectId, senderId, appId } = runtimeFcmConfig || readFcmConfigFromUrl();

  if (!apiKey || !projectId || !senderId || !appId) return null;

  try {
    if (!firebase.apps.length) {
      firebase.initializeApp({
        apiKey,
        authDomain: `${projectId}.firebaseapp.com`,
        projectId,
        storageBucket: `${projectId}.firebasestorage.app`,
        messagingSenderId: senderId,
        appId,
      });
    }
    messaging = firebase.messaging();
    return messaging;
  } catch (_) {
    return null;
  }
}

function ensureFirebaseMessagingHandler() {
  const instance = initFirebaseMessaging();
  if (!instance || backgroundMessageHandlerAttached) return instance;
  backgroundMessageHandlerAttached = true;
  instance.onBackgroundMessage((payload) => showPushNotification(payload));
  return instance;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE).catch(() => undefined))
      // Esta versão corrige entrega FCM em Android 14/16. Ativamos sem esperar
      // fechamento de abas para que celulares com SW antigo passem a receber.
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => ![STATIC_CACHE, PAGES_CACHE, IMG_CACHE, DATA_CACHE].includes(k))
            .map((k) => caches.delete(k)),
        ),
      )
      // clients.claim() faz o SW assumir controle de todas as abas abertas
      // sem precisar recarregar — essencial para que o pushManager funcione
      // imediatamente após a instalação no mobile.
      .then(() => self.clients.claim()),
  );
});

function isBypass(url) {
  return (
    url.pathname.startsWith("/~oauth") ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_serverFn") ||
    url.pathname.startsWith("/_build") ||
    url.pathname === "/sitemap.xml"
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // === Supabase REST (cross-origin): stale-while-revalidate para tabelas offline ===
  const restMatch = req.method === "GET" && url.href.match(SUPABASE_REST_MATCH);
  if (restMatch && OFFLINE_TABLES.includes(restMatch[1])) {
    event.respondWith(
      caches.open(DATA_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        const network = fetch(req)
          .then((res) => {
            if (res && res.status === 200) cache.put(req, res.clone()).catch(() => undefined);
            return res;
          })
          .catch(() => cached || Response.error());
        return cached || network;
      }),
    );
    return;
  }

  if (req.method !== "GET") return;
  if (url.origin !== self.location.origin) return;
  if (isBypass(url)) return;

  // Navegação (HTML): NetworkFirst com fallback offline
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches
            .open(PAGES_CACHE)
            .then((c) => c.put(req, copy))
            .catch(() => undefined);
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          return cached || (await caches.match(OFFLINE_URL)) || Response.error();
        }),
    );
    return;
  }

  // Imagens: CacheFirst
  if (req.destination === "image") {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches
              .open(IMG_CACHE)
              .then((c) => c.put(req, copy))
              .catch(() => undefined);
            return res;
          }),
      ),
    );
    return;
  }

  // Assets estáticos (js/css/fontes): CacheFirst
  if (/\.(?:js|css|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches
              .open(STATIC_CACHE)
              .then((c) => c.put(req, copy))
              .catch(() => undefined);
            return res;
          }),
      ),
    );
  }
});

// =====================
// Mensagens do cliente → SW
// =====================
// Permite que o pwa-register.ts force a ativação do novo SW sem reload.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  if (event.data && event.data.type === "INIT_FCM") {
    runtimeFcmConfig = normalizeFcmConfig(event.data.config);
    ensureFirebaseMessagingHandler();
  }

  if (event.data && event.data.type === "FLUSH_QUEUE") {
    event.waitUntil(flushOfflineQueue());
  }
});

// =====================
// Background Sync — fila de ações offline
// =====================
function openSyncDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SYNC_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SYNC_STORE)) {
        db.createObjectStore(SYNC_STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function readAllQueue() {
  const db = await openSyncDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SYNC_STORE, "readonly");
    const req = tx.objectStore(SYNC_STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function deleteFromQueue(id) {
  const db = await openSyncDB();
  return new Promise((resolve) => {
    const tx = db.transaction(SYNC_STORE, "readwrite");
    tx.objectStore(SYNC_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

async function flushOfflineQueue() {
  const items = await readAllQueue().catch(() => []);
  for (const item of items) {
    try {
      const res = await fetch(item.url, {
        method: item.method || "POST",
        headers: item.headers || { "Content-Type": "application/json" },
        body: item.body,
        credentials: "include",
      });
      if (res.ok) await deleteFromQueue(item.id);
    } catch (_) {
      // Sem rede: mantém para a próxima tentativa
    }
  }
  // Notifica clientes conectados para revalidarem seus dados.
  const clientsList = await self.clients.matchAll({ includeUncontrolled: true });
  clientsList.forEach((c) => c.postMessage({ type: "OFFLINE_QUEUE_FLUSHED" }));
}

self.addEventListener("sync", (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(flushOfflineQueue());
  }
});

// =====================
// Web Push notifications
// =====================

function toSameOriginUrl(value) {
  try {
    const url = new URL(value || "/", APP_ORIGIN);
    return url.origin === APP_ORIGIN ? url.href : new URL("/", APP_ORIGIN).href;
  } catch (_) {
    return new URL("/", APP_ORIGIN).href;
  }
}

function normalizePushPayload(rawPayload) {
  const fallback = {
    title: "U.E. Evaristo",
    body: "Você tem uma nova notificação.",
    url: "/",
    tag: "",
  };

  if (!rawPayload || typeof rawPayload !== "object") return fallback;

  const data = rawPayload.data && typeof rawPayload.data === "object" ? rawPayload.data : {};
  const notification =
    rawPayload.notification && typeof rawPayload.notification === "object"
      ? rawPayload.notification
      : {};
  const fcmOptions =
    rawPayload.fcmOptions || rawPayload.fcm_options || rawPayload.webpush?.fcm_options || {};

  return {
    ...fallback,
    ...rawPayload,
    ...data,
    ...notification,
    url: data.url || rawPayload.url || fcmOptions.link || fallback.url,
    tag: data.tag || notification.tag || rawPayload.tag || fallback.tag,
  };
}

function createNotificationTag(value) {
  if (typeof value === "string" && value.trim().length > 0 && value !== "ecm-default") {
    return value.trim();
  }
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `ecm-${Date.now()}-${randomPart}`;
}

function showPushNotification(rawPayload) {
  const payload = normalizePushPayload(rawPayload);
  const { title, body, url } = payload;
  const tag = createNotificationTag(payload.tag);

  const options = {
    body,
    tag,
    icon: payload.icon || NOTIFICATION_ICON,
    badge: payload.badge || NOTIFICATION_BADGE,
    image: payload.image,
    vibrate: [200, 100, 200],
    silent: false,
    requireInteraction: true,
    timestamp: Date.now(),
    data: { url: toSameOriginUrl(url), tag },
    renotify: true,
  };

  if (self.navigator && "setAppBadge" in self.navigator) {
    self.navigator.setAppBadge().catch(() => undefined);
  }

  return self.registration.showNotification(title, options);
}

ensureFirebaseMessagingHandler();

self.addEventListener("push", (event) => {
  if (messaging) return;

  let rawPayload = null;

  if (event.data) {
    try {
      rawPayload = event.data.json();
    } catch (_) {
      try {
        rawPayload = { body: event.data.text() };
      } catch (_) {
        // usa padrão
      }
    }
  }

  event.waitUntil(showPushNotification(rawPayload));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // Limpa o badge do ícone ao interagir.
  if (self.navigator && "clearAppBadge" in self.navigator) {
    self.navigator.clearAppBadge().catch(() => undefined);
  }
  const url = toSameOriginUrl((event.notification.data && event.notification.data.url) || "/");

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      // Se já há uma aba com o site aberta, navega nela
      for (const client of list) {
        if (client.url && "focus" in client) {
          return client.navigate(url).catch(() => client.focus());
        }
      }
      // Senão abre uma nova aba
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    }),
  );
});

self.addEventListener("notificationclose", (_event) => {
  // Podemos usar para analytics futuros; por ora apenas registramos.
  // console.log("[sw] Notificação fechada sem clique");
});

// Push notifications FCM são gerenciadas neste próprio /sw.js para evitar
// conflito de escopo entre o PWA instalado e o token FCM no Android/TWA.

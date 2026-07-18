// Firebase Web SDK client — inicializa uma única vez.
// A config pública + VAPID public key vêm do endpoint /api/public/fcm-config
// (evita bake em bundle e permite rotação sem redeploy).

import {
  deleteApp,
  initializeApp,
  getApps,
  type FirebaseApp,
  type FirebaseOptions,
} from "firebase/app";
import { getMessaging, isSupported, type Messaging } from "firebase/messaging";

export type FcmPublicConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
  vapidKey: string;
};

let cachedConfig: FcmPublicConfig | null = null;
let configPromise: Promise<FcmPublicConfig> | null = null;

export async function loadFcmConfig(): Promise<FcmPublicConfig> {
  if (cachedConfig) return cachedConfig;
  if (configPromise) return configPromise;
  configPromise = (async () => {
    const res = await fetch("/api/public/fcm-config", { credentials: "omit" });
    if (!res.ok) throw new Error(`Falha ao carregar config FCM (HTTP ${res.status}).`);
    const cfg = (await res.json()) as FcmPublicConfig;
    cachedConfig = cfg;
    return cfg;
  })();
  return configPromise;
}

let app: FirebaseApp | null = null;

export async function getFirebaseApp(): Promise<FirebaseApp> {
  if (app) return app;
  const cfg = await loadFcmConfig();
  const options: FirebaseOptions = {
    apiKey: cfg.apiKey,
    authDomain: cfg.authDomain,
    projectId: cfg.projectId,
    storageBucket: cfg.storageBucket,
    messagingSenderId: cfg.messagingSenderId,
    appId: cfg.appId,
    measurementId: cfg.measurementId,
  };
  app = getApps()[0] ?? initializeApp(options);
  return app;
}

let messaging: Messaging | null = null;

export async function getFirebaseMessaging(): Promise<Messaging | null> {
  if (typeof window === "undefined") return null;
  if (messaging) return messaging;
  if (!(await isSupported())) return null;
  messaging = getMessaging(await getFirebaseApp());
  return messaging;
}

export async function resetFirebaseMessagingClient(): Promise<void> {
  messaging = null;
  const currentApp = app ?? getApps()[0] ?? null;
  app = null;
  if (currentApp) {
    await deleteApp(currentApp).catch(() => undefined);
  }
}

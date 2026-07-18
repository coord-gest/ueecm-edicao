// Client-side push notifications via Firebase Cloud Messaging.
// Mantém a MESMA API pública (isPushSupported / subscribeToPush /
// unsubscribeFromPush / getCurrentSubscription) para não quebrar os botões
// existentes — mas por baixo agora fala com FCM em vez de Web Push+VAPID direto.
//
// NOTA: restaurado da versão antiga que funcionava. A telemetria
// (`reportFcmFailure`) foi mantida para continuar alimentando /painel-runtime
// e /diagnosticar-notificacoes.

import { supabase } from "@/integrations/supabase/client";
import { getFirebaseMessaging, loadFcmConfig } from "@/integrations/firebase/client";
import { getToken, deleteToken, onMessage } from "firebase/messaging";
import { logFcmDiagnostic } from "@/lib/fcm-diagnostics.functions";

export function isPushSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "serviceWorker" in navigator && "Notification" in window && "PushManager" in window;
}

/** Detecta plataforma para gravar no banco (broadcast futuro por plataforma). */
function detectPlatform(): "web" | "android-web" | "ios-web" {
  if (typeof navigator === "undefined") return "web";
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return "android-web";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios-web";
  return "web";
}

/** Fire-and-forget: registra falha do getToken no fcm_diagnostics. */
function reportFcmFailure(code: string, message: string): void {
  try {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null;
    let iframe = false;
    try {
      iframe = typeof window !== "undefined" && window.top !== window.self;
    } catch {
      iframe = true;
    }
    const host = typeof window !== "undefined" ? window.location.hostname : "";
    const preview =
      !import.meta.env.PROD ||
      host.startsWith("id-preview--") ||
      host.startsWith("preview--") ||
      host.endsWith(".lovableproject.com");
    const standalone =
      typeof window !== "undefined" &&
      (window.matchMedia?.("(display-mode: standalone)")?.matches ||
        Boolean((navigator as unknown as { standalone?: boolean }).standalone));
    void logFcmDiagnostic({
      data: {
        phase: "getToken",
        success: false,
        platform: detectPlatform(),
        userAgent: ua,
        isIframe: iframe,
        isPreview: preview,
        isStandalone: standalone,
        isInAppBrowser: /(FBAN|FBAV|Instagram|Line|MicroMessenger|Twitter|TikTok)/i.test(
          typeof navigator !== "undefined" ? navigator.userAgent : "",
        ),
        notificationPermission:
          typeof Notification !== "undefined" ? Notification.permission : null,
        errorCode: code,
        errorMessage: message.slice(0, 1000),
      },
    }).catch(() => undefined);
  } catch {
    /* nunca lança */
  }
}

/**
 * Registra o Service Worker do FCM, passando a config pública via query params.
 * O SW usa esses params para inicializar o Firebase — evita hardcode no arquivo.
 */
async function registerFcmServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  const cfg = await loadFcmConfig();
  const swUrl =
    "/firebase-messaging-sw.js?" +
    new URLSearchParams({
      apiKey: cfg.apiKey,
      projectId: cfg.projectId,
      senderId: cfg.messagingSenderId,
      appId: cfg.appId,
    }).toString();

  try {
    const reg = await navigator.serviceWorker.register(swUrl, {
      scope: "/firebase-cloud-messaging-push-scope",
    });
    if (reg.installing) {
      await new Promise<void>((resolve) => {
        const sw = reg.installing!;
        sw.addEventListener("statechange", () => {
          if (sw.state === "activated") resolve();
        });
        setTimeout(resolve, 10_000);
      });
    }
    return reg;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[fcm] falha ao registrar SW:", e);
    reportFcmFailure("sw-register", msg);
    return null;
  }
}

/** Devolve o token FCM atual (se existir) — sem pedir permissão. */
export async function getCurrentSubscription(): Promise<{ token: string } | null> {
  if (!isPushSupported()) return null;
  if (Notification.permission !== "granted") return null;
  try {
    const messaging = await getFirebaseMessaging();
    if (!messaging) return null;
    const cfg = await loadFcmConfig();
    const reg = await registerFcmServiceWorker();
    if (!reg) return null;
    const token = await getToken(messaging, {
      vapidKey: cfg.vapidKey,
      serviceWorkerRegistration: reg,
    });
    return token ? { token } : null;
  } catch (e) {
    console.warn("[fcm] getCurrentSubscription falhou:", e);
    return null;
  }
}

/**
 * Inscreve o dispositivo para receber notificações via FCM.
 * Funciona para usuários autenticados e anônimos (visitantes).
 */
export async function subscribeToPush(): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!isPushSupported()) {
    return { ok: false, reason: "Navegador não suporta notificações push." };
  }

  const perm = await Notification.requestPermission();
  if (perm !== "granted") {
    reportFcmFailure("permission-denied", `Notification.permission=${perm}`);
    return { ok: false, reason: "Permissão de notificações negada pelo navegador." };
  }

  let messaging;
  try {
    messaging = await getFirebaseMessaging();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    reportFcmFailure("firebase-init", msg);
    return { ok: false, reason: `Firebase não configurado: ${msg}` };
  }
  if (!messaging) {
    reportFcmFailure("messaging-unsupported", "getFirebaseMessaging returned null");
    return { ok: false, reason: "Firebase Messaging não suportado neste navegador." };
  }

  const cfg = await loadFcmConfig().catch((e: unknown) => {
    throw new Error(`Config FCM indisponível: ${e instanceof Error ? e.message : String(e)}`);
  });

  const reg = await registerFcmServiceWorker();
  if (!reg) {
    return { ok: false, reason: "Não foi possível registrar o Service Worker do FCM." };
  }

  let token: string;
  try {
    token = await getToken(messaging, {
      vapidKey: cfg.vapidKey,
      serviceWorkerRegistration: reg,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const code = /storage/i.test(msg)
      ? "storage"
      : /permission/i.test(msg)
        ? "permission"
        : "getToken";
    reportFcmFailure(code, msg);
    return { ok: false, reason: `Falha ao obter token FCM: ${msg}` };
  }

  if (!token) {
    reportFcmFailure("empty-token", "getToken returned empty");
    return { ok: false, reason: "FCM não devolveu um token (permissão pode ter sido negada)." };
  }

  onMessage(messaging, (payload) => {
    const data = payload.data ?? {};
    const title = data.title ?? payload.notification?.title ?? "Nova notificação";
    const body = data.body ?? payload.notification?.body ?? "";
    try {
      reg.showNotification(title, {
        body,
        icon: "/icon-192.png",
        badge: "/badge-96.png",
        tag: data.tag ?? "ecm-fcm",
        data: { url: data.url ?? "/" },
      });
    } catch {
      /* best-effort */
    }
  });

  const {
    data: { session },
  } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

  const response = await fetch("/api/push/fcm-register", {
    method: "POST",
    headers,
    body: JSON.stringify({
      token,
      platform: detectPlatform(),
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null,
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const reason =
      body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : "Não foi possível salvar o token no servidor.";
    reportFcmFailure("server-save", reason);
    return { ok: false, reason };
  }

  return { ok: true };
}

/** Cancela a inscrição FCM e remove o token do banco. */
export async function unsubscribeFromPush(): Promise<void> {
  try {
    const messaging = await getFirebaseMessaging();
    if (!messaging) return;

    let token: string | null = null;
    try {
      const cfg = await loadFcmConfig();
      const reg = await navigator.serviceWorker.getRegistration(
        "/firebase-cloud-messaging-push-scope",
      );
      if (reg) {
        token = await getToken(messaging, {
          vapidKey: cfg.vapidKey,
          serviceWorkerRegistration: reg,
        });
      }
    } catch {
      /* ignora */
    }

    await deleteToken(messaging).catch(() => undefined);

    if (token) {
      await fetch("/api/push/fcm-register", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      }).catch(() => undefined);
    }
  } catch (e) {
    console.warn("[fcm] unsubscribe falhou:", e);
  }
}

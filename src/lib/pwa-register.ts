// Registro do Service Worker com suporte a atualizações silenciosas.
// Regras:
// - Só registra em produção (HTTPS obrigatório para push)
// - Nunca em iframes / previews Lovable / localhost sem flag
// - Suporta ?sw=off como kill switch
// - Desregistra SWs obsoletos quando o contexto é recusado

import { loadFcmConfig } from "@/integrations/firebase/client";

const SW_URL = "/sw.js";

/** Guarda o Service Worker que está aguardando para ser ativado. */
let pendingUpdateSW: ServiceWorker | null = null;

function isRefusedContext(): boolean {
  if (typeof window === "undefined") return true;
  if (!import.meta.env.PROD) return true;
  try {
    if (window.top !== window.self) return true;
  } catch {
    return true;
  }
  const host = window.location.hostname;
  if (host.startsWith("id-preview--") || host.startsWith("preview--")) return true;
  if (host === "lovableproject.com" || host.endsWith(".lovableproject.com")) return true;
  if (host === "lovableproject-dev.com" || host.endsWith(".lovableproject-dev.com")) return true;
  if (host === "beta.lovable.dev" || host.endsWith(".beta.lovable.dev")) return true;
  if (new URLSearchParams(window.location.search).get("sw") === "off") return true;
  return false;
}

async function unregisterMatching() {
  if (!("serviceWorker" in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    regs
      .filter((r) => {
        const u = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || "";
        try {
          return new URL(u).pathname === SW_URL;
        } catch {
          return false;
        }
      })
      .map((r) => r.unregister()),
  );
}

async function getServiceWorkerUrl(): Promise<string> {
  try {
    const cfg = await loadFcmConfig();
    return `${SW_URL}?${new URLSearchParams({
      apiKey: cfg.apiKey,
      projectId: cfg.projectId,
      senderId: cfg.messagingSenderId,
      appId: cfg.appId,
    }).toString()}`;
  } catch {
    return SW_URL;
  }
}

/** Versão atual da aplicação (injetada em build time). */
export const APP_VERSION: string = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";

/** Tenta descobrir a versão do novo build via /version.json (no-store). */
async function fetchAvailableVersion(): Promise<string | null> {
  try {
    const res = await fetch("/version.json", { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { version?: string };
    return data?.version ?? null;
  } catch {
    return null;
  }
}

/**
 * Dispara um evento customizado no window para que a UI exiba o aviso de
 * atualização. O Service Worker aguardará até o usuário clicar em
 * "Recarregar" antes de assumir o controle.
 */
async function notifyUpdateAvailable(sw: ServiceWorker) {
  pendingUpdateSW = sw;
  const availableVersion = await fetchAvailableVersion();
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("pwa-update-available", {
        detail: {
          sw,
          currentVersion: APP_VERSION,
          availableVersion,
        },
      }),
    );
  }
}

function setupUpdateFlow(reg: ServiceWorkerRegistration, hadControllerOnRegister: boolean) {
  const track = (sw: ServiceWorker) => {
    sw.addEventListener("statechange", (e) => {
      const target = e.target as ServiceWorker;
      if (target.state === "installed") {
        // Primeira instalação do PWA: não mostrar banner nem recarregar.
        // Só é atualização real quando a página já era controlada por um SW.
        if (!hadControllerOnRegister) return;
        // Novo SW instalado e aguardando — notifica a UI em vez de
        // forçar a ativação imediatamente.
        void notifyUpdateAvailable(target);
      }
    });
  };

  if (reg.installing) {
    track(reg.installing);
  }

  reg.addEventListener("updatefound", () => {
    const newSW = reg.installing;
    if (newSW) track(newSW);
  });
}

/** Chamado pelo botão do toast para ativar o novo SW e recarregar. */
export function triggerUpdateReload() {
  if (pendingUpdateSW) {
    pendingUpdateSW.postMessage({ type: "SKIP_WAITING" });
  }
}

export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  if (isRefusedContext()) {
    await unregisterMatching().catch(() => {});
    return;
  }

  try {
    const hadControllerOnRegister = Boolean(navigator.serviceWorker.controller);
    const reg = await navigator.serviceWorker.register(await getServiceWorkerUrl(), {
      scope: "/",
      updateViaCache: "none",
    });
    setupUpdateFlow(reg, hadControllerOnRegister);

    // Verifica atualizações a cada 1 hora (útil para PWAs que ficam abertos)
    setInterval(
      () => {
        reg.update().catch(() => {});
      },
      60 * 60 * 1000,
    );

    // E também sempre que o app volta ao foco — pega deploys recentes
    // assim que o usuário reabre o PWA instalado.
    window.addEventListener("focus", () => {
      reg.update().catch(() => {});
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        reg.update().catch(() => {});
      }
    });
  } catch (err) {
    console.warn("[pwa] service worker registration failed", err);
  }
}

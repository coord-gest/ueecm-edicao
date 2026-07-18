// Probes de diagnóstico FCM que rodam INTEIRAMENTE no navegador.
// Nenhum destes checks depende de rede/servidor — servem para identificar
// bloqueios locais de armazenamento/permissão antes de tentar getToken.

export type ProbeReport = {
  timestamp: string;
  platform: "web" | "android-web" | "ios-web";
  userAgent: string;
  isIframe: boolean;
  isPreview: boolean;
  isStandalone: boolean;
  isInAppBrowser: boolean;
  cookiesEnabled: boolean;
  notificationSupported: boolean;
  notificationPermission: NotificationPermission | "unavailable";
  serviceWorkerSupported: boolean;
  serviceWorkerRegistered: boolean;
  serviceWorkerScript: string | null;
  indexedDbOk: boolean;
  indexedDbError: string | null;
  fcmConfigOk: boolean;
  fcmConfigError: string | null;
};

export type FcmErrorKind =
  | "storage"
  | "permission-denied"
  | "in-app-browser"
  | "preview"
  | "sw-registration"
  | "config"
  | "network"
  | "unregistered"
  | "unknown";

export function detectPlatform(): ProbeReport["platform"] {
  if (typeof navigator === "undefined") return "web";
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return "android-web";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios-web";
  return "web";
}

export function isInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /FBAN|FBAV|Instagram|Line\/|TikTok|LinkedInApp|MicroMessenger|WhatsApp/i.test(
    navigator.userAgent,
  );
}

export function isPreviewOrIframe(): { iframe: boolean; preview: boolean } {
  if (typeof window === "undefined") return { iframe: false, preview: false };
  let iframe = false;
  try {
    iframe = window.top !== window.self;
  } catch {
    iframe = true;
  }
  const host = window.location.hostname;
  const preview =
    !import.meta.env.PROD ||
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    host.endsWith(".lovableproject.com") ||
    host.endsWith(".lovableproject-dev.com") ||
    host.endsWith(".beta.lovable.dev");
  return { iframe, preview };
}

export function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia?.("(display-mode: standalone)")?.matches;
  const iosStandalone =
    "standalone" in navigator && (navigator as unknown as { standalone?: boolean }).standalone;
  return Boolean(mq || iosStandalone);
}

async function probeIndexedDb(): Promise<{ ok: boolean; error: string | null }> {
  if (typeof indexedDB === "undefined") {
    return { ok: false, error: "IndexedDB indisponível neste navegador." };
  }
  return new Promise((resolve) => {
    try {
      const dbName = "__fcm_diag_probe__";
      const req = indexedDB.open(dbName, 1);
      let opened = false;
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("probe")) db.createObjectStore("probe");
      };
      req.onerror = () => {
        resolve({ ok: false, error: req.error?.message ?? "open() falhou" });
      };
      req.onblocked = () => {
        resolve({ ok: false, error: "IndexedDB bloqueado (onblocked)." });
      };
      req.onsuccess = () => {
        opened = true;
        try {
          const db = req.result;
          const tx = db.transaction("probe", "readwrite");
          const store = tx.objectStore("probe");
          store.put(1, "k");
          tx.oncomplete = () => {
            db.close();
            try {
              indexedDB.deleteDatabase(dbName);
            } catch {
              // best effort
            }
            resolve({ ok: true, error: null });
          };
          tx.onerror = () => {
            db.close();
            resolve({ ok: false, error: tx.error?.message ?? "transaction falhou" });
          };
        } catch (e) {
          resolve({ ok: false, error: (e as Error).message });
        }
      };
      setTimeout(() => {
        if (!opened) resolve({ ok: false, error: "timeout ao abrir IndexedDB" });
      }, 3000);
    } catch (e) {
      resolve({ ok: false, error: (e as Error).message });
    }
  });
}

async function probeServiceWorker(): Promise<{
  supported: boolean;
  registered: boolean;
  script: string | null;
}> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return { supported: false, registered: false, script: null };
  }
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    if (regs.length === 0) return { supported: true, registered: false, script: null };
    const active = regs[0].active ?? regs[0].waiting ?? regs[0].installing;
    return {
      supported: true,
      registered: true,
      script: active?.scriptURL ?? null,
    };
  } catch {
    return { supported: true, registered: false, script: null };
  }
}

async function probeFcmConfig(): Promise<{ ok: boolean; error: string | null }> {
  try {
    const res = await fetch("/api/public/fcm-config", { cache: "no-store" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: body.error ?? `HTTP ${res.status}` };
    }
    const json = await res.json();
    if (!json.apiKey || !json.vapidKey) {
      return { ok: false, error: "Config incompleta (apiKey ou vapidKey ausente)." };
    }
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function runProbe(): Promise<ProbeReport> {
  const { iframe, preview } = isPreviewOrIframe();
  const [idbResult, swResult, cfgResult] = await Promise.all([
    probeIndexedDb(),
    probeServiceWorker(),
    probeFcmConfig(),
  ]);

  const notificationSupported = typeof window !== "undefined" && "Notification" in window;

  return {
    timestamp: new Date().toISOString(),
    platform: detectPlatform(),
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : "",
    isIframe: iframe,
    isPreview: preview,
    isStandalone: isStandalonePwa(),
    isInAppBrowser: isInAppBrowser(),
    cookiesEnabled: typeof navigator !== "undefined" ? navigator.cookieEnabled : false,
    notificationSupported,
    notificationPermission: notificationSupported
      ? (Notification.permission as NotificationPermission)
      : "unavailable",
    serviceWorkerSupported: swResult.supported,
    serviceWorkerRegistered: swResult.registered,
    serviceWorkerScript: swResult.script,
    indexedDbOk: idbResult.ok,
    indexedDbError: idbResult.error,
    fcmConfigOk: cfgResult.ok,
    fcmConfigError: cfgResult.error,
  };
}

/** Classifica a mensagem de erro do getToken em um tipo acionável. */
export function classifyFcmError(message: string): FcmErrorKind {
  const m = message.toLowerCase();
  if (/in-?app|instagram|facebook|tiktok|whatsapp|linkedin/.test(m)) return "in-app-browser";
  if (/preview|iframe/.test(m)) return "preview";
  if (/storage|indexeddb|failed[- ]storage|installations/.test(m)) return "storage";
  if (/permission|denied|negad/.test(m)) return "permission-denied";
  if (/registration failed(?! - storage)|service ?worker|sw registration/.test(m))
    return "sw-registration";
  if (/vapid|api ?key|config|not configured/.test(m)) return "config";
  if (/network|fetch|failed to fetch|network request failed/.test(m)) return "network";
  if (/unregistered|not.?found|invalid.?argument/.test(m)) return "unregistered";
  return "unknown";
}

export type FixStep = { title: string; steps: string[] };

export function getFixSteps(kind: FcmErrorKind, report: ProbeReport | null): FixStep[] {
  const isAndroid = report?.platform === "android-web";
  const isIos = report?.platform === "ios-web";
  const out: FixStep[] = [];

  if (kind === "in-app-browser") {
    out.push({
      title: "Abra no navegador do sistema",
      steps: [
        "Toque no menu (⋮ ou ···) do app onde você está",
        "Escolha 'Abrir no Chrome' (Android) ou 'Abrir no Safari' (iOS)",
        "Cole a URL do site e tente ativar as notificações novamente",
      ],
    });
    return out;
  }

  if (kind === "preview" || report?.isPreview || report?.isIframe) {
    out.push({
      title: "Saia do preview / iframe",
      steps: [
        "Notificações não funcionam dentro do preview do Lovable ou de qualquer iframe",
        "Abra o site publicado diretamente: https://conectaueecm.com",
        "Ou instale o app (PWA/APK) para ambiente isolado",
      ],
    });
    return out;
  }

  if (kind === "storage") {
    out.push({
      title: "Limpar dados do site (desktop)",
      steps: [
        "Abra DevTools com F12 (ou Ctrl+Shift+I / Cmd+Option+I)",
        "Vá em Application → Storage",
        "Clique em 'Clear site data' e marque tudo",
        "Recarregue a página (Ctrl+F5) e clique novamente em ativar notificações",
      ],
    });
    if (isAndroid) {
      out.push({
        title: "Limpar dados do app (Android)",
        steps: [
          "Configurações → Apps → U.E. Evaristo (ou Chrome, se estiver no navegador)",
          "Toque em Armazenamento → Limpar dados",
          "Reabra o app e tente ativar de novo",
        ],
      });
    }
    if (isIos) {
      out.push({
        title: "Reinstalar o PWA (iOS)",
        steps: [
          "Segure o ícone do app na tela inicial e escolha Remover App",
          "Abra o Safari e acesse https://conectaueecm.com",
          "Compartilhar → 'Adicionar à Tela de Início'",
          "Abra pelo ícone e ative as notificações",
        ],
      });
    }
    out.push({
      title: "Verifique se não está em janela anônima",
      steps: [
        "Janelas anônimas/privadas isolam IndexedDB e o FCM sempre falha",
        "Feche a aba anônima e use uma janela normal",
      ],
    });
    return out;
  }

  if (kind === "permission-denied") {
    out.push({
      title: "Reative a permissão de notificações",
      steps: [
        "Clique no cadeado 🔒 na barra de endereço",
        "Vá em 'Permissões' → 'Notificações'",
        "Selecione 'Permitir' (não deixe em 'Bloquear' nem 'Perguntar')",
        "Recarregue a página e tente novamente",
      ],
    });
    return out;
  }

  if (kind === "sw-registration") {
    out.push({
      title: "Force o registro do Service Worker",
      steps: [
        "Abra DevTools → Application → Service Workers",
        "Clique em 'Unregister' em todos os workers listados",
        "Application → Storage → 'Clear site data'",
        "Recarregue e tente novamente",
      ],
    });
    return out;
  }

  if (kind === "config") {
    out.push({
      title: "Config do Firebase ausente",
      steps: [
        "Peça ao desenvolvedor para verificar os secrets FIREBASE_* em /painel-runtime",
        "Sem eles, o servidor não devolve a config e o FCM não inicializa",
      ],
    });
    return out;
  }

  if (kind === "network") {
    out.push({
      title: "Falha de rede",
      steps: [
        "Verifique sua conexão com a internet",
        "Se estiver em Wi-Fi corporativa, pode haver bloqueio de fcm.googleapis.com",
        "Tente em rede 4G/5G para descartar bloqueio de firewall",
      ],
    });
    return out;
  }

  if (kind === "unregistered") {
    out.push({
      title: "Token antigo inválido — reative",
      steps: [
        "O token deste dispositivo foi invalidado (comum após dias sem uso)",
        "Clique novamente em ativar notificações",
        "Se persistir, faça 'Clear site data' no DevTools",
      ],
    });
    return out;
  }

  out.push({
    title: "Não foi possível identificar automaticamente",
    steps: [
      "Envie o diagnóstico completo para o suporte usando o botão abaixo",
      "Tente em outro navegador (Chrome/Edge/Firefox) para isolar o problema",
      "Se for celular, tente instalar o app (PWA/APK)",
    ],
  });
  return out;
}

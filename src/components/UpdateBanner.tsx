import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, Sparkles, X, History, WifiOff, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { APP_VERSION, triggerUpdateReload } from "@/lib/pwa-register";
import { trackEvent } from "@/lib/analytics";

type UpdateDetail = {
  currentVersion?: string;
  availableVersion?: string | null;
};

const PENDING_KEY = "pwa_pending_version";
const APPLIED_KEY = "pwa_applied_version";
const SHOWN_AT_KEY = "pwa_update_shown_at";
const HISTORY_KEY = "pwa_version_history";
const METERED_OVERRIDE_KEY = "pwa_metered_override_until";
const METERED_OVERRIDE_MS = 24 * 60 * 60 * 1000; // 24h
const MAX_HISTORY = 8;

type HistoryEntry = { version: string; appliedAt: string };
type FailureInfo = { expected: string; got: string };

/** Encurta um ISO/hash para exibição amigável no banner. */
function shortVersion(v: string | null | undefined): string {
  if (!v) return "—";
  const iso = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(v);
  if (iso) return `${iso[1]} ${iso[2]}`;
  return v.length > 12 ? v.slice(0, 12) : v;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function safeGet(key: string): string | null {
  try {
    return typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}
function safeRemove(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function readHistory(): HistoryEntry[] {
  try {
    const raw = safeGet(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => x && x.version && x.appliedAt) : [];
  } catch {
    return [];
  }
}

function pushHistory(version: string) {
  const list = readHistory();
  if (list[0]?.version === version) return;
  list.unshift({ version, appliedAt: new Date().toISOString() });
  safeSet(HISTORY_KEY, JSON.stringify(list.slice(0, MAX_HISTORY)));
}

function isMeteredOverrideActive(): boolean {
  const raw = safeGet(METERED_OVERRIDE_KEY);
  if (!raw) return false;
  const until = Number(raw);
  if (!Number.isFinite(until)) return false;
  if (until <= Date.now()) {
    safeRemove(METERED_OVERRIDE_KEY);
    return false;
  }
  return true;
}

function setMeteredOverride() {
  safeSet(METERED_OVERRIDE_KEY, String(Date.now() + METERED_OVERRIDE_MS));
}

type NetworkStatus = {
  metered: boolean;
  saveData: boolean;
  offline: boolean;
  effectiveType: string | null;
};

function readNetworkStatus(): NetworkStatus {
  if (typeof navigator === "undefined") {
    return { metered: false, saveData: false, offline: false, effectiveType: null };
  }
  const offline = navigator.onLine === false;
  const conn =
    (navigator as unknown as { connection?: { saveData?: boolean; effectiveType?: string } })
      .connection ?? null;
  const saveData = Boolean(conn?.saveData);
  const effectiveType = conn?.effectiveType ?? null;
  const slow = effectiveType === "slow-2g" || effectiveType === "2g";
  return { metered: saveData || slow, saveData, offline, effectiveType };
}

/**
 * Banner fixo (topo) exibido quando um novo Service Worker está aguardando.
 */
export function UpdateBanner() {
  const [visible, setVisible] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [availableVersion, setAvailableVersion] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [network, setNetwork] = useState<NetworkStatus>(() => readNetworkStatus());
  const [failure, setFailure] = useState<FailureInfo | null>(null);
  const shownAtRef = useRef<number | null>(null);
  const reloadBtnRef = useRef<HTMLButtonElement | null>(null);
  const handleReloadRef = useRef<() => void>(() => {});

  const history = useMemo(() => (visible ? readHistory() : []), [visible, showHistory, reloading]);
  const lastApplied = history[0] ?? null;

  // Metered "override" (usuário optou por atualizar mesmo em rede limitada nas
  // últimas 24h) suprime o aviso metered — mantém o offline sempre bloqueando.
  const meteredOverride = isMeteredOverrideActive();
  const effectiveMetered = network.metered && !meteredOverride;
  const networkBlocked = network.offline || effectiveMetered;

  // Após o reload: confirma sucesso ou detecta falha de aplicação.
  useEffect(() => {
    const pending = safeGet(PENDING_KEY);
    const shownAtRaw = safeGet(SHOWN_AT_KEY);
    if (!pending) return;

    if (pending === APP_VERSION) {
      const totalMs = shownAtRaw ? Date.now() - Number(shownAtRaw) : null;
      safeRemove(PENDING_KEY);
      safeRemove(SHOWN_AT_KEY);
      safeSet(APPLIED_KEY, APP_VERSION);
      pushHistory(APP_VERSION);
      toast.success("Aplicativo atualizado com sucesso", {
        description: `Você está na versão ${shortVersion(APP_VERSION)}.`,
        duration: 4000,
      });
      void trackEvent("pwa_update_applied", {
        metadata: {
          version: APP_VERSION,
          total_time_to_apply_ms: totalMs,
        },
      });
    } else {
      const info: FailureInfo = { expected: pending, got: APP_VERSION ?? "" };
      void trackEvent("pwa_update_failed", {
        metadata: { expected: info.expected, got: info.got },
      });
      toast.error("A atualização não foi aplicada", {
        description: `Esperado ${shortVersion(info.expected)}, mas o app carregou ${shortVersion(info.got)}.`,
        duration: 8000,
        action: {
          label: "Tentar novamente",
          onClick: () => handleReloadRef.current(),
        },
      });
      setFailure(info);
      setAvailableVersion(pending);
      setVisible(true);
      shownAtRef.current = Date.now();
      safeSet(SHOWN_AT_KEY, String(shownAtRef.current));
    }
  }, []);

  useEffect(() => {
    const onUpdate = (ev: Event) => {
      const detail = (ev as CustomEvent<UpdateDetail>).detail;
      const nextVersion = detail?.availableVersion ?? null;

      if (nextVersion && nextVersion === APP_VERSION) return;
      if (nextVersion && safeGet(APPLIED_KEY) === nextVersion) return;

      const net = readNetworkStatus();
      setNetwork(net);
      setAvailableVersion(nextVersion);
      setVisible(true);
      shownAtRef.current = Date.now();
      safeSet(SHOWN_AT_KEY, String(shownAtRef.current));
      void trackEvent("pwa_update_shown", {
        metadata: {
          current: APP_VERSION,
          available: nextVersion,
          metered: net.metered,
          save_data: net.saveData,
          effective_type: net.effectiveType,
          metered_override: isMeteredOverrideActive(),
        },
      });
    };
    window.addEventListener("pwa-update-available", onUpdate);
    return () => window.removeEventListener("pwa-update-available", onUpdate);
  }, []);

  // Observa mudanças de rede enquanto o banner está aberto.
  useEffect(() => {
    if (!visible) return;
    const refresh = () => setNetwork(readNetworkStatus());
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    const conn = (navigator as unknown as { connection?: EventTarget }).connection;
    conn?.addEventListener?.("change", refresh);
    return () => {
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
      conn?.removeEventListener?.("change", refresh);
    };
  }, [visible]);

  // Foco automático no botão principal ao abrir; Esc fecha.
  useEffect(() => {
    if (!visible) return;
    reloadBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !reloading) {
        setVisible(false);
        void trackEvent("pwa_update_dismissed", {
          metadata: { via: "escape", available: availableVersion },
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, reloading, availableVersion]);

  const handleReload = () => {
    if (network.offline) {
      toast.error("Sem conexão", {
        description: "Conecte-se à internet para baixar a atualização.",
      });
      return;
    }
    // Se o usuário optou por atualizar mesmo em rede limitada, persiste a
    // preferência por 24h para não perguntar de novo.
    if (network.metered) {
      setMeteredOverride();
      void trackEvent("pwa_update_metered_override", {
        metadata: { available: availableVersion, effective_type: network.effectiveType },
      });
    }

    const elapsedMs = shownAtRef.current ? Date.now() - shownAtRef.current : null;
    setReloading(true);
    if (availableVersion) safeSet(PENDING_KEY, availableVersion);

    void trackEvent("pwa_update_clicked", {
      metadata: {
        current: APP_VERSION,
        available: availableVersion,
        time_to_click_ms: elapsedMs,
        metered: network.metered,
        save_data: network.saveData,
        effective_type: network.effectiveType,
        retry_after_failure: Boolean(failure),
      },
    });

    const startedAt = Date.now();
    let didReload = false;
    const doReload = (reason: "controllerchange" | "fallback" | "error") => {
      if (didReload) return;
      didReload = true;
      void trackEvent("pwa_update_reload", {
        metadata: {
          reason,
          reload_delay_ms: Date.now() - startedAt,
          available: availableVersion,
        },
      });
      try {
        window.location.reload();
      } catch {
        /* último recurso */
      }
    };

    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        () => doReload("controllerchange"),
        { once: true },
      );
    }

    try {
      triggerUpdateReload();
    } catch {
      doReload("error");
      return;
    }

    window.setTimeout(() => doReload("fallback"), 2500);
  };
  handleReloadRef.current = handleReload;

  if (!visible) return null;

  return (
    <div
      role="alert"
      aria-live={reloading ? "assertive" : "polite"}
      aria-atomic="true"
      data-testid="update-banner"
      className="fixed inset-x-0 top-0 z-[100] flex justify-center px-3 pt-3 sm:px-4"
    >
      <div className="flex w-full max-w-2xl flex-col gap-2 rounded-xl border border-primary/30 bg-gradient-to-r from-primary/95 to-primary/85 px-4 py-3 text-primary-foreground shadow-2xl backdrop-blur-md">
        <div className="flex items-start gap-3">
          <div
            aria-hidden="true"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/20"
          >
            {failure ? <AlertTriangle className="size-5" /> : <Sparkles className="size-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-semibold sm:text-base">
              {reloading
                ? "Atualizando o app..."
                : failure
                  ? "Falha ao aplicar a atualização"
                  : "Nova versão disponível"}
            </p>
            {reloading ? (
              <p className="text-xs opacity-90 sm:text-sm" data-testid="update-reloading-msg">
                Aplicando a atualização e recarregando. Não feche esta janela.
              </p>
            ) : (
              <div className="mt-0.5 space-y-1 text-xs opacity-90 sm:text-sm">
                {failure && (
                  <p
                    data-testid="update-failure-msg"
                    className="rounded-md bg-white/15 px-2 py-1 text-[11px] font-medium sm:text-xs"
                  >
                    Esperávamos a versão{" "}
                    <span data-testid="update-failure-expected" className="font-mono font-semibold">
                      {shortVersion(failure.expected)}
                    </span>
                    , mas o app carregou{" "}
                    <span data-testid="update-failure-got" className="font-mono font-semibold">
                      {shortVersion(failure.got)}
                    </span>
                    . Clique em <em>Tentar novamente</em> para reaplicar.
                  </p>
                )}
                <p>
                  <span className="sr-only">Versão atual: </span>
                  Atual:{" "}
                  <span data-testid="update-current-version" className="font-mono">
                    {shortVersion(APP_VERSION)}
                  </span>
                  <span aria-hidden="true">{"  →  "}</span>
                  <span className="sr-only">Nova versão: </span>
                  Nova:{" "}
                  <span data-testid="update-available-version" className="font-mono font-semibold">
                    {shortVersion(availableVersion)}
                  </span>
                </p>
                {networkBlocked ? (
                  <p
                    data-testid="update-network-warning"
                    className="flex items-center gap-1 rounded-md bg-white/15 px-2 py-1 text-[11px] font-medium sm:text-xs"
                  >
                    <WifiOff aria-hidden="true" className="size-3.5" />
                    {network.offline
                      ? "Você está offline. Reconecte para atualizar."
                      : "Rede limitada ou economia de dados ativa. Conecte-se ao Wi-Fi para atualizar sem gastar dados."}
                  </p>
                ) : meteredOverride && network.metered ? (
                  <p
                    data-testid="update-metered-override"
                    className="text-[11px] opacity-80 sm:text-xs"
                  >
                    Você optou por atualizar em rede limitada (válido por 24h).
                  </p>
                ) : (
                  !failure && (
                    <p className="opacity-80">Clique em atualizar para aplicar as melhorias.</p>
                  )
                )}
              </div>
            )}
          </div>
          <Button
            ref={reloadBtnRef}
            size="sm"
            onClick={handleReload}
            disabled={reloading || network.offline}
            aria-label={
              reloading
                ? "Atualizando o aplicativo, aguarde"
                : failure
                  ? "Tentar aplicar a atualização novamente"
                  : `Atualizar aplicativo para a versão ${shortVersion(availableVersion)}`
            }
            data-testid="update-reload-btn"
            className="shrink-0 rounded-lg bg-white text-primary hover:bg-white/90 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
          >
            <RefreshCw aria-hidden="true" className={`size-4 ${reloading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">
              {reloading
                ? "Atualizando..."
                : failure
                  ? "Tentar novamente"
                  : effectiveMetered
                    ? "Atualizar mesmo assim"
                    : "Atualizar agora"}
            </span>
            <span className="sm:hidden">
              {reloading ? "..." : failure ? "Repetir" : "Atualizar"}
            </span>
          </Button>
          {!reloading && (
            <button
              type="button"
              onClick={() => {
                setVisible(false);
                void trackEvent("pwa_update_dismissed", {
                  metadata: {
                    via: "close",
                    available: availableVersion,
                    had_failure: Boolean(failure),
                  },
                });
              }}
              aria-label="Dispensar aviso de atualização"
              className="rounded-md p-1.5 text-primary-foreground/80 transition hover:bg-white/10 hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          )}
        </div>

        {!reloading && (
          <div className="flex items-center justify-between border-t border-white/20 pt-2 text-[11px] sm:text-xs">
            <span className="opacity-80">
              Última aplicada:{" "}
              <span className="font-mono">
                {lastApplied ? shortVersion(lastApplied.version) : "—"}
              </span>
              {lastApplied ? (
                <span className="opacity-75"> ({formatDateTime(lastApplied.appliedAt)})</span>
              ) : null}
            </span>
            <button
              type="button"
              onClick={() => setShowHistory((s) => !s)}
              aria-expanded={showHistory}
              aria-controls="pwa-version-history"
              data-testid="update-history-toggle"
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:text-xs"
            >
              <History aria-hidden="true" className="size-3.5" />
              {showHistory ? "Ocultar histórico" : "Ver histórico"}
            </button>
          </div>
        )}

        {showHistory && !reloading && (
          <div
            id="pwa-version-history"
            data-testid="update-history"
            className="max-h-40 overflow-y-auto rounded-md bg-white/10 p-2 text-[11px] sm:text-xs"
          >
            {history.length === 0 ? (
              <p className="opacity-80">Nenhuma atualização registrada ainda.</p>
            ) : (
              <ul className="space-y-1">
                {history.map((h) => (
                  <li key={`${h.version}-${h.appliedAt}`} className="flex justify-between gap-2">
                    <span className="font-mono">{shortVersion(h.version)}</span>
                    <span className="opacity-80">{formatDateTime(h.appliedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Fila de ações offline persistida em IndexedDB e drenada pelo Service Worker
 * (Background Sync API). Usada para comentários, justificativas e outras
 * ações que precisam sobreviver a uma reconexão.
 */

const DB_NAME = "ecm-offline";
const STORE = "queue";
const SYNC_TAG = "ecm-offline-queue";

export type QueuedAction = {
  url: string;
  method?: "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
  body: string;
  label?: string;
};

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB indisponível"));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueueOfflineAction(action: QueuedAction): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).add({ ...action, queuedAt: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  // Registra Background Sync quando disponível; senão tenta drenar quando voltar online.
  try {
    const reg = await navigator.serviceWorker?.ready;
    if (reg && "sync" in reg) {
      // @ts-expect-error — Background Sync API não tipada por padrão
      await reg.sync.register(SYNC_TAG);
    }
  } catch {
    // Ignorado: fallback usa evento 'online'
  }
}

export async function countPendingActions(): Promise<number> {
  try {
    const db = await openDB();
    return await new Promise<number>((resolve) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(0);
    });
  } catch {
    return 0;
  }
}

/** Solicita ao SW que tente drenar a fila agora (fallback sem Background Sync). */
export function requestQueueFlush(): void {
  navigator.serviceWorker?.controller?.postMessage({ type: "FLUSH_QUEUE" });
}

/** Instala listener global: quando voltar online, pede flush ao SW. */
export function installOnlineFlushListener(): void {
  if (typeof window === "undefined") return;
  window.addEventListener("online", () => requestQueueFlush());
}

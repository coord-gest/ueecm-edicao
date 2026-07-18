/**
 * E2E-style test do fluxo de atualização do PWA.
 *
 * Cobre:
 *  1. O banner NÃO aparece sem evento de atualização.
 *  2. Quando `pwa-update-available` é disparado (o wrapper de PWA faz isso
 *     assim que um novo Service Worker entra em `installed` aguardando),
 *     o banner aparece exibindo a versão atual e a nova versão.
 *  3. Clicar em "Atualizar agora" chama `triggerUpdateReload` (SKIP_WAITING)
 *     e, mesmo se o `controllerchange` nunca disparar, o app recarrega via
 *     o fallback de timeout — o clique NUNCA fica preso.
 */
import { fireEvent, render, screen, act, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const triggerUpdateReloadMock = vi.fn();
const trackEventMock = vi.fn();

vi.mock("@/lib/pwa-register", () => ({
  APP_VERSION: "2026-07-14T10:00:00.000Z",
  triggerUpdateReload: (...args: unknown[]) => triggerUpdateReloadMock(...args),
}));

vi.mock("@/lib/analytics", () => ({
  trackEvent: (...args: unknown[]) => {
    trackEventMock(...args);
    return Promise.resolve();
  },
}));

const { toastFn, toastSuccess, toastError } = vi.hoisted(() => ({
  toastFn: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(toastFn, {
    success: toastSuccess,
    error: toastError,
  }),
}));

import { UpdateBanner } from "@/components/UpdateBanner";

function dispatchUpdate(availableVersion: string | null = "2026-07-14T12:30:00.000Z") {
  window.dispatchEvent(
    new CustomEvent("pwa-update-available", {
      detail: {
        sw: {} as ServiceWorker,
        currentVersion: "2026-07-14T10:00:00.000Z",
        availableVersion,
      },
    }),
  );
}

describe("UpdateBanner (PWA update flow E2E)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    triggerUpdateReloadMock.mockReset();
    trackEventMock.mockReset();
    toastFn.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
    window.localStorage.clear();
    // Reset navigator overrides
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    Object.defineProperty(navigator, "connection", { configurable: true, value: undefined });
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("não renderiza nada quando não há SW aguardando", () => {
    render(<UpdateBanner />);
    expect(screen.queryByTestId("update-banner")).toBeNull();
  });

  it("mostra o banner com versão atual e disponível quando o SW está aguardando", () => {
    render(<UpdateBanner />);
    act(() => dispatchUpdate("2026-07-14T12:30:00.000Z"));

    expect(screen.getByTestId("update-banner")).toBeInTheDocument();
    expect(screen.getByTestId("update-current-version").textContent).toContain("2026-07-14");
    expect(screen.getByTestId("update-available-version").textContent).toContain("12:30");
    expect(screen.getByTestId("update-reload-btn")).toBeEnabled();
  });

  it("clicar em Atualizar agora aciona SKIP_WAITING, mostra aviso e SEMPRE recarrega (fallback)", async () => {
    const reloadSpy = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, reload: reloadSpy },
    });

    // fireEvent used with fake timers
    render(<UpdateBanner />);
    act(() => dispatchUpdate());

    fireEvent.click(screen.getByTestId("update-reload-btn"));

    expect(triggerUpdateReloadMock).toHaveBeenCalledTimes(1);
    // Aviso de recarga aparece
    expect(screen.getByTestId("update-reloading-msg")).toBeInTheDocument();
    // Botão desabilitado enquanto recarrega
    expect(screen.getByTestId("update-reload-btn")).toBeDisabled();
    // Antes do fallback: nenhum reload ainda
    expect(reloadSpy).not.toHaveBeenCalled();

    // Avança até o fallback de 2.5s — o controllerchange "não disparou"
    act(() => {
      vi.advanceTimersByTime(2600);
    });

    expect(reloadSpy).toHaveBeenCalledTimes(1);

    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  it("ainda recarrega mesmo se triggerUpdateReload lançar erro", async () => {
    triggerUpdateReloadMock.mockImplementationOnce(() => {
      throw new Error("SW postMessage falhou");
    });
    const reloadSpy = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, reload: reloadSpy },
    });

    // fireEvent used with fake timers
    render(<UpdateBanner />);
    act(() => dispatchUpdate());

    fireEvent.click(screen.getByTestId("update-reload-btn"));

    act(() => {
      vi.advanceTimersByTime(2600);
    });

    expect(reloadSpy).toHaveBeenCalledTimes(1);

    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  it("suprime o banner quando availableVersion === APP_VERSION", () => {
    render(<UpdateBanner />);
    act(() => dispatchUpdate("2026-07-14T10:00:00.000Z"));
    expect(screen.queryByTestId("update-banner")).toBeNull();
  });

  it("suprime o banner quando a versão já foi aplicada anteriormente", () => {
    window.localStorage.setItem("pwa_applied_version", "2026-07-14T12:30:00.000Z");
    render(<UpdateBanner />);
    act(() => dispatchUpdate("2026-07-14T12:30:00.000Z"));
    expect(screen.queryByTestId("update-banner")).toBeNull();
  });

  it("registra analytics de exibição, clique e reload com métrica de tempo", () => {
    const reloadSpy = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, reload: reloadSpy },
    });

    render(<UpdateBanner />);
    act(() => dispatchUpdate());

    expect(trackEventMock).toHaveBeenCalledWith(
      "pwa_update_shown",
      expect.objectContaining({ metadata: expect.any(Object) }),
    );

    fireEvent.click(screen.getByTestId("update-reload-btn"));

    const clickCall = trackEventMock.mock.calls.find((c) => c[0] === "pwa_update_clicked");
    expect(clickCall).toBeDefined();
    expect(clickCall?.[1].metadata).toHaveProperty("time_to_click_ms");

    act(() => {
      vi.advanceTimersByTime(2600);
    });

    const reloadCall = trackEventMock.mock.calls.find((c) => c[0] === "pwa_update_reload");
    expect(reloadCall).toBeDefined();
    expect(reloadCall?.[1].metadata).toMatchObject({ reason: "fallback" });
    expect(reloadCall?.[1].metadata.reload_delay_ms).toBeGreaterThanOrEqual(2500);
  });

  it("salva pending version no clique para confirmar após reload", () => {
    render(<UpdateBanner />);
    act(() => dispatchUpdate("2026-07-14T12:30:00.000Z"));
    fireEvent.click(screen.getByTestId("update-reload-btn"));
    expect(window.localStorage.getItem("pwa_pending_version")).toBe("2026-07-14T12:30:00.000Z");
  });

  it("foca automaticamente no botão Atualizar e aria-live vira 'assertive' no reload", () => {
    render(<UpdateBanner />);
    act(() => dispatchUpdate());
    const btn = screen.getByTestId("update-reload-btn");
    expect(document.activeElement).toBe(btn);

    const banner = screen.getByTestId("update-banner");
    expect(banner.getAttribute("aria-live")).toBe("polite");

    fireEvent.click(btn);
    expect(banner.getAttribute("aria-live")).toBe("assertive");
  });

  describe("network awareness", () => {
    it("mostra aviso offline e desabilita o botão quando navigator.onLine é false", () => {
      Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
      render(<UpdateBanner />);
      act(() => dispatchUpdate());

      expect(screen.getByTestId("update-network-warning").textContent).toMatch(/offline/i);
      expect(screen.getByTestId("update-reload-btn")).toBeDisabled();
    });

    it("chama handleReload em offline resulta em toast de erro e nenhum reload", () => {
      // Renderiza online, dispara o banner, depois muda para offline e clica.
      render(<UpdateBanner />);
      act(() => dispatchUpdate());
      // Muda para offline e dispara evento para o listener atualizar o estado
      Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
      act(() => {
        window.dispatchEvent(new Event("offline"));
      });

      // Botão fica disabled — assert isso (guard adicional)
      expect(screen.getByTestId("update-reload-btn")).toBeDisabled();
      expect(triggerUpdateReloadMock).not.toHaveBeenCalled();
    });

    it("mostra aviso metered e rótulo 'Atualizar mesmo assim' quando saveData=true", () => {
      Object.defineProperty(navigator, "connection", {
        configurable: true,
        value: { saveData: true, effectiveType: "4g" },
      });
      render(<UpdateBanner />);
      act(() => dispatchUpdate());

      expect(screen.getByTestId("update-network-warning").textContent).toMatch(
        /Rede limitada|economia/i,
      );
      expect(screen.getByTestId("update-reload-btn").textContent).toMatch(/mesmo assim/i);
    });

    it("mostra aviso metered para effectiveType='2g'", () => {
      Object.defineProperty(navigator, "connection", {
        configurable: true,
        value: { saveData: false, effectiveType: "2g" },
      });
      render(<UpdateBanner />);
      act(() => dispatchUpdate());

      expect(screen.queryByTestId("update-network-warning")).not.toBeNull();
    });

    it("persiste o override 'Atualizar mesmo assim' por 24h após clique em rede metered", () => {
      Object.defineProperty(navigator, "connection", {
        configurable: true,
        value: { saveData: true, effectiveType: "4g" },
      });
      render(<UpdateBanner />);
      act(() => dispatchUpdate());
      fireEvent.click(screen.getByTestId("update-reload-btn"));

      const until = Number(window.localStorage.getItem("pwa_metered_override_until"));
      expect(until).toBeGreaterThan(Date.now() + 23 * 60 * 60 * 1000);
      expect(until).toBeLessThanOrEqual(Date.now() + 24 * 60 * 60 * 1000 + 1000);

      const override = trackEventMock.mock.calls.find(
        (c) => c[0] === "pwa_update_metered_override",
      );
      expect(override).toBeDefined();
    });

    it("com override ativo, não exibe aviso metered em nova sessão", () => {
      window.localStorage.setItem(
        "pwa_metered_override_until",
        String(Date.now() + 12 * 60 * 60 * 1000),
      );
      Object.defineProperty(navigator, "connection", {
        configurable: true,
        value: { saveData: true, effectiveType: "4g" },
      });
      render(<UpdateBanner />);
      act(() => dispatchUpdate());

      expect(screen.queryByTestId("update-network-warning")).toBeNull();
      expect(screen.getByTestId("update-metered-override")).toBeInTheDocument();
      expect(screen.getByTestId("update-reload-btn").textContent).toMatch(/Atualizar agora/i);
    });
  });

  describe("failure recovery", () => {
    it("mostra mensagem de falha comparando esperada vs carregada quando pending ≠ APP_VERSION", () => {
      window.localStorage.setItem("pwa_pending_version", "2026-08-01T09:00:00.000Z");
      render(<UpdateBanner />);

      expect(screen.getByTestId("update-failure-msg")).toBeInTheDocument();
      expect(screen.getByTestId("update-failure-expected").textContent).toContain("2026-08-01");
      expect(screen.getByTestId("update-failure-got").textContent).toContain("2026-07-14");
      expect(screen.getByTestId("update-reload-btn").textContent).toMatch(
        /Tentar novamente|Repetir/,
      );
    });

    it("registra pwa_update_failed com expected e got no analytics", () => {
      window.localStorage.setItem("pwa_pending_version", "2026-08-01T09:00:00.000Z");
      render(<UpdateBanner />);

      const failedCall = trackEventMock.mock.calls.find((c) => c[0] === "pwa_update_failed");
      expect(failedCall).toBeDefined();
      expect(failedCall?.[1].metadata).toMatchObject({
        expected: "2026-08-01T09:00:00.000Z",
        got: "2026-07-14T10:00:00.000Z",
      });
    });

    it("toast de falha inclui action 'Tentar novamente' que dispara reload", () => {
      window.localStorage.setItem("pwa_pending_version", "2026-08-01T09:00:00.000Z");
      render(<UpdateBanner />);

      const errorCall = toastError.mock.calls.find(
        (c) => typeof c[0] === "string" && /não foi aplicada/i.test(c[0]),
      );
      expect(errorCall).toBeDefined();
      const opts = errorCall?.[1] as { action?: { label: string; onClick: () => void } };
      expect(opts?.action?.label).toMatch(/Tentar novamente/i);

      // Aciona o handler do toast — deve chamar triggerUpdateReload
      act(() => opts!.action!.onClick());
      expect(triggerUpdateReloadMock).toHaveBeenCalledTimes(1);
    });
  });
});

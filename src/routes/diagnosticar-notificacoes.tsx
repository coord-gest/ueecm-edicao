import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Loader2,
  Play,
  Send,
  Bell,
  ClipboardCopy,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  runProbe,
  classifyFcmError,
  getFixSteps,
  type ProbeReport,
  type FcmErrorKind,
} from "@/lib/fcm-diagnostics";
import { logFcmDiagnostic } from "@/lib/fcm-diagnostics.functions";
import { subscribeToPush } from "@/lib/push";

export const Route = createFileRoute("/diagnosticar-notificacoes")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Diagnosticar notificações | U.E. Evaristo" },
      {
        name: "description",
        content:
          "Verifique por que as notificações não estão funcionando no seu navegador: permissões, Service Worker, IndexedDB e config do Firebase.",
      },
    ],
  }),
  component: DiagPage,
});

type State =
  | { kind: "idle" }
  | { kind: "probing" }
  | { kind: "ready"; report: ProbeReport }
  | { kind: "trying-token"; report: ProbeReport }
  | { kind: "token-ok"; report: ProbeReport }
  | { kind: "token-failed"; report: ProbeReport; error: string; classification: FcmErrorKind };

function CheckRow({
  label,
  ok,
  detail,
}: {
  label: string;
  ok: boolean | null;
  detail?: string | null;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border/70 bg-background/50 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        {detail && <p className="mt-0.5 break-words text-xs text-muted-foreground">{detail}</p>}
      </div>
      {ok === null ? (
        <Badge variant="secondary">n/d</Badge>
      ) : ok ? (
        <CheckCircle2 className="size-5 text-emerald-500" />
      ) : (
        <XCircle className="size-5 text-destructive" />
      )}
    </div>
  );
}

function DiagPage() {
  const [state, setState] = useState<State>({ kind: "idle" });
  const logFn = useServerFn(logFcmDiagnostic);

  const doProbe = async () => {
    setState({ kind: "probing" });
    const report = await runProbe();
    setState({ kind: "ready", report });
    // Registra o probe (sem erro) para termos baseline de contextos
    logFn({
      data: {
        phase: "probe",
        success:
          report.indexedDbOk &&
          report.serviceWorkerSupported &&
          report.notificationSupported &&
          !report.isInAppBrowser,
        platform: report.platform,
        userAgent: report.userAgent,
        isIframe: report.isIframe,
        isPreview: report.isPreview,
        isStandalone: report.isStandalone,
        isInAppBrowser: report.isInAppBrowser,
        notificationPermission: report.notificationPermission,
        serviceWorkerSupported: report.serviceWorkerSupported,
        serviceWorkerRegistered: report.serviceWorkerRegistered,
        serviceWorkerScript: report.serviceWorkerScript,
        indexedDbOk: report.indexedDbOk,
        cookiesEnabled: report.cookiesEnabled,
        fcmConfigOk: report.fcmConfigOk,
        errorMessage: report.indexedDbError ?? report.fcmConfigError ?? null,
      },
    }).catch(() => undefined);
  };

  const tryToken = async () => {
    if (state.kind !== "ready" && state.kind !== "token-failed") return;
    const report = state.report;
    setState({ kind: "trying-token", report });
    const result = await subscribeToPush();
    if (result.ok) {
      setState({ kind: "token-ok", report });
      toast.success("Notificações ativadas com sucesso!");
      logFn({
        data: {
          phase: "getToken",
          success: true,
          platform: report.platform,
          userAgent: report.userAgent,
          isIframe: report.isIframe,
          isPreview: report.isPreview,
          isStandalone: report.isStandalone,
          isInAppBrowser: report.isInAppBrowser,
          notificationPermission: report.notificationPermission,
          indexedDbOk: report.indexedDbOk,
        },
      }).catch(() => undefined);
    } else {
      const classification = classifyFcmError(result.reason);
      setState({ kind: "token-failed", report, error: result.reason, classification });
      logFn({
        data: {
          phase: "getToken",
          success: false,
          platform: report.platform,
          userAgent: report.userAgent,
          isIframe: report.isIframe,
          isPreview: report.isPreview,
          isStandalone: report.isStandalone,
          isInAppBrowser: report.isInAppBrowser,
          notificationPermission: report.notificationPermission,
          serviceWorkerSupported: report.serviceWorkerSupported,
          serviceWorkerRegistered: report.serviceWorkerRegistered,
          indexedDbOk: report.indexedDbOk,
          cookiesEnabled: report.cookiesEnabled,
          fcmConfigOk: report.fcmConfigOk,
          errorCode: classification,
          errorMessage: result.reason.slice(0, 1000),
        },
      }).catch(() => undefined);
    }
  };

  const report =
    state.kind === "ready" ||
    state.kind === "trying-token" ||
    state.kind === "token-ok" ||
    state.kind === "token-failed"
      ? state.report
      : null;

  const copyReport = async () => {
    if (!report) return;
    const payload = {
      ...report,
      error: state.kind === "token-failed" ? state.error : null,
      errorKind: state.kind === "token-failed" ? state.classification : null,
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      toast.success("Relatório copiado — cole na conversa com o suporte.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  const fixSteps =
    state.kind === "token-failed"
      ? getFixSteps(state.classification, report)
      : report && !report.indexedDbOk
        ? getFixSteps("storage", report)
        : report?.isPreview || report?.isIframe
          ? getFixSteps("preview", report)
          : report?.isInAppBrowser
            ? getFixSteps("in-app-browser", report)
            : [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Voltar
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Diagnosticar notificações</h1>
        <p className="text-sm text-muted-foreground">
          Verifica se o seu navegador consegue receber notificações da escola e mostra exatamente
          onde está o bloqueio.
        </p>
      </div>

      {/* Ação principal */}
      {state.kind === "idle" && (
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <Bell className="mx-auto mb-3 size-8 text-primary" />
          <p className="mb-4 text-sm text-muted-foreground">
            Vamos rodar 6 verificações rápidas no seu navegador. Nenhum dado sensível é enviado.
          </p>
          <Button onClick={doProbe} size="lg" className="gap-2">
            <Play className="size-4" /> Iniciar diagnóstico
          </Button>
        </div>
      )}

      {state.kind === "probing" && (
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-6">
          <Loader2 className="size-5 animate-spin" />
          <p className="text-sm">Rodando checks…</p>
        </div>
      )}

      {/* Resultado dos probes */}
      {report && (
        <section className="mt-6 rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 text-base font-semibold">Resultado dos checks</h2>
          <div className="space-y-2">
            <CheckRow
              label="Contexto do site"
              ok={!report.isPreview && !report.isIframe}
              detail={
                report.isPreview
                  ? "Você está no preview/dev — notificações só funcionam em produção."
                  : report.isIframe
                    ? "Página aberta dentro de iframe — o navegador isola o storage."
                    : `Plataforma: ${report.platform}${report.isStandalone ? " · PWA instalado" : ""}`
              }
            />
            <CheckRow
              label="Navegador do sistema (não in-app)"
              ok={!report.isInAppBrowser}
              detail={
                report.isInAppBrowser
                  ? "Detectamos navegador dentro de Instagram/Facebook/TikTok/WhatsApp."
                  : "OK — navegador normal."
              }
            />
            <CheckRow
              label="API de Notificações"
              ok={report.notificationSupported}
              detail={`Permissão atual: ${report.notificationPermission}`}
            />
            <CheckRow
              label="Service Worker"
              ok={report.serviceWorkerSupported}
              detail={
                report.serviceWorkerRegistered
                  ? `Registrado: ${report.serviceWorkerScript ?? "(sem script)"}`
                  : "Ainda não registrado (normal antes de ativar)."
              }
            />
            <CheckRow
              label="IndexedDB (necessário para o FCM)"
              ok={report.indexedDbOk}
              detail={report.indexedDbError ?? "Escrita/leitura funcionando."}
            />
            <CheckRow
              label="Cookies habilitados"
              ok={report.cookiesEnabled}
              detail={
                report.cookiesEnabled
                  ? "OK"
                  : "Cookies desabilitados bloqueiam o FCM em muitos navegadores."
              }
            />
            <CheckRow
              label="Config do Firebase disponível"
              ok={report.fcmConfigOk}
              detail={report.fcmConfigError ?? "Servidor devolveu apiKey + vapidKey."}
            />
          </div>

          {/* Ações após probe */}
          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={doProbe} variant="outline" size="sm">
              <Play className="size-4" /> Rodar novamente
            </Button>
            {(state.kind === "ready" || state.kind === "token-failed") && (
              <Button
                onClick={tryToken}
                size="sm"
                disabled={report.isPreview || report.isIframe || report.isInAppBrowser}
              >
                <Bell className="size-4" /> Tentar obter token FCM
              </Button>
            )}
            {state.kind === "trying-token" && (
              <Button disabled size="sm">
                <Loader2 className="size-4 animate-spin" /> Solicitando permissão…
              </Button>
            )}
            <Button onClick={copyReport} variant="ghost" size="sm">
              <ClipboardCopy className="size-4" /> Copiar relatório
            </Button>
          </div>
        </section>
      )}

      {/* Sucesso */}
      {state.kind === "token-ok" && (
        <section className="mt-6 rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-5 text-emerald-500" />
            <h2 className="text-base font-semibold text-emerald-700 dark:text-emerald-400">
              Tudo certo! Notificações ativadas.
            </h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            O seu dispositivo foi registrado e vai receber comunicados, alertas e novos posts.
          </p>
        </section>
      )}

      {/* Erro classificado */}
      {state.kind === "token-failed" && (
        <section className="mt-6 rounded-2xl border border-destructive/40 bg-destructive/5 p-5">
          <div className="flex items-center gap-2">
            <XCircle className="size-5 text-destructive" />
            <h2 className="text-base font-semibold">
              Falha ao obter token — categoria:{" "}
              <Badge variant="destructive">{state.classification}</Badge>
            </h2>
          </div>
          <pre className="mt-3 overflow-x-auto rounded bg-muted/60 p-2 text-[11px] leading-snug text-foreground/80">
            {state.error}
          </pre>
        </section>
      )}

      {/* Passos de correção */}
      {fixSteps.length > 0 && (
        <section className="mt-6 rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 text-base font-semibold">Como resolver</h2>
          <div className="space-y-4">
            {fixSteps.map((f) => (
              <div key={f.title}>
                <p className="mb-1 text-sm font-semibold">{f.title}</p>
                <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                  {f.steps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
          <div className="mt-5 flex gap-2">
            <Button onClick={copyReport} variant="outline" size="sm">
              <Send className="size-4" /> Enviar relatório para o suporte
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}

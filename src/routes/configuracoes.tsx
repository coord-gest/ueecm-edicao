import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Bell,
  BellOff,
  Smartphone,
  Apple,
  Info,
  RefreshCw,
  Activity,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SiteFooter } from "@/components/SiteFooter";
import { isPushSupported, subscribeToPush, unsubscribeFromPush } from "@/lib/push";

export const Route = createFileRoute("/configuracoes")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Configurações | U.E. - Evaristo Campelo de Matos" },
      {
        name: "description",
        content:
          "Gerencie suas preferências de notificações e aparência do aplicativo da U.E. - Evaristo Campelo de Matos.",
      },
    ],
  }),
  component: ConfiguracoesPage,
});

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function DiagRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-card/50 px-3 py-2">
      <span className="text-sm text-foreground">{label}</span>
      <div className="shrink-0">{value}</div>
    </div>
  );
}

function renderPermission(p: NotificationPermission | "unsupported") {
  const map = {
    granted: { label: "concedida", variant: "default" as const },
    denied: { label: "bloqueada", variant: "destructive" as const },
    default: { label: "não solicitada", variant: "secondary" as const },
    unsupported: { label: "não suportada", variant: "destructive" as const },
  };
  const { label, variant } = map[p];
  return <Badge variant={variant}>{label}</Badge>;
}
function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window);
}

type Diag = {
  permission: NotificationPermission | "unsupported";
  hasSubscription: boolean;
  endpoint: string | null;
  swState: "none" | "installing" | "waiting" | "active" | "redundant";
  swScope: string | null;
  standalone: boolean;
  secureContext: boolean;
  serviceWorkerApi: boolean;
  pushManagerApi: boolean;
  notificationApi: boolean;
};

async function collectDiagnostics(): Promise<Diag> {
  const diag: Diag = {
    permission: "default",
    hasSubscription: false,
    endpoint: null,
    swState: "none",
    swScope: null,
    standalone: isStandalone(),
    secureContext: typeof window !== "undefined" ? window.isSecureContext : false,
    serviceWorkerApi: typeof navigator !== "undefined" && "serviceWorker" in navigator,
    pushManagerApi: typeof window !== "undefined" && "PushManager" in window,
    notificationApi: typeof window !== "undefined" && "Notification" in window,
  };
  if (!diag.notificationApi) {
    diag.permission = "unsupported";
  } else {
    diag.permission = Notification.permission;
  }
  if (diag.serviceWorkerApi) {
    // O SW do FCM registra em /firebase-cloud-messaging-push-scope, não em /.
    // Buscamos todas as registrations e preferimos a do FCM.
    const regs = await navigator.serviceWorker.getRegistrations().catch(() => []);
    const fcmReg =
      regs.find((r) => r.scope.includes("firebase-cloud-messaging-push-scope")) ?? regs[0];
    if (fcmReg) {
      diag.swScope = fcmReg.scope;
      const sw = fcmReg.active ?? fcmReg.waiting ?? fcmReg.installing;
      if (sw) diag.swState = sw.state as Diag["swState"];
      if (diag.pushManagerApi) {
        const sub = await fcmReg.pushManager.getSubscription().catch(() => null);
        diag.hasSubscription = !!sub;
        diag.endpoint = sub?.endpoint ?? null;
      }
    }
  }
  return diag;
}

function ConfiguracoesPage() {
  const [mounted, setMounted] = useState(false);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [diag, setDiag] = useState<Diag | null>(null);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const refreshDiag = async () => {
    try {
      const d = await collectDiagnostics();
      setDiag(d);
      setPermission(d.permission);
      setEnabled(d.hasSubscription);
    } catch {
      setEnabled(false);
    }
  };

  useEffect(() => {
    if (!mounted) return;
    if (!isPushSupported()) {
      setEnabled(false);
      setPermission("unsupported");
      collectDiagnostics()
        .then(setDiag)
        .catch(() => {});
      return;
    }
    void refreshDiag();
  }, [mounted]);

  const handleRetry = async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      const r = await subscribeToPush();
      if (r.ok) {
        toast.success("Inscrição realizada!", {
          description: "Este dispositivo agora está registrado para receber notificações.",
        });
      } else {
        toast.error("Falha ao inscrever", { description: r.reason, duration: 8000 });
      }
      await refreshDiag();
    } finally {
      setRetrying(false);
    }
  };

  const supported = mounted && isPushSupported();
  const iosNeedsInstall = mounted && isIOS() && !isStandalone();

  const handleToggle = async (next: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      if (next) {
        const r = await subscribeToPush();
        if (r.ok) {
          setEnabled(true);
          setPermission(Notification.permission);
          toast.success("Notificações ativadas!", {
            description: "Você receberá alertas e novas publicações mesmo com o app fechado.",
          });
        } else {
          const denied =
            r.reason.toLowerCase().includes("permissão negada") ||
            r.reason.toLowerCase().includes("permission");
          setPermission(typeof Notification !== "undefined" ? Notification.permission : "default");
          toast.error(denied ? "Permissão negada" : "Não foi possível ativar", {
            description: denied
              ? "Ative as notificações nas configurações do seu celular/navegador."
              : r.reason,
            duration: 7000,
          });
        }
      } else {
        await unsubscribeFromPush();
        setEnabled(false);
        toast.success("Notificações desativadas.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-3 px-4 sm:px-6">
          <Button asChild variant="ghost" size="sm" className="rounded-full">
            <Link to="/">
              <ArrowLeft className="size-4" />
              <span>Voltar</span>
            </Link>
          </Button>
          <h1 className="font-display text-base font-semibold text-primary sm:text-lg">
            Configurações
          </h1>
          <ThemeToggle className="rounded-full" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 pb-24 sm:px-6 sm:py-10 md:pb-10">
        <div className="mb-6">
          <h2 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
            Preferências
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Controle como você recebe avisos e como o app se comporta no seu dispositivo.
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {enabled ? <Bell className="size-5" /> : <BellOff className="size-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="text-base sm:text-lg">Notificações push</CardTitle>
                <CardDescription className="mt-1">
                  Receba alertas urgentes e novas publicações mesmo com o aplicativo fechado.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!mounted ? (
              <div className="h-14 animate-pulse rounded-lg bg-secondary/50" />
            ) : iosNeedsInstall ? (
              <Alert>
                <Apple className="size-4" />
                <AlertTitle>Instale o aplicativo primeiro</AlertTitle>
                <AlertDescription>
                  No iPhone/iPad, abra este site no Safari, toque em <strong>Compartilhar</strong> e
                  escolha <strong>"Adicionar à Tela de Início"</strong>. Depois, abra o app
                  instalado e volte aqui para ativar as notificações.
                </AlertDescription>
              </Alert>
            ) : !supported ? (
              <Alert variant="destructive">
                <Info className="size-4" />
                <AlertTitle>Não suportado</AlertTitle>
                <AlertDescription>
                  Seu navegador não suporta notificações push. Tente usar Chrome, Edge, Firefox ou
                  Safari atualizado.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="flex items-center justify-between gap-4 rounded-lg border border-border/60 bg-card/50 p-4">
                  <div className="min-w-0 flex-1">
                    <Label
                      htmlFor="push-toggle"
                      className="font-medium text-foreground cursor-pointer"
                    >
                      Receber notificações
                    </Label>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {enabled === null
                        ? "Verificando..."
                        : enabled
                          ? "Ativado neste dispositivo"
                          : "Desativado neste dispositivo"}
                    </p>
                  </div>
                  <Switch
                    id="push-toggle"
                    checked={!!enabled}
                    disabled={busy || enabled === null}
                    onCheckedChange={handleToggle}
                    aria-label="Ativar ou desativar notificações"
                  />
                </div>

                {permission === "denied" && (
                  <Alert variant="destructive">
                    <Info className="size-4" />
                    <AlertTitle>Permissão bloqueada</AlertTitle>
                    <AlertDescription>
                      Você bloqueou as notificações deste site. Para reativar, abra as configurações
                      do navegador (no Chrome: cadeado ao lado da URL → Notificações → Permitir) e
                      recarregue a página.
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}

            <div className="rounded-lg bg-secondary/40 p-3 text-xs text-muted-foreground">
              <div className="flex items-start gap-2">
                <Smartphone className="size-4 shrink-0 text-primary" />
                <p>
                  Para a melhor experiência no celular, instale o app na tela inicial. Assim você
                  recebe avisos como em um aplicativo nativo, mesmo sem o navegador aberto.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Activity className="size-5" />
                </div>
                <div>
                  <CardTitle className="text-base sm:text-lg">
                    Diagnóstico de notificações
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Estado atual da permissão e da inscrição push neste dispositivo.
                  </CardDescription>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void refreshDiag()}
                disabled={!mounted}
                className="shrink-0"
                aria-label="Atualizar diagnóstico"
              >
                <RefreshCw className="size-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {!diag ? (
              <div className="h-24 animate-pulse rounded-lg bg-secondary/50" />
            ) : (
              <>
                <DiagRow
                  label="Permissão de notificação"
                  value={renderPermission(diag.permission)}
                />
                <DiagRow
                  label="Inscrição push"
                  value={
                    <Badge variant={diag.hasSubscription ? "default" : "secondary"}>
                      {diag.hasSubscription ? "ativa" : "inexistente"}
                    </Badge>
                  }
                />
                <DiagRow
                  label="Service Worker"
                  value={
                    <Badge variant={diag.swState === "active" ? "default" : "secondary"}>
                      {diag.swState}
                    </Badge>
                  }
                />
                <DiagRow
                  label="Modo instalado (PWA)"
                  value={
                    <Badge variant={diag.standalone ? "default" : "secondary"}>
                      {diag.standalone ? "sim" : "não"}
                    </Badge>
                  }
                />
                <DiagRow
                  label="Contexto seguro (HTTPS)"
                  value={
                    <Badge variant={diag.secureContext ? "default" : "destructive"}>
                      {diag.secureContext ? "sim" : "não"}
                    </Badge>
                  }
                />
                <DiagRow
                  label="APIs disponíveis"
                  value={
                    <span className="text-xs text-muted-foreground">
                      SW {diag.serviceWorkerApi ? "✓" : "✗"} · Push{" "}
                      {diag.pushManagerApi ? "✓" : "✗"} · Notification{" "}
                      {diag.notificationApi ? "✓" : "✗"}
                    </span>
                  }
                />
                {diag.endpoint && (
                  <div className="rounded-lg bg-secondary/40 p-3">
                    <p className="text-xs font-medium text-muted-foreground">Endpoint</p>
                    <p className="mt-1 break-all font-mono text-[11px] text-foreground/80">
                      {diag.endpoint.slice(0, 80)}
                      {diag.endpoint.length > 80 ? "…" : ""}
                    </p>
                  </div>
                )}

                <Button
                  onClick={handleRetry}
                  disabled={retrying || !diag.serviceWorkerApi || !diag.pushManagerApi}
                  className="w-full"
                >
                  {retrying ? (
                    <>
                      <RefreshCw className="size-4 animate-spin" />
                      Tentando inscrever…
                    </>
                  ) : (
                    <>
                      <Bell className="size-4" />
                      {diag.hasSubscription
                        ? "Reinscrever este dispositivo"
                        : "Tentar inscrever novamente"}
                    </>
                  )}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Aparência</CardTitle>
            <CardDescription>
              Alterne entre tema claro e escuro a qualquer momento pelo botão no topo da página.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>

      <SiteFooter />
    </div>
  );
}

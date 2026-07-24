import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Download, Smartphone, Apple, Monitor, Check, Share, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ApkDownloadCard } from "@/components/ApkDownloadCard";
import { AutoPresentationMode } from "@/components/AutoPresentationMode";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export const Route = createFileRoute("/instalar")({
  head: () => ({
    meta: [
      { title: "Baixar o App · Conecta UEECM" },
      {
        name: "description",
        content:
          "Instale o app Conecta UEECM no seu celular ou computador e receba notificações da escola em tempo real.",
      },
      { property: "og:title", content: "Baixar o App · Conecta UEECM" },
      {
        property: "og:description",
        content: "Instale o app da escola e receba notificações em tempo real.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InstalarPage,
});

function detectPlatform(): "ios" | "android" | "desktop" | "unknown" {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  if (/Windows|Mac|Linux/.test(ua)) return "desktop";
  return "unknown";
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function InstalarPage() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [platform, setPlatform] = useState<"ios" | "android" | "desktop" | "unknown">("unknown");
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
    setInstalled(isStandalone());

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
      toast.success("App instalado com sucesso!");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function handleInstall() {
    if (!deferred) {
      toast.info("Use o menu do navegador", {
        description:
          "Toque nos 3 pontinhos no canto superior direito e escolha 'Instalar app' ou 'Adicionar à tela inicial'.",
        duration: 8000,
      });
      return;
    }
    try {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === "accepted") setInstalled(true);
    } catch {
      /* ignored */
    } finally {
      setDeferred(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-6">
        <Button asChild variant="ghost" size="sm">
          <Link to="/">
            <ArrowLeft className="size-4" />
            Voltar à página inicial
          </Link>
        </Button>
      </div>
      <header className="text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Download className="size-8" />
        </div>
        <h1 className="mt-4 font-display text-3xl font-bold text-primary sm:text-4xl">
          Baixe o app Conecta UEECM
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Tenha a escola sempre à mão: comunicados urgentes, eventos, notas e mensagens diretamente
          no seu celular — mesmo com o app fechado.
        </p>
      </header>

      {installed ? (
        <div className="mt-8 flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-emerald-700 dark:text-emerald-300">
          <Check className="size-5" />
          <p className="text-sm font-medium">Você já está usando o app instalado!</p>
        </div>
      ) : (
        <div className="mt-8 flex justify-center">
          <Button size="lg" onClick={handleInstall} className="gap-2">
            <Download className="size-5" />
            {deferred ? "Instalar agora" : "Como instalar"}
          </Button>
        </div>
      )}

      <div id="apk" className="scroll-mt-24">
        <ApkDownloadCard />
      </div>

      <section className="mt-10 grid gap-4 sm:grid-cols-2">
        {/* Android */}
        <article className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <Smartphone className="size-5" />
            </div>
            <h2 className="font-display text-lg font-semibold">Android (Chrome)</h2>
          </div>
          <ol className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li>
              <span className="font-semibold text-foreground">1.</span> Toque no botão{" "}
              <em>Instalar agora</em> acima.
            </li>
            <li>
              <span className="font-semibold text-foreground">2.</span> Se não aparecer, toque nos{" "}
              <strong>três pontinhos</strong> no canto superior direito do Chrome.
            </li>
            <li>
              <span className="font-semibold text-foreground">3.</span> Escolha{" "}
              <strong>“Instalar app”</strong> ou <strong>“Adicionar à tela inicial”</strong>.
            </li>
            <li>
              <span className="font-semibold text-foreground">4.</span> Abra o app pelo ícone que
              apareceu na tela inicial.
            </li>
          </ol>
        </article>

        {/* iOS */}
        <article className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400">
              <Apple className="size-5" />
            </div>
            <h2 className="font-display text-lg font-semibold">iPhone / iPad (Safari)</h2>
          </div>
          <ol className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li>
              <span className="font-semibold text-foreground">1.</span> Abra este site no{" "}
              <strong>Safari</strong> (não funciona em Chrome no iOS).
            </li>
            <li className="flex items-start gap-1.5">
              <span className="font-semibold text-foreground">2.</span>
              <span>
                Toque no botão <Share className="inline size-4 align-text-bottom" />{" "}
                <strong>Compartilhar</strong> na barra inferior.
              </span>
            </li>
            <li>
              <span className="font-semibold text-foreground">3.</span> Role e escolha{" "}
              <strong>“Adicionar à Tela de Início”</strong>.
            </li>
            <li>
              <span className="font-semibold text-foreground">4.</span> Toque em{" "}
              <strong>Adicionar</strong> — pronto! No iOS, notificações só funcionam após instalar.
            </li>
          </ol>
        </article>

        {/* Desktop */}
        <article className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <Monitor className="size-5" />
            </div>
            <h2 className="font-display text-lg font-semibold">Computador (Chrome/Edge)</h2>
          </div>
          <ol className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li>
              <span className="font-semibold text-foreground">1.</span> Na barra de endereço,
              procure o ícone <Download className="inline size-4 align-text-bottom" /> à direita.
            </li>
            <li>
              <span className="font-semibold text-foreground">2.</span> Clique nele e escolha{" "}
              <strong>“Instalar”</strong>.
            </li>
            <li>
              <span className="font-semibold text-foreground">3.</span> O app abre em janela própria
              e fica disponível no menu Iniciar.
            </li>
          </ol>
        </article>

        {/* Troubleshooting */}
        <article className="rounded-2xl border border-dashed border-border bg-muted/30 p-5">
          <h2 className="font-display text-lg font-semibold text-foreground">
            Não aparece a opção?
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              • O app <strong>já pode estar instalado</strong> — procure o ícone na tela inicial.
            </li>
            <li>
              • Use um navegador compatível: <strong>Chrome</strong>, <strong>Edge</strong>,{" "}
              <strong>Samsung Internet</strong> ou <strong>Safari</strong> (iOS).
            </li>
            <li>
              • Alguns navegadores (Firefox mobile, Opera Mini) <strong>não suportam</strong> a
              instalação PWA — troque para o Chrome.
            </li>
            <li>
              • No <strong>Android</strong>, abra o menu de 3 pontinhos e procure{" "}
              <em>“Instalar app”</em> ou <em>“Adicionar à tela inicial”</em>.
            </li>
          </ul>
        </article>
      </section>

      <section className="mt-10 rounded-2xl border border-primary/20 bg-primary/5 p-6 text-center">
        <h3 className="font-display text-lg font-semibold text-primary">Por que instalar o app?</h3>
        <div className="mt-4 grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
          <div>
            <p className="font-semibold text-foreground">🔔 Notificações</p>
            <p className="mt-1">Receba avisos urgentes na hora, mesmo com o app fechado.</p>
          </div>
          <div>
            <p className="font-semibold text-foreground">⚡ Acesso rápido</p>
            <p className="mt-1">Ícone na tela inicial, abre como um app nativo.</p>
          </div>
          <div>
            <p className="font-semibold text-foreground">🔒 Seguro</p>
            <p className="mt-1">Mesma segurança do site, sem ocupar espaço extra.</p>
          </div>
        </div>
      </section>
    <AutoPresentationMode />
      </div>
  );
}

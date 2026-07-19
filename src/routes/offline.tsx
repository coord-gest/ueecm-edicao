import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { WifiOff, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/offline")({
  head: () => ({
    meta: [
      { title: "Sem conexão · U.E. Evaristo" },
      { name: "description", content: "Você está offline. Reconecte-se para continuar." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OfflinePage,
});

function OfflinePage() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border/70 bg-card p-8 text-center shadow-sm">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <WifiOff className="size-8" />
        </div>
        <h1 className="mt-5 font-display text-2xl font-bold text-foreground">Você está offline</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Não foi possível carregar esta página. Verifique sua conexão e tente novamente. As páginas
          já visitadas continuam disponíveis no app instalado.
        </p>
        <div
          className={`mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
            online
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          <span className={`size-2 rounded-full ${online ? "bg-emerald-500" : "bg-destructive"}`} />
          {online ? "Conexão restabelecida" : "Sem conexão com a internet"}
        </div>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button onClick={() => window.location.reload()} className="rounded-lg">
            <RefreshCw className="size-4" /> Tentar novamente
          </Button>
          <Button asChild variant="outline" className="rounded-lg">
            <Link to="/">
              <Home className="size-4" /> Início
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}

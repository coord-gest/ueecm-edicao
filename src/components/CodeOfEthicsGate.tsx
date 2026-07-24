import { useEffect, useRef, useState } from "react";
import { Loader2, ShieldCheck, ScrollText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import {
  CODE_OF_ETHICS_SECTIONS,
  CODE_OF_ETHICS_VERSION,
  requiresCodeOfEthics,
} from "@/lib/code-of-ethics";
import { logger } from "@/lib/logger";

type Status = "idle" | "checking" | "needs_acceptance" | "accepted";

/**
 * Modal bloqueante que exige o aceite do Código de Ética no primeiro
 * acesso de perfis profissionais (admin, diretor, coordenador, professor,
 * secretário, social_media). O aceite é gravado em `code_of_ethics_acceptances`
 * e ocorre uma única vez por versão.
 */
export function CodeOfEthicsGate({ children }: { children: React.ReactNode }) {
  const { user, roles, loading } = useAuth();
  const [status, setStatus] = useState<Status>("idle");
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [reachedEnd, setReachedEnd] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setStatus("idle");
      return;
    }
    if (!requiresCodeOfEthics(roles)) {
      setStatus("accepted");
      return;
    }

    let cancelled = false;
    setStatus("checking");
    (async () => {
      const { data, error } = await supabase
        .from("code_of_ethics_acceptances")
        .select("id")
        .eq("user_id", user.id)
        .eq("version", CODE_OF_ETHICS_VERSION)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        logger.error("[CodeOfEthicsGate] erro ao verificar aceite:", error);
        // Falha "segura": em caso de erro, não bloqueia — evita travar o painel
        // por indisponibilidade do banco. Auditoria segue via tentativa futura.
        setStatus("accepted");
        return;
      }
      setStatus(data ? "accepted" : "needs_acceptance");
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, user, roles]);

  const handleAccept = async () => {
    if (!user) return;
    setSubmitting(true);
    const ua = typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null;
    const { error } = await supabase.from("code_of_ethics_acceptances").insert({
      user_id: user.id,
      version: CODE_OF_ETHICS_VERSION,
      user_agent: ua,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Não foi possível registrar seu aceite", { description: error.message });
      return;
    }
    toast.success("Código de Ética aceito. Bem-vindo(a)!");
    setStatus("accepted");
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) {
      setReachedEnd(true);
    }
  };

  if (status !== "needs_acceptance" && status !== "checking") {
    return <>{children}</>;
  }

  return (
    <>
      {children}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ethics-title"
        className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
      >
        <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden border border-border bg-card shadow-2xl">
          <header className="flex items-start gap-3 border-b border-border bg-muted/40 px-6 py-5">
            <div className="flex size-10 shrink-0 items-center justify-center bg-primary text-primary-foreground">
              <ShieldCheck className="size-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <h2 id="ethics-title" className="text-lg font-semibold text-foreground">
                Código de Ética — Aceite obrigatório
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Para acessar o painel, leia com atenção e confirme o aceite. Este passo é
                exibido apenas no primeiro acesso.
              </p>
            </div>
          </header>

          {status === "checking" ? (
            <div className="flex flex-1 items-center justify-center px-6 py-16 text-sm text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" /> Verificando aceite…
            </div>
          ) : (
            <>
              <ScrollArea className="flex-1">
                <div
                  ref={scrollRef}
                  onScroll={handleScroll}
                  className="max-h-[52vh] overflow-y-auto px-6 py-5 text-sm leading-relaxed text-foreground"
                >
                  <div className="mb-4 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                    <ScrollText className="size-3.5" aria-hidden />
                    Versão {CODE_OF_ETHICS_VERSION} · U.E. Evaristo Campelo de Matos
                  </div>
                  {CODE_OF_ETHICS_SECTIONS.map((section) => (
                    <section key={section.title} className="mb-5">
                      <h3 className="mb-2 text-sm font-semibold text-foreground">
                        {section.title}
                      </h3>
                      {section.paragraphs.map((p, i) => (
                        <p key={i} className="mb-2 text-sm text-muted-foreground">
                          {p}
                        </p>
                      ))}
                    </section>
                  ))}
                  <p className="mt-6 text-xs text-muted-foreground">
                    Role até o fim do documento para habilitar o aceite.
                  </p>
                </div>
              </ScrollArea>

              <footer className="border-t border-border bg-muted/30 px-6 py-4">
                <label className="flex items-start gap-3 text-sm text-foreground">
                  <Checkbox
                    id="ethics-accept"
                    checked={checked}
                    disabled={!reachedEnd}
                    onCheckedChange={(v) => setChecked(v === true)}
                    className="mt-0.5"
                  />
                  <span>
                    Li integralmente o Código de Ética e concordo em cumprir seus termos.
                    {!reachedEnd && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        (role o texto até o fim para habilitar)
                      </span>
                    )}
                  </span>
                </label>
                <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button
                    variant="outline"
                    onClick={() => void supabase.auth.signOut()}
                    disabled={submitting}
                  >
                    Sair sem aceitar
                  </Button>
                  <Button onClick={handleAccept} disabled={!checked || submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" /> Registrando…
                      </>
                    ) : (
                      "Li e aceito o Código de Ética"
                    )}
                  </Button>
                </div>
              </footer>
            </>
          )}
        </div>
      </div>
    </>
  );
}
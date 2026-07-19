import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { verifyCaptchaToken } from "@/lib/turnstile.functions";

import { useAuth } from "@/lib/use-auth";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "Entrar — Painel Administrativo | U.E. - Evaristo Campelo de Matos" }],
  }),
  component: Login,
});

function Login() {
  const { user, loading, signIn } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) {
      navigate({ to: "/painel", replace: true });
    }
  }, [user, loading, navigate]);

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    if (!captchaToken) {
      toast.error("Complete a verificação anti-bot antes de continuar.");
      return;
    }
    setSubmitting(true);
    try {
      await verifyCaptchaToken({ data: { token: captchaToken, action: "login" } });
    } catch (err) {
      setSubmitting(false);
      setCaptchaToken(null);
      toast.error(err instanceof Error ? err.message : "Falha na verificação anti-bot.");
      return;
    }
    const { error } = await signIn(email.trim(), senha);
    setSubmitting(false);
    setCaptchaToken(null);
    if (error) {
      toast.error("Não foi possível entrar", { description: error });
    } else {
      toast.success("Bem-vindo de volta!");
    }
  };

  return (
    <div className="relative flex min-h-dvh w-full bg-background">
      <ThemeToggle className="absolute right-4 top-4 z-50 rounded-full border border-border/60 bg-background/70 backdrop-blur-md shadow-sm hover:bg-background" />
      {/* Left: Visual / Branding */}
      <aside className="relative hidden overflow-hidden lg:flex lg:w-1/2 xl:w-[55%]">
        {/* Base dark gradient built from semantic tokens (OKLCH-safe) */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(135deg, oklch(0.20 0.05 260) 0%, oklch(0.24 0.07 260) 55%, color-mix(in oklab, var(--primary) 65%, oklch(0.18 0.05 260)) 100%)",
          }}
        />

        {/* Ambient blooms */}
        <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-primary/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-accent/35 blur-3xl" />

        {/* Dot texture */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, var(--background) 1px, transparent 0)",
            backgroundSize: "22px 22px",
          }}
        />

        {/* Bottom scrim */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

        <div className="relative z-10 flex h-full w-full flex-col justify-between p-12 text-white xl:p-16">
          {/* Top: brand row */}
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-xl border border-white/25 bg-white/10 backdrop-blur-md">
              <img src={logo} alt="Brasão da escola" className="size-8 rounded-md" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/85">
              Gestão Escolar
            </span>
          </div>

          {/* Middle: headline */}
          <div className="max-w-xl">
            <div className="mb-6 h-1.5 w-12 rounded-full bg-primary" />
            <h1 className="font-display text-4xl font-bold leading-tight text-white drop-shadow-sm xl:text-5xl">
              Educação que{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage: "linear-gradient(90deg, var(--primary) 0%, var(--accent) 100%)",
                }}
              >
                transforma
              </span>{" "}
              vidas.
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-white/85 xl:text-lg">
              U.E. Evaristo Campelo de Matos — comprometida com a excelência acadêmica e o
              acolhimento da nossa comunidade escolar.
            </p>
          </div>

          {/* Bottom: footer */}
          <div className="flex items-center justify-between text-xs text-white/70">
            <span>© {new Date().getFullYear()} Portal Administrativo</span>
            <span className="font-medium uppercase tracking-[0.18em]">Escola Pública</span>
          </div>
        </div>
      </aside>

      {/* Right: Form */}
      <main className="flex w-full items-center justify-center px-6 py-10 sm:px-10 lg:w-1/2 lg:px-16 xl:w-[45%]">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile brand mark */}
          <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
            <div className="mb-6 flex size-16 items-center justify-center rounded-2xl bg-foreground shadow-xl lg:hidden">
              <img src={logo} alt="Brasão da escola" className="size-10 rounded-lg" />
            </div>
            <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">
              Bem-vindo ao Painel
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Acesse sua conta administrativa para gerenciar a escola.
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleSignIn}>
            <div className="space-y-2">
              <Label htmlFor="email" className="ml-1 text-sm font-medium text-foreground">
                E-mail institucional
              </Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nome@escola.gov.br"
                  className="h-12 rounded-2xl border-border bg-background pl-11 text-sm shadow-sm transition-all focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="senha" className="ml-1 text-sm font-medium text-foreground">
                  Senha de acesso
                </Label>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="senha"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="••••••••"
                  className="h-12 rounded-2xl border-border bg-background pl-11 pr-12 text-sm shadow-sm transition-all focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                />
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  tabIndex={-1}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <TurnstileWidget
              action="login"
              onToken={setCaptchaToken}
              onExpire={() => setCaptchaToken(null)}
              onError={() => setCaptchaToken(null)}
            />

            <Button
              type="submit"
              disabled={submitting || !captchaToken}
              className="group h-13 w-full rounded-2xl py-4 text-base font-semibold shadow-lg shadow-primary/25 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/30 active:translate-y-0"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                <>
                  Entrar no Sistema
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </Button>
          </form>

          <div className="space-y-4 border-t border-border pt-6 text-center">
            <p className="text-xs text-muted-foreground">
              O cadastro de novos usuários é feito apenas pelo Desenvolvedor.
            </p>
            <Link
              to="/"
              className="group inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-1" />
              Voltar ao blog da escola
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

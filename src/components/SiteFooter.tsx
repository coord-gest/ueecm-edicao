import { Link, useRouterState } from "@tanstack/react-router";
import { Linkedin, Github, Instagram, Globe, MessageCircle, Facebook } from "lucide-react";
import { useEffect, useState } from "react";
import logo from "@/assets/logo.png";

/** true em qualquer viewport < 1024px (mobile + tablet + PWA/APP/Capacitor). */
function useIsMobileOrTablet() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);
  return isMobile;
}

const socialLinks = [
  {
    href: "https://www.linkedin.com/in/francisco-douglas-sousa",
    label: "LinkedIn",
    Icon: Linkedin,
  },
  { href: "https://github.com/Francisco-Douglas-dev", label: "GitHub", Icon: Github },
  { href: "https://www.instagram.com/franciscodouglas77", label: "Instagram", Icon: Instagram },
  { href: "https://portfolio-franciscodouglas.vercel.app/", label: "Portfólio", Icon: Globe },
  { href: "https://wa.me/5586981625526", label: "WhatsApp", Icon: MessageCircle },
];

function MobileSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group border-t border-primary-foreground/15 py-3 lg:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold uppercase tracking-wide text-gold">
        {title}
        <span className="text-primary-foreground/60 transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

export function SiteFooter() {
  const isMobile = useIsMobileOrTablet();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [navOpen, setNavOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  // Ao trocar de rota (ou entrar em modo mobile/tablet) recolhe automaticamente.
  useEffect(() => {
    setNavOpen(false);
    setContactOpen(false);
  }, [pathname, isMobile]);

  return (
    <footer className="w-full border-t border-border/60 bg-primary text-primary-foreground">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:grid lg:grid-cols-3 lg:gap-8 lg:py-12">
        <div className="pb-4 lg:pb-0">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Logo" className="h-10 w-10" width={512} height={512} />
            <p className="font-display text-lg font-semibold">U.E. - Evaristo Campelo de Matos</p>
          </div>
          <p className="mt-3 max-w-xs text-sm text-primary-foreground/70">
            Educação que inspira. Acompanhe as novidades, eventos e conquistas da nossa comunidade
            escolar.
          </p>
          <p className="mt-4 text-xs uppercase tracking-wider text-primary-foreground/60">
            CNPJ: 04.051.494/0001-94
          </p>
          <div className="mt-3 flex items-center gap-3">
            <a
              href="https://facebook.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook"
              className="grid size-9 place-items-center rounded-full bg-primary-foreground/10 transition-colors hover:bg-gold hover:text-gold-foreground"
            >
              <Facebook className="size-4" />
            </a>
            <a
              href="https://www.instagram.com/evaristo_campelo_de_matos?igsh=emMxZTltZ2V0c2s="
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="grid size-9 place-items-center rounded-full bg-primary-foreground/10 transition-colors hover:bg-gold hover:text-gold-foreground"
            >
              <Instagram className="size-4" />
            </a>
            <a
              href="https://wa.me/5586981305051"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp"
              className="grid size-9 place-items-center rounded-full bg-primary-foreground/10 transition-colors hover:bg-gold hover:text-gold-foreground"
            >
              <MessageCircle className="size-4" />
            </a>
          </div>
        </div>

        <details
          className="group border-t border-primary-foreground/15 py-3 lg:border-0 lg:py-0 lg:[&>summary]:hidden"
          open={isMobile ? navOpen : true}
          onToggle={(e) => isMobile && setNavOpen((e.currentTarget as HTMLDetailsElement).open)}
        >
          <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold uppercase tracking-wide text-gold lg:hidden">
            Navegação
            <span className="text-primary-foreground/60 transition-transform group-open:rotate-180">
              ▾
            </span>
          </summary>
          <nav
            aria-label="Links institucionais e legais"
            data-testid="footer-nav"
            className="mt-3 lg:mt-0"
          >
            <h4 className="hidden text-sm font-semibold uppercase tracking-wide text-gold lg:block">
              Navegação
            </h4>
            <ul className="mt-3 space-y-2 text-sm text-primary-foreground/80 [&_a]:rounded [&_a]:outline-none [&_a]:focus-visible:ring-2 [&_a]:focus-visible:ring-gold [&_a]:focus-visible:ring-offset-2 [&_a]:focus-visible:ring-offset-primary">
              <li>
                <Link to="/" className="hover:text-gold">
                  Início
                </Link>
              </li>
              <li>
                <Link to="/sobre" className="hover:text-gold">
                  Sobre a Escola
                </Link>
              </li>
              <li>
                <Link to="/posts" className="hover:text-gold">
                  Publicações
                </Link>
              </li>
              <li>
                <Link to="/calendario" className="hover:text-gold">
                  Calendário Escolar
                </Link>
              </li>
              <li>
                <Link to="/horarios" className="hover:text-gold">
                  Grade de Horários
                </Link>
              </li>
              <li>
                <Link to="/enquetes" className="hover:text-gold">
                  Enquetes
                </Link>
              </li>
              <li>
                <Link to="/galeria" className="hover:text-gold">
                  Galeria de Eventos
                </Link>
              </li>
              <li>
                <Link to="/instalar" className="hover:text-gold">
                  Baixar o App
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-gold">
                  Painel Administrativo
                </Link>
              </li>

              <li>
                <Link to="/privacidade" className="hover:text-gold">
                  Privacidade e Proteção de Dados
                </Link>
              </li>
              <li>
                <Link to="/solicitar-dados" className="hover:text-gold">
                  Solicitar meus dados (LGPD)
                </Link>
              </li>
              <li>
                <Link to="/uso-de-imagem" className="hover:text-gold">
                  Uso de Imagem de Alunos
                </Link>
              </li>
              <li>
                <Link to="/termos-de-uso" className="hover:text-gold">
                  Termos de Uso
                </Link>
              </li>
            </ul>
          </nav>
        </details>
        <details
          className="group border-t border-primary-foreground/15 py-3 lg:border-0 lg:py-0 lg:[&>summary]:hidden"
          open={isMobile ? contactOpen : true}
          onToggle={(e) => isMobile && setContactOpen((e.currentTarget as HTMLDetailsElement).open)}
        >
          <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold uppercase tracking-wide text-gold lg:hidden">
            Contato
            <span className="text-primary-foreground/60 transition-transform group-open:rotate-180">
              ▾
            </span>
          </summary>
          <div className="mt-3 lg:mt-0">
            <h4 className="hidden text-sm font-semibold uppercase tracking-wide text-gold lg:block">
              Contato
            </h4>
            <ul className="mt-3 space-y-3 text-sm text-primary-foreground/80">
              <li>Rua Av. Sebastião Alves dos Reis, 127, Assunção do Piauí - PI, 64333-000</li>
              <li>
                <p className="font-semibold text-primary-foreground">Direção</p>
                <a href="mailto:ueecmevaristo2018@gmail.com" className="block hover:text-gold">
                  ueecmevaristo2018@gmail.com
                </a>
                <div className="mt-1 space-y-0.5">
                  <div>
                    <span className="text-primary-foreground/60">Diretor Val de Sousa: </span>
                    <a href="tel:+5586981305051" className="hover:text-gold">
                      (86) 98130-5051
                    </a>
                  </div>
                  <div>
                    <span className="text-primary-foreground/60">Diretora Hellen: </span>
                    <a href="tel:+5586988371613" className="hover:text-gold">
                      (86) 98837-1613
                    </a>
                  </div>
                </div>
              </li>
              <li>
                <p className="font-semibold text-primary-foreground">Coordenação</p>
                <a href="mailto:coordenacao.ueecm@outlook.com" className="block hover:text-gold">
                  coordenacao.ueecm@outlook.com
                </a>
                <div className="mt-1 space-y-0.5">
                  <div>
                    <span className="text-primary-foreground/60">
                      Anos Iniciais — Gonçala Alves:{" "}
                    </span>
                    <a href="tel:+5586981148393" className="hover:text-gold">
                      (86) 98114-8393
                    </a>
                  </div>
                  <div>
                    <span className="text-primary-foreground/60">
                      Anos Finais — Francisco Douglas:{" "}
                    </span>
                    <a href="tel:+5586988175046" className="hover:text-gold">
                      (86) 98817-5046
                    </a>
                  </div>
                </div>
              </li>
            </ul>
            <div className="mt-4 grid grid-cols-2 gap-1.5">
              <a
                href="https://wa.me/5586981305051"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 rounded-md bg-green-700 px-2 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-800"
              >
                <MessageCircle className="h-3 w-3 shrink-0" />
                Diretor Val
              </a>
              <a
                href="https://wa.me/5586988371613"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 rounded-md bg-green-700 px-2 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-800"
              >
                <MessageCircle className="h-3 w-3 shrink-0" />
                Diretora Hellen
              </a>
              <a
                href="https://wa.me/5586981148393"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 rounded-md bg-green-600 px-2 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-700"
              >
                <MessageCircle className="h-3 w-3 shrink-0" />
                Coord. Iniciais
              </a>
              <a
                href="https://wa.me/5586988175046"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 rounded-md bg-green-600 px-2 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-700"
              >
                <MessageCircle className="h-3 w-3 shrink-0" />
                Coord. Finais
              </a>
            </div>
          </div>
        </details>
      </div>
      <div className="border-t border-primary-foreground/15">
        <div className="mx-auto max-w-6xl px-4 py-4 text-xs text-primary-foreground/80 sm:px-6">
          <p className="text-center md:text-left">
            <span className="font-semibold uppercase tracking-wide text-gold">
              Encarregado de Dados (DPO) — LGPD Art. 41:
            </span>{" "}
            Francisco Douglas ·{" "}
            <a
              href="mailto:franciscodouglas.dev@outlook.com?subject=LGPD%20-%20Encarregado%20(DPO)"
              className="underline hover:text-gold"
            >
              franciscodouglas.dev@outlook.com
            </a>{" "}
            ·{" "}
            <Link to="/privacidade" className="underline hover:text-gold">
              Política de Privacidade
            </Link>{" "}
            ·{" "}
            <Link to="/solicitar-dados" className="underline hover:text-gold">
              Solicitar meus dados
            </Link>
          </p>
        </div>
      </div>
      <div className="border-t border-primary-foreground/15">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-5 text-xs text-primary-foreground/70 sm:px-6 md:flex-row md:justify-between">
          <p className="text-center md:text-left">
            © {new Date().getFullYear()} U.E. - Evaristo Campelo de Matos. Todos os direitos
            reservados. ·{" "}
            <Link to="/privacidade" rel="privacy-policy" className="underline hover:text-gold">
              Privacidade e Proteção de Dados
            </Link>{" "}
            ·{" "}
            <Link to="/termos-de-uso" className="underline hover:text-gold">
              Termos de Uso
            </Link>
          </p>
          <div className="flex flex-col items-center gap-2 md:flex-row md:gap-4">
            <span className="text-primary-foreground/80">Desenvolvido por Francisco Douglas</span>
            <div className="flex items-center gap-3">
              {socialLinks.map(({ href, label, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="transition-transform duration-200 hover:scale-110 hover:text-gold"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

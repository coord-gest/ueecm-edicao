import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const Route = createFileRoute("/seguranca/incidentes")({
  head: () => ({
    meta: [
      { title: "Resposta a Incidentes de Segurança (LGPD Art. 48) — UEECM" },
      {
        name: "description",
        content:
          "Como a U.E. Evaristo Campelo de Matos detecta, contém, comunica e responde a incidentes de segurança envolvendo dados pessoais, conforme Art. 48 da LGPD.",
      },
      { property: "og:title", content: "Resposta a Incidentes de Segurança (LGPD)" },
      {
        property: "og:description",
        content:
          "Plano público de resposta a incidentes, canal de comunicação e fluxo de notificação à ANPD e aos titulares.",
      },
      { property: "og:type", content: "article" },
    ],
    links: [{ rel: "canonical", href: "https://conectaueecm.com/seguranca/incidentes" }],
  }),
  component: IncidentPage,
});

function IncidentPage() {
  const lastUpdate = "23 de julho de 2026";
  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <article className="prose prose-slate dark:prose-invert max-w-none">
          <h1>Plano de Resposta a Incidentes de Segurança</h1>
          <p className="text-sm text-muted-foreground">Última atualização: {lastUpdate}</p>
          <p>
            Este plano descreve, em linguagem acessível, como a{" "}
            <strong>U.E. Evaristo Campelo de Matos</strong> se organiza para detectar, conter,
            comunicar e responder a incidentes de segurança envolvendo dados pessoais, em
            conformidade com o <strong>Art. 48 da LGPD (Lei nº 13.709/2018)</strong> e com as
            orientações da <strong>Autoridade Nacional de Proteção de Dados (ANPD)</strong>.
          </p>

          <div className="not-prose my-6 rounded-lg border-2 border-destructive/40 bg-destructive/5 p-5">
            <h2 className="text-base font-semibold text-foreground">
              Canal exclusivo para reporte de incidentes
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Se você identificou uma possível exposição, vazamento, acesso indevido ou uso
              impróprio de dados pessoais tratados por este portal, comunique-nos imediatamente:
            </p>
            <ul className="mt-3 space-y-1 text-sm">
              <li>
                <strong>E-mail do DPO:</strong>{" "}
                <a
                  className="text-primary hover:underline"
                  href="mailto:franciscodouglas.dev@outlook.com?subject=LGPD%20-%20Incidente%20de%20Seguran%C3%A7a"
                >
                  franciscodouglas.dev@outlook.com
                </a>{" "}
                (assunto: <em>“LGPD — Incidente de Segurança”</em>)
              </li>
              <li>
                <strong>Assunto sugerido:</strong> descrição breve, data/hora e sistema/URL
                afetados
              </li>
              <li>
                <strong>Prazo interno de triagem:</strong> até 24 horas úteis
              </li>
            </ul>
          </div>

          <h2>1. Ciclo de resposta</h2>
          <ol>
            <li>
              <strong>Detecção</strong> — monitoramento contínuo de logs, alertas do banco de
              dados, avisos de scanners de dependências e denúncias externas.
            </li>
            <li>
              <strong>Triagem e classificação</strong> — o DPO avalia severidade, dados
              envolvidos e número estimado de titulares afetados (P0/P1/P2).
            </li>
            <li>
              <strong>Contenção</strong> — revogação de credenciais comprometidas, isolamento de
              serviços, ajuste de políticas RLS e desativação de rotas afetadas.
            </li>
            <li>
              <strong>Erradicação</strong> — correção da causa raiz (código, configuração,
              controle de acesso) e verificação de integridade dos backups.
            </li>
            <li>
              <strong>Recuperação</strong> — restauração dos serviços a partir de fontes seguras
              e validação end-to-end.
            </li>
            <li>
              <strong>Notificação</strong> — comunicação à ANPD e aos titulares em prazo
              razoável, conforme item 3.
            </li>
            <li>
              <strong>Lições aprendidas</strong> — post-mortem, atualização deste plano e do
              runbook técnico.
            </li>
          </ol>

          <h2>2. Papéis e responsabilidades</h2>
          <ul>
            <li>
              <strong>Encarregado (DPO)</strong> — Francisco Douglas: coordena resposta, decide
              comunicações e é o ponto de contato com a ANPD.
            </li>
            <li>
              <strong>Direção da Escola</strong> — aprova comunicações externas e mobiliza
              recursos.
            </li>
            <li>
              <strong>Coordenação técnica</strong> — executa a contenção, correção e
              recuperação.
            </li>
            <li>
              <strong>Operadores (Supabase, Cloudflare)</strong> — acionados quando o incidente
              envolve a camada de infraestrutura contratada.
            </li>
          </ul>

          <h2>3. Notificação à ANPD e aos titulares (Art. 48)</h2>
          <p>
            Nos incidentes que possam acarretar <strong>risco ou dano relevante</strong> aos
            titulares, adotamos, em prazo razoável (referência interna: <strong>até 72 horas</strong>{" "}
            a partir da confirmação do incidente):
          </p>
          <ul>
            <li>
              Comunicação à ANPD pelos canais oficiais, contendo: natureza dos dados afetados,
              titulares envolvidos, medidas técnicas de proteção, riscos, medidas adotadas para
              reverter/mitigar efeitos e motivos de eventual atraso.
            </li>
            <li>
              Comunicação individualizada aos titulares afetados, por e-mail e/ou aviso no
              portal, com orientações de proteção (troca de senha, atenção a golpes, etc.).
            </li>
          </ul>

          <h2>4. Registro e auditoria</h2>
          <p>
            Todo incidente é registrado internamente com data/hora, escopo, ações tomadas e
            responsáveis. O runbook técnico completo (uso interno) está publicado em{" "}
            <code>docs/incident-response.md</code> e é revisado semestralmente.
          </p>

          <h2>5. Prevenção contínua</h2>
          <ul>
            <li>Autenticação com verificação anti-bot (Cloudflare Turnstile) no login.</li>
            <li>Row-Level Security (RLS) em todas as tabelas com dados pessoais.</li>
            <li>Column-Level Security em dados sensíveis de profissionais.</li>
            <li>Cabeçalhos de segurança (CSP, HSTS, X-Frame-Options, Referrer-Policy).</li>
            <li>Backups automáticos assinados (HMAC) e testes periódicos de restauração.</li>
            <li>Rate-limiting em endpoints públicos e chat com IA.</li>
            <li>Logs de auditoria (audit_logs, admin_access_logs, alert_audit_logs).</li>
          </ul>

          <p className="mt-8">
            <Link to="/privacidade" className="text-primary hover:underline">
              ← Voltar para a Política de Privacidade
            </Link>
          </p>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
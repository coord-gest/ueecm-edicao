import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { clearConsent } from "@/lib/cookie-consent";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      {
        title: "Política de Privacidade (LGPD) — UEECM",
      },
      {
        name: "description",
        content:
          "Política de Privacidade da U.E. Evaristo Campelo de Matos em conformidade com a Lei Geral de Proteção de Dados (LGPD).",
      },
      { property: "og:title", content: "Política de Privacidade (LGPD)" },
      {
        property: "og:description",
        content: "Saiba como tratamos seus dados pessoais conforme a LGPD (Lei nº 13.709/2018).",
      },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "https://conectaueecm.com/privacidade" },
    ],
    links: [{ rel: "canonical", href: "https://conectaueecm.com/privacidade" }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  const lastUpdate = "11 de julho de 2026";
  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <article className="prose prose-slate dark:prose-invert max-w-none">
          <h1>Política de Privacidade</h1>
          <p className="text-sm text-muted-foreground">Última atualização: {lastUpdate}</p>
          <p>
            Esta Política descreve como a <strong>U.E. Evaristo Campelo de Matos</strong> (“Escola”)
            coleta, utiliza, armazena e protege os dados pessoais tratados em seu site, em
            conformidade com a{" "}
            <strong>Lei nº 13.709/2018 — Lei Geral de Proteção de Dados (LGPD)</strong>.
          </p>

          <h2>1. Controlador dos dados</h2>
          <p>
            U.E. Evaristo Campelo de Matos — Rua Av. Sebastião Alves dos Reis, 127, Assunção do
            Piauí - PI, 64333-000.
          </p>

          <div className="not-prose my-6 rounded-lg border border-primary/30 bg-primary/5 p-5">
            <h3 className="text-base font-semibold text-foreground">
              Encarregado pelo Tratamento de Dados (DPO) — Art. 41 da LGPD
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              O Encarregado é o ponto de contato entre a Escola, os titulares de dados e a
              Autoridade Nacional de Proteção de Dados (ANPD). Para dúvidas sobre esta Política,
              solicitações de titulares (art. 18) ou incidentes de segurança envolvendo dados
              pessoais, utilize o canal abaixo:
            </p>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-4">
              <dt className="font-medium text-foreground">Encarregado (DPO)</dt>
              <dd>Francisco Douglas</dd>
              <dt className="font-medium text-foreground">E-mail do DPO</dt>
              <dd>
                <a
                  href="mailto:franciscodouglas.dev@outlook.com?subject=LGPD%20-%20Encarregado%20(DPO)"
                  className="text-primary hover:underline"
                >
                  franciscodouglas.dev@outlook.com
                </a>
              </dd>
              <dt className="font-medium text-foreground">Endereço postal</dt>
              <dd>Rua Av. Sebastião Alves dos Reis, 127 — Assunção do Piauí/PI, CEP 64333-000</dd>
              <dt className="font-medium text-foreground">Prazo de resposta</dt>
              <dd>Até 15 dias corridos após o recebimento da solicitação.</dd>
            </dl>
          </div>

          <h2>2. Dados que coletamos</h2>
          <ul>
            <li>
              <strong>Cadastro administrativo</strong>: nome, e-mail e função, fornecidos somente
              pela equipe escolar autorizada para acesso ao painel.
            </li>
            <li>
              <strong>Notificações push</strong>: endpoint do navegador e chaves criptográficas para
              o envio de avisos. Não identificam você pessoalmente.
            </li>
            <li>
              <strong>Dados técnicos</strong>: registros mínimos de acesso (logs) para segurança e
              auditoria.
            </li>
          </ul>

          <h2>3. Finalidades e base legal</h2>
          <p>
            A tabela abaixo detalha, para cada operação de tratamento realizada pelo portal, a
            finalidade específica e a hipótese legal aplicável do <strong>Art. 7º</strong> (ou{" "}
            <strong>Art. 11</strong>, para dados sensíveis) da LGPD:
          </p>
          <div className="not-prose my-4 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left">
                  <th className="p-2 font-semibold">Operação</th>
                  <th className="p-2 font-semibold">Finalidade</th>
                  <th className="p-2 font-semibold">Base legal (LGPD)</th>
                </tr>
              </thead>
              <tbody className="[&_td]:border-b [&_td]:border-border [&_td]:p-2 [&_td]:align-top">
                <tr>
                  <td>Cadastro e login no painel</td>
                  <td>Autenticar servidores, professores e responsáveis autorizados</td>
                  <td>Art. 7º, V — execução de contrato / obrigação legal</td>
                </tr>
                <tr>
                  <td>Publicações, calendário e comunicados</td>
                  <td>Divulgar informações institucionais e educacionais</td>
                  <td>Art. 7º, IX — interesse legítimo</td>
                </tr>
                <tr>
                  <td>Agendamentos e atendimentos</td>
                  <td>Organizar atendimentos escolares presenciais</td>
                  <td>Art. 7º, V — execução de procedimento preliminar / contrato</td>
                </tr>
                <tr>
                  <td>Consentimento parental (menores de 18)</td>
                  <td>Autorização do responsável legal para uso do serviço por menor</td>
                  <td>Art. 14, §1º — consentimento específico e em destaque do responsável</td>
                </tr>
                <tr>
                  <td>Notificações push</td>
                  <td>Enviar avisos sobre novos conteúdos e comunicados</td>
                  <td>Art. 7º, I — consentimento (opt-in, revogável)</td>
                </tr>
                <tr>
                  <td>Cookies de análise de uso</td>
                  <td>Métricas agregadas de páginas visitadas</td>
                  <td>Art. 7º, I — consentimento (opt-in via banner)</td>
                </tr>
                <tr>
                  <td>Logs técnicos e auditoria</td>
                  <td>Segurança, prevenção a fraude e rastreabilidade</td>
                  <td>Art. 7º, IX — interesse legítimo / Art. 7º, II — obrigação legal</td>
                </tr>
                <tr>
                  <td>Uso de imagem de alunos</td>
                  <td>Divulgação institucional de atividades escolares</td>
                  <td>Art. 7º, I e Art. 14 — consentimento específico do responsável</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-sm text-muted-foreground">
            A revogação do consentimento, quando esta é a base legal, é livre e gratuita e pode ser
            exercida pelo canal do titular abaixo. Operações fundadas em outras hipóteses (execução
            de contrato, obrigação legal, interesse legítimo) permanecem válidas até o encerramento
            da finalidade ou do vínculo com a Escola.
          </p>

          <h2>4. Compartilhamento</h2>
          <p>
            Não vendemos dados. Utilizamos prestadores de infraestrutura (hospedagem e banco de
            dados) que atuam como operadores, sob obrigações contratuais de segurança e
            confidencialidade.
          </p>

          <h2>5. Retenção</h2>
          <p>
            Mantemos os dados pelo tempo necessário às finalidades acima ou conforme obrigação
            legal. Inscrições de notificação são removidas ao desativar os avisos ou ao desinstalar
            o aplicativo.
          </p>

          <h2>6. Seus direitos (art. 18 da LGPD)</h2>
          <p>Como titular de dados, você pode a qualquer momento solicitar:</p>
          <ul>
            <li>Confirmação da existência de tratamento;</li>
            <li>Acesso aos dados;</li>
            <li>Correção de dados incompletos, inexatos ou desatualizados;</li>
            <li>Anonimização, bloqueio ou eliminação de dados desnecessários ou excessivos;</li>
            <li>Portabilidade a outro fornecedor;</li>
            <li>Eliminação dos dados tratados com base no consentimento;</li>
            <li>Informação sobre entidades públicas e privadas com quem houve compartilhamento;</li>
            <li>Revogação do consentimento;</li>
            <li>Revisão de decisões automatizadas que afetem seus interesses, quando aplicável.</li>
          </ul>

          <div className="not-prose my-6 rounded-lg border-2 border-primary/40 bg-primary/5 p-5">
            <h3 className="text-base font-semibold text-foreground">
              Canal automatizado — formulário oficial
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Use o formulário abaixo para registrar sua solicitação com protocolo. É a forma mais
              rápida — você recebe um número de acompanhamento e a equipe é notificada
              imediatamente.
            </p>
            <a
              href="/solicitar-dados"
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90"
            >
              Abrir formulário de solicitação →
            </a>
          </div>

          <div className="not-prose my-6 rounded-lg border border-border bg-muted/40 p-5">
            <h3 className="text-base font-semibold text-foreground">Alternativa por e-mail</h3>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              <li>
                Envie e-mail para{" "}
                <a
                  href="mailto:franciscodouglas.dev@outlook.com?subject=LGPD%20-%20Solicita%C3%A7%C3%A3o%20de%20Titular%20(art.%2018)"
                  className="text-primary hover:underline"
                >
                  franciscodouglas.dev@outlook.com
                </a>{" "}
                com o assunto <em>“LGPD — Solicitação de Titular”</em>.
              </li>
              <li>
                Informe seu nome completo, vínculo com a Escola (aluno, responsável, servidor) e
                qual direito deseja exercer.
              </li>
              <li>
                Para proteger sua identidade, poderemos solicitar confirmação por outro meio
                (telefone cadastrado ou comparecimento).
              </li>
              <li>Responderemos em até 15 dias corridos, sem custo para o titular.</li>
            </ol>
          </div>

          <h2>7. Segurança</h2>
          <p>
            Adotamos controles técnicos e organizacionais como criptografia em trânsito (HTTPS),
            cabeçalhos de segurança (CSP, HSTS, X-Frame-Options), autenticação, controle de acesso
            por papéis, políticas de linha (RLS) no banco de dados e registros de auditoria.
          </p>
          <p>
            Em caso de incidente envolvendo dados pessoais, seguimos o{" "}
            <Link to="/seguranca/incidentes" className="text-primary hover:underline">
              Plano de Resposta a Incidentes (Art. 48 da LGPD)
            </Link>
            , com comunicação à ANPD e aos titulares em prazo razoável.
          </p>

          <h2>8. Cookies e tecnologias similares</h2>
          <p>
            Utilizamos cookies e armazenamento local do navegador organizados em três categorias. Ao
            acessar o site pela primeira vez, você vê um banner para escolher quais categorias
            autoriza. Suas preferências podem ser alteradas a qualquer momento pelo botão logo
            abaixo.
          </p>
          <section
            aria-labelledby="cookie-preferences-heading"
            data-testid="cookie-preferences-section"
            className="not-prose my-4 rounded-lg border border-border bg-muted/40 p-4"
          >
            <h3 id="cookie-preferences-heading" className="text-sm font-semibold text-foreground">
              Preferências de cookies
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Clique para reabrir o banner e revisar suas escolhas de cookies e armazenamento local.
            </p>
            <Button
              type="button"
              variant="secondary"
              className="mt-3 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              onClick={clearConsent}
              aria-label="Reabrir banner para gerenciar preferências de cookies"
            >
              Gerenciar preferências de cookies
            </Button>
          </section>
          <ul>
            <li>
              <strong>Essenciais</strong> (sempre ativos): sessão de login, preferências de tema,
              tokens de segurança. Base legal: execução de contrato e interesse legítimo.
            </li>
            <li>
              <strong>Análise de uso</strong> (opt-in): métricas agregadas de páginas visitadas para
              melhorar a experiência. Base legal: consentimento (art. 7º, I).
            </li>
            <li>
              <strong>Marketing</strong> (opt-in): reservado para futuras campanhas institucionais.
              Nenhum cookie desta categoria está ativo atualmente.
            </li>
          </ul>

          <h2>9. Dados de crianças e adolescentes (art. 14 da LGPD)</h2>
          <p>
            Por se tratar de uma escola, é altamente provável o tratamento de dados de menores de
            idade. Nesses casos, o tratamento ocorre com base no{" "}
            <strong>melhor interesse do menor</strong> e, quando exigido, mediante{" "}
            <strong>consentimento específico e em destaque do responsável legal</strong>. Não
            coletamos dados de menores para fins comerciais nem os compartilhamos além do necessário
            à finalidade educacional.
          </p>
          <p>
            No formulário de{" "}
            <Link to="/agendar" className="text-primary hover:underline">
              agendamento
            </Link>
            , quando o solicitante declara idade inferior a 18 anos, é exigido preenchimento
            obrigatório dos dados do responsável legal (nome, CPF e e-mail) e o aceite expresso do
            termo de consentimento parental. Registramos, para fins de auditoria, data/hora,
            endereço IP, user-agent e a versão do termo aceito — em conformidade com o Art. 14 e o
            Art. 37 da LGPD.
          </p>
          <p>
            As diretrizes específicas sobre captura, publicação e revogação de imagens de estudantes
            estão detalhadas em página dedicada:{" "}
            <Link to="/uso-de-imagem" className="text-primary hover:underline">
              Uso de Imagem de Alunos e Menores de Idade
            </Link>
            .
          </p>

          <h2>10. Alterações</h2>
          <p>
            Esta Política pode ser atualizada. A data da última revisão constará no topo do
            documento.
          </p>

          <p className="mt-8">
            <Link to="/" className="text-primary hover:underline">
              ← Voltar para o início
            </Link>
          </p>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}

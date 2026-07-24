import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { AutoPresentationMode } from "@/components/AutoPresentationMode";

export const Route = createFileRoute("/termos-de-uso")({
  head: () => ({
    meta: [
      {
        title: "Termos de Uso — U.E. Evaristo Campelo de Matos",
      },
      {
        name: "description",
        content:
          "Termos de Uso do site da U.E. Evaristo Campelo de Matos. Leia as condições de acesso, conteúdo e responsabilidade.",
      },
      { property: "og:title", content: "Termos de Uso" },
      {
        property: "og:description",
        content: "Condições de uso do site da U.E. Evaristo Campelo de Matos.",
      },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "https://conectaueecm.com/termos-de-uso" },
    ],
    links: [{ rel: "canonical", href: "https://conectaueecm.com/termos-de-uso" }],
  }),
  component: TermsPage,
});

function TermsPage() {
  const lastUpdate = "8 de julho de 2026";
  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <article className="prose prose-slate dark:prose-invert max-w-none">
          <h1>Termos de Uso</h1>
          <p className="text-sm text-muted-foreground">Última atualização: {lastUpdate}</p>
          <p>
            Estes Termos de Uso regulam o acesso e a utilização do site da{" "}
            <strong>U.E. Evaristo Campelo de Matos</strong> (“Escola”, “nós”). Ao acessar ou usar
            este site, você concorda com as condições aqui estabelecidas, em conformidade com a{" "}
            <strong>Lei nº 12.965/2014 (Marco Civil da Internet)</strong> e a{" "}
            <strong>Lei nº 13.709/2018 (LGPD)</strong>.
          </p>

          <h2>1. Aceitação dos termos</h2>
          <p>
            O uso do site é livre e voluntário, sujeito à observância destes Termos. Caso não
            concorde com qualquer disposição, recomendamos que não utilize os serviços
            disponibilizados.
          </p>

          <h2>2. Objetivo do site</h2>
          <p>O site tem finalidade exclusivamente informativa e institucional, destinada a:</p>
          <ul>
            <li>Divulgar publicações, notícias e eventos escolares;</li>
            <li>Disponibilizar o calendário escolar e a grade de horários;</li>
            <li>Apresentar a equipe pedagógica e os profissionais da escola;</li>
            <li>
              Permitir que a equipe administrativa gerencie conteúdos por meio do painel restrito.
            </li>
          </ul>

          <h2>3. Acesso e contas</h2>
          <ul>
            <li>
              O acesso ao <strong>painel administrativo</strong> é restrito a usuários previamente
              autorizados pela coordenação escolar.
            </li>
            <li>O usuário é responsável pela confidencialidade de suas credenciais de acesso.</li>
            <li>
              A Escola se reserva o direito de suspender ou cancelar contas em caso de uso indevido
              ou violação destes Termos.
            </li>
          </ul>

          <h2>4. Propriedade intelectual e direitos autorais</h2>
          <p>
            Esta seção reúne as regras de propriedade intelectual aplicáveis ao site, em
            conformidade com a <strong>Lei nº 9.610/1998 (Direitos Autorais)</strong>, a{" "}
            <strong>Lei nº 9.279/1996 (Propriedade Industrial)</strong> e o{" "}
            <strong>Marco Civil da Internet (Lei nº 12.965/2014)</strong>.
          </p>

          <h3>4.1. Titularidade do conteúdo</h3>
          <p>
            Todo o conteúdo disponibilizado neste site — textos, imagens, fotografias, ilustrações,
            logotipos, marcas, ícones, vídeos, áudios, layouts, códigos-fonte e demais materiais — é
            de titularidade da U.E. Evaristo Campelo de Matos ou de terceiros que autorizaram sua
            utilização institucional.
          </p>

          <h3>4.2. Desenvolvimento e tecnologia</h3>
          <p>
            A arquitetura de software, o código-fonte do sistema e a concepção visual (logo e ícone)
            do assistente virtual da instituição foram integralmente desenvolvidos por{" "}
            <strong>Francisco Douglas</strong>, detentor dos direitos morais de autor, estando o uso
            patrimonial cedido e licenciado para a U.E. Evaristo Campelo de Matos. Contato do
            desenvolvedor:{" "}
            <a href="mailto:franciscodouglas77@gmail.com" className="text-primary hover:underline">
              franciscodouglas77@gmail.com
            </a>{" "}
            /{" "}
            <a href="https://wa.me/5586988175046" className="text-primary hover:underline">
              (86) 98817-5046
            </a>
            .
          </p>

          <h3>4.3. Uso permitido</h3>
          <ul>
            <li>
              Visualização e leitura on-line para fins pessoais, educacionais ou informativos, sem
              finalidade lucrativa;
            </li>
            <li>
              Compartilhamento dos links diretos das publicações em redes sociais e aplicativos de
              mensagens;
            </li>
            <li>
              Citação de trechos, desde que acompanhados de indicação clara da fonte, nos termos do
              art. 46, III, da Lei nº 9.610/1998.
            </li>
          </ul>

          <h3>4.4. Uso vedado</h3>
          <ul>
            <li>
              Reprodução total ou parcial dos conteúdos para fins comerciais, publicitários ou de
              obtenção de vantagem econômica;
            </li>
            <li>
              Modificação, adaptação, tradução ou criação de obras derivadas sem autorização prévia
              e por escrito;
            </li>
            <li>
              Remoção, ocultação ou alteração de créditos, marcas d'água e informações de autoria;
            </li>
            <li>
              Utilização de imagens de alunos, servidores ou terceiros fora do contexto pedagógico e
              institucional autorizado (ver{" "}
              <Link to="/uso-de-imagem" className="text-primary hover:underline">
                Uso de Imagem de Alunos
              </Link>
              );
            </li>
            <li>
              Uso de mecanismos automatizados (scraping, mineração de dados) para coleta massiva de
              conteúdo sem autorização.
            </li>
          </ul>

          <h3>4.5. Marcas e identidade visual</h3>
          <p>
            O nome, o logotipo e a identidade visual da U.E. Evaristo Campelo de Matos, bem como o
            nome, logotipo, ícone e interface do assistente virtual oficial, são protegidos e não
            podem ser utilizados para sugerir vínculo, patrocínio ou endosso institucional sem
            autorização expressa da direção escolar.
          </p>

          <h3>4.6. Solicitação de autorização e notificação de violação</h3>
          <p>
            Pedidos de autorização para reprodução, adaptação ou uso didático em outras instituições
            e notificações de suposta violação de direitos autorais (<em>notice and takedown</em>,
            art. 19 do Marco Civil da Internet) devem ser encaminhados para{" "}
            <a href="mailto:coordenacao.ueecm@outlook.com">coordenacao.ueecm@outlook.com</a>,
            informando identificação do notificante, URL do conteúdo, descrição da suposta violação
            e fundamento legal.
          </p>

          <h2>5. Conduta do usuário</h2>
          <p>Ao utilizar o site, o usuário se compromete a não:</p>
          <ul>
            <li>
              Inserir conteúdo ofensivo, discriminatório, ilegal ou que viole direitos de terceiros;
            </li>
            <li>
              Tentar acessar áreas restritas sem autorização ou realizar atividades que comprometam
              a segurança do sistema;
            </li>
            <li>
              Utilizar mecanismos automatizados (robôs, crawlers) de forma abusiva ou não
              autorizada.
            </li>
          </ul>

          <h2>6. Limitação de responsabilidade</h2>
          <p>
            A Escola se esforça para manter o site disponível e as informações atualizadas, mas não
            garante:
          </p>
          <ul>
            <li>Acesso ininterrupto ou livre de erros técnicos;</li>
            <li>
              Precisão absoluta de todo o conteúdo, especialmente quando dependente de terceiros;
            </li>
            <li>Compatibilidade com todos os dispositivos, navegadores ou conexões de internet.</li>
          </ul>
          <p>
            Eventuais links para sites externos são disponibilizados para conveniência do usuário,
            sem que a Escola se responsabilize pelo conteúdo ou práticas de privacidade desses
            sites.
          </p>

          <h2>7. Privacidade e proteção de dados</h2>
          <p>
            O tratamento de dados pessoais realizado por meio deste site obedece à nossa{" "}
            <Link to="/privacidade" className="text-primary hover:underline">
              Política de Privacidade
            </Link>
            , em conformidade com a LGPD. Ao navegar ou utilizar funcionalidades que exijam
            fornecimento de dados, você declara estar ciente e de acordo com as práticas descritas
            nesse documento.
          </p>

          <h2>8. Notificações push</h2>
          <p>
            O usuário pode optar por receber notificações push no navegador. Essa funcionalidade é
            voluntária, pode ser desativada a qualquer momento nas configurações do dispositivo ou
            navegador, e não identifica o usuário pessoalmente.
          </p>

          <h2>9. Modificações dos termos</h2>
          <p>
            A Escola pode atualizar estes Termos de Uso a qualquer momento. Alterações relevantes
            serão publicadas nesta página com a data da última revisão. O uso continuado do site
            após as modificações constitui aceitação dos novos termos.
          </p>

          <h2>10. Legislação aplicável e foro</h2>
          <p>
            Estes Termos são regidos pelas leis da República Federativa do Brasil. Para dirimir
            quaisquer controvérsias, fica eleito o foro da comarca de Assunção do Piauí — PI, com
            renúncia a qualquer outro, por mais privilegiado que seja.
          </p>

          <h2>11. Contato</h2>
          <p>
            Em caso de dúvidas sobre estes Termos de Uso, entre em contato pelo e-mail:{" "}
            <a href="mailto:coordenacao.ueecm@outlook.com">coordenacao.ueecm@outlook.com</a>.
          </p>

          <p className="mt-8">
            <Link to="/" className="text-primary hover:underline">
              ← Voltar para o início
            </Link>
          </p>
        </article>
      </main>
      <AutoPresentationMode />
      <SiteFooter />
    </div>
  );
}

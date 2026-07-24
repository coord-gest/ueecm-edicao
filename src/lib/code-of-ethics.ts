import type { AppRole } from "@/lib/roles";

/**
 * Versão atual do Código de Ética. Quando o texto for atualizado de forma
 * material, incremente este número — usuários que aceitaram a versão
 * anterior receberão novamente o banner para aceitar a nova versão.
 */
export const CODE_OF_ETHICS_VERSION = 1;

/**
 * Papéis (profissionais internos) que precisam aceitar o Código de Ética
 * antes de usar o painel. Responsáveis/leitores não são bloqueados.
 */
export const CODE_OF_ETHICS_REQUIRED_ROLES: AppRole[] = [
  "admin",
  "diretor",
  "coordenador",
  "professor",
  "secretario",
  "social_media",
];

export function requiresCodeOfEthics(roles: AppRole[]): boolean {
  return roles.some((r) => CODE_OF_ETHICS_REQUIRED_ROLES.includes(r));
}

/**
 * Texto placeholder do Código de Ética.
 *
 * ⚠️ O texto oficial será fornecido pela Direção/Coordenação. Assim que
 * receber o documento final, substitua o conteúdo de `CODE_OF_ETHICS_SECTIONS`
 * abaixo mantendo a mesma estrutura (título + parágrafos). Se o conteúdo
 * mudar de forma significativa, incremente `CODE_OF_ETHICS_VERSION` para
 * que todos os usuários aceitem novamente.
 */
export interface EthicsSection {
  title: string;
  paragraphs: string[];
}

export const CODE_OF_ETHICS_SECTIONS: EthicsSection[] = [
  {
    title: "1. Propósito",
    paragraphs: [
      "Este Código de Ética estabelece os princípios e compromissos que orientam a atuação de todos os profissionais da U.E. Evaristo Campelo de Matos e o uso do Sistema Conecta UEECM.",
      "Ao aceitar este documento, você declara conhecer e concordar com as regras aqui descritas.",
    ],
  },
  {
    title: "2. Respeito à comunidade escolar",
    paragraphs: [
      "Trate alunos, famílias, colegas e visitantes com respeito, cordialidade e sem qualquer tipo de discriminação.",
      "Não é permitido qualquer conteúdo, comentário ou conduta de teor ofensivo, preconceituoso, sexista, racista ou que promova violência.",
    ],
  },
  {
    title: "3. Sigilo e proteção de dados (LGPD)",
    paragraphs: [
      "As informações de alunos, responsáveis e profissionais acessadas pelo sistema são confidenciais e devem ser usadas exclusivamente para finalidades pedagógicas e administrativas.",
      "É proibido compartilhar, exportar, imprimir ou publicar dados pessoais fora dos canais oficiais da escola.",
      "Não compartilhe seu login, senha ou dispositivo autenticado com outras pessoas.",
    ],
  },
  {
    title: "4. Uso responsável do sistema",
    paragraphs: [
      "Utilize o Conecta UEECM apenas para atividades relacionadas à sua função na escola.",
      "Não tente burlar controles de acesso, RLS, permissões ou registros de auditoria.",
      "Ao publicar comunicados, mural, alertas ou apresentações, revise o conteúdo — você é responsável pelo que envia.",
    ],
  },
  {
    title: "5. Uso de imagem",
    paragraphs: [
      "Fotos e vídeos de alunos só podem ser publicados nos canais da escola se houver autorização de uso de imagem registrada.",
      "Em caso de dúvida, consulte a Coordenação antes de publicar.",
    ],
  },
  {
    title: "6. Comunicação institucional",
    paragraphs: [
      "As comunicações com famílias devem ocorrer pelos canais oficiais: Conecta UEECM, WhatsApp institucional e comunicados formais.",
      "Mantenha uma linguagem profissional, clara e acolhedora.",
    ],
  },
  {
    title: "7. Denúncias e descumprimento",
    paragraphs: [
      "Situações que violem este Código devem ser comunicadas à Direção ou ao Encarregado de Dados (DPO) da escola.",
      "O descumprimento pode acarretar medidas disciplinares e, quando aplicável, medidas legais previstas na legislação vigente.",
    ],
  },
  {
    title: "8. Aceite",
    paragraphs: [
      "Ao clicar em \"Li e aceito o Código de Ética\", você confirma que leu, compreendeu e concorda em cumprir integralmente os termos acima. O aceite é registrado com data, hora e identificação do usuário para fins de auditoria.",
    ],
  },
];
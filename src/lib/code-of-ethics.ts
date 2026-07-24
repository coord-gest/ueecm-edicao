import type { AppRole } from "@/lib/roles";

/**
 * Versão atual do Código de Ética. Quando o texto for atualizado de forma
 * material, incremente este número — usuários que aceitaram a versão
 * anterior receberão novamente o banner para aceitar a nova versão.
 */
export const CODE_OF_ETHICS_VERSION = 2;

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
    title: "U. E. Evaristo Campelo de Matos — Assunção do Piauí/PI",
    paragraphs: [
      "CÓDIGO DE ÉTICA para uso do Sistema/Site/Aplicativo conectaueecm.com (\"Portal Escolar\") — Versão 2 (Revisada).",
      "Documento interno da unidade escolar, elaborado com base no Termo de Cooperação Técnica e Cessão Gratuita de Uso de Sistema firmado entre a U.E. Evaristo Campelo de Matos e o extensionista responsável pelo sistema. Assunção do Piauí — 2026.",
    ],
  },
  {
    title: "Advertência importante sobre a natureza do sistema",
    paragraphs: [
      "O Sistema/Site/Aplicativo conectaueecm.com (\"Portal Escolar\") NÃO é um sistema oficial, contratado, desenvolvido, mantido ou custeado pela Secretaria Municipal de Educação de Assunção do Piauí, tampouco por qualquer outro órgão da Administração Pública Municipal.",
      "Trata-se de ferramenta desenvolvida de forma voluntária e gratuita por um extensionista universitário, no âmbito de Projeto de Extensão de sua instituição de ensino superior, e cedida gratuitamente à U.E. Evaristo Campelo de Matos por meio de Termo de Cooperação Técnica e Cessão Gratuita de Uso de Sistema, sem qualquer vínculo, chancela, financiamento ou responsabilidade da Secretaria Municipal de Educação.",
      "O domínio conectaueecm.com está registrado em nome do desenvolvedor (CEDENTE), que arca pessoalmente com o custeio de sua manutenção, não havendo qualquer despesa, ônus orçamentário ou compromisso financeiro assumido pelo Poder Público Municipal em razão do uso deste sistema.",
      "Este Código de Ética é, portanto, um documento interno da unidade escolar, destinado a orientar a conduta de seus funcionários no uso dessa ferramenta cedida gratuitamente, e não deve ser interpretado como norma, portaria ou ato da Secretaria Municipal de Educação, nem como reconhecimento de que o sistema integra a rede oficial de tecnologia da Administração Pública.",
    ],
  },
  {
    title: "Apresentação",
    paragraphs: [
      "Este Código de Ética estabelece os princípios, direitos, deveres e condutas que devem orientar o uso do conectaueecm.com por todos os funcionários da U. E. Evaristo Campelo de Matos — incluindo membros do Núcleo Gestor, corpo docente, corpo técnico-pedagógico, secretaria, auxiliares administrativos e núcleo de apoio (serviços gerais, merenda e segurança patrimonial).",
      "O documento foi elaborado com base no Termo de Cooperação Técnica e Cessão Gratuita de Uso de Sistema firmado entre a escola (CESSIONÁRIA) e o extensionista responsável pelo desenvolvimento do sistema (CEDENTE), sendo complementar ao Regimento Escolar Unificado do Sistema Municipal de Educação de Assunção do Piauí (2026), ao Estatuto dos Servidores Municipais (Lei nº 024/2005) e à Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018).",
      "O uso do conectaueecm.com é uma extensão do ambiente escolar. Assim, os mesmos valores de respeito, urbanidade, zelo pelo patrimônio, sigilo profissional e responsabilidade que regem a convivência presencial aplicam-se integralmente ao ambiente digital, ainda que o sistema não seja de titularidade da escola nem da Secretaria Municipal de Educação.",
    ],
  },
  {
    title: "Título I — Disposições Gerais e Natureza do Sistema",
    paragraphs: [
      "Art. 1º O sistema é disponibilizado à U.E. Evaristo Campelo de Matos exclusivamente por força do Termo de Cooperação Técnica e Cessão Gratuita de Uso de Sistema firmado com o extensionista universitário responsável por seu desenvolvimento, sem qualquer participação, contratação, financiamento, gestão ou responsabilidade da Secretaria Municipal de Educação ou de outro órgão público municipal.",
      "Art. 2º A propriedade intelectual, o código-fonte, a arquitetura e o domínio do sistema pertencem ao CEDENTE/desenvolvedor, que concede à escola apenas licença de uso gratuita, não exclusiva e intransferível, para fins institucionais e pedagógicos (Cláusula Sexta do Termo).",
      "Art. 3º Nenhuma disposição deste Código ou do uso cotidiano do sistema gera, para a Secretaria Municipal de Educação ou para o Município, qualquer obrigação, despesa, ônus orçamentário, vínculo contratual ou responsabilidade civil, técnica ou administrativa (Cláusula Décima Terceira do Termo). Havendo dúvida de terceiros, os funcionários devem esclarecer que se trata de ferramenta cedida gratuitamente por projeto de extensão universitária, e não de sistema oficial da rede municipal.",
      "Art. 4º Este Código orienta, padroniza e disciplina o uso do sistema pelos funcionários, promovendo ambiente digital seguro, ético e respeitoso, alinhado à missão educacional da escola.",
      "Art. 5º Aplica-se a todos os funcionários com acesso ao sistema, independentemente de cargo, função ou vínculo: Núcleo Gestor; coordenação, supervisão, orientação, assistência social e psicologia escolar; professores; secretaria e auxiliares administrativos; auxiliares de serviços gerais, merendeiras e vigias, quando utilizarem o sistema; estagiários, prestadores de serviço e colaboradores eventuais autorizados.",
      "Art. 6º O acesso é ferramenta de trabalho de uso pessoal, intransferível e vinculado à função, vedada a utilização para finalidades alheias às atividades pedagógicas e administrativas. O uso não gera direito adquirido — o acesso pode ser suspenso, restrito ou revogado a qualquer tempo pela Direção.",
    ],
  },
  {
    title: "Título II — Princípios Éticos Fundamentais",
    paragraphs: [
      "Art. 7º O uso do sistema deve observar permanentemente os seguintes princípios:",
      "• Legalidade — atuar em conformidade com a legislação vigente, o Regimento Escolar e o Termo de Cooperação Técnica;",
      "• Respeito e urbanidade — tratar colegas, alunos, pais/responsáveis e demais usuários com cordialidade, sem discriminação de raça, cor, sexo, religião, condição social ou qualquer outra natureza;",
      "• Sigilo e confidencialidade — proteger dados pessoais e acadêmicos de alunos, servidores e famílias, inclusive credenciais e informações técnicas do sistema;",
      "• Veracidade — inserir apenas informações verdadeiras, precisas e atualizadas, sem rasuras, omissões ou adulterações;",
      "• Responsabilidade — zelar pelas próprias credenciais e responder por toda ação realizada sob seu login;",
      "• Impessoalidade — não utilizar o sistema para fins político-partidários, religiosos, comerciais ou de interesse particular;",
      "• Transparência — comunicar-se de forma clara e profissional, informando terceiros sobre a natureza não oficial/não governamental do sistema;",
      "• Zelo — cuidar da integridade das informações, reconhecendo que o sistema é bem cedido gratuitamente por terceiro (CEDENTE).",
    ],
  },
  {
    title: "Título III — Diretrizes de Uso — Acesso e Segurança",
    paragraphs: [
      "Art. 8º Cada funcionário recebe login e senha individuais, sendo vedado o compartilhamento, empréstimo ou cessão dessas credenciais a terceiros, ainda que colegas de trabalho.",
      "Art. 9º São deveres quanto à segurança do acesso: manter a senha em sigilo e alterá-la periodicamente ou em caso de suspeita; encerrar a sessão (logout) ao término do uso, especialmente em dispositivos compartilhados; comunicar imediatamente à Direção qualquer acesso não autorizado, perda de dispositivo ou suspeita de violação de dados, para que a escola (Controladora) adote providências junto ao desenvolvedor (Operador); não instalar softwares não autorizados que comprometam a segurança do sistema.",
      "Art. 10º É vedado tentar acessar, sem autorização, áreas, registros ou funcionalidades que não sejam pertinentes às atribuições do cargo, respeitando os papéis de acesso (leitor, professor, secretário, coordenador, diretor).",
    ],
  },
  {
    title: "Título III — Uso de Dados e Sigilo Profissional (LGPD)",
    paragraphs: [
      "Art. 11º Para os fins da LGPD (Lei nº 13.709/2018), a escola atua como Controladora dos dados tratados no sistema, cabendo-lhe definir finalidades e meios; o desenvolvedor (CEDENTE) atua exclusivamente como Operador, processando os dados conforme instruções da escola.",
      "Art. 12º Todos os dados de alunos, famílias e servidores — notas, frequência, comunicados, contatos e demais registros — são sigilosos e devem ser tratados com o máximo cuidado.",
      "Art. 13º É dever de todo funcionário: utilizar os dados exclusivamente para finalidades pedagógicas e administrativas; não copiar, imprimir, fotografar (print) ou exportar dados para fora do ambiente institucional, salvo autorização expressa da Direção; não divulgar por redes sociais, mensageiros ou e-mail pessoal informações, notas ou boletins obtidos pelo sistema; manter absoluto sigilo sobre situações de vulnerabilidade social, saúde ou necessidades educacionais especiais; encaminhar à Direção — e não ao desenvolvedor — solicitações de titulares de dados relativas a direitos previstos na LGPD.",
      "Art. 14º O descumprimento do sigilo sujeita o funcionário às sanções deste Código, do Regimento Escolar e da legislação aplicável, sem prejuízo de responsabilização civil e penal.",
    ],
  },
  {
    title: "Título III — Comunicação e Conduta Digital",
    paragraphs: [
      "Art. 15º A comunicação por meio do sistema — com colegas, alunos, pais ou responsáveis — deve ser sempre respeitosa, profissional e pautada pela linguagem própria do ambiente escolar.",
      "Art. 16º É vedado, em qualquer funcionalidade: usar linguagem ofensiva, discriminatória, agressiva ou de duplo sentido; emitir opiniões político-partidárias, religiosas ou que gerem constrangimento; fazer críticas públicas a colegas, alunos, famílias, à gestão ou ao desenvolvedor por meio de mensagens, comunicados ou campos do sistema; utilizar canais institucionais para fins particulares, comerciais ou de divulgação de terceiros; atribuir ao sistema, em comunicados, caráter de \"sistema da Secretaria de Educação\" ou qualquer denominação que sugira vínculo institucional inexistente com o Poder Público.",
    ],
  },
  {
    title: "Título III — Publicações de Conteúdo e Imagem",
    paragraphs: [
      "Art. 17º A publicação de fotos, vídeos, textos ou quaisquer conteúdos envolvendo alunos no blog público ou em notificações do sistema somente poderá ocorrer mediante consentimento específico e em destaque dos pais ou responsáveis legais, nos termos do art. 14, §1º, da LGPD (Anexo II do Termo).",
      "Art. 18º Todo conteúdo publicado deve ter finalidade pedagógica, informativa ou institucional; preservar dignidade, imagem e integridade de alunos e servidores; ser revisado quanto à veracidade, observando o fluxo editorial (rascunho → revisão → aprovação → publicado); respeitar direitos autorais e de imagem de terceiros.",
      "Art. 19º É vedada a publicação de conteúdos que exponham situações disciplinares, notas individuais, dados de saúde ou qualquer informação sensível de alunos em áreas de acesso público ou coletivo.",
    ],
  },
  {
    title: "Título III — Condutas Vedadas",
    paragraphs: [
      "Art. 20º Além das vedações já mencionadas, é proibido: inserir, alterar ou excluir notas, frequência ou registros escolares sem amparo real e sem autorização, com o propósito de beneficiar ou prejudicar aluno; utilizar o sistema para constranger, intimidar ou assediar colegas, alunos ou responsáveis; criar perfis falsos, usar identidade de terceiros ou permitir que terceiros usem sua identidade; acessar o sistema em condição incompatível com o exercício da função (art. 41 do Regimento); explorar falhas técnicas para obter vantagem indevida ou acesso não autorizado; utilizar o sistema para doutrinação político-partidária ou manifestação contrária aos princípios éticos e cívicos da educação; ceder, sublicenciar, comercializar, copiar ou disponibilizar o sistema, seu código-fonte ou credenciais a terceiros estranhos à escola (Cláusula Sexta, item 6.3, do Termo).",
    ],
  },
  {
    title: "Título IV — Deveres Éticos por Segmento Funcional",
    paragraphs: [
      "Núcleo Gestor (Direção e Coordenação): designar formalmente o(a) servidor(a) responsável pela interlocução com o CEDENTE e pela administração dos papéis de acesso (Cláusula Quinta, \"a\", do Termo); zelar pelo correto uso do sistema por toda a equipe, orientando quanto às boas práticas e à natureza não oficial do sistema perante terceiros; centralizar e formalizar, junto ao CEDENTE, comunicações sobre incidentes de segurança, solicitações de titulares ou continuidade/transição do sistema (Cláusula Décima Primeira).",
      "Corpo Docente: lançar no sistema, com pontualidade e sem rasuras, conteúdos ministrados, frequência e notas; utilizar canais de comunicação com pais e responsáveis de forma clara, respeitosa e profissional; preservar o sigilo de avaliações e desempenho individual perante terceiros não autorizados.",
      "Secretaria Escolar e Auxiliares Administrativos: garantir segurança, sigilo e organização dos registros digitais; manter cópias de segurança próprias e independentes das informações institucionais críticas (Cláusula Décima, item 10.3); assegurar a fidedignidade das informações lançadas em matrícula, comunicados e cadastro escolar; não tratar o sistema como repositório exclusivo de documentos essenciais, mantendo arquivo físico/paralelo previsto no Regimento.",
      "Núcleo de Apoio (Serviços Gerais, Merenda e Segurança Patrimonial): quando autorizados, fazer uso responsável e restrito às finalidades autorizadas; comunicar à Direção qualquer dificuldade, dúvida ou uso indevido identificado.",
    ],
  },
  {
    title: "Título V — Relação com o Desenvolvedor (CEDENTE) do Sistema",
    paragraphs: [
      "Art. 21º O sistema é mantido, tecnicamente, por pessoa física vinculada a projeto de extensão universitária (CEDENTE), em regime voluntário e gratuito, sem vínculo empregatício, estatutário ou contratual com a escola ou com a Secretaria (Cláusula Décima Terceira do Termo).",
      "Art. 22º O sistema é fornecido \"no estado em que se encontra\" (as is), sem garantia de disponibilidade contínua ou ausência de falhas; nenhum funcionário deve tratá-lo como infraestrutura crítica única, devendo a escola manter rotinas próprias de guarda de documentos essenciais (Cláusula Décima).",
      "Art. 23º É vedado a qualquer funcionário, sem autorização da Direção, contatar diretamente o CEDENTE para solicitar alterações, novas funcionalidades ou tratamento de dados fora do fluxo institucional — tais demandas devem ser centralizadas pelo gestor interno designado.",
      "Art. 24º Nenhum funcionário está autorizado a prometer, negociar ou formalizar, em nome da escola, contratação remunerada, vínculo funcional ou compromisso financeiro com o CEDENTE — competência exclusiva da Direção, observados os trâmites da Administração Pública.",
      "Art. 25º Em caso de descontinuação do sistema, expiração do domínio ou encerramento da cessão, seguir as orientações da Direção quanto à migração de dados e adoção de solução alternativa, sem prejuízo do direito da escola de obter cópia de segurança dos dados institucionais (Cláusula Décima Primeira).",
    ],
  },
  {
    title: "Título VI — Infrações e Penalidades",
    paragraphs: [
      "Art. 26º O descumprimento sujeita o funcionário, conforme a gravidade, às seguintes medidas, sem prejuízo de outras sanções do Regimento, do Estatuto dos Servidores Municipais e da legislação vigente: orientação e advertência verbal; advertência por escrito nos assentamentos funcionais; suspensão temporária do acesso ao sistema; instauração de sindicância ou processo administrativo disciplinar em casos graves; comunicação às autoridades competentes em casos de violação de dados, crime cibernético ou dano a terceiros.",
      "Art. 27º A apuração é de responsabilidade exclusiva da Direção da unidade escolar, observado o contraditório e a ampla defesa, não competindo à Secretaria, ao CEDENTE ou a terceiros conduzi-la, salvo quando formalmente acionados pela escola.",
      "Art. 28º As infrações serão classificadas em leves, médias e graves, seguindo, por analogia, os critérios do art. 96, §6º, do Regimento Escolar, considerando gravidade, reincidência e efeitos causados a terceiros.",
    ],
  },
  {
    title: "Título VII — Disposições Finais e Aceite",
    paragraphs: [
      "Art. 29º Todo funcionário, ao receber suas credenciais de acesso, declara ciência e concordância com este Código de Ética e com a natureza gratuita, voluntária e não governamental do sistema, comprometendo-se a observá-lo integralmente.",
      "Art. 30º Este Código poderá ser revisado sempre que necessário, mediante aprovação da Direção — inclusive por alterações supervenientes do Termo de Cooperação Técnica —, sendo os funcionários comunicados formalmente.",
      "Art. 31º Os casos omissos serão resolvidos pela Direção da U. E. Evaristo Campelo de Matos, no âmbito de sua autonomia administrativa, sem que isso implique responsabilidade da Secretaria Municipal de Educação sobre o sistema.",
      "Ao clicar em \"Li e aceito o Código de Ética\", você confirma que leu, compreendeu e concorda em cumprir integralmente os termos acima. O aceite é registrado com data, hora e identificação do usuário para fins de auditoria.",
    ],
  },
];
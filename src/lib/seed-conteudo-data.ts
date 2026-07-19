/**
 * Dados fictícios de conteúdo (comunicados, enquetes, autorizações,
 * alertas, agendamentos, mensagens, depoimentos, lembretes, destaques,
 * comentários de posts). Marcados com `[Seed]` para wipe isolado.
 */

export type SeedComunicado = {
  titulo: string;
  mensagem: string;
  tipo: "informativo" | "urgente" | "evento" | "geral";
  agendarEmHoras: number | null;
};

export const SEED_COMUNICADOS: SeedComunicado[] = [
  {
    titulo: "Reunião de pais — 3º bimestre",
    mensagem: "Convidamos os responsáveis para a reunião no auditório às 19h. Presença essencial.",
    tipo: "informativo",
    agendarEmHoras: null,
  },
  {
    titulo: "URGENTE: alteração no horário de saída de sexta",
    mensagem: "Saída antecipada às 11h30 devido à manutenção elétrica. Chegue com antecedência.",
    tipo: "urgente",
    agendarEmHoras: null,
  },
  {
    titulo: "Feira de Ciências — inscrições abertas",
    mensagem: "Inscrições de projetos até dia 20. Consulte a coordenação pedagógica para detalhes.",
    tipo: "evento",
    agendarEmHoras: null,
  },
  {
    titulo: "Cronograma da recuperação bimestral",
    mensagem: "Provas de recuperação começam segunda-feira. Confira o calendário completo no mural.",
    tipo: "informativo",
    agendarEmHoras: null,
  },
  {
    titulo: "Suspensão de aula por assembleia pedagógica",
    mensagem: "Não haverá aula na quinta pela manhã. Turno da tarde funciona normalmente.",
    tipo: "urgente",
    agendarEmHoras: null,
  },
  {
    titulo: "Palestra sobre cyberbullying",
    mensagem: "Convidamos famílias e alunos para o encontro sobre segurança digital neste sábado.",
    tipo: "evento",
    agendarEmHoras: 48, // agendado
  },
  {
    titulo: "Semana Cultural — programação",
    mensagem: "Confira a agenda completa da nossa semana cultural com apresentações e exposições.",
    tipo: "informativo",
    agendarEmHoras: null,
  },
  {
    titulo: "Lembrete: entrega de boletins",
    mensagem: "Retirada dos boletins na secretaria entre 8h e 17h a partir de segunda.",
    tipo: "geral",
    agendarEmHoras: null,
  },
];

export type SeedEnquete = {
  titulo: string;
  descricao: string;
  tipo: "unica" | "multipla";
  publico: "todos" | "autenticados" | "staff";
  ativo: boolean;
  encerraEmDias: number | null;
  opcoes: string[];
};

export const SEED_ENQUETES: SeedEnquete[] = [
  {
    titulo: "Qual tema de palestra vocês preferem para o próximo mês?",
    descricao: "Vote na opção que mais interessa à comunidade escolar.",
    tipo: "unica",
    publico: "todos",
    ativo: true,
    encerraEmDias: 14,
    opcoes: ["Educação financeira", "Saúde mental", "Uso consciente da tecnologia", "Meio ambiente"],
  },
  {
    titulo: "Avaliação da Feira de Ciências (encerrada)",
    descricao: "Sua opinião sobre a última edição.",
    tipo: "unica",
    publico: "autenticados",
    ativo: false,
    encerraEmDias: -3, // já encerrou
    opcoes: ["Excelente", "Boa", "Regular", "Precisa melhorar"],
  },
  {
    titulo: "Reunião pedagógica — dia preferido",
    descricao: "Escolha o melhor dia para a reunião de professores.",
    tipo: "unica",
    publico: "staff",
    ativo: true,
    encerraEmDias: 7,
    opcoes: ["Quarta 14h", "Quinta 14h", "Sexta 10h"],
  },
];

export type SeedAutorizacao = {
  titulo: string;
  descricao: string;
  daysAteEvento: number;
  daysAtePrazo: number;
};

export const SEED_AUTORIZACOES: SeedAutorizacao[] = [
  {
    titulo: "Passeio ao Museu da Ciência",
    descricao: "Visita monitorada com transporte próprio. Sáida às 8h, retorno às 14h. Autorização do responsável obrigatória.",
    daysAteEvento: 15,
    daysAtePrazo: 10,
  },
  {
    titulo: "Uso de imagem em materiais institucionais",
    descricao: "Autorização anual para uso de imagem em publicações da escola, redes sociais e site.",
    daysAteEvento: 0,
    daysAtePrazo: 60,
  },
];

export type SeedAlerta = {
  message: string;
  variant: "info" | "success" | "warning" | "destructive";
  linkUrl: string | null;
  linkLabel: string | null;
  expiraEmDias: number;
};

export const SEED_ALERTAS: SeedAlerta[] = [
  {
    message: "Matrículas 2027 abertas — vagas limitadas por turma.",
    variant: "info",
    linkUrl: "/agendar",
    linkLabel: "Agendar visita",
    expiraEmDias: 30,
  },
  {
    message: "Manutenção elétrica programada para sábado — o site pode ficar fora por até 2h.",
    variant: "warning",
    linkUrl: null,
    linkLabel: null,
    expiraEmDias: 3,
  },
  {
    message: "Suspensão de aula na quinta pela manhã — assembleia pedagógica obrigatória.",
    variant: "destructive",
    linkUrl: null,
    linkLabel: null,
    expiraEmDias: 2,
  },
];

export type SeedAgendamento = {
  motivo: string;
  status: "pendente" | "confirmado" | "concluido" | "recusado" | "cancelado";
  daysUntil: number;
  relacao: string;
};

export const SEED_AGENDAMENTOS: SeedAgendamento[] = [
  { motivo: "Reunião sobre rendimento do meu filho", status: "pendente", daysUntil: 3, relacao: "responsavel" },
  { motivo: "Solicitação de segunda via de documento", status: "confirmado", daysUntil: 5, relacao: "responsavel" },
  { motivo: "Feedback pedagógico — bimestre encerrado", status: "concluido", daysUntil: -7, relacao: "responsavel" },
  { motivo: "Solicitação de horário fora do padrão", status: "recusado", daysUntil: -2, relacao: "responsavel" },
  { motivo: "Reunião de coordenação (remarcada)", status: "cancelado", daysUntil: -5, relacao: "responsavel" },
];

export type SeedMensagemCoord = {
  assunto: string;
  mensagem: string;
  remetenteTipo: "responsavel" | "aluno";
  respostaCoord: string | null;
};

export const SEED_MENSAGENS_COORD: SeedMensagemCoord[] = [
  {
    assunto: "Dúvida sobre lição de casa",
    mensagem: "Boa tarde! Meu filho está com dificuldade em resolver os exercícios de matemática desta semana. Podem orientar?",
    remetenteTipo: "responsavel",
    respostaCoord: "Olá! Encaminhamos ao professor da disciplina. Ele entrará em contato até amanhã.",
  },
  {
    assunto: "Justificativa de ausência",
    mensagem: "Minha filha esteve doente na segunda. Como faço para justificar?",
    remetenteTipo: "responsavel",
    respostaCoord: null,
  },
  {
    assunto: "Sugestão para a semana cultural",
    mensagem: "Gostaria de sugerir a inclusão de uma oficina de robótica no evento.",
    remetenteTipo: "responsavel",
    respostaCoord: "Muito obrigado pela sugestão! Vamos avaliar com a equipe pedagógica.",
  },
  {
    assunto: "Elogio à professora Ana Beatriz",
    mensagem: "Queria registrar o excelente trabalho da profa. Ana. Nossa filha está adorando as aulas.",
    remetenteTipo: "responsavel",
    respostaCoord: null,
  },
];

export type SeedDepoimento = {
  autorNome: string;
  autorIdade: number | null;
  mensagem: string;
  tipo: "comentario" | "sugestao" | "elogio";
  vinculo: "mae" | "pai" | "responsavel" | "aluno" | "professor" | "ex_aluno" | "comunidade";
  turmaAno: string | null;
};

export const SEED_DEPOIMENTOS: SeedDepoimento[] = [
  {
    autorNome: "[Seed] Cláudia Ribeiro",
    autorIdade: 41,
    mensagem: "Meu filho está no 8º ano e vejo a cada dia como a escola desenvolve o senso crítico dele. Grata!",
    tipo: "elogio",
    vinculo: "mae",
    turmaAno: "8º ano",
  },
  {
    autorNome: "[Seed] Marcos Oliveira",
    autorIdade: 45,
    mensagem: "Sugiro mais atividades ao ar livre no ensino médio. A estrutura permite e os alunos aproveitariam.",
    tipo: "sugestao",
    vinculo: "pai",
    turmaAno: "2ª série EM",
  },
  {
    autorNome: "[Seed] Larissa (ex-aluna)",
    autorIdade: 22,
    mensagem: "Estudei aqui e hoje estou na faculdade. A base que recebi foi essencial. Obrigada, professores!",
    tipo: "comentario",
    vinculo: "ex_aluno",
    turmaAno: null,
  },
  {
    autorNome: "[Seed] Fernanda Souza",
    autorIdade: 38,
    mensagem: "Adoro a comunicação transparente. Recebo os comunicados no celular e nunca perco nada.",
    tipo: "elogio",
    vinculo: "mae",
    turmaAno: "6º ano",
  },
];

export type SeedComentarioPost = {
  autorNome: string;
  conteudo: string;
  status: "aprovado" | "pendente" | "rejeitado";
};

export const SEED_COMENTARIOS: SeedComentarioPost[] = [
  { autorNome: "[Seed] Ana Paula", conteudo: "Excelente post! Compartilhei com outras famílias.", status: "aprovado" },
  { autorNome: "[Seed] José Roberto", conteudo: "Muito informativo, parabéns pela iniciativa.", status: "aprovado" },
  { autorNome: "[Seed] Camila M.", conteudo: "Quando será a próxima edição?", status: "aprovado" },
  { autorNome: "[Seed] Ricardo T.", conteudo: "Poderiam disponibilizar em PDF também?", status: "pendente" },
  { autorNome: "[Seed] Patrícia N.", conteudo: "Comentário aguardando moderação.", status: "pendente" },
  { autorNome: "[Seed] Anônimo", conteudo: "Comentário rejeitado (exemplo de moderação).", status: "rejeitado" },
];

export type SeedReminder = {
  texto: string;
  daysUntil: number;
  prioridade: "baixa" | "media" | "alta";
};

export const SEED_REMINDERS: SeedReminder[] = [
  { texto: "Reunião com coordenação — 15h", daysUntil: 1, prioridade: "alta" },
  { texto: "Revisar planejamento do próximo bimestre", daysUntil: 3, prioridade: "media" },
  { texto: "Enviar relatório mensal", daysUntil: 5, prioridade: "media" },
];

export type SeedJustificativa = {
  motivo: string;
  status: "pendente" | "aprovado" | "rejeitado";
  daysAtras: number;
};

export const SEED_JUSTIFICATIVAS: SeedJustificativa[] = [
  { motivo: "Consulta médica de rotina — atestado anexo.", status: "aprovado", daysAtras: 10 },
  { motivo: "Viagem em família previamente comunicada.", status: "aprovado", daysAtras: 15 },
  { motivo: "Sintomas gripais, atestado será entregue.", status: "pendente", daysAtras: 2 },
  { motivo: "Compromisso pessoal.", status: "rejeitado", daysAtras: 7 },
  { motivo: "Consulta odontológica.", status: "aprovado", daysAtras: 20 },
  { motivo: "Problema de transporte.", status: "pendente", daysAtras: 1 },
];

export type SeedDestaque = {
  posicao: number;
  motivo: string;
};

export const SEED_DESTAQUES: SeedDestaque[] = [
  { posicao: 1, motivo: "[Seed] Melhor desempenho geral do bimestre — nota máxima em 5 disciplinas." },
  { posicao: 2, motivo: "[Seed] Superação em matemática — evoluiu de 6.0 para 9.5." },
  { posicao: 3, motivo: "[Seed] Excelente participação em atividades culturais." },
  { posicao: 4, motivo: "[Seed] Liderança e cooperação com colegas em projetos." },
];

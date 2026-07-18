// Dados acadêmicos fictícios profissionais para popular o sistema.
// Marcadores permitem remoção em lote sem afetar dados reais.

export const SEED_TURMA_NAMES = [
  "6º ano A",
  "6º ano B",
  "7º ano A",
  "8º ano A",
  "9º ano A",
  "1ª série EM",
  "2ª série EM",
  "3ª série EM",
];

export const SEED_DISCIPLINA_NAMES = [
  "Português",
  "Matemática",
  "História",
  "Geografia",
  "Ciências",
  "Biologia",
  "Física",
  "Química",
  "Inglês",
  "Educação Física",
  "Artes",
  "Filosofia",
  "Sociologia",
];

export const SEED_PROFESSORES: Record<string, string> = {
  Português: "Profa. Ana Beatriz Lima",
  Matemática: "Prof. Marcos Vinícius Souza",
  História: "Prof. Eduardo Ramos",
  Geografia: "Profa. Cláudia Mendes",
  Ciências: "Profa. Patrícia Nogueira",
  Biologia: "Profa. Helena Carvalho",
  Física: "Prof. Ricardo Tavares",
  Química: "Profa. Mariana Alves",
  Inglês: "Profa. Juliana Prado",
  "Educação Física": "Prof. Bruno Henrique",
  Artes: "Profa. Larissa Oliveira",
  Filosofia: "Prof. Sérgio Martins",
  Sociologia: "Prof. Felipe Andrade",
};

export const SEED_EVENTO_TAG = "[Seed Demo]";

type SeedEvento = {
  titulo: string;
  descricao: string;
  tipo: "academico" | "cultural" | "esportivo" | "reuniao" | "feriado";
  local: string;
  turma: string | null;
  diasAteOcorrer: number;
  duracaoHoras: number;
};

export const SEED_EVENTOS: SeedEvento[] = [
  {
    titulo: "Reunião de pais e mestres — Fund. II",
    descricao: "Entrega de boletins do 1º bimestre.",
    tipo: "reuniao",
    local: "Auditório",
    turma: null,
    diasAteOcorrer: 2,
    duracaoHoras: 3,
  },
  {
    titulo: "Prova bimestral de Matemática",
    descricao: "Avaliação do conteúdo do bimestre.",
    tipo: "academico",
    local: "Sala 12",
    turma: "9º ano A",
    diasAteOcorrer: 4,
    duracaoHoras: 2,
  },
  {
    titulo: "Feira de Ciências — abertura",
    descricao: "Apresentação dos projetos finalistas.",
    tipo: "academico",
    local: "Pátio coberto",
    turma: null,
    diasAteOcorrer: 7,
    duracaoHoras: 5,
  },
  {
    titulo: "Treino de futsal interclasses",
    descricao: "Preparação para a final.",
    tipo: "esportivo",
    local: "Quadra poliesportiva",
    turma: "8º ano A",
    diasAteOcorrer: 9,
    duracaoHoras: 2,
  },
  {
    titulo: "Sarau literário",
    descricao: "Apresentações de poesia e música.",
    tipo: "cultural",
    local: "Biblioteca",
    turma: null,
    diasAteOcorrer: 12,
    duracaoHoras: 3,
  },
  {
    titulo: "Simulado ENEM",
    descricao: "Simulado completo para 3ª série.",
    tipo: "academico",
    local: "Salas 20–23",
    turma: "3ª série EM",
    diasAteOcorrer: 14,
    duracaoHoras: 5,
  },
  {
    titulo: "Conselho de classe",
    descricao: "Reunião de coordenação e professores.",
    tipo: "reuniao",
    local: "Sala dos professores",
    turma: null,
    diasAteOcorrer: 16,
    duracaoHoras: 4,
  },
  {
    titulo: "Visita ao Museu de Arte",
    descricao: "Atividade complementar de Artes.",
    tipo: "cultural",
    local: "Museu Municipal",
    turma: "7º ano A",
    diasAteOcorrer: 18,
    duracaoHoras: 4,
  },
  {
    titulo: "Festival de talentos",
    descricao: "Apresentações dos estudantes.",
    tipo: "cultural",
    local: "Auditório",
    turma: null,
    diasAteOcorrer: 21,
    duracaoHoras: 4,
  },
  {
    titulo: "Recesso escolar — Corpus Christi",
    descricao: "Sem expediente.",
    tipo: "feriado",
    local: "—",
    turma: null,
    diasAteOcorrer: 25,
    duracaoHoras: 24,
  },
  {
    titulo: "Olimpíada de Português — fase escolar",
    descricao: "Aplicação da prova classificatória.",
    tipo: "academico",
    local: "Salas 10 e 11",
    turma: "1ª série EM",
    diasAteOcorrer: 27,
    duracaoHoras: 3,
  },
  {
    titulo: "Mostra cultural afro-brasileira",
    descricao: "Encerramento da semana cultural.",
    tipo: "cultural",
    local: "Pátio coberto",
    turma: null,
    diasAteOcorrer: 29,
    duracaoHoras: 6,
  },
];

// Grade semanal: 5 aulas por dia, segunda a sexta.
// Turnos: Fundamental II e EM seguem o turno padrão definido em SEED_TURMA_TURNO.
export const SEED_TURMA_TURNO: Record<string, "manha" | "tarde"> = {
  "6º ano A": "tarde",
  "6º ano B": "tarde",
  "7º ano A": "tarde",
  "8º ano A": "manha",
  "9º ano A": "manha",
  "1ª série EM": "manha",
  "2ª série EM": "manha",
  "3ª série EM": "manha",
};

// Disciplinas que cada turma cursa (em ordem rotativa, 25 aulas/semana).
export const SEED_TURMA_DISCIPLINAS: Record<string, string[]> = {
  "6º ano A": [
    "Português",
    "Matemática",
    "Ciências",
    "História",
    "Geografia",
    "Inglês",
    "Artes",
    "Educação Física",
  ],
  "6º ano B": [
    "Português",
    "Matemática",
    "Ciências",
    "História",
    "Geografia",
    "Inglês",
    "Artes",
    "Educação Física",
  ],
  "7º ano A": [
    "Português",
    "Matemática",
    "Ciências",
    "História",
    "Geografia",
    "Inglês",
    "Artes",
    "Educação Física",
  ],
  "8º ano A": [
    "Português",
    "Matemática",
    "Ciências",
    "História",
    "Geografia",
    "Inglês",
    "Artes",
    "Educação Física",
  ],
  "9º ano A": [
    "Português",
    "Matemática",
    "Ciências",
    "História",
    "Geografia",
    "Inglês",
    "Artes",
    "Educação Física",
  ],
  "1ª série EM": [
    "Português",
    "Matemática",
    "Biologia",
    "Física",
    "Química",
    "História",
    "Geografia",
    "Inglês",
    "Filosofia",
    "Sociologia",
    "Educação Física",
  ],
  "2ª série EM": [
    "Português",
    "Matemática",
    "Biologia",
    "Física",
    "Química",
    "História",
    "Geografia",
    "Inglês",
    "Filosofia",
    "Sociologia",
    "Educação Física",
  ],
  "3ª série EM": [
    "Português",
    "Matemática",
    "Biologia",
    "Física",
    "Química",
    "História",
    "Geografia",
    "Inglês",
    "Filosofia",
    "Sociologia",
  ],
};

// Faixas horárias por turno (5 aulas).
export const SEED_FAIXAS = {
  manha: [
    { hora_inicio: "07:00", hora_fim: "07:50" },
    { hora_inicio: "07:50", hora_fim: "08:40" },
    { hora_inicio: "08:55", hora_fim: "09:45" },
    { hora_inicio: "09:45", hora_fim: "10:35" },
    { hora_inicio: "10:35", hora_fim: "11:25" },
  ],
  tarde: [
    { hora_inicio: "13:00", hora_fim: "13:50" },
    { hora_inicio: "13:50", hora_fim: "14:40" },
    { hora_inicio: "14:55", hora_fim: "15:45" },
    { hora_inicio: "15:45", hora_fim: "16:35" },
    { hora_inicio: "16:35", hora_fim: "17:25" },
  ],
} as const;

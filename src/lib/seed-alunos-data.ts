/**
 * Dados fictícios de alunos e responsáveis para popular o sistema.
 * Marcadores garantem que a limpeza remove somente estes registros.
 */

// 24 alunos distribuídos nas 8 turmas seed
// (turma_slug identifica a turma seed em `turmas_escolares` via observacoes tag).
export type SeedAluno = {
  matricula: string; // sempre começa com SEED-
  nome: string;
  turmaSlug: string; // referência ao slug seed em turmas
  dataNascimento: string; // ISO date
};

const primeirosNomes = [
  "Ana Clara", "João Pedro", "Maria Eduarda", "Pedro Henrique", "Beatriz",
  "Rafael", "Lorena", "Miguel", "Sofia", "Arthur", "Isabela", "Gabriel",
  "Larissa", "Enzo", "Manuela", "Davi", "Valentina", "Bernardo", "Helena",
  "Guilherme", "Alice", "Théo", "Laura", "Nicolas",
];

const sobrenomes = [
  "Silva", "Souza", "Santos", "Oliveira", "Pereira", "Lima", "Costa",
  "Ferreira", "Almeida", "Ribeiro", "Carvalho", "Nogueira", "Mendes",
  "Rocha", "Cardoso", "Barros", "Freitas", "Araújo", "Gomes", "Martins",
  "Machado", "Vieira", "Moraes", "Cavalcante",
];

const turmasSlugs = [
  "seed-6-ano-a", "seed-6-ano-b", "seed-7-ano-a", "seed-8-ano-a",
  "seed-9-ano-a", "seed-1-serie-em", "seed-2-serie-em", "seed-3-serie-em",
];

export const SEED_ALUNOS: SeedAluno[] = primeirosNomes.map((nome, i) => {
  const turmaIdx = i % turmasSlugs.length;
  // idade determinística por turma para gerar aniversariantes
  const anoNasc = 2026 - (11 + turmaIdx);
  const mes = ((i * 3) % 12) + 1;
  const dia = ((i * 7) % 27) + 1;
  return {
    matricula: `SEED-${String(2026000 + i + 1)}`,
    nome: `${nome} ${sobrenomes[i]}`,
    turmaSlug: turmasSlugs[turmaIdx],
    dataNascimento: `${anoNasc}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`,
  };
});

// Responsáveis fictícios sem login (email marcado *.resp.seed@escola.demo).
// Cada aluno recebe 1–2 responsáveis nesta lista. Os 3 usuários seed.family.*
// serão adicionalmente vinculados a 2 alunos cada dentro da server function.
export type SeedResponsavel = {
  key: string; // usado como base do email (respkey.resp.seed@escola.demo)
  nome: string;
  telefone: string;
  parentesco: "mae" | "pai" | "responsavel";
  vinculos: string[]; // matrículas dos alunos vinculados
};

// Gera 24 responsáveis (um por aluno), + 6 secundários compartilhados.
export const SEED_RESPONSAVEIS: SeedResponsavel[] = SEED_ALUNOS.flatMap((a, i) => {
  const primeiro = a.nome.split(" ")[0];
  const sobreAluno = a.nome.split(" ").slice(1).join(" ");
  const resps: SeedResponsavel[] = [
    {
      key: `resp1.${i}`,
      nome: `${i % 2 === 0 ? "Cláudia" : "Marcos"} ${sobreAluno}`,
      telefone: `(85) 9${String(80000000 + i * 137).slice(0, 8)}`,
      parentesco: i % 2 === 0 ? "mae" : "pai",
      vinculos: [a.matricula],
    },
  ];
  if (i % 4 === 0) {
    resps.push({
      key: `resp2.${i}`,
      nome: `${i % 2 === 0 ? "Roberto" : "Fernanda"} ${sobreAluno}`,
      telefone: `(85) 9${String(70000000 + i * 211).slice(0, 8)}`,
      parentesco: i % 2 === 0 ? "pai" : "mae",
      vinculos: [a.matricula],
    });
  }
  // Um "irmão" com responsável comum: primeiro do próximo par
  void primeiro;
  return resps;
});

// Matrículas para cada usuário seed.family.N (2 alunos cada, distribuídos em turmas diferentes)
export const SEED_FAMILY_USER_VINCULOS: Record<string, string[]> = {
  "seed.family.1": [SEED_ALUNOS[0].matricula, SEED_ALUNOS[9].matricula],
  "seed.family.2": [SEED_ALUNOS[1].matricula, SEED_ALUNOS[12].matricula],
  "seed.family.3": [SEED_ALUNOS[2].matricula, SEED_ALUNOS[15].matricula],
};

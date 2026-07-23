import postScience from "@/assets/post-science.jpg";
import postSports from "@/assets/post-sports.jpg";
import postLibrary from "@/assets/post-library.jpg";
import postArt from "@/assets/post-art.jpg";

export interface Turma {
  id: string;
  nome: string;
}

export interface Disciplina {
  id: string;
  nome: string;
}

export interface Post {
  id: string;
  titulo: string;
  resumo: string;
  imagem: string;
  autor: string;
  data: string;
  turma?: string;
  disciplina?: string;
  destaque?: boolean;
  geral?: boolean;
}

export const turmas: Turma[] = [
  { id: "6a", nome: "6º Ano A" },
  { id: "6b", nome: "6º Ano B" },
  { id: "7a", nome: "7º Ano A" },
  { id: "7b", nome: "7º Ano B" },
  { id: "8a", nome: "8º Ano A" },
  { id: "9a", nome: "9º Ano A" },
];

export const disciplinas: Disciplina[] = [
  { id: "mat", nome: "Matemática" },
  { id: "hist", nome: "História" },
  { id: "cie", nome: "Ciências" },
  { id: "port", nome: "Português" },
  { id: "art", nome: "Artes" },
  { id: "edf", nome: "Educação Física" },
];

export const posts: Post[] = [
  {
    id: "1",
    titulo: "Semana da Ciência reúne projetos incríveis dos alunos",
    resumo:
      "Estudantes do fundamental apresentaram experimentos sobre energia renovável e biologia em uma feira aberta às famílias.",
    imagem: postScience,
    autor: "Profª. Helena Martins",
    data: "2026-05-28T14:30:00",
    turma: "8º Ano A",
    disciplina: "Ciências",
    destaque: true,
  },
  {
    id: "2",
    titulo: "Inauguração do novo campo esportivo da escola",
    resumo:
      "A Diretoria celebra a entrega do espaço renovado, que ampliará as atividades de Educação Física e os campeonatos internos.",
    imagem: postSports,
    autor: "Direção Escolar",
    data: "2026-05-25T09:00:00",
    geral: true,
    destaque: true,
  },
  {
    id: "3",
    titulo: "Clube de leitura inspira novos talentos literários",
    resumo:
      "A turma desenvolveu resenhas e debates sobre clássicos da literatura brasileira na biblioteca renovada.",
    imagem: postLibrary,
    autor: "Prof. Carlos Eduardo",
    data: "2026-05-22T16:15:00",
    turma: "9º Ano A",
    disciplina: "Português",
  },
  {
    id: "4",
    titulo: "Exposição de Artes celebra a criatividade estudantil",
    resumo:
      "Pinturas e esculturas produzidas durante o semestre ganharam destaque no saguão principal da escola.",
    imagem: postArt,
    autor: "Profª. Beatriz Lopes",
    data: "2026-05-19T11:45:00",
    turma: "6º Ano A",
    disciplina: "Artes",
  },
  {
    id: "5",
    titulo: "Olimpíada de Matemática: alunos conquistam medalhas",
    resumo:
      "Representantes da escola tiveram desempenho de destaque na fase regional da competição nacional.",
    imagem: postScience,
    autor: "Prof. Rafael Souza",
    data: "2026-05-15T08:20:00",
    turma: "7º Ano B",
    disciplina: "Matemática",
  },
  {
    id: "6",
    titulo: "Comunicado: calendário de reuniões de pais e mestres",
    resumo:
      "Confira as datas e horários dos encontros do próximo bimestre com a coordenação pedagógica.",
    imagem: postLibrary,
    autor: "Coordenação Pedagógica",
    data: "2026-05-12T13:00:00",
    geral: true,
  },
];

export function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function formatarDataHora(iso: string) {
  // Se vier apenas uma data (YYYY-MM-DD), mostra só o dia — evita o shift
  // de fuso que faria "2026-07-03" virar "2026-07-02 21:00" em UTC-3.
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }
  const date = new Date(iso);
  const base = date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  // Sigla do fuso local (ex.: "BRT", "GMT-3") para deixar claro entre dispositivos.
  const tz = date.toLocaleTimeString("pt-BR", { timeZoneName: "short" }).split(" ").pop();
  return tz ? `${base} ${tz}` : base;
}

/** Retorna os posts ordenados da data/hora mais recente para a mais antiga. */
export function ordenarPorDataHora(lista: Post[]) {
  return [...lista].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
}

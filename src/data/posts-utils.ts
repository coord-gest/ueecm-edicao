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

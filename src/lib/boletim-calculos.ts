// Cálculos do Boletim Oficial (SEMED Assunção do Piauí).
// Todos os inputs chegam como string ("8,5" / "8.5" / ""). Funções são puras.

export type NotasDisciplina = Record<string, string>;

export const BOLETIM_COLUNAS_KEYS = [
  "aq1",
  "ae1",
  "aq2",
  "ae2",
  "rec2",
  "aq3",
  "ae3",
  "aq4",
  "ae4",
  "rec4",
  "pf",
] as const;

export type BoletimColunaKey = (typeof BOLETIM_COLUNAS_KEYS)[number];

/** Parseia uma nota exigindo faixa 0–10. Fora da faixa ou não numérico → null. */
export function parseNota(v: string | undefined | null): number | null {
  if (v == null) return null;
  const s = String(v).trim().replace(",", ".");
  if (!s || s === "-") return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  if (n < 0 || n > 10) return null;
  return n;
}

/** True quando o campo está vazio OU contém uma nota válida (0–10). */
export function isNotaValida(v: string | undefined | null): boolean {
  if (v == null) return true;
  const s = String(v).trim();
  if (!s || s === "-") return true;
  return parseNota(s) != null;
}

export function fmtNota(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "";
  const r = Math.round(n * 10) / 10;
  return r.toFixed(1).replace(".", ",");
}

/** Média do bimestre = max((AQ+AE)/2, REC quando existir). Ausente conta 0. */
function mediaBimestre(aq: number | null, ae: number | null, rec: number | null): number | null {
  if (aq == null && ae == null && rec == null) return null;
  const base = ((aq ?? 0) + (ae ?? 0)) / 2;
  if (rec != null) return Math.max(base, rec);
  return base;
}

export function calcularBimestres(n: NotasDisciplina) {
  const b1 = mediaBimestre(parseNota(n.aq1), parseNota(n.ae1), null);
  const b2 = mediaBimestre(parseNota(n.aq2), parseNota(n.ae2), parseNota(n.rec2));
  const b3 = mediaBimestre(parseNota(n.aq3), parseNota(n.ae3), null);
  const b4 = mediaBimestre(parseNota(n.aq4), parseNota(n.ae4), parseNota(n.rec4));
  return { b1, b2, b3, b4 };
}

/** Média final = média dos 4 bimestres (ausentes = 0). Com PF, usa (MF + PF)/2. */
export function calcularMediaFinal(n: NotasDisciplina): number | null {
  const { b1, b2, b3, b4 } = calcularBimestres(n);
  const algum = [b1, b2, b3, b4].some((x) => x != null);
  if (!algum) return null;
  const mf = ((b1 ?? 0) + (b2 ?? 0) + (b3 ?? 0) + (b4 ?? 0)) / 4;
  const pf = parseNota(n.pf);
  if (pf != null) return (mf + pf) / 2;
  return mf;
}

export type ResultadoDisciplina = "CURSANDO" | "APROVADO" | "EM RECUPERAÇÃO PARCIAL" | "REPROVADO";

export function calcularResultado(n: NotasDisciplina): ResultadoDisciplina {
  const { b1, b2, b3, b4 } = calcularBimestres(n);
  const completos = [b1, b2, b3, b4].every((x) => x != null);
  const mf = calcularMediaFinal(n);
  if (mf == null) return "CURSANDO";
  if (!completos) {
    // Alguém abaixo de 3 sinaliza recuperação parcial durante o ano
    if ([b1, b2, b3, b4].some((x) => x != null && x < 3)) return "EM RECUPERAÇÃO PARCIAL";
    return "CURSANDO";
  }
  if (mf >= 6) return "APROVADO";
  if (mf >= 4) return "EM RECUPERAÇÃO PARCIAL";
  return "REPROVADO";
}

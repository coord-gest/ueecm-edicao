// Paleta determinística para colorir disciplinas na Grade de Horários.
// Usa `disciplina.cor` quando definida (hex), senão escolhe da paleta por hash do id/nome.

const PALETTE: DisciplinaColor[] = [
  { bg: "#fee2e2", border: "#f87171", text: "#991b1b", accent: "#ef4444" }, // red
  { bg: "#ffedd5", border: "#fb923c", text: "#9a3412", accent: "#f97316" }, // orange
  { bg: "#fef3c7", border: "#fbbf24", text: "#92400e", accent: "#f59e0b" }, // amber
  { bg: "#fef9c3", border: "#facc15", text: "#854d0e", accent: "#eab308" }, // yellow
  { bg: "#dcfce7", border: "#4ade80", text: "#166534", accent: "#22c55e" }, // green
  { bg: "#d1fae5", border: "#34d399", text: "#065f46", accent: "#10b981" }, // emerald
  { bg: "#ccfbf1", border: "#2dd4bf", text: "#115e59", accent: "#14b8a6" }, // teal
  { bg: "#cffafe", border: "#22d3ee", text: "#155e75", accent: "#06b6d4" }, // cyan
  { bg: "#dbeafe", border: "#60a5fa", text: "#1e40af", accent: "#3b82f6" }, // blue
  { bg: "#e0e7ff", border: "#818cf8", text: "#3730a3", accent: "#6366f1" }, // indigo
  { bg: "#ede9fe", border: "#a78bfa", text: "#5b21b6", accent: "#8b5cf6" }, // violet
  { bg: "#fae8ff", border: "#e879f9", text: "#86198f", accent: "#d946ef" }, // fuchsia
  { bg: "#fce7f3", border: "#f472b6", text: "#9d174d", accent: "#ec4899" }, // pink
  { bg: "#ffe4e6", border: "#fb7185", text: "#9f1239", accent: "#f43f5e" }, // rose
];

function hashString(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.replace("#", "").trim();
  if (!(m.length === 3 || m.length === 6)) return null;
  const full =
    m.length === 3
      ? m
          .split("")
          .map((c) => c + c)
          .join("")
      : m;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return null;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export type DisciplinaColor = { bg: string; border: string; text: string; accent: string };

// Cor neutra para disciplinas inválidas (sem id, sem nome e sem cor)
export const NEUTRAL_COLOR: DisciplinaColor = {
  bg: "rgba(100, 116, 139, 0.10)", // slate-500 @ 10%
  border: "rgba(100, 116, 139, 0.40)",
  text: "rgb(51, 65, 85)", // slate-700
  accent: "rgb(100, 116, 139)", // slate-500
};

export function getDisciplinaColor(
  d?: {
    id?: string | null;
    nome?: string | null;
    cor?: string | null;
  } | null,
): DisciplinaColor {
  if (d?.cor && /^#?[0-9a-fA-F]{3,6}$/.test(d.cor.trim())) {
    const raw = d.cor.trim();
    const rgb = hexToRgb(raw.startsWith("#") ? raw : `#${raw}`);
    if (rgb) {
      return {
        bg: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.14)`,
        border: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.55)`,
        text: `rgb(${Math.max(0, rgb.r - 60)}, ${Math.max(0, rgb.g - 60)}, ${Math.max(0, rgb.b - 60)})`,
        accent: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
      };
    }
  }
  // Chave determinística baseada em id ou nome — gera a MESMA cor entre
  // sessões e usuários diferentes (sem aleatoriedade nem estado).
  const key = (d?.id || d?.nome || "").toString().trim();
  if (!key) return NEUTRAL_COLOR;
  return PALETTE[hashString(key) % PALETTE.length];
}

// Lista de cores hex sugeridas no formulário de cadastro
export const SUGGESTED_HEX_COLORS = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#eab308",
  "#22c55e",
  "#10b981",
  "#06b6d4",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#d946ef",
  "#ec4899",
];

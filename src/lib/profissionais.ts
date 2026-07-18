import type { Database } from "@/integrations/supabase/types";

export type Profissional = Database["public"]["Tables"]["profissionais"]["Row"];
export type ProfissionalInsert = Database["public"]["Tables"]["profissionais"]["Insert"];
export type ProfissionalUpdate = Database["public"]["Tables"]["profissionais"]["Update"];

export type Cargo = "diretor" | "coordenador" | "professor" | "secretario" | "outro";

export const CARGO_LABEL: Record<Cargo, string> = {
  diretor: "Diretor(a)",
  coordenador: "Coordenador(a)",
  professor: "Professor(a)",
  secretario: "Secretário(a)",
  outro: "Outro",
};

export const CARGO_OPTIONS: { value: Cargo; label: string }[] = [
  { value: "diretor", label: "Diretoria" },
  { value: "coordenador", label: "Coordenação" },
  { value: "professor", label: "Professores" },
  { value: "secretario", label: "Secretaria" },
  { value: "outro", label: "Demais profissionais" },
];

export const CARGO_ORDER: Cargo[] = ["diretor", "coordenador", "professor", "secretario", "outro"];

export function getInitials(nome: string) {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
}

export function tempoDeProfissao(p: Pick<Profissional, "anos_experiencia" | "ano_ingresso">) {
  const parts: string[] = [];
  if (p.anos_experiencia != null) parts.push(`${p.anos_experiencia} anos de profissão`);
  if (p.ano_ingresso != null) parts.push(`na escola desde ${p.ano_ingresso}`);
  return parts.join(" · ");
}

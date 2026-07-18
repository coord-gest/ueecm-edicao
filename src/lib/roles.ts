export const APP_ROLES = [
  "desenvolvedor",
  "admin",
  "diretor",
  "coordenador",
  "professor",
  "secretario",
  "leitor",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const roleLabels: Record<AppRole, string> = {
  desenvolvedor: "Desenvolvedor",
  admin: "Administrador",
  diretor: "Diretor",
  coordenador: "Coordenador",
  professor: "Professor",
  secretario: "Secretário",
  leitor: "Leitor",
};

const ROLE_ALIASES: Record<string, AppRole> = {
  desenvolvedor: "desenvolvedor",
  developer: "desenvolvedor",
  admin: "admin",
  administrador: "admin",
  diretor: "diretor",
  director: "diretor",
  coordenador: "coordenador",
  coordinator: "coordenador",
  professor: "professor",
  teacher: "professor",
  secretario: "secretario",
  secretária: "secretario",
  secretaria: "secretario",
  leitor: "leitor",
  aluno: "leitor",
  student: "leitor",
  family: "leitor",
};

export function normalizeRole(role: string | null | undefined): AppRole | null {
  if (!role) return null;
  return ROLE_ALIASES[role.trim().toLowerCase()] ?? null;
}

export function normalizeRoles(rawRoles: Array<string | null | undefined>): AppRole[] {
  const normalized = rawRoles
    .map((role) => normalizeRole(role))
    .filter((role): role is AppRole => role !== null);
  return Array.from(new Set(normalized));
}

export function hasAnyRole(roles: AppRole[], allowed: AppRole[]): boolean {
  return allowed.some((role) => roles.includes(role));
}

export function isStaffRole(role: AppRole): boolean {
  return role !== "leitor";
}

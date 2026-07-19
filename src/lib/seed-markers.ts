/**
 * Marcadores estáveis usados por TODO o sistema de seed para isolar
 * dados fictícios dos dados reais. Cada tabela tem seu marcador próprio.
 *
 * REGRA DE OURO: qualquer operação de wipe FILTRA por um destes marcadores.
 * Nunca deletar por LIMIT, range de datas, ou "os N mais recentes".
 */

// Usuários já existentes (definidos em seed-users.functions.ts)
export const SEED_USER_DOMAIN = "escola.demo";
export const SEED_USER_PREFIX = "seed.";
export const SEED_USER_EMAIL_PATTERN = `${SEED_USER_PREFIX}%@${SEED_USER_DOMAIN}`;

// Prefixos e tags
export const SEED_MATRICULA_PREFIX = "SEED-";
export const SEED_RESP_EMAIL_PATTERN = "%.resp.seed@escola.demo";
export const SEED_TURMA_ESCOLAR_TAG = "[SEED]"; // vai em turmas_escolares.observacoes
export const SEED_TITLE_TAG = "[Seed]"; // prefixo em títulos/mensagens
export const SEED_COMUNICADO_TAG = "[Seed]"; // prefixo em titulo
export const SEED_ALERT_TAG = "[Seed]"; // dentro do message
export const SEED_ENQUETE_TAG = "[Seed]"; // prefixo em titulo
export const SEED_AUTORIZACAO_TAG = "[Seed]"; // prefixo em titulo
export const SEED_AGENDAMENTO_TAG = "[Seed]"; // dentro do motivo
export const SEED_MSG_TAG = "[Seed]"; // prefixo em assunto
export const SEED_DEPOIMENTO_TAG = "[Seed]"; // dentro do autor_nome
export const SEED_COMENTARIO_TAG = "[Seed]"; // dentro do autor_nome
export const SEED_REMINDER_TAG = "[Seed]"; // prefixo em texto
export const SEED_GALERIA_TAG = "[Seed]"; // prefixo em titulo
export const SEED_DESTAQUE_MOTIVO_TAG = "[Seed]"; // dentro do motivo

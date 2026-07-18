/**
 * Server-only: gera um snapshot JSON das tabelas críticas e faz upload
 * no bucket `backups`. Chamado tanto pelo pg_cron semanal quanto pelo
 * botão manual do painel de manutenção.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logger } from "@/lib/logger";

/** Tabelas exportadas em cada snapshot. Ordem irrelevante — restauração manual. */
const CRITICAL_TABLES = [
  "alunos",
  "turmas_escolares",
  "turmas",
  "disciplinas",
  "notas",
  "frequencia",
  "comunicados",
  "comunicado_leituras",
  "responsaveis",
  "aluno_responsavel",
  "autorizacoes",
  "autorizacao_respostas",
  "patrocinadores",
  "eventos_patrocinio",
  "profissionais",
  "profiles",
  "user_roles",
  "posts",
  "familias_depoimentos",
  "alunos_destaque",
] as const;

export type BackupResult = {
  ok: true;
  path: string;
  bytes: number;
  tables: number;
  rows: number;
  duration_ms: number;
  drive?: { ok: true; fileId: string; folderId: string } | { ok: false; error: string };
};

export async function runBackup(): Promise<BackupResult> {
  const start = Date.now();
  const snapshot: Record<string, unknown> = {
    generated_at: new Date().toISOString(),
    schema_version: 1,
  };
  let totalRows = 0;

  for (const table of CRITICAL_TABLES) {
    const { data, error } = await supabaseAdmin
      .from(table as never)
      .select("*")
      .limit(10000);
    if (error) {
      logger.warn(`[backup] tabela ${table} falhou:`, error.message);
      snapshot[table] = { error: error.message };
      continue;
    }
    snapshot[table] = data ?? [];
    totalRows += (data ?? []).length;
  }

  const json = JSON.stringify(snapshot);
  const bytes = new TextEncoder().encode(json).byteLength;
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const path = `auto/backup-${ts}.json`;

  const { error: upErr } = await supabaseAdmin.storage.from("backups").upload(path, json, {
    contentType: "application/json",
    upsert: false,
  });
  if (upErr) throw new Error(`upload_failed: ${upErr.message}`);

  // Retenção: manter os últimos 12 arquivos automáticos
  const { data: files } = await supabaseAdmin.storage
    .from("backups")
    .list("auto", { limit: 200, sortBy: { column: "created_at", order: "desc" } });
  if (files && files.length > 12) {
    const toRemove = files.slice(12).map((f) => `auto/${f.name}`);
    await supabaseAdmin.storage.from("backups").remove(toRemove);
  }

  // Upload adicional para o Google Drive (UEECM/Backups) — melhor esforço.
  // Se o Drive não estiver conectado, apenas registramos e seguimos.
  let drive: BackupResult["drive"];
  try {
    const { isDriveConfigured, ensureUEECMTree, uploadFileServer } =
      await import("@/lib/google-drive.server");
    if (isDriveConfigured()) {
      const { backupsId } = await ensureUEECMTree();
      const uploaded = await uploadFileServer({
        name: `backup-${ts}.json`,
        mimeType: "application/json",
        parentId: backupsId,
        data: new TextEncoder().encode(json),
      });
      drive = { ok: true, fileId: uploaded.id, folderId: backupsId };
    } else {
      drive = { ok: false, error: "google_drive_not_connected" };
    }
  } catch (err) {
    logger.warn("[backup] Drive upload falhou:", err);
    drive = { ok: false, error: (err as Error).message };
  }

  return {
    ok: true,
    path,
    bytes,
    tables: CRITICAL_TABLES.length,
    rows: totalRows,
    duration_ms: Date.now() - start,
    drive,
  };
}

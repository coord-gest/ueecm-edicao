import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

export type NotasMap = Record<string, Record<string, string>>; // alunoId -> coluna -> valor

/** alunoId -> disciplinaKey -> colunaKey -> valor */
export type NotasBoletimMap = Record<string, Record<string, Record<string, string>>>;

export type AlunoBoletim = {
  id: string;
  nome: string;
  matricula?: string | null;
  inep?: string | null;
  sexo?: string | null;
  nascimento?: string | null;
  mae?: string | null;
  pai?: string | null;
};

export type ArquivoPreenchimentoDados = {
  /** @deprecated legado (modelo por áreas). Mantido para leitura de dados antigos. */
  notas?: NotasMap;
  /** @deprecated legado por bimestre. */
  notasPorBimestre?: Record<string, NotasMap>;
  /** Notas do Boletim Oficial: aluno -> disciplina -> coluna -> valor. */
  notasBoletim?: NotasBoletimMap;
  alunos: AlunoBoletim[];
  observacoes?: string;
};

/** Legado: retorna notas do bimestre no formato antigo. */
export function getNotasDoBimestre(
  dados: ArquivoPreenchimentoDados,
  bimestre: number,
  bimestreLegado?: number,
): NotasMap {
  const key = String(bimestre);
  if (dados.notasPorBimestre?.[key]) return dados.notasPorBimestre[key];
  if (bimestreLegado != null && bimestre === bimestreLegado) return dados.notas ?? {};
  return {};
}

/** Retorna o mapa de notas do Boletim Oficial (garante estrutura vazia). */
export function getNotasBoletim(dados: ArquivoPreenchimentoDados): NotasBoletimMap {
  return dados.notasBoletim ?? {};
}

/** Detecta se este preenchimento é do modelo legado (não tem notasBoletim). */
export function isPreenchimentoLegado(dados: ArquivoPreenchimentoDados): boolean {
  if (dados.notasBoletim) return false;
  return !!(dados.notas || dados.notasPorBimestre);
}

/**
 * Mapa das áreas do modelo antigo → disciplinas do Boletim Oficial.
 * Cada valor da área é replicado nas disciplinas correspondentes.
 */
export const LEGADO_AREA_TO_DISCIPLINAS: Record<string, string[]> = {
  lingua_portuguesa: ["lingua_portuguesa"],
  matematica: ["matematica"],
  producao_texto: ["leitura_producao"],
  ciencias_natureza: ["ciencias"],
  ciencias_humanas: ["historia", "geografia", "ensino_religioso"],
  linguagens: ["ingles", "artes", "educacao_fisica"],
};

export const LEGADO_AREA_LABELS: Record<string, string> = {
  lingua_portuguesa: "Língua Portuguesa",
  matematica: "Matemática",
  producao_texto: "Produção de Texto",
  ciencias_natureza: "Ciências da Natureza",
  ciencias_humanas: "Ciências Humanas",
  linguagens: "Linguagens",
};

/**
 * Converte um preenchimento legado (áreas × bimestre) para o Boletim Oficial.
 * Cada bimestre B (1..4) preenche a coluna "ae<B>" das disciplinas mapeadas.
 * Mantém `notas` e `notasPorBimestre` como backup dentro do próprio JSON.
 */
export function migrarLegadoParaBoletim(
  dados: ArquivoPreenchimentoDados,
  bimestreLegado?: number,
): ArquivoPreenchimentoDados {
  if (dados.notasBoletim) return dados;
  const notasBoletim: NotasBoletimMap = {};
  const aplicar = (bim: number, mapa: NotasMap) => {
    const coluna = `ae${bim}`;
    for (const [alunoId, colunas] of Object.entries(mapa ?? {})) {
      for (const [areaKey, valor] of Object.entries(colunas ?? {})) {
        const v = (valor ?? "").toString().trim();
        if (!v) continue;
        for (const disc of LEGADO_AREA_TO_DISCIPLINAS[areaKey] ?? []) {
          notasBoletim[alunoId] ??= {};
          notasBoletim[alunoId][disc] ??= {};
          if (!notasBoletim[alunoId][disc][coluna]) {
            notasBoletim[alunoId][disc][coluna] = v;
          }
        }
      }
    }
  };
  if (dados.notasPorBimestre) {
    for (const [bimStr, mapa] of Object.entries(dados.notasPorBimestre)) {
      const bim = Number(bimStr);
      if (bim >= 1 && bim <= 4) aplicar(bim, mapa);
    }
  }
  if (dados.notas && bimestreLegado && bimestreLegado >= 1 && bimestreLegado <= 4) {
    aplicar(bimestreLegado, dados.notas);
  }
  return { ...dados, notasBoletim };
}

/** Migra em lote todos os preenchimentos legados do template informado. */
export async function migrarTodosLegados(templateId: string): Promise<{
  total: number;
  migrados: number;
  ignorados: number;
  erros: number;
}> {
  const { data, error } = await supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from(TABLE as any)
    .select("id, bimestre, dados")
    .eq("template_id", templateId);
  if (error) throw error;
  const rows = (data ?? []) as unknown as Array<{
    id: string;
    bimestre: number;
    dados: ArquivoPreenchimentoDados;
  }>;
  let migrados = 0;
  let ignorados = 0;
  let erros = 0;
  for (const row of rows) {
    if (!isPreenchimentoLegado(row.dados)) {
      ignorados++;
      continue;
    }
    try {
      const novo = migrarLegadoParaBoletim(row.dados, row.bimestre);
      await updatePreenchimento(row.id, { dados: novo });
      migrados++;
    } catch (e) {
      logger.error("[migrar] falhou id=", row.id, e);
      erros++;
    }
  }
  return { total: rows.length, migrados, ignorados, erros };
}

/**
 * Move todos os preenchimentos legados (sem `notasBoletim`) de um template para outro.
 * Preserva 100% dos dados (alunos, notas e observações) — apenas altera `template_id`.
 */
export async function moverLegadosParaTemplate(
  fromTemplateId: string,
  toTemplateId: string,
): Promise<{ total: number; movidos: number; ignorados: number; erros: number }> {
  const { data, error } = await supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from(TABLE as any)
    .select("id, dados")
    .eq("template_id", fromTemplateId);
  if (error) throw error;
  const rows = (data ?? []) as unknown as Array<{ id: string; dados: ArquivoPreenchimentoDados }>;
  let movidos = 0;
  let ignorados = 0;
  let erros = 0;
  for (const row of rows) {
    if (!isPreenchimentoLegado(row.dados)) {
      ignorados++;
      continue;
    }
    try {
      const { error: upErr } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from(TABLE as any)
        .update({ template_id: toTemplateId })
        .eq("id", row.id);
      if (upErr) throw upErr;
      movidos++;
    } catch (e) {
      logger.error("[mover] falhou id=", row.id, e);
      erros++;
    }
  }
  return { total: rows.length, movidos, ignorados, erros };
}

export type ArquivoPreenchimento = {
  id: string;
  template_id: string;
  turma_id: string;
  bimestre: number;
  titulo: string;
  dados: ArquivoPreenchimentoDados;
  criado_por: string;
  atualizado_por: string | null;
  created_at: string;
  updated_at: string;
};

const TABLE = "arquivo_preenchimentos";

export async function listPreenchimentos(templateId: string) {
  const { data, error } = await supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from(TABLE as any)
    .select("id, template_id, turma_id, bimestre, titulo, updated_at, created_at, atualizado_por")
    .eq("template_id", templateId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Array<
    Pick<
      ArquivoPreenchimento,
      | "id"
      | "template_id"
      | "turma_id"
      | "bimestre"
      | "titulo"
      | "updated_at"
      | "created_at"
      | "atualizado_por"
    >
  >;
}

export async function getPreenchimento(id: string): Promise<ArquivoPreenchimento> {
  const { data, error } = await supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from(TABLE as any)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Preenchimento não encontrado");
  return data as unknown as ArquivoPreenchimento;
}

export async function createPreenchimento(input: {
  template_id: string;
  turma_id: string;
  bimestre: number;
  titulo: string;
  dados: ArquivoPreenchimentoDados;
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sessão expirada");
  const { data, error } = await supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from(TABLE as any)
    .insert({ ...input, criado_por: user.id, atualizado_por: user.id })
    .select("id")
    .single();
  if (error) throw error;
  return data as unknown as { id: string };
}

export async function updatePreenchimento(
  id: string,
  patch: Partial<Pick<ArquivoPreenchimento, "titulo" | "bimestre" | "dados">>,
  opts: { skipSync?: boolean } = {},
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from(TABLE as any)
    .update({ ...patch, atualizado_por: user?.id ?? null })
    .eq("id", id);
  if (error) throw error;
  if (!opts.skipSync && patch.dados) {
    // Espelha em segundo plano para o template irmão (Boletim <-> Notas por Área).
    scheduleSyncPaired(id).catch((e) => logger.warn("[sync-paired]", e));
  }
}

export async function deletePreenchimento(id: string) {
  const { error } = await supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from(TABLE as any)
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export const BIMESTRES = [
  { value: 1, label: "1º Bimestre" },
  { value: 2, label: "2º Bimestre" },
  { value: 3, label: "3º Bimestre" },
  { value: 4, label: "4º Bimestre" },
] as const;

/* ------------------------------------------------------------------ */
/*  Sincronização bidirecional: Boletim Oficial  <->  Notas por Área  */
/* ------------------------------------------------------------------ */

const BOLETIM_TID = "avaliacao-bimestral";
const AREA_TID = "notas-por-area";

/** Disciplina do Boletim Oficial -> Área do modelo legado. */
const DISCIPLINA_TO_AREA: Record<string, string> = {
  lingua_portuguesa: "lingua_portuguesa",
  matematica: "matematica",
  leitura_producao: "producao_texto",
  ciencias: "ciencias_natureza",
  historia: "ciencias_humanas",
  geografia: "ciencias_humanas",
  ensino_religioso: "ciencias_humanas",
  ingles: "linguagens",
  artes: "linguagens",
  educacao_fisica: "linguagens",
};

function parseNota(v: string | undefined | null): number | null {
  if (v == null) return null;
  const s = String(v).replace(",", ".").trim();
  if (!s || s === "-") return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0 || n > 10) return null;
  return n;
}

function fmtNota(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1).replace(".", ",");
}

/** Junta duas listas de alunos por id (mantém a ordem da primeira e anexa novos). */
function mergeAlunos(a: AlunoBoletim[], b: AlunoBoletim[]): AlunoBoletim[] {
  const map = new Map<string, AlunoBoletim>();
  for (const x of a) map.set(x.id, x);
  for (const x of b) {
    const cur = map.get(x.id);
    map.set(x.id, cur ? { ...cur, ...x } : x);
  }
  return Array.from(map.values());
}

/**
 * A partir de um Boletim Oficial, produz o mapa por área para um bimestre.
 * Usa a média das notas `ae<bim>` das disciplinas mapeadas em cada área.
 */
function boletimParaAreaBimestre(notasBoletim: NotasBoletimMap, bimestre: number): NotasMap {
  const coluna = `ae${bimestre}`;
  const out: NotasMap = {};
  for (const [alunoId, discs] of Object.entries(notasBoletim ?? {})) {
    // area -> lista de números
    const buckets: Record<string, number[]> = {};
    for (const [discKey, colunas] of Object.entries(discs ?? {})) {
      const area = DISCIPLINA_TO_AREA[discKey];
      if (!area) continue;
      const v = parseNota(colunas?.[coluna]);
      if (v == null) continue;
      (buckets[area] ??= []).push(v);
    }
    for (const [area, arr] of Object.entries(buckets)) {
      if (!arr.length) continue;
      const avg = arr.reduce((s, x) => s + x, 0) / arr.length;
      (out[alunoId] ??= {})[area] = fmtNota(avg);
    }
  }
  return out;
}

/**
 * A partir de um preenchimento Área, produz notas do Boletim (aluno×disciplina×coluna).
 * Cada valor de área é replicado para todas as disciplinas mapeadas naquele bimestre.
 */
function areaParaBoletim(
  dados: ArquivoPreenchimentoDados,
  bimestreLegado?: number,
): NotasBoletimMap {
  const out: NotasBoletimMap = {};
  const aplicar = (bim: number, mapa: NotasMap) => {
    const coluna = `ae${bim}`;
    for (const [alunoId, colunas] of Object.entries(mapa ?? {})) {
      for (const [areaKey, valor] of Object.entries(colunas ?? {})) {
        const v = parseNota(valor);
        if (v == null) continue;
        for (const disc of LEGADO_AREA_TO_DISCIPLINAS[areaKey] ?? []) {
          out[alunoId] ??= {};
          out[alunoId][disc] ??= {};
          out[alunoId][disc][coluna] = fmtNota(v);
        }
      }
    }
  };
  if (dados.notasPorBimestre) {
    for (const [k, mapa] of Object.entries(dados.notasPorBimestre)) {
      const bim = Number(k);
      if (bim >= 1 && bim <= 4) aplicar(bim, mapa);
    }
  }
  if (dados.notas && bimestreLegado && bimestreLegado >= 1 && bimestreLegado <= 4) {
    aplicar(bimestreLegado, dados.notas);
  }
  return out;
}

// Guarda contra recursão + coalescing de calls por preenchimento.
const syncPending = new Map<string, number>();
const syncInFlight = new Set<string>();

function scheduleSyncPaired(sourceId: string): Promise<void> {
  return new Promise((resolve) => {
    const prev = syncPending.get(sourceId);
    if (prev) window.clearTimeout(prev);
    const t = window.setTimeout(async () => {
      syncPending.delete(sourceId);
      try {
        await syncPaired(sourceId);
      } finally {
        resolve();
      }
    }, 1200);
    syncPending.set(sourceId, t);
  });
}

async function syncPaired(sourceId: string): Promise<void> {
  if (syncInFlight.has(sourceId)) return;
  syncInFlight.add(sourceId);
  try {
    const src = await getPreenchimento(sourceId);
    if (src.template_id === BOLETIM_TID) {
      await syncBoletimParaArea(src);
    } else if (src.template_id === AREA_TID) {
      await syncAreaParaBoletim(src);
    }
  } catch (e) {
    logger.warn("[syncPaired] falhou", e);
  } finally {
    syncInFlight.delete(sourceId);
  }
}

async function syncBoletimParaArea(boletim: ArquivoPreenchimento) {
  const notasBoletim = boletim.dados.notasBoletim ?? {};
  for (const bim of [1, 2, 3, 4]) {
    const mapa = boletimParaAreaBimestre(notasBoletim, bim);
    // Busca preenchimento Área para (turma, bim)
    const { data: existing } = await supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from(TABLE as any)
      .select("id, dados, titulo")
      .eq("template_id", AREA_TID)
      .eq("turma_id", boletim.turma_id)
      .eq("bimestre", bim)
      .maybeSingle();

    const temDados = Object.keys(mapa).length > 0;
    if (!existing) {
      if (!temDados) continue;
      const dados: ArquivoPreenchimentoDados = {
        alunos: boletim.dados.alunos,
        notasPorBimestre: { [String(bim)]: mapa },
      };
      await createPreenchimento({
        template_id: AREA_TID,
        turma_id: boletim.turma_id,
        bimestre: bim,
        titulo: `Notas por Área — ${bim}º Bim (auto)`,
        dados,
      });
    } else {
      const cur = existing as unknown as {
        id: string;
        dados: ArquivoPreenchimentoDados;
        titulo: string;
      };
      const porBim = { ...(cur.dados.notasPorBimestre ?? {}) };
      // Reescreve o bimestre inteiro com o que veio do Boletim (fonte da verdade)
      porBim[String(bim)] = mapa;
      const dados: ArquivoPreenchimentoDados = {
        ...cur.dados,
        notasPorBimestre: porBim,
        alunos: mergeAlunos(cur.dados.alunos ?? [], boletim.dados.alunos ?? []),
      };
      await updatePreenchimento(cur.id, { dados }, { skipSync: true });
    }
  }
}

async function syncAreaParaBoletim(area: ArquivoPreenchimento) {
  const derivado = areaParaBoletim(area.dados, area.bimestre);
  // Busca/gera o Boletim único da turma (o primeiro encontrado).
  const { data: existing } = await supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from(TABLE as any)
    .select("id, dados, titulo")
    .eq("template_id", BOLETIM_TID)
    .eq("turma_id", area.turma_id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!existing) {
    if (!Object.keys(derivado).length) return;
    await createPreenchimento({
      template_id: BOLETIM_TID,
      turma_id: area.turma_id,
      bimestre: 1,
      titulo: `Boletim Oficial (auto)`,
      dados: {
        alunos: area.dados.alunos,
        notasBoletim: derivado,
      },
    });
    return;
  }
  const cur = existing as unknown as { id: string; dados: ArquivoPreenchimentoDados };
  const notasAll: NotasBoletimMap = { ...(cur.dados.notasBoletim ?? {}) };
  // Só sobrescreve as colunas ae<bim> que a Área efetivamente produziu.
  // Preserva demais colunas (AQ, REC, MB, PF etc.) do Boletim.
  for (const [alunoId, discs] of Object.entries(derivado)) {
    notasAll[alunoId] = { ...(notasAll[alunoId] ?? {}) };
    for (const [discKey, colunas] of Object.entries(discs)) {
      notasAll[alunoId][discKey] = { ...(notasAll[alunoId][discKey] ?? {}), ...colunas };
    }
  }
  const dados: ArquivoPreenchimentoDados = {
    ...cur.dados,
    notasBoletim: notasAll,
    alunos: mergeAlunos(cur.dados.alunos ?? [], area.dados.alunos ?? []),
  };
  await updatePreenchimento(
    (existing as unknown as { id: string }).id,
    { dados },
    { skipSync: true },
  );
}

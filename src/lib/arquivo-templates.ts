// Registro central dos modelos de arquivos disponíveis no Painel > Acadêmico > Arquivos.

import avaliacaoBimestralAsset from "@/assets/avaliacao-bimestral.docx.asset.json";
import { BOLETIM_COLUNAS_KEYS, type BoletimColunaKey } from "./boletim-calculos";

export type ArquivoTemplateCategoria = "avaliacao" | "planejamento" | "registro" | "comunicado";
import { logger } from "@/lib/logger";

export type ArquivoTemplateColuna = {
  key: string;
  label: string;
  short: string;
};

export type ArquivoTemplate = {
  id: string;
  nome: string;
  descricao: string;
  categoria: ArquivoTemplateCategoria;
  formato: "docx" | "xlsx" | "pdf";
  url: string;
  filename: string;
  size: number;
  campos: string[];
  escopo: "turma" | "escola" | "professor";
  preenchivel?: boolean;
  /** @deprecated: colunas do modelo legado (por área). Boletim oficial usa disciplinas + colunas fixas. */
  colunas?: ArquivoTemplateColuna[];
};

// ---------------- Boletim Oficial ---------------- //

export type BoletimDisciplina = { key: string; label: string; short: string };

export const BOLETIM_DISCIPLINAS: BoletimDisciplina[] = [
  { key: "lingua_portuguesa", label: "Língua Portuguesa", short: "L. Port." },
  { key: "matematica", label: "Matemática", short: "Matem." },
  { key: "historia", label: "História", short: "Hist." },
  { key: "geografia", label: "Geografia", short: "Geog." },
  { key: "ciencias", label: "Ciências", short: "Ciên." },
  { key: "artes", label: "Artes", short: "Artes" },
  { key: "ensino_religioso", label: "Ensino Religioso", short: "E. Rel." },
  { key: "educacao_fisica", label: "Educação Física", short: "E. Fís." },
  { key: "ingles", label: "Língua Estrangeira — Inglês", short: "Inglês" },
  { key: "leitura_producao", label: "Leitura e Produção Textual", short: "Leitura" },
];

export type BoletimColuna = {
  key: BoletimColunaKey;
  label: string;
  short: string;
  grupo: 1 | 2 | 3 | 4 | 5;
};

export const BOLETIM_COLUNAS: BoletimColuna[] = [
  { key: "aq1", label: "1ª Avaliação Qualitativa", short: "1ªAQ", grupo: 1 },
  { key: "ae1", label: "1ª Avaliação Escrita", short: "1ªAE", grupo: 1 },
  { key: "aq2", label: "2ª Avaliação Qualitativa", short: "2ªAQ", grupo: 2 },
  { key: "ae2", label: "2ª Avaliação Escrita", short: "2ªAE", grupo: 2 },
  { key: "rec2", label: "Recuperação — 2º Bim", short: "REC", grupo: 2 },
  { key: "aq3", label: "3ª Avaliação Qualitativa", short: "3ªAQ", grupo: 3 },
  { key: "ae3", label: "3ª Avaliação Escrita", short: "3ªAE", grupo: 3 },
  { key: "aq4", label: "4ª Avaliação Qualitativa", short: "4ªAQ", grupo: 4 },
  { key: "ae4", label: "4ª Avaliação Escrita", short: "4ªAE", grupo: 4 },
  { key: "rec4", label: "Recuperação — 4º Bim", short: "REC", grupo: 4 },
  { key: "pf", label: "Prova Final", short: "PF", grupo: 5 },
];

// Sanity-check: garante que a ordem bate com boletim-calculos.
if (BOLETIM_COLUNAS.map((c) => c.key).join(",") !== BOLETIM_COLUNAS_KEYS.join(",")) {
  // eslint-disable-next-line no-console
  logger.warn("[boletim] BOLETIM_COLUNAS fora de ordem com BOLETIM_COLUNAS_KEYS");
}

// Colunas legadas — mantidas para abrir preenchimentos antigos em modo leitura.
export const AVALIACAO_BIMESTRAL_COLUNAS: ArquivoTemplateColuna[] = [
  { key: "lingua_portuguesa", label: "Língua Portuguesa (II Simulado SAEPI)", short: "L. Port." },
  { key: "linguagens", label: "Linguagens (IN / AR / E.F)", short: "Ling." },
  { key: "ciencias_humanas", label: "Ciências Humanas (HI / GE / E.R)", short: "C. Hum." },
  { key: "matematica", label: "Matemática (II Simulado SAEPI)", short: "Matem." },
  { key: "ciencias_natureza", label: "Ciências da Natureza", short: "C. Nat." },
  { key: "producao_texto", label: "Produção de Texto", short: "Prod. Texto" },
];

export const ARQUIVO_TEMPLATES: ArquivoTemplate[] = [
  {
    id: "avaliacao-bimestral",
    nome: "Boletim Escolar Oficial — SEMED Assunção do Piauí",
    descricao:
      "Modelo oficial da Secretaria Municipal de Educação de Assunção do Piauí. Registra AQ + AE de cada bimestre, recuperações do 2º e 4º bimestre, prova final e calcula média final e resultado automaticamente.",
    categoria: "avaliacao",
    formato: "docx",
    url: avaliacaoBimestralAsset.url,
    filename: "boletim-escolar.docx",
    size: avaliacaoBimestralAsset.size,
    campos: [
      "Dados do aluno (INEP, sexo, nascimento, filiação)",
      "10 disciplinas × 11 avaliações (AQ · AE · REC · PF)",
      "Média final e resultado calculados",
      "Carga horária e assinaturas",
    ],
    escopo: "turma",
    preenchivel: true,
  },
  {
    id: "notas-por-area",
    nome: "Notas Por Área de Conhecimento",
    descricao:
      "Modelo simplificado por área do conhecimento (Língua Portuguesa, Matemática, Linguagens, Ciências Humanas, Ciências da Natureza e Produção de Texto). Um preenchimento por bimestre com uma nota por área.",
    categoria: "avaliacao",
    formato: "docx",
    url: avaliacaoBimestralAsset.url,
    filename: "notas-por-area.docx",
    size: avaliacaoBimestralAsset.size,
    campos: [
      "Nome do aluno e turma",
      "6 áreas do conhecimento × 1 nota por bimestre",
      "Um preenchimento por bimestre",
    ],
    escopo: "turma",
    preenchivel: true,
    colunas: AVALIACAO_BIMESTRAL_COLUNAS,
  },
];

export function getArquivoTemplate(id: string): ArquivoTemplate | undefined {
  return ARQUIVO_TEMPLATES.find((t) => t.id === id);
}

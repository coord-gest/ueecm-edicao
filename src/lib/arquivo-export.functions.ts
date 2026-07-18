import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  AlignmentType,
  WidthType,
  BorderStyle,
  ShadingType,
  PageOrientation,
  PageBreak,
} from "docx";

// ------------------------------------------------------------- //
//  Boletim Oficial (SEMED Assunção do Piauí) — .docx por aluno.
// ------------------------------------------------------------- //

type AlunoInput = {
  id: string;
  nome: string;
  matricula?: string | null;
  inep?: string | null;
  sexo?: string | null;
  nascimento?: string | null;
  mae?: string | null;
  pai?: string | null;
};

type BoletimInput = {
  turmaNome: string;
  anoSerie: string;
  turno: string;
  anoLetivo: number | string;
  alunos: AlunoInput[];
  /** alunoId -> disciplinaKey -> colunaKey -> valor. */
  notasBoletim: Record<string, Record<string, Record<string, string>>>;
  observacoes?: string;
};

const DISCIPLINAS: { key: string; label: string }[] = [
  { key: "lingua_portuguesa", label: "LÍNGUA PORTUGUESA" },
  { key: "matematica", label: "MATEMÁTICA" },
  { key: "historia", label: "HISTÓRIA" },
  { key: "geografia", label: "GEOGRAFIA" },
  { key: "ciencias", label: "CIÊNCIAS" },
  { key: "artes", label: "ARTES" },
  { key: "ensino_religioso", label: "ENSINO RELIGIOSO" },
  { key: "educacao_fisica", label: "EDUCAÇÃO FÍSICA" },
  { key: "ingles", label: "LÍNGUA ESTRANGEIRA — INGLÊS" },
  { key: "leitura_producao", label: "LEITURA E PRODUÇÃO TEXTUAL" },
];

const COLUNAS: { key: string; short: string }[] = [
  { key: "aq1", short: "1ªAQ" },
  { key: "ae1", short: "1ªAE" },
  { key: "aq2", short: "2ªAQ" },
  { key: "ae2", short: "2ªAE" },
  { key: "rec2", short: "REC." },
  { key: "aq3", short: "3ªAQ" },
  { key: "ae3", short: "3ªAE" },
  { key: "aq4", short: "4ªAQ" },
  { key: "ae4", short: "4ªAE" },
  { key: "rec4", short: "REC." },
  { key: "pf", short: "PF" },
];

// ---------- Cálculos (espelham src/lib/boletim-calculos.ts). ---------- //
function parseNota(v: string | undefined | null): number | null {
  if (v == null) return null;
  const s = String(v).trim().replace(",", ".");
  if (!s || s === "-") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
function fmtNota(n: number | null) {
  if (n == null) return "";
  return (Math.round(n * 10) / 10).toFixed(1).replace(".", ",");
}
function mediaBim(aq: number | null, ae: number | null, rec: number | null) {
  if (aq == null && ae == null && rec == null) return null;
  const base = ((aq ?? 0) + (ae ?? 0)) / 2;
  return rec != null ? Math.max(base, rec) : base;
}
function calcularMediaFinal(n: Record<string, string>) {
  const b1 = mediaBim(parseNota(n.aq1), parseNota(n.ae1), null);
  const b2 = mediaBim(parseNota(n.aq2), parseNota(n.ae2), parseNota(n.rec2));
  const b3 = mediaBim(parseNota(n.aq3), parseNota(n.ae3), null);
  const b4 = mediaBim(parseNota(n.aq4), parseNota(n.ae4), parseNota(n.rec4));
  if ([b1, b2, b3, b4].every((x) => x == null)) return null;
  const mf = ((b1 ?? 0) + (b2 ?? 0) + (b3 ?? 0) + (b4 ?? 0)) / 4;
  const pf = parseNota(n.pf);
  return pf != null ? (mf + pf) / 2 : mf;
}
function calcularResultado(n: Record<string, string>) {
  const b1 = mediaBim(parseNota(n.aq1), parseNota(n.ae1), null);
  const b2 = mediaBim(parseNota(n.aq2), parseNota(n.ae2), parseNota(n.rec2));
  const b3 = mediaBim(parseNota(n.aq3), parseNota(n.ae3), null);
  const b4 = mediaBim(parseNota(n.aq4), parseNota(n.ae4), parseNota(n.rec4));
  const completo = [b1, b2, b3, b4].every((x) => x != null);
  const mf = calcularMediaFinal(n);
  if (mf == null) return "CURSANDO";
  if (!completo) {
    if ([b1, b2, b3, b4].some((x) => x != null && x < 3)) return "EM RECUPERAÇÃO PARCIAL";
    return "CURSANDO";
  }
  if (mf >= 6) return "APROVADO";
  if (mf >= 4) return "EM RECUPERAÇÃO PARCIAL";
  return "REPROVADO";
}

// ---------- Helpers docx ---------- //
const B = { style: BorderStyle.SINGLE, size: 4, color: "666666" };
const BORDERS = { top: B, bottom: B, left: B, right: B };

/** Retorna cor de shading (BG, texto) baseada no valor da nota. */
function coresPorNota(
  v: string | number | null | undefined,
): { fill: string; color: string } | null {
  const n = typeof v === "number" ? v : parseNota(typeof v === "string" ? v : null);
  if (n == null) return null;
  if (n >= 7) return { fill: "C6EFCE", color: "0B6B2B" }; // verde
  if (n >= 5) return { fill: "FFEB9C", color: "8A6A00" }; // amarelo
  return { fill: "FFC7CE", color: "9C0006" }; // vermelho
}

function tCell(
  text: string,
  opts: {
    bold?: boolean;
    header?: boolean;
    rowSpan?: number;
    colSpan?: number;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    size?: number;
    fill?: string;
    color?: string;
  } = {},
) {
  const shadeFill = opts.fill ?? (opts.header ? "1F4E78" : undefined);
  const runColor = opts.color ?? (opts.header ? "FFFFFF" : undefined);
  return new TableCell({
    borders: BORDERS,
    rowSpan: opts.rowSpan,
    columnSpan: opts.colSpan,
    shading: shadeFill ? { fill: shadeFill, type: ShadingType.CLEAR, color: "auto" } : undefined,
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    children: [
      new Paragraph({
        alignment: opts.align ?? AlignmentType.CENTER,
        children: [
          new TextRun({
            text,
            bold: opts.bold || opts.header,
            size: opts.size ?? 14,
            color: runColor,
          }),
        ],
      }),
    ],
  });
}

/** Retorna o rótulo de conceito baseado na média final. */
function conceitoDe(mf: number | null): { label: string; fill: string; color: string } {
  if (mf == null) return { label: "—", fill: "F2F2F2", color: "595959" };
  if (mf >= 9) return { label: "EXCELENTE", fill: "0B6B2B", color: "FFFFFF" };
  if (mf >= 7) return { label: "BOM", fill: "70AD47", color: "FFFFFF" };
  if (mf >= 6) return { label: "SATISFATÓRIO", fill: "FFC000", color: "3B2E00" };
  if (mf >= 4) return { label: "REGULAR", fill: "ED7D31", color: "FFFFFF" };
  return { label: "INSUFICIENTE", fill: "C00000", color: "FFFFFF" };
}

/** Tabela de barras de desempenho: 10 células por disciplina, coloridas até a média. */
function tabelaDesempenho(input: BoletimInput, aluno: AlunoInput) {
  const notasAluno = input.notasBoletim[aluno.id] ?? {};
  const larguraDisc = 3200;
  const larguraMedia = 900;
  const larguraCel = 830;
  const totalW = larguraDisc + larguraMedia + larguraCel * 10 + 900; // + conceito

  const header = new TableRow({
    tableHeader: true,
    children: [
      tCell("COMPONENTE", { header: true, align: AlignmentType.LEFT }),
      tCell("MÉDIA", { header: true }),
      tCell("DESEMPENHO (0 → 10)", { header: true, colSpan: 10 }),
      tCell("CONCEITO", { header: true }),
    ],
  });

  const linhas = DISCIPLINAS.map((d) => {
    const n = notasAluno[d.key] ?? {};
    const mf = calcularMediaFinal(n);
    const preenchidas = mf == null ? 0 : Math.round(Math.max(0, Math.min(10, mf)));
    const cor = mf == null ? "E7E6E6" : mf >= 7 ? "70AD47" : mf >= 5 ? "FFC000" : "C00000";
    const conc = conceitoDe(mf);
    const barra = Array.from({ length: 10 }).map((_, i) =>
      tCell(" ", { fill: i < preenchidas ? cor : "F2F2F2", size: 10 }),
    );
    return new TableRow({
      children: [
        tCell(d.label, { align: AlignmentType.LEFT, size: 13 }),
        tCell(fmtNota(mf), { bold: true, size: 14 }),
        ...barra,
        tCell(conc.label, { bold: true, size: 11, fill: conc.fill, color: conc.color }),
      ],
    });
  });

  return new Table({
    width: { size: totalW, type: WidthType.DXA },
    columnWidths: [
      larguraDisc,
      larguraMedia,
      ...Array.from({ length: 10 }).map(() => larguraCel),
      900,
    ],
    rows: [header, ...linhas],
  });
}

function paragrafoInfo(chunks: Array<{ label: string; value: string }>) {
  const runs: TextRun[] = [];
  chunks.forEach((c, i) => {
    if (i > 0) runs.push(new TextRun({ text: "     " }));
    runs.push(new TextRun({ text: `${c.label}: `, bold: true, size: 18 }));
    runs.push(new TextRun({ text: c.value || "—", size: 18 }));
  });
  return new Paragraph({ children: runs, spacing: { after: 60 } });
}

function boletimDeAluno(input: BoletimInput, aluno: AlunoInput, pageBreakBefore: boolean) {
  const notasAluno = input.notasBoletim[aluno.id] ?? {};

  // Cabeçalho da tabela: linha 1 (mescla) + linha 2 (colunas)
  const header1 = new TableRow({
    tableHeader: true,
    children: [
      tCell("COMPONENTE CURRICULAR", { header: true, rowSpan: 2, align: AlignmentType.LEFT }),
      tCell("AVALIAÇÕES", { header: true, colSpan: COLUNAS.length }),
      tCell("MÉDIA FINAL", { header: true, rowSpan: 2 }),
      tCell("RESULTADO", { header: true, rowSpan: 2 }),
    ],
  });
  const header2 = new TableRow({
    tableHeader: true,
    children: COLUNAS.map((c) => tCell(c.short, { header: true, size: 12 })),
  });

  const linhas = DISCIPLINAS.map((d, idx) => {
    const n = notasAluno[d.key] ?? {};
    const mf = calcularMediaFinal(n);
    const res = calcularResultado(n);
    const stripe = idx % 2 === 0 ? "FFFFFF" : "F7F9FC";
    const mfCor = coresPorNota(mf);
    const resFill =
      res === "APROVADO"
        ? "70AD47"
        : res === "REPROVADO"
          ? "C00000"
          : res === "EM RECUPERAÇÃO PARCIAL"
            ? "FFC000"
            : "BFBFBF";
    const resColor = res === "EM RECUPERAÇÃO PARCIAL" ? "3B2E00" : "FFFFFF";
    return new TableRow({
      children: [
        tCell(d.label, { align: AlignmentType.LEFT, size: 14, fill: stripe, bold: true }),
        ...COLUNAS.map((c) => {
          const v = n[c.key] || "";
          const cor = coresPorNota(v);
          return tCell(v || "-", {
            size: 14,
            fill: cor?.fill ?? stripe,
            color: cor?.color,
            bold: !!cor,
          });
        }),
        tCell(fmtNota(mf), {
          bold: true,
          size: 15,
          fill: mfCor?.fill ?? stripe,
          color: mfCor?.color,
        }),
        tCell(res, { size: 11, bold: true, fill: resFill, color: resColor }),
      ],
    });
  });

  const table = new Table({
    width: { size: 14400, type: WidthType.DXA },
    rows: [header1, header2, ...linhas],
  });

  // Legenda de cores
  const legenda = new Paragraph({
    spacing: { before: 160, after: 80 },
    children: [
      new TextRun({ text: "Legenda das notas: ", bold: true, size: 14 }),
      new TextRun({ text: " ≥ 7,0 ", size: 14, highlight: "green" }),
      new TextRun({ text: " Bom desempenho     ", size: 14 }),
      new TextRun({ text: " 5,0 – 6,9 ", size: 14, highlight: "yellow" }),
      new TextRun({ text: " Atenção     ", size: 14 }),
      new TextRun({ text: " < 5,0 ", size: 14, highlight: "red" }),
      new TextRun({ text: " Necessita reforço", size: 14 }),
    ],
  });

  const children: (Paragraph | Table)[] = [];
  if (pageBreakBefore) {
    children.push(new Paragraph({ children: [new PageBreak()] }));
  }

  return [
    ...children,
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: "PREFEITURA MUNICIPAL DE ASSUNÇÃO DO PIAUÍ", bold: true, size: 22 }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "SECRETARIA MUNICIPAL DE EDUCAÇÃO", size: 18 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "UNID ESC EVARISTO CAMPELO DE MATOS", size: 18 })],
      spacing: { after: 120 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: `BOLETIM ESCOLAR — ${input.anoLetivo}`, bold: true, size: 24 }),
      ],
      spacing: { after: 200 },
    }),
    paragrafoInfo([
      { label: aluno.sexo === "MASCULINO" ? "ALUNO" : "ALUNA", value: aluno.nome },
      { label: "INEP", value: aluno.inep ?? "" },
      { label: "SEXO", value: aluno.sexo ?? "" },
      { label: "NASCIMENTO", value: aluno.nascimento ?? "" },
    ]),
    paragrafoInfo([
      { label: "MÃE", value: aluno.mae ?? "" },
      { label: "PAI", value: aluno.pai ?? "" },
    ]),
    paragrafoInfo([
      { label: "CURSO", value: "NORMAL" },
      { label: "MODALIDADE", value: "ENSINO REGULAR" },
    ]),
    paragrafoInfo([
      { label: "TURMA", value: input.turmaNome },
      { label: "ETAPA", value: input.anoSerie },
      { label: "TURNO", value: input.turno },
      { label: "DIAS LETIVOS", value: "200" },
    ]),
    new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: "" })] }),
    table,
    legenda,
    new Paragraph({
      spacing: { before: 220, after: 100 },
      children: [
        new TextRun({
          text: "DESEMPENHO POR COMPONENTE CURRICULAR",
          bold: true,
          size: 20,
          color: "1F4E78",
        }),
      ],
    }),
    tabelaDesempenho(input, aluno),
    new Paragraph({
      spacing: { before: 200 },
      children: [
        new TextRun({ text: "CARGA HORÁRIA: ", bold: true, size: 18 }),
        new TextRun({ text: "800 h     ", size: 18 }),
        new TextRun({ text: "RESULTADO: ", bold: true, size: 18 }),
        new TextRun({ text: "CURSANDO", size: 18 }),
      ],
    }),
    new Paragraph({
      spacing: { before: 600 },
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: "________________________________          ________________________________",
          size: 18,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: "SECRETÁRIO(A) ESCOLAR                              DIRETOR(A) ESCOLAR",
          size: 16,
        }),
      ],
    }),
  ];
}

export const exportBoletimOficial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: BoletimInput) => {
    // S3: limites anti-DoS. Sem cap, um payload malicioso com 10k alunos
    // travaria o Worker por segundos gerando DOCX.
    if (!data || typeof data !== "object") throw new Error("Payload inválido");
    if (!Array.isArray(data.alunos) || data.alunos.length === 0) {
      throw new Error("Lista de alunos vazia");
    }
    if (data.alunos.length > 60) {
      throw new Error("Máximo de 60 alunos por exportação");
    }
    return data;
  })
  .handler(async ({ data, context }) => {
    const { data: isStaff, error: roleError } = await context.supabase.rpc(
      "is_professor_or_staff",
      { _user_id: context.userId },
    );
    if (roleError) throw roleError;
    if (!isStaff) throw new Error("Acesso restrito à equipe da escola.");

    const children = data.alunos.flatMap((aluno, i) => boletimDeAluno(data, aluno, i > 0));

    const doc = new Document({
      styles: { default: { document: { run: { font: "Arial", size: 18 } } } },
      sections: [
        {
          properties: {
            page: {
              size: { width: 12240, height: 15840, orientation: PageOrientation.LANDSCAPE },
              margin: { top: 720, right: 720, bottom: 720, left: 720 },
            },
          },
          children,
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    const base = data.turmaNome.replace(/\s+/g, "-").toLowerCase() || "turma";
    const filename =
      data.alunos.length === 1
        ? `boletim-${base}-${data.alunos[0].nome.split(" ")[0].toLowerCase()}.docx`
        : `boletins-${base}.docx`;
    return {
      base64: Buffer.from(buffer).toString("base64"),
      filename,
    };
  });

// ------------------------------------------------------------- //
//  Notas Por Área de Conhecimento — modelo simples (1 nota/área)
// ------------------------------------------------------------- //

type NotasAreaInput = {
  turmaNome: string;
  anoSerie: string;
  turno: string;
  anoLetivo: number | string;
  bimestre: number;
  alunos: { id: string; nome: string }[];
  /** alunoId -> areaKey -> valor */
  notas?: Record<string, Record<string, string>>;
};

const AREAS_NOTAS: {
  key: string;
  label: string;
  short: string;
  headerFill: string;
  cellFill: string;
  headerColor: string;
}[] = [
  {
    key: "lingua_portuguesa",
    label: "Língua Portuguesa (II Simulado SAEPI)",
    short: "L. Port.",
    headerFill: "C00000",
    cellFill: "FCE4E4",
    headerColor: "FFFFFF",
  },
  {
    key: "linguagens",
    label: "Linguagens (IN / AR / E.F)",
    short: "Ling.",
    headerFill: "7030A0",
    cellFill: "EDE1F5",
    headerColor: "FFFFFF",
  },
  {
    key: "ciencias_humanas",
    label: "Ciências Humanas (HI / GE / E.R)",
    short: "C. Hum.",
    headerFill: "BF8F00",
    cellFill: "FFF4CC",
    headerColor: "FFFFFF",
  },
  {
    key: "matematica",
    label: "Matemática (II Simulado SAEPI)",
    short: "Matem.",
    headerFill: "1F4E78",
    cellFill: "DEEBF7",
    headerColor: "FFFFFF",
  },
  {
    key: "ciencias_natureza",
    label: "Ciências da Natureza",
    short: "C. Nat.",
    headerFill: "548235",
    cellFill: "E2F0D9",
    headerColor: "FFFFFF",
  },
  {
    key: "producao_texto",
    label: "Produção de Texto",
    short: "Prod. Texto",
    headerFill: "C65911",
    cellFill: "FBE5D6",
    headerColor: "FFFFFF",
  },
];

function txtCell(
  text: string,
  opts: {
    bold?: boolean;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    shade?: string;
    color?: string;
    width: number;
    size?: number;
  } = { width: 1000 },
) {
  return new TableCell({
    width: { size: opts.width, type: WidthType.DXA },
    shading: opts.shade ? { fill: opts.shade, type: ShadingType.CLEAR, color: "auto" } : undefined,
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
      left: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
      right: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
    },
    children: [
      new Paragraph({
        alignment: opts.align ?? AlignmentType.LEFT,
        children: [
          new TextRun({ text, bold: opts.bold, size: opts.size ?? 18, color: opts.color }),
        ],
      }),
    ],
  });
}

export const exportNotasPorArea = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: NotasAreaInput) => {
    if (!data || typeof data !== "object") throw new Error("Payload inválido");
    if (!Array.isArray(data.alunos) || data.alunos.length === 0) {
      throw new Error("Lista de alunos vazia");
    }
    if (data.alunos.length > 60) {
      throw new Error("Máximo de 60 alunos por exportação");
    }
    return data;
  })
  .handler(async ({ data, context }) => {
    const { data: isStaff, error: roleError } = await context.supabase.rpc(
      "is_professor_or_staff",
      { _user_id: context.userId },
    );
    if (roleError) throw roleError;
    if (!isStaff) throw new Error("Acesso restrito à equipe da escola.");

    const nomeW = 4200;
    const numW = 700;
    const areaW = 1240;
    const totalW = numW + nomeW + areaW * AREAS_NOTAS.length; // 4200 + 700 + 6*1240 = 12340

    const headerBim = new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: "U.E. Educandário Espírito Santo — CENTRO DE MÚLTIPLO USO",
          bold: true,
          size: 20,
        }),
      ],
    });
    const headerSub = new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `NOTAS POR ÁREA DE CONHECIMENTO — ${data.bimestre}º BIMESTRE / ${data.anoLetivo}`,
          bold: true,
          size: 22,
        }),
      ],
    });
    const headerTurma = new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [
        new TextRun({
          text: `Turma: ${data.turmaNome}${data.anoSerie ? ` • ${data.anoSerie}` : ""}${data.turno ? ` • ${data.turno}` : ""}`,
          size: 18,
        }),
      ],
    });

    const headerRow = new TableRow({
      tableHeader: true,
      children: [
        txtCell("Nº", {
          bold: true,
          align: AlignmentType.CENTER,
          shade: "1F4E78",
          color: "FFFFFF",
          width: numW,
        }),
        txtCell("ALUNO(A)", { bold: true, shade: "1F4E78", color: "FFFFFF", width: nomeW }),
        ...AREAS_NOTAS.map((a) =>
          txtCell(a.short, {
            bold: true,
            align: AlignmentType.CENTER,
            shade: a.headerFill,
            color: a.headerColor,
            width: areaW,
          }),
        ),
      ],
    });

    const alunos =
      data.alunos.length > 0
        ? data.alunos
        : Array.from({ length: 30 }).map((_, i) => ({ id: `x${i}`, nome: "" }));

    const dataRows = alunos.map((aluno, i) => {
      const stripe = i % 2 === 0 ? undefined : "F7F9FC";
      return new TableRow({
        children: [
          txtCell(String(i + 1), { align: AlignmentType.CENTER, width: numW, shade: stripe }),
          txtCell(aluno.nome, { width: nomeW, shade: stripe }),
          ...AREAS_NOTAS.map((a) => {
            const v = data.notas?.[aluno.id]?.[a.key] ?? "";
            const notaCores = coresPorNota(v);
            return txtCell(v, {
              align: AlignmentType.CENTER,
              width: areaW,
              shade: notaCores?.fill ?? a.cellFill,
              color: notaCores?.color,
              bold: !!notaCores,
            });
          }),
        ],
      });
    });

    const legenda = new Paragraph({
      spacing: { before: 240 },
      children: [
        new TextRun({
          text: "Legenda: " + AREAS_NOTAS.map((a) => `${a.short} = ${a.label}`).join(" • "),
          size: 16,
          italics: true,
        }),
      ],
    });

    const legendaNotas = new Paragraph({
      spacing: { before: 80 },
      children: [
        new TextRun({ text: "Desempenho: ", bold: true, size: 16 }),
        new TextRun({ text: " ≥ 7,0 Bom ", size: 16, highlight: "green" }),
        new TextRun({ text: "   " }),
        new TextRun({ text: " 5,0 – 6,9 Atenção ", size: 16, highlight: "yellow" }),
        new TextRun({ text: "   " }),
        new TextRun({ text: " < 5,0 Reforço ", size: 16, highlight: "red" }),
      ],
    });

    const assinatura = new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 480 },
      children: [new TextRun({ text: "_______________________________________", size: 18 })],
    });
    const assinaturaLabel = new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "Professor(a) responsável", size: 16 })],
    });

    const doc = new Document({
      styles: { default: { document: { run: { font: "Arial", size: 18 } } } },
      sections: [
        {
          properties: {
            page: {
              size: { width: 12240, height: 15840, orientation: PageOrientation.LANDSCAPE },
              margin: { top: 720, right: 720, bottom: 720, left: 720 },
            },
          },
          children: [
            headerBim,
            headerSub,
            headerTurma,
            new Table({
              width: { size: totalW, type: WidthType.DXA },
              columnWidths: [numW, nomeW, ...AREAS_NOTAS.map(() => areaW)],
              rows: [headerRow, ...dataRows],
            }),
            legenda,
            legendaNotas,
            assinatura,
            assinaturaLabel,
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    const base = data.turmaNome.replace(/\s+/g, "-").toLowerCase() || "turma";
    return {
      base64: Buffer.from(buffer).toString("base64"),
      filename: `notas-por-area-${base}-${data.bimestre}bim.docx`,
    };
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const generateBoletim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({ alunoId: z.string().uuid(), bimestre: z.number().int().min(1).max(4).nullable() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");

    const { data: aluno, error: aErr } = await supabase
      .from("alunos")
      .select(
        "id, nome_completo, matricula, data_nascimento, turma_id, turmas_escolares(nome, ano_serie, turno, ano_letivo)",
      )
      .eq("id", data.alunoId)
      .maybeSingle();
    if (aErr || !aluno) throw new Error(aErr?.message ?? "Aluno não encontrado ou sem permissão");

    let notasQ = supabase
      .from("notas")
      .select("disciplina, bimestre, valor, observacao")
      .eq("aluno_id", data.alunoId);
    if (data.bimestre) notasQ = notasQ.eq("bimestre", data.bimestre);
    const { data: notas } = await notasQ.order("disciplina").order("bimestre");

    const { data: freq } = await supabase
      .from("frequencia")
      .select("presente")
      .eq("aluno_id", data.alunoId);
    const total = freq?.length ?? 0;
    const presentes = freq?.filter((f) => f.presente).length ?? 0;
    const pctFreq = total > 0 ? Math.round((presentes / total) * 100) : null;

    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const draw = (t: string, x: number, y: number, size = 11, f = font, color = rgb(0, 0, 0)) =>
      page.drawText(t, { x, y, size, font: f, color });

    const turma = (
      aluno as {
        turmas_escolares: {
          nome: string;
          ano_serie: string | null;
          turno: string | null;
          ano_letivo: number;
        } | null;
      }
    ).turmas_escolares;

    draw("BOLETIM ESCOLAR", 40, 800, 18, bold);
    draw(`Bimestre: ${data.bimestre ?? "Todos"}`, 400, 800, 11, bold);
    draw(`Aluno: ${aluno.nome_completo}`, 40, 770, 12, bold);
    draw(`Matrícula: ${aluno.matricula}`, 40, 752);
    draw(
      `Turma: ${turma?.nome ?? "—"}  |  Ano: ${turma?.ano_serie ?? "—"}  |  Turno: ${turma?.turno ?? "—"}`,
      40,
      736,
    );
    if (pctFreq !== null) draw(`Frequência geral: ${pctFreq}%  (${presentes}/${total})`, 40, 720);

    // Table header
    let y = 680;
    draw("Disciplina", 40, y, 11, bold);
    draw("Bim.", 320, y, 11, bold);
    draw("Nota", 380, y, 11, bold);
    draw("Obs.", 440, y, 11, bold);
    page.drawLine({ start: { x: 40, y: y - 4 }, end: { x: 555, y: y - 4 }, thickness: 0.5 });
    y -= 22;
    for (const n of notas ?? []) {
      if (y < 60) {
        y = 800;
        pdf.addPage();
      }
      draw(String(n.disciplina ?? "—").slice(0, 40), 40, y);
      draw(String(n.bimestre), 320, y);
      draw(n.valor != null ? Number(n.valor).toFixed(1) : "—", 380, y);
      draw(String(n.observacao ?? "").slice(0, 25), 440, y, 9);
      y -= 18;
    }
    if ((notas ?? []).length === 0) draw("Nenhuma nota lançada.", 40, y);

    const bytes = await pdf.save();
    const base64 = Buffer.from(bytes).toString("base64");
    return { filename: `boletim-${aluno.matricula}.pdf`, base64, userId: context.userId };
  });

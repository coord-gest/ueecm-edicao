import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  tableName: z.string().optional(),
  action: z.string().optional(),
  actor: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

/** Gera um PDF com os eventos de auditoria filtrados. */
export const exportAuditPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => inputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: isAdmin } = await supabase.rpc("is_school_admin", {
      _user_id: userId,
    });
    if (!isAdmin) throw new Error("Acesso restrito ao log de auditoria.");

    let q = supabase
      .from("audit_logs")
      .select("created_at, actor_email, table_name, action, record_id")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (data.tableName && data.tableName !== "todas") q = q.eq("table_name", data.tableName);
    if (data.action && data.action !== "todas") q = q.eq("action", data.action);
    if (data.actor) q = q.ilike("actor_email", `%${data.actor}%`);
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", data.to);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    let page = pdf.addPage([842, 595]); // A4 landscape
    const draw = (t: string, x: number, y: number, size = 9, f = font) =>
      page.drawText(t, { x, y, size, font: f, color: rgb(0, 0, 0) });

    draw("Log de Auditoria", 40, 560, 16, bold);
    draw(
      `Filtros: tabela=${data.tableName ?? "todas"} • ação=${data.action ?? "todas"} • ator=${data.actor ?? "—"} • período=${data.from ?? "—"} → ${data.to ?? "—"}`,
      40,
      540,
      9,
    );
    draw(`Total: ${rows?.length ?? 0} registro(s)`, 40, 525, 9);

    let y = 500;
    draw("Quando", 40, y, 9, bold);
    draw("Ator", 170, y, 9, bold);
    draw("Tabela", 380, y, 9, bold);
    draw("Ação", 500, y, 9, bold);
    draw("Registro", 580, y, 9, bold);
    y -= 14;

    for (const r of rows ?? []) {
      if (y < 40) {
        page = pdf.addPage([842, 595]);
        y = 560;
      }
      draw(new Date(r.created_at as string).toLocaleString("pt-BR"), 40, y);
      draw(String(r.actor_email ?? "—").slice(0, 38), 170, y);
      draw(String(r.table_name ?? "—").slice(0, 22), 380, y);
      draw(String(r.action ?? "—"), 500, y);
      draw(String(r.record_id ?? "—").slice(0, 32), 580, y);
      y -= 12;
    }

    const bytes = await pdf.save();
    const base64 = Buffer.from(bytes).toString("base64");
    return { filename: `auditoria-${new Date().toISOString().slice(0, 10)}.pdf`, base64 };
  });

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ComunicadoSemConfirmacao = {
  id: string;
  titulo: string;
  created_at: string;
  tipo: string;
  turma_id: string | null;
  aluno_id: string | null;
  alerta_gestao_apos_horas: number | null;
  horas_desde_envio: number;
  total_esperado: number;
  total_confirmado: number;
};

/**
 * Lista comunicados com requer_confirmacao=true cujo prazo de alerta
 * à gestão já expirou (ou está próximo). Apenas equipe da escola pode ver.
 */
export const listarComunicadosSemConfirmacao = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const staffRoles = ["admin", "diretor", "coordenador", "secretario", "desenvolvedor"];
    const isStaff = (roles ?? []).some((r) => staffRoles.includes(r.role as string));
    if (!isStaff) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: comunicados, error } = await supabaseAdmin
      .from("comunicados")
      .select("id, titulo, created_at, tipo, turma_id, aluno_id, alerta_gestao_apos_horas")
      .eq("requer_confirmacao", true)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;

    const items: ComunicadoSemConfirmacao[] = [];
    for (const c of comunicados ?? []) {
      const horas = (Date.now() - new Date(c.created_at).getTime()) / 36e5;

      // Total esperado: responsáveis dos alunos alvo
      let alunoIds: string[] = [];
      if (c.tipo === "individual" && c.aluno_id) {
        alunoIds = [c.aluno_id];
      } else if (c.turma_id) {
        const { data: alunos } = await supabaseAdmin
          .from("alunos")
          .select("id")
          .eq("turma_id", c.turma_id)
          .eq("ativo", true);
        alunoIds = (alunos ?? []).map((a) => a.id);
      }

      let totalEsperado = 0;
      if (alunoIds.length) {
        const { data: links } = await supabaseAdmin
          .from("aluno_responsavel")
          .select("responsavel_id")
          .in("aluno_id", alunoIds);
        totalEsperado = new Set((links ?? []).map((l) => l.responsavel_id)).size;
      }

      const { count: totalConfirmado } = await supabaseAdmin
        .from("comunicado_leituras")
        .select("id", { count: "exact", head: true })
        .eq("comunicado_id", c.id)
        .not("confirmado_em", "is", null);

      items.push({
        id: c.id,
        titulo: c.titulo,
        created_at: c.created_at,
        tipo: c.tipo,
        turma_id: c.turma_id,
        aluno_id: c.aluno_id,
        alerta_gestao_apos_horas: c.alerta_gestao_apos_horas,
        horas_desde_envio: Math.round(horas),
        total_esperado: totalEsperado,
        total_confirmado: totalConfirmado ?? 0,
      });
    }

    return items;
  });

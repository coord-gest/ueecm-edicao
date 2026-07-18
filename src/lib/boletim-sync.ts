// Sincroniza notas do Boletim Oficial (guardadas no JSON do preenchimento)
// com a tabela `public.notas`, que alimenta relatórios como o Relatório
// Acadêmico por turma/aluno.
//
// Estratégia: para cada aluno do preenchimento, apagamos as linhas da tabela
// `notas` cujas disciplinas pertencem ao Boletim Oficial (1..4 bimestres),
// e reinserimos os valores calculados. Outras disciplinas ficam intactas.

import { supabase } from "@/integrations/supabase/client";
import type { NotasBoletimMap } from "./arquivo-preenchimentos";
import { BOLETIM_DISCIPLINAS } from "./arquivo-templates";
import { calcularBimestres } from "./boletim-calculos";

const DISCIPLINAS_KEYS = BOLETIM_DISCIPLINAS.map((d) => d.key);

export async function syncBoletimToNotasTable(
  alunoIds: string[],
  notasBoletim: NotasBoletimMap,
): Promise<{ inseridas: number }> {
  if (alunoIds.length === 0) return { inseridas: 0 };

  // Limpa somente as disciplinas do boletim oficial para estes alunos.
  const { error: delErr } = await supabase
    .from("notas")
    .delete()
    .in("aluno_id", alunoIds)
    .in("disciplina", DISCIPLINAS_KEYS);
  if (delErr) throw delErr;

  const rows: Array<{
    aluno_id: string;
    disciplina: string;
    bimestre: number;
    valor: number;
  }> = [];

  for (const alunoId of alunoIds) {
    const porDisc = notasBoletim[alunoId] ?? {};
    for (const disc of DISCIPLINAS_KEYS) {
      const n = porDisc[disc];
      if (!n) continue;
      const { b1, b2, b3, b4 } = calcularBimestres(n);
      const pares: Array<[number, number | null]> = [
        [1, b1],
        [2, b2],
        [3, b3],
        [4, b4],
      ];
      for (const [bim, valor] of pares) {
        if (valor == null || !Number.isFinite(valor)) continue;
        rows.push({
          aluno_id: alunoId,
          disciplina: disc,
          bimestre: bim,
          valor: Math.round(valor * 100) / 100,
        });
      }
    }
  }

  if (rows.length === 0) return { inseridas: 0 };

  const { error: insErr } = await supabase.from("notas").insert(rows);
  if (insErr) throw insErr;
  return { inseridas: rows.length };
}

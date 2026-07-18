import { BOLETIM_COLUNAS, BOLETIM_DISCIPLINAS } from "@/lib/arquivo-templates";
import type { AlunoBoletim, ArquivoPreenchimentoDados } from "@/lib/arquivo-preenchimentos";
import { calcularMediaFinal, calcularResultado, fmtNota } from "@/lib/boletim-calculos";

type Props = {
  turmaNome?: string;
  anoSerie?: string;
  turno?: string;
  anoLetivo?: number | string;
  aluno: AlunoBoletim | undefined;
  dados: ArquivoPreenchimentoDados;
};

export function AvaliacaoBimestralPreview({
  turmaNome,
  anoSerie,
  turno,
  anoLetivo,
  aluno,
  dados,
}: Props) {
  const notasAluno = aluno ? (dados.notasBoletim?.[aluno.id] ?? {}) : {};
  const anoStr = anoLetivo ?? new Date().getFullYear();

  return (
    <div className="rounded-md border bg-white p-6 text-[10px] leading-tight text-black shadow-sm print:shadow-none">
      <header className="mb-3 text-center">
        <p className="text-[11px] font-bold uppercase">Prefeitura Municipal de Assunção do Piauí</p>
        <p className="text-[10px] uppercase">Secretaria Municipal de Educação</p>
        <p className="text-[10px] uppercase">U.E. Evaristo Campelo de Matos</p>
        <p className="mt-2 text-[13px] font-bold">BOLETIM ESCOLAR — {anoStr}</p>
      </header>

      <section className="mb-2 space-y-1 text-[10px]">
        <p>
          <strong>ALUNO(A):</strong> {aluno?.nome ?? "—"}
          {"   "}
          <strong>INEP:</strong> {aluno?.inep ?? "—"}
          {"   "}
          <strong>SEXO:</strong> {aluno?.sexo ?? "—"}
          {"   "}
          <strong>NASCIMENTO:</strong> {aluno?.nascimento ?? "—"}
        </p>
        <p>
          <strong>MÃE:</strong> {aluno?.mae ?? "—"}
          {"   "}
          <strong>PAI:</strong> {aluno?.pai ?? "—"}
        </p>
        <p>
          <strong>CURSO:</strong> NORMAL{"   "}
          <strong>MODALIDADE:</strong> ENSINO REGULAR
        </p>
        <p>
          <strong>TURMA:</strong> {turmaNome ?? "—"}
          {"   "}
          <strong>ETAPA:</strong> {anoSerie ?? "—"}
          {"   "}
          <strong>TURNO:</strong> {turno ?? "—"}
          {"   "}
          <strong>DIAS LETIVOS:</strong> 200
        </p>
      </section>

      <table className="w-full border-collapse text-[9px]">
        <thead>
          <tr className="bg-gray-100">
            <th rowSpan={2} className="border border-gray-400 p-1 text-left">
              COMPONENTE CURRICULAR
            </th>
            <th colSpan={BOLETIM_COLUNAS.length} className="border border-gray-400 p-1">
              AVALIAÇÕES
            </th>
            <th rowSpan={2} className="border border-gray-400 p-1">
              MÉDIA FINAL
            </th>
            <th rowSpan={2} className="border border-gray-400 p-1">
              RESULTADO
            </th>
          </tr>
          <tr className="bg-gray-100">
            {BOLETIM_COLUNAS.map((c) => (
              <th key={c.key} className="border border-gray-400 p-1 text-[8px]">
                {c.short}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {BOLETIM_DISCIPLINAS.map((d) => {
            const n = notasAluno[d.key] ?? {};
            const mf = calcularMediaFinal(n);
            const res = calcularResultado(n);
            return (
              <tr key={d.key}>
                <td className="border border-gray-400 p-1">{d.label.toUpperCase()}</td>
                {BOLETIM_COLUNAS.map((c) => (
                  <td key={c.key} className="border border-gray-400 p-1 text-center">
                    {n[c.key] || "-"}
                  </td>
                ))}
                <td className="border border-gray-400 p-1 text-center font-semibold">
                  {fmtNota(mf)}
                </td>
                <td className="border border-gray-400 p-1 text-center">{res}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className="mt-2 text-[10px]">
        <strong>CARGA HORÁRIA:</strong> 800 h{"   "}
        <strong>RESULTADO:</strong> CURSANDO
      </p>

      {dados.observacoes ? (
        <div className="mt-3 text-[10px]">
          <strong>Observações:</strong>
          <p className="mt-1 whitespace-pre-wrap">{dados.observacoes}</p>
        </div>
      ) : null}

      <footer className="mt-10 grid grid-cols-2 gap-6 text-[10px]">
        <div className="border-t border-gray-500 pt-1 text-center">SECRETÁRIO(A) ESCOLAR</div>
        <div className="border-t border-gray-500 pt-1 text-center">DIRETOR(A) ESCOLAR</div>
      </footer>
    </div>
  );
}

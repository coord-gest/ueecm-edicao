import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { supabase } from "@/integrations/supabase/client";
import {
  listFilhosDoResponsavel,
  listRegistrosDoFilho,
  marcarRegistrosLidos,
  type DiarioTipo,
} from "@/lib/diario-bordo.functions";
import { TIPO_META } from "@/lib/diario-tipos";

export const Route = createFileRoute("/painel-diario-filho")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Diário do meu filho | Portal Escolar" }],
  }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: PainelDiarioFilho,
});

const RANGES: { label: string; dias: number }[] = [
  { label: "7 dias", dias: 7 },
  { label: "30 dias", dias: 30 },
  { label: "Bimestre", dias: 60 },
  { label: "6 meses", dias: 180 },
];

function PainelDiarioFilho() {
  const qc = useQueryClient();
  const listFilhos = useServerFn(listFilhosDoResponsavel);
  const listRegs = useServerFn(listRegistrosDoFilho);
  const marcarLidos = useServerFn(marcarRegistrosLidos);

  const { data: filhos = [], isLoading: loadingFilhos } = useQuery({
    queryKey: ["diario-filho", "lista"],
    queryFn: () => listFilhos(),
  });

  const [alunoId, setAlunoId] = useState<string>("");
  const [dias, setDias] = useState<number>(30);
  const activeAluno = alunoId || filhos[0]?.aluno_id || "";

  const { data: registros = [], isLoading: loadingRegs } = useQuery({
    queryKey: ["diario-filho", "regs", activeAluno, dias],
    queryFn: () => listRegs({ data: { aluno_id: activeAluno, dias } }),
    enabled: !!activeAluno,
  });

  const marcarMut = useMutation({
    mutationFn: (ids: string[]) => marcarLidos({ data: { ids } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["diario-filho"] }),
  });

  // Auto-marca como lidos ao abrir feed
  useEffect(() => {
    if (!registros.length) return;
    const ids = registros.map((r) => r.id);
    marcarMut.mutate(ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAluno, registros.length]);

  const contagens = useMemo(() => {
    const c: Record<DiarioTipo, number> = {
      elogio: 0,
      participacao: 0,
      avanco: 0,
      observacao: 0,
      atencao: 0,
    };
    for (const r of registros) c[r.tipo] += 1;
    return c;
  }, [registros]);

  const grupos = useMemo(() => {
    const map = new Map<string, typeof registros>();
    for (const r of registros) {
      const dia = new Date(r.created_at).toLocaleDateString("pt-BR");
      const arr = map.get(dia) ?? [];
      arr.push(r);
      map.set(dia, arr);
    }
    return Array.from(map.entries());
  }, [registros]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <Link
        to="/meus-filhos"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Meus filhos
      </Link>
      <div className="mt-2 mb-6">
        <h1 className="text-2xl font-bold sm:text-3xl">Diário do meu filho</h1>
        <p className="text-sm text-muted-foreground">
          Acompanhe o dia a dia escolar em uma linha do tempo simples.
        </p>
      </div>

      {loadingFilhos ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : filhos.length === 0 ? (
        <Card className="rounded-[5px]">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhum filho vinculado ao seu cadastro ainda.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Filtros */}
          <Card className="mb-4 rounded-[5px]">
            <CardContent className="flex flex-wrap items-end gap-3 py-4">
              <div className="min-w-[220px] flex-1">
                <label className="mb-1 block text-xs">Filho(a)</label>
                <Select value={activeAluno} onValueChange={setAlunoId}>
                  <SelectTrigger className="rounded-[5px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {filhos.map((f) => (
                      <SelectItem key={f.aluno_id} value={f.aluno_id}>
                        {f.aluno_nome}
                        {f.turma_nome ? ` — ${f.turma_nome}` : ""}
                        {f.nao_lidos > 0 ? ` · ${f.nao_lidos} novo(s)` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-wrap gap-1">
                {RANGES.map((r) => (
                  <Button
                    key={r.dias}
                    size="sm"
                    variant={dias === r.dias ? "default" : "outline"}
                    className="rounded-[5px]"
                    onClick={() => setDias(r.dias)}
                  >
                    {r.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Contagens */}
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {(Object.keys(TIPO_META) as DiarioTipo[]).map((t) => {
              const m = TIPO_META[t];
              const Icon = m.icon;
              return (
                <Card key={t} className={`rounded-[5px] ${m.cardClass}`}>
                  <CardContent className="flex items-center gap-2 py-3">
                    <div
                      className={`flex size-8 items-center justify-center rounded-[5px] ${m.iconBgClass}`}
                    >
                      <Icon className={`size-4 ${m.iconClass}`} />
                    </div>
                    <div>
                      <p className="text-xl font-bold leading-none">
                        {contagens[t]}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {m.label}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Feed */}
          {loadingRegs ? (
            <div className="flex justify-center py-16">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : registros.length === 0 ? (
            <Card className="rounded-[5px]">
              <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
                <Sparkles className="size-8 text-muted-foreground/50" />
                Ainda não há registros no período selecionado.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {grupos.map(([dia, rs]) => (
                <section key={dia}>
                  <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {dia}
                  </h2>
                  <div className="space-y-2">
                    {rs.map((r) => {
                      const m = TIPO_META[r.tipo];
                      const Icon = m.icon;
                      return (
                        <Card
                          key={r.id}
                          className={`rounded-[5px] ${m.cardClass}`}
                        >
                          <CardContent className="flex items-start gap-3 py-3">
                            <div
                              className={`flex size-9 items-center justify-center rounded-[5px] ${m.iconBgClass}`}
                            >
                              <Icon className={`size-5 ${m.iconClass}`} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className={`rounded-[5px] ${m.badgeClass}`}
                                >
                                  {m.label}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(r.created_at).toLocaleTimeString(
                                    "pt-BR",
                                    { hour: "2-digit", minute: "2-digit" },
                                  )}
                                </span>
                              </div>
                              <p className="mt-1 font-medium">{r.titulo}</p>
                              {r.descricao && (
                                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                                  {r.descricao}
                                </p>
                              )}
                              <p className="mt-1 text-[11px] text-muted-foreground">
                                {r.autor_nome ?? "Professor(a)"}
                                {r.disciplina ? ` · ${r.disciplina}` : ""}
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  GraduationCap,
  Megaphone,
  ClipboardList,
  CalendarCheck,
  Download,
  Loader2,
  Cake,
  CalendarClock,
  FileWarning,
  CalendarPlus,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { EscolaShell } from "@/components/escola/EscolaShell";
import { generateBoletim } from "@/lib/boletim.functions";
import {
  AlertasPersonalizados,
  computarAlertas,
} from "@/components/responsavel/AlertasPersonalizados";

import { PainelLayout } from "@/components/PainelLayout";

export const Route = createFileRoute("/meus-filhos")({
  ssr: false,
  head: () => ({ meta: [{ title: "Meus Filhos | Escola" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: MeusFilhosPage,
});

type ProxEvento = { id: string; titulo: string; data_inicio: string; horario: string | null };

type ChildRow = {
  id: string;
  nome_completo: string;
  matricula: string;
  data_nascimento: string | null;
  turma: { nome: string; ano_serie: string | null; turno: string | null } | null;
  notasRecentes: { disciplina: string; bimestre: number; valor: number | null }[];
  frequencia: { data: string; presente: boolean }[];
  freqPct: number | null;
  comunicadosNaoLidos: { titulo: string; created_at: string }[];
  proximosEventos: ProxEvento[];
};

function MeusFilhosPage() {
  const { user, loading } = useAuth();

  const { data: filhos, isLoading } = useQuery({
    queryKey: ["meus-filhos", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<ChildRow[]> => {
      const { data: resps } = await supabase
        .from("responsaveis")
        .select("id")
        .eq("user_id", user!.id);
      const respIds = (resps ?? []).map((r) => r.id);
      if (respIds.length === 0) return [];

      const { data: links } = await supabase
        .from("aluno_responsavel")
        .select("aluno_id")
        .in("responsavel_id", respIds);
      const alunoIds = Array.from(new Set((links ?? []).map((l) => l.aluno_id)));
      if (alunoIds.length === 0) return [];

      const { data: alunos } = await supabase
        .from("alunos")
        .select(
          "id, nome_completo, matricula, data_nascimento, turma_id, turmas_escolares(nome, ano_serie, turno)",
        )
        .in("id", alunoIds);

      const result: ChildRow[] = [];
      for (const a of alunos ?? []) {
        const hojeIso = new Date().toISOString().slice(0, 10);
        const em30 = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
        const [{ data: notas }, { data: freq }, { data: coms }, { data: lidos }, { data: eventos }] =
          await Promise.all([
            supabase
              .from("notas")
              .select("disciplina, bimestre, valor")
              .eq("aluno_id", a.id)
              .order("bimestre", { ascending: false })
              .limit(12),
            supabase
              .from("frequencia")
              .select("data, presente")
              .eq("aluno_id", a.id)
              .gte("data", new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10))
              .order("data", { ascending: true }),
            supabase
              .from("comunicados")
              .select("id, titulo, created_at")
              .or(
                `aluno_id.eq.${a.id},turma_id.eq.${a.turma_id ?? "00000000-0000-0000-0000-000000000000"}`,
              ),
            supabase.from("comunicado_leituras").select("comunicado_id").eq("usuario_id", user!.id),
            supabase
              .from("eventos")
              .select("id, titulo, data_inicio, horario")
              .eq("ativo", true)
              .gte("data_inicio", hojeIso)
              .lte("data_inicio", em30)
              .order("data_inicio", { ascending: true })
              .limit(4),
          ]);
        const total = freq?.length ?? 0;
        const presentes = freq?.filter((f) => f.presente).length ?? 0;
        const lidosSet = new Set((lidos ?? []).map((l) => l.comunicado_id));
        const naoLidos = (coms ?? [])
          .filter((c) => !lidosSet.has(c.id))
          .map((c) => ({ titulo: c.titulo, created_at: c.created_at }));
        result.push({
          id: a.id,
          nome_completo: a.nome_completo,
          matricula: a.matricula,
          data_nascimento: (a as { data_nascimento: string | null }).data_nascimento,
          turma: (a as { turmas_escolares: ChildRow["turma"] }).turmas_escolares,
          notasRecentes: (notas ?? []) as ChildRow["notasRecentes"],
          frequencia: (freq ?? []) as ChildRow["frequencia"],
          freqPct: total > 0 ? Math.round((presentes / total) * 100) : null,
          comunicadosNaoLidos: naoLidos,
          proximosEventos: (eventos ?? []) as ProxEvento[],
        });
      }
      return result;
    },
  });

  const [tabAtiva, setTabAtiva] = useState<string | null>(null);

  if (loading) return null;

  const activeId = tabAtiva ?? filhos?.[0]?.id ?? null;

  return (
    <PainelLayout>
      <EscolaShell title="Meus filhos" description="Acompanhe notas, frequência e comunicados">
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-48 rounded-2xl" />
            <Skeleton className="h-48 rounded-2xl" />
          </div>
        ) : !filhos || filhos.length === 0 ? (
          <div className="rounded-2xl border border-border/70 bg-card p-10 text-center">
            <GraduationCap className="mx-auto size-10 text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">
              Nenhum aluno vinculado à sua conta. Procure a secretaria da escola para fazer o
              vínculo.
            </p>
          </div>
        ) : filhos.length >= 2 ? (
          <Tabs value={activeId ?? undefined} onValueChange={setTabAtiva} className="w-full">
            <TabsList className="w-full flex-wrap justify-start gap-1">
              {filhos.map((f) => (
                <TabsTrigger key={f.id} value={f.id} className="gap-2">
                  {f.nome_completo.split(" ")[0]}
                  {f.comunicadosNaoLidos.length > 0 && (
                    <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                      {f.comunicadosNaoLidos.length}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
            {filhos.map((f) => (
              <TabsContent key={f.id} value={f.id} className="mt-4">
                <FilhoCard filho={f} />
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {filhos.map((f) => (
              <FilhoCard key={f.id} filho={f} />
            ))}
          </div>
        )}
      </EscolaShell>
    </PainelLayout>
  );
}

function FilhoCard({ filho }: { filho: ChildRow }) {
  const baixarBoletim = useServerFn(generateBoletim);
  const [baixando, setBaixando] = useState(false);

  const alertas = computarAlertas({
    nomeAluno: filho.nome_completo,
    dataNascimento: filho.data_nascimento,
    notas: filho.notasRecentes,
    frequencia: filho.frequencia,
    comunicadosNaoLidos: filho.comunicadosNaoLidos,
  });

  async function baixar() {
    setBaixando(true);
    try {
      const res = await baixarBoletim({ data: { alunoId: filho.id, bimestre: null } });
      const blob = new Blob([Uint8Array.from(atob(res.base64), (c) => c.charCodeAt(0))], {
        type: "application/pdf",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBaixando(false);
    }
  }

  const aniversarianteHoje = (() => {
    if (!filho.data_nascimento) return false;
    const dn = new Date(filho.data_nascimento);
    const h = new Date();
    return dn.getDate() === h.getDate() && dn.getMonth() === h.getMonth();
  })();

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
            {filho.nome_completo}
            {aniversarianteHoje && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                <Cake className="size-3" /> Aniversariante 🎉
              </span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            Matrícula {filho.matricula} • {filho.turma?.nome ?? "Sem turma"}
            {filho.turma?.turno ? ` • ${filho.turma.turno}` : ""}
          </p>
        </div>
        {filho.comunicadosNaoLidos.length > 0 && (
          <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
            {filho.comunicadosNaoLidos.length} novos
          </span>
        )}
      </div>

      {alertas.length > 0 && (
        <div className="mt-4">
          <AlertasPersonalizados alertas={alertas} />
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-secondary p-3">
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarCheck className="size-3.5" /> Frequência (30d)
          </p>
          <p className="mt-1 text-xl font-semibold">
            {filho.freqPct !== null ? `${filho.freqPct}%` : "—"}
          </p>
        </div>
        <div className="rounded-xl bg-secondary p-3">
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <ClipboardList className="size-3.5" /> Notas recentes
          </p>
          <p className="mt-1 text-xl font-semibold">{filho.notasRecentes.length}</p>
        </div>
      </div>

      {filho.notasRecentes.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs">
          {filho.notasRecentes.slice(0, 4).map((n, i) => (
            <li key={i} className="flex justify-between">
              <span className="text-muted-foreground">
                {n.disciplina} • {n.bimestre}º bim
              </span>
              <span
                className={
                  n.valor != null && n.valor < 6
                    ? "font-semibold text-destructive"
                    : "font-semibold text-foreground"
                }
              >
                {n.valor != null ? Number(n.valor).toFixed(1) : "—"}
              </span>
            </li>
          ))}
        </ul>
      )}

      {filho.proximosEventos.length > 0 && (
        <div className="mt-4 rounded-xl border border-border/70 bg-secondary/40 p-3">
          <p className="mb-2 flex items-center gap-1 text-xs font-semibold text-muted-foreground">
            <CalendarClock className="size-3.5" /> Próximos eventos (30 dias)
          </p>
          <ul className="space-y-1 text-xs">
            {filho.proximosEventos.map((e) => (
              <li key={e.id} className="flex justify-between gap-2">
                <span className="truncate font-medium text-foreground">{e.titulo}</span>
                <span className="whitespace-nowrap text-muted-foreground">
                  {new Date(e.data_inicio + "T00:00:00").toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                  })}
                  {e.horario ? ` • ${e.horario.slice(0, 5)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button asChild size="sm" className="rounded-full">
          <Link to="/meus-filhos/$id" params={{ id: filho.id }}>
            <GraduationCap className="size-4" /> Ver detalhes
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline" className="rounded-full">
          <Link to="/meus-filhos/$id" params={{ id: filho.id }} hash="justificar">
            <FileWarning className="size-4" /> Justificar falta
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline" className="rounded-full">
          <Link to="/agendar">
            <CalendarPlus className="size-4" /> Agendar
          </Link>
        </Button>
        <Button asChild size="sm" variant="ghost" className="rounded-full">
          <Link to="/escola/comunicados">
            <Megaphone className="size-4" /> Comunicados
          </Link>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="rounded-full"
          onClick={baixar}
          disabled={baixando}
        >
          {baixando ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          Boletim PDF
        </Button>
      </div>
    </div>
  );
}

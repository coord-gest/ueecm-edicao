import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Award, Loader2, Sparkles, Star, TrendingUp, AlertTriangle, ShieldAlert, Send } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  listMinhasTurmasMeritos,
  listAlunosDaTurmaMeritos,
  listMeritosPorTurma,
  criarMerito,
  type MeritoTipo,
  type MeritoItem,
} from "@/lib/meritos.functions";

export const Route = createFileRoute("/painel-meritos")({
  head: () => ({
    meta: [
      { title: "Méritos e Ocorrências — Conecta UEECM" },
      { name: "description", content: "Registre em 30 segundos elogios, avanços, atenções e ocorrências. A IA reescreve para as famílias em linguagem construtiva." },
    ],
  }),
  component: PainelMeritos,
});

const TIPOS: Array<{ v: MeritoTipo; label: string; icon: React.ComponentType<{ className?: string }>; bg: string; text: string }> = [
  { v: "elogio", label: "Elogio", icon: Star, bg: "bg-emerald-500 hover:bg-emerald-600", text: "text-white" },
  { v: "avanco", label: "Avanço", icon: TrendingUp, bg: "bg-blue-500 hover:bg-blue-600", text: "text-white" },
  { v: "atencao", label: "Atenção", icon: AlertTriangle, bg: "bg-amber-500 hover:bg-amber-600", text: "text-white" },
  { v: "ocorrencia", label: "Ocorrência", icon: ShieldAlert, bg: "bg-red-500 hover:bg-red-600", text: "text-white" },
];

function PainelMeritos() {
  const qc = useQueryClient();
  const listTurmasFn = useServerFn(listMinhasTurmasMeritos);
  const listAlunosFn = useServerFn(listAlunosDaTurmaMeritos);
  const listMeritosFn = useServerFn(listMeritosPorTurma);
  const criarFn = useServerFn(criarMerito);

  const [turmaId, setTurmaId] = useState<string | null>(null);
  const [alunoId, setAlunoId] = useState<string | null>(null);
  const [tipo, setTipo] = useState<MeritoTipo>("elogio");
  const [nota, setNota] = useState("");
  const [disciplina, setDisciplina] = useState("");

  const turmasQ = useQuery({ queryKey: ["meritos-turmas"], queryFn: () => listTurmasFn(), staleTime: 5 * 60_000 });
  const alunosQ = useQuery({
    queryKey: ["meritos-alunos", turmaId],
    queryFn: () => listAlunosFn({ data: { turmaId: turmaId! } }),
    enabled: !!turmaId,
    staleTime: 60_000,
  });
  const meritosQ = useQuery({
    queryKey: ["meritos-por-turma", turmaId],
    queryFn: () => listMeritosFn({ data: { turmaId: turmaId!, dias: 30 } }),
    enabled: !!turmaId,
    staleTime: 30_000,
  });

  const contagem = useMemo(() => {
    const rows = meritosQ.data ?? [];
    const c = { elogio: 0, avanco: 0, atencao: 0, ocorrencia: 0 };
    rows.forEach((r) => { c[r.tipo] = (c[r.tipo] ?? 0) + 1; });
    return c;
  }, [meritosQ.data]);

  const positivos = contagem.elogio + contagem.avanco;
  const negativos = contagem.atencao + contagem.ocorrencia;
  const razaoOk = negativos === 0 || positivos / Math.max(negativos, 1) >= 3;

  const criarMut = useMutation({
    mutationFn: (input: { alunoId: string; tipo: MeritoTipo; notaOriginal: string; disciplina?: string | null }) =>
      criarFn({ data: input }),
    onSuccess: (result) => {
      toast.success(result.ia_reescreveu ? "Registrado! IA enviou versão construtiva ao responsável." : "Registrado e enviado ao responsável.");
      setNota("");
      qc.invalidateQueries({ queryKey: ["meritos-por-turma", turmaId] });
    },
    onError: (err) => toast.error((err as Error).message),
  });

  return (
    <div className="container mx-auto max-w-5xl p-4 md:p-6 space-y-6">
      <header className="flex items-start gap-3">
        <div className="rounded-[5px] bg-primary/10 p-2 text-primary"><Award className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Méritos e Ocorrências</h1>
          <p className="text-sm text-muted-foreground">Registre em 30 segundos. A IA reescreve para as famílias em linguagem construtiva.</p>
        </div>
      </header>

      {turmasQ.isLoading ? (
        <Loading />
      ) : (turmasQ.data ?? []).length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Você não é responsável por nenhuma turma.</CardContent></Card>
      ) : (
        <>
          <Card>
            <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">Turma</label>
                <Select value={turmaId ?? undefined} onValueChange={(v) => { setTurmaId(v); setAlunoId(null); }}>
                  <SelectTrigger><SelectValue placeholder="Selecione a turma…" /></SelectTrigger>
                  <SelectContent>
                    {turmasQ.data?.map((t) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">Aluno</label>
                <Select value={alunoId ?? undefined} onValueChange={setAlunoId} disabled={!turmaId}>
                  <SelectTrigger><SelectValue placeholder={turmaId ? "Selecione o aluno…" : "Escolha uma turma primeiro"} /></SelectTrigger>
                  <SelectContent>
                    {alunosQ.data?.map((a) => <SelectItem key={a.id} value={a.id}>{a.nome_completo}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {turmaId && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Balanço da turma (últimos 30 dias)</CardTitle>
                <CardDescription className={razaoOk ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>
                  {razaoOk ? "✓ Reforço positivo saudável (3 elogios para cada ocorrência)" : "⚠️ Busque equilibrar com mais reforço positivo (padrão pedagógico: 3 elogios : 1 ocorrência)"}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-4 gap-2 text-center">
                {TIPOS.map((t) => (
                  <div key={t.v} className="rounded-[5px] bg-muted/50 p-2">
                    <t.icon className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                    <div className="text-xl font-bold">{contagem[t.v]}</div>
                    <div className="text-[10px] uppercase text-muted-foreground">{t.label}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {alunoId && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Novo registro</CardTitle>
                <CardDescription>A IA reescreverá em linguagem construtiva antes de enviar ao responsável.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {TIPOS.map((t) => (
                    <Button
                      key={t.v}
                      type="button"
                      onClick={() => setTipo(t.v)}
                      className={`${t.bg} ${t.text} ${tipo === t.v ? "ring-2 ring-offset-2 ring-primary" : "opacity-80"}`}
                    >
                      <t.icon className="h-4 w-4 mr-1" /> {t.label}
                    </Button>
                  ))}
                </div>
                <Input placeholder="Disciplina (opcional)" value={disciplina} onChange={(e) => setDisciplina(e.target.value)} maxLength={80} />
                <Textarea
                  placeholder="Escreva sua nota em linguagem livre… (ex: 'Ajudou os colegas na atividade em grupo')"
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  rows={3}
                  maxLength={1000}
                />
                <Button
                  className="w-full"
                  disabled={nota.trim().length < 3 || criarMut.isPending}
                  onClick={() => criarMut.mutate({ alunoId, tipo, notaOriginal: nota.trim(), disciplina: disciplina.trim() || null })}
                >
                  {criarMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                  Enviar ao responsável
                </Button>
              </CardContent>
            </Card>
          )}

          {turmaId && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Últimos registros da turma</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {meritosQ.isLoading ? <Loading /> :
                  (meritosQ.data ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">Nenhum registro nos últimos 30 dias.</p>
                  ) : (meritosQ.data ?? []).slice(0, 20).map((m) => <MeritoRow key={m.id} m={m} />)
                }
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function MeritoRow({ m }: { m: MeritoItem }) {
  const t = TIPOS.find((x) => x.v === m.tipo)!;
  const Icon = t.icon;
  return (
    <div className="flex gap-3 rounded-[5px] border p-3">
      <div className={`rounded-[5px] p-2 h-fit ${t.bg} ${t.text}`}><Icon className="h-4 w-4" /></div>
      <div className="flex-1 min-w-0 text-sm">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium">{m.aluno_nome ?? "Aluno"}</span>
          <Badge variant="outline" className="text-[10px]">{t.label}</Badge>
          {m.disciplina && <Badge variant="secondary" className="text-[10px]">{m.disciplina}</Badge>}
          {m.ia_reescreveu && <Badge variant="outline" className="text-[10px] gap-1"><Sparkles className="h-2.5 w-2.5" />IA</Badge>}
        </div>
        <p className="text-muted-foreground mt-1 whitespace-pre-line line-clamp-3">
          {m.nota_construtiva ?? m.nota_original}
        </p>
        <p className="text-[10px] text-muted-foreground mt-1">
          {new Date(m.created_at).toLocaleString("pt-BR")}
          {m.autor_nome ? ` • ${m.autor_nome}` : ""}
        </p>
      </div>
    </div>
  );
}

function Loading() {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground p-6">
      <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
    </div>
  );
}
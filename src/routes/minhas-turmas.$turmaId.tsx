import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Megaphone,
  ClipboardList,
  CalendarCheck,
  Download,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { EscolaShell } from "@/components/escola/EscolaShell";
import { exportRowsAsCsv } from "@/lib/csv-export";

import { PainelLayout } from "@/components/PainelLayout";

export const Route = createFileRoute("/minhas-turmas/$turmaId")({
  ssr: false,
  head: () => ({ meta: [{ title: "Turma | Escola" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: TurmaDetail,
});

function TurmaDetail() {
  const { turmaId } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: turma } = useQuery({
    queryKey: ["turma", turmaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("turmas_escolares")
        .select("id, nome, ano_serie, turno, ano_letivo, professor_responsavel_id")
        .eq("id", turmaId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: alunos } = useQuery({
    queryKey: ["turma-alunos", turmaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("alunos")
        .select("id, nome_completo, matricula")
        .eq("turma_id", turmaId)
        .order("nome_completo");
      return data ?? [];
    },
  });

  const ehDono = turma?.professor_responsavel_id === user?.id;

  return (
    <PainelLayout>
      <EscolaShell
        title={turma?.nome ?? "Turma"}
        description={`${turma?.ano_serie ?? ""} • ${turma?.turno ?? ""}`}
      >
        <Button asChild variant="ghost" size="sm" className="mb-3 rounded-full">
          <Link to="/minhas-turmas">
            <ArrowLeft className="size-4" /> Minhas turmas
          </Link>
        </Button>

        <Tabs defaultValue="alunos">
          <TabsList>
            <TabsTrigger value="alunos">Alunos ({alunos?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="nota" disabled={!ehDono}>
              <ClipboardList className="size-4" /> Lançar nota
            </TabsTrigger>
            <TabsTrigger value="frequencia" disabled={!ehDono}>
              <CalendarCheck className="size-4" /> Frequência
            </TabsTrigger>
            <TabsTrigger value="comunicado" disabled={!ehDono}>
              <Megaphone className="size-4" /> Comunicado
            </TabsTrigger>
          </TabsList>

          <TabsContent value="alunos">
            <div className="mb-3 flex justify-end">
              <ExportTurmaButton turmaId={turmaId} turmaNome={turma?.nome ?? "turma"} />
            </div>
            <div className="rounded-2xl border border-border/70 bg-card shadow-sm">
              {(alunos ?? []).length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">
                  Nenhum aluno nesta turma.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Matrícula</th>
                      <th className="px-4 py-3">Nome</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alunos!.map((a) => (
                      <tr key={a.id} className="border-b last:border-0">
                        <td className="px-4 py-3 font-mono text-xs">{a.matricula}</td>
                        <td className="px-4 py-3">{a.nome_completo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </TabsContent>

          <TabsContent value="nota">
            <FormNota
              alunos={alunos ?? []}
              onDone={() => qc.invalidateQueries({ queryKey: ["turma", turmaId] })}
            />
          </TabsContent>
          <TabsContent value="frequencia">
            <FormFrequencia alunos={alunos ?? []} />
          </TabsContent>
          <TabsContent value="comunicado">
            <FormComunicado turmaId={turmaId} alunos={alunos ?? []} />
          </TabsContent>
        </Tabs>
      </EscolaShell>
    </PainelLayout>
  );
}

type Aluno = { id: string; nome_completo: string; matricula: string };

function FormNota({ alunos, onDone }: { alunos: Aluno[]; onDone: () => void }) {
  const { user } = useAuth();
  const m = useMutation({
    mutationFn: async (payload: {
      aluno_id: string;
      disciplina: string;
      bimestre: number;
      valor: number | null;
      observacao: string | null;
    }) => {
      const { error } = await supabase.from("notas").insert({ ...payload, lancado_por: user!.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Nota lançada.");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    m.mutate({
      aluno_id: String(f.get("aluno_id")),
      disciplina: String(f.get("disciplina")).trim(),
      bimestre: Number(f.get("bimestre")),
      valor: f.get("valor") ? Number(f.get("valor")) : null,
      observacao: String(f.get("observacao") ?? "").trim() || null,
    });
    e.currentTarget.reset();
  }
  return (
    <form
      onSubmit={submit}
      className="grid gap-3 rounded-2xl border border-border/70 bg-card p-5 sm:grid-cols-2"
    >
      <div className="sm:col-span-2">
        <Label>Aluno</Label>
        <Select name="aluno_id" required>
          <SelectTrigger>
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {alunos.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.nome_completo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Disciplina</Label>
        <Input name="disciplina" required />
      </div>
      <div>
        <Label>Bimestre</Label>
        <Select name="bimestre" defaultValue="1">
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 3, 4].map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}º
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Nota (0–10)</Label>
        <Input name="valor" type="number" step="0.1" min="0" max="10" />
      </div>
      <div className="sm:col-span-2">
        <Label>Observação</Label>
        <Input name="observacao" />
      </div>
      <Button type="submit" disabled={m.isPending} className="sm:col-span-2 rounded-full">
        {m.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}{" "}
        Lançar
      </Button>
    </form>
  );
}

function FormFrequencia({ alunos }: { alunos: Aluno[] }) {
  const { user } = useAuth();
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [ausentes, setAusentes] = useState<Set<string>>(new Set());

  const m = useMutation({
    mutationFn: async () => {
      const rows = alunos.map((a) => ({
        aluno_id: a.id,
        data,
        presente: !ausentes.has(a.id),
        registrado_por: user!.id,
      }));
      const { error } = await supabase.from("frequencia").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Frequência de ${data} registrada.`);
      setAusentes(new Set());
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label>Data</Label>
          <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </div>
        <p className="text-sm text-muted-foreground">
          Marque os alunos <strong>ausentes</strong>. Os demais entram como presentes.
        </p>
      </div>
      <ul className="mt-4 divide-y">
        {alunos.map((a) => {
          const ausente = ausentes.has(a.id);
          return (
            <li key={a.id} className="flex items-center justify-between py-2">
              <span className={ausente ? "text-destructive line-through" : ""}>
                {a.nome_completo}
              </span>
              <Button
                size="sm"
                variant={ausente ? "destructive" : "outline"}
                onClick={() => {
                  const s = new Set(ausentes);
                  if (ausente) s.delete(a.id);
                  else s.add(a.id);
                  setAusentes(s);
                }}
              >
                {ausente ? "Ausente" : "Presente"}
              </Button>
            </li>
          );
        })}
      </ul>
      <Button
        onClick={() => m.mutate()}
        disabled={m.isPending || alunos.length === 0}
        className="mt-4 rounded-full"
      >
        {m.isPending && <Loader2 className="size-4 animate-spin" />} Salvar chamada
      </Button>
    </div>
  );
}

function FormComunicado({ turmaId, alunos }: { turmaId: string; alunos: Aluno[] }) {
  const { user } = useAuth();
  const [alunoId, setAlunoId] = useState<string>("__turma__");
  const m = useMutation({
    mutationFn: async (p: { titulo: string; mensagem: string }) => {
      const paraTurma = alunoId === "__turma__";
      const payload = {
        titulo: p.titulo,
        mensagem: p.mensagem,
        autor_id: user!.id,
        tipo: paraTurma ? "turma" : "individual",
        turma_id: turmaId,
        aluno_id: paraTurma ? null : alunoId,
        anexos: [],
      };
      const { error } = await supabase.from("comunicados").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => toast.success("Comunicado enviado."),
    onError: (e: Error) => toast.error(e.message),
  });
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    m.mutate({
      titulo: String(f.get("titulo")).trim(),
      mensagem: String(f.get("mensagem")).trim(),
    });
    e.currentTarget.reset();
  }
  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-border/70 bg-card p-5">
      <div>
        <Label>Destinatário</Label>
        <Select value={alunoId} onValueChange={setAlunoId}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__turma__">Toda a turma</SelectItem>
            {alunos.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.nome_completo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Título</Label>
        <Input name="titulo" required />
      </div>
      <div>
        <Label>Mensagem</Label>
        <Textarea name="mensagem" rows={4} required />
      </div>
      <Button type="submit" disabled={m.isPending} className="rounded-full">
        {m.isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Megaphone className="size-4" />
        )}{" "}
        Enviar
      </Button>
    </form>
  );
}

function ExportTurmaButton({ turmaId, turmaNome }: { turmaId: string; turmaNome: string }) {
  const [busy, setBusy] = useState<"freq" | "notas" | null>(null);

  async function exportFrequencia() {
    setBusy("freq");
    try {
      const { data: alunos } = await supabase
        .from("alunos")
        .select("id, nome_completo, matricula")
        .eq("turma_id", turmaId);
      const ids = (alunos ?? []).map((a) => a.id);
      if (ids.length === 0) {
        toast.info("Turma sem alunos");
        return;
      }
      const { data: freq, error } = await supabase
        .from("frequencia")
        .select("aluno_id, data, presente, justificativa")
        .in("aluno_id", ids)
        .order("data", { ascending: false })
        .limit(5000);
      if (error) throw error;
      const byId = new Map((alunos ?? []).map((a) => [a.id, a]));
      const rows = (freq ?? []).map((f) => {
        const a = byId.get(f.aluno_id);
        return {
          data: f.data,
          matricula: a?.matricula ?? "",
          nome: a?.nome_completo ?? "",
          presente: f.presente ? "sim" : "não",
          justificativa: f.justificativa ?? "",
        };
      });
      if (rows.length === 0) {
        toast.info("Sem registros de frequência");
        return;
      }
      exportRowsAsCsv(`frequencia-${turmaNome}.csv`, rows, [
        { key: "data", label: "Data" },
        { key: "matricula", label: "Matrícula" },
        { key: "nome", label: "Aluno" },
        { key: "presente", label: "Presente" },
        { key: "justificativa", label: "Justificativa" },
      ]);
      toast.success(`${rows.length} registro(s) exportado(s)`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function exportNotas() {
    setBusy("notas");
    try {
      const { data: alunos } = await supabase
        .from("alunos")
        .select("id, nome_completo, matricula")
        .eq("turma_id", turmaId);
      const ids = (alunos ?? []).map((a) => a.id);
      if (ids.length === 0) {
        toast.info("Turma sem alunos");
        return;
      }
      const { data: notas, error } = await supabase
        .from("notas")
        .select("aluno_id, disciplina, bimestre, valor, observacao")
        .in("aluno_id", ids)
        .order("bimestre", { ascending: true })
        .limit(5000);
      if (error) throw error;
      const byId = new Map((alunos ?? []).map((a) => [a.id, a]));
      const rows = (notas ?? []).map((n) => {
        const a = byId.get(n.aluno_id);
        return {
          matricula: a?.matricula ?? "",
          nome: a?.nome_completo ?? "",
          disciplina: n.disciplina ?? "",
          bimestre: n.bimestre ?? "",
          valor: n.valor ?? "",
          observacao: n.observacao ?? "",
        };
      });
      if (rows.length === 0) {
        toast.info("Sem notas lançadas");
        return;
      }
      exportRowsAsCsv(`notas-${turmaNome}.csv`, rows, [
        { key: "matricula", label: "Matrícula" },
        { key: "nome", label: "Aluno" },
        { key: "disciplina", label: "Disciplina" },
        { key: "bimestre", label: "Bimestre" },
        { key: "valor", label: "Nota" },
        { key: "observacao", label: "Observação" },
      ]);
      toast.success(`${rows.length} nota(s) exportada(s)`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        variant="outline"
        className="rounded-full"
        onClick={exportFrequencia}
        disabled={busy !== null}
      >
        {busy === "freq" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Download className="size-4" />
        )}{" "}
        Frequência (CSV)
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="rounded-full"
        onClick={exportNotas}
        disabled={busy !== null}
      >
        {busy === "notas" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Download className="size-4" />
        )}{" "}
        Notas (CSV)
      </Button>
    </div>
  );
}

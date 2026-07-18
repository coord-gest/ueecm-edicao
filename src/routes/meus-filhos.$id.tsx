import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Download,
  Loader2,
  CalendarCheck,
  ClipboardList,
  ShieldCheck,
  Check,
  X,
  FileWarning,
  CalendarPlus,
  Upload,
  MessageCircle,
} from "lucide-react";

import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { PainelLayout } from "@/components/PainelLayout";
import { abrirOuCriarThread } from "@/lib/chat-aluno";
import { useNavigate } from "@tanstack/react-router";
import { EscolaShell } from "@/components/escola/EscolaShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { generateBoletim } from "@/lib/boletim.functions";

export const Route = createFileRoute("/meus-filhos/$id")({
  ssr: false,
  head: () => ({ meta: [{ title: "Detalhes do filho | Escola" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: DetalheFilhoPage,
});

type Aluno = {
  id: string;
  nome_completo: string;
  matricula: string;
  turma_id: string | null;
  data_nascimento: string | null;
  turmas_escolares: { nome: string; ano_serie: string | null; turno: string | null } | null;
};

function DetalheFilhoPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();

  const { data: aluno, isLoading } = useQuery({
    queryKey: ["filho", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alunos")
        .select(
          "id, nome_completo, matricula, turma_id, data_nascimento, turmas_escolares(nome, ano_serie, turno)",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as Aluno | null;
    },
  });

  return (
    <PainelLayout>
      <EscolaShell
        title={aluno?.nome_completo ?? "Detalhes do filho"}
        description={
          aluno
            ? `Matrícula ${aluno.matricula} • ${aluno.turmas_escolares?.nome ?? "Sem turma"}${
                aluno.turmas_escolares?.turno ? ` • ${aluno.turmas_escolares.turno}` : ""
              }`
            : "Boletim, frequência e autorizações"
        }
      >
        <div className="mb-4">
          <Button asChild variant="ghost" size="sm" className="gap-1">
            <Link to="/meus-filhos">
              <ArrowLeft className="size-4" /> Voltar
            </Link>
          </Button>
          {aluno && (
            <ChatProfessorButton alunoId={aluno.id} />
          )}
        </div>

        {isLoading ? (
          <Skeleton className="h-96 rounded-2xl" />
        ) : !aluno ? (
          <div className="rounded-2xl border p-8 text-center text-muted-foreground">
            Aluno não encontrado ou você não tem acesso.
          </div>
        ) : (
          <Tabs defaultValue="boletim" className="w-full">
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="boletim">
                <ClipboardList className="mr-1 size-4" /> Boletim
              </TabsTrigger>
              <TabsTrigger value="frequencia">
                <CalendarCheck className="mr-1 size-4" /> Frequência
              </TabsTrigger>
              <TabsTrigger value="autorizacoes">
                <ShieldCheck className="mr-1 size-4" /> Autorizações
              </TabsTrigger>
              <TabsTrigger value="justificar">
                <FileWarning className="mr-1 size-4" /> Justificar falta
              </TabsTrigger>
              <TabsTrigger value="reuniao">
                <CalendarPlus className="mr-1 size-4" /> Reunião
              </TabsTrigger>
            </TabsList>

            <TabsContent value="boletim" className="mt-4">
              <BoletimTab alunoId={aluno.id} />
            </TabsContent>
            <TabsContent value="frequencia" className="mt-4">
              <FrequenciaTab alunoId={aluno.id} />
            </TabsContent>
            <TabsContent value="autorizacoes" className="mt-4">
              <AutorizacoesTab
                alunoId={aluno.id}
                turmaId={aluno.turma_id}
                userId={user?.id ?? null}
              />
            </TabsContent>
            <TabsContent value="justificar" className="mt-4">
              <JustificarTab alunoId={aluno.id} userId={user?.id ?? null} />
            </TabsContent>
            <TabsContent value="reuniao" className="mt-4">
              <ReuniaoTab alunoNome={aluno.nome_completo} />
            </TabsContent>
          </Tabs>
        )}
      </EscolaShell>
    </PainelLayout>
  );
}

// ============ BOLETIM ============
function BoletimTab({ alunoId }: { alunoId: string }) {
  const baixarBoletim = useServerFn(generateBoletim);
  const [baixando, setBaixando] = useState(false);

  const { data: notas, isLoading } = useQuery({
    queryKey: ["boletim", alunoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notas")
        .select("disciplina, bimestre, valor, observacao")
        .eq("aluno_id", alunoId)
        .order("disciplina");
      if (error) throw error;
      return data ?? [];
    },
  });

  async function baixar() {
    setBaixando(true);
    try {
      const res = await baixarBoletim({ data: { alunoId, bimestre: null } });
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

  if (isLoading) return <Skeleton className="h-64 rounded-2xl" />;

  const disciplinas = Array.from(new Set((notas ?? []).map((n) => n.disciplina))).sort();
  const bimestres = [1, 2, 3, 4];

  const notaFor = (disc: string, bim: number) =>
    (notas ?? []).find((n) => n.disciplina === disc && n.bimestre === bim);

  const media = (disc: string) => {
    const vals = bimestres
      .map((b) => notaFor(disc, b)?.valor)
      .filter((v): v is number => v != null);
    if (vals.length === 0) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={baixar} disabled={baixando} className="rounded-full">
          {baixando ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          Baixar PDF completo
        </Button>
      </div>

      {disciplinas.length === 0 ? (
        <div className="rounded-2xl border p-8 text-center text-sm text-muted-foreground">
          Nenhuma nota lançada ainda.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border">
          <table className="w-full text-sm">
            <thead className="bg-secondary">
              <tr>
                <th className="p-3 text-left font-semibold">Disciplina</th>
                {bimestres.map((b) => (
                  <th key={b} className="p-3 text-center font-semibold">
                    {b}º bim
                  </th>
                ))}
                <th className="p-3 text-center font-semibold">Média</th>
              </tr>
            </thead>
            <tbody>
              {disciplinas.map((d) => {
                const m = media(d);
                return (
                  <tr key={d} className="border-t">
                    <td className="p-3 font-medium">{d}</td>
                    {bimestres.map((b) => {
                      const n = notaFor(d, b);
                      const v = n?.valor;
                      return (
                        <td
                          key={b}
                          className={`p-3 text-center ${
                            v != null && v < 6 ? "font-semibold text-destructive" : ""
                          }`}
                        >
                          {v != null ? Number(v).toFixed(1) : "—"}
                        </td>
                      );
                    })}
                    <td
                      className={`p-3 text-center font-bold ${
                        m != null && m < 6 ? "text-destructive" : "text-primary"
                      }`}
                    >
                      {m != null ? m.toFixed(1) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============ FREQUÊNCIA ============
function FrequenciaTab({ alunoId }: { alunoId: string }) {
  const { data: freq, isLoading } = useQuery({
    queryKey: ["freq", alunoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("frequencia")
        .select("data, presente, justificativa")
        .eq("aluno_id", alunoId)
        .order("data", { ascending: false })
        .limit(180);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) return <Skeleton className="h-64 rounded-2xl" />;

  const total = freq?.length ?? 0;
  const presentes = freq?.filter((f) => f.presente).length ?? 0;
  const faltas = total - presentes;
  const pct = total > 0 ? Math.round((presentes / total) * 100) : null;

  // Últimos 30 dias
  const cutoff = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const f30 = (freq ?? []).filter((f) => f.data >= cutoff);
  const pct30 =
    f30.length > 0 ? Math.round((f30.filter((f) => f.presente).length / f30.length) * 100) : null;

  // Faltas consecutivas recentes
  let seq = 0;
  for (const f of freq ?? []) {
    if (!f.presente) seq++;
    else break;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Frequência geral</p>
          <p className="mt-1 text-3xl font-bold text-primary">{pct != null ? `${pct}%` : "—"}</p>
          <Progress value={pct ?? 0} className="mt-2" />
          <p className="mt-2 text-xs text-muted-foreground">
            {presentes} presenças / {faltas} faltas
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Últimos 30 dias</p>
          <p className="mt-1 text-3xl font-bold">{pct30 != null ? `${pct30}%` : "—"}</p>
          <Progress value={pct30 ?? 0} className="mt-2" />
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Faltas consecutivas</p>
          <p
            className={`mt-1 text-3xl font-bold ${seq >= 3 ? "text-destructive" : "text-foreground"}`}
          >
            {seq}
          </p>
          {seq >= 3 && (
            <Badge variant="destructive" className="mt-2">
              Atenção — procurar a escola
            </Badge>
          )}
        </div>
      </div>

      <div className="rounded-2xl border">
        <div className="border-b bg-secondary/50 p-3 text-sm font-semibold">Histórico recente</div>
        {(freq ?? []).length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Nenhum registro de frequência.
          </p>
        ) : (
          <ul className="max-h-96 divide-y overflow-y-auto">
            {(freq ?? []).slice(0, 60).map((f, i) => (
              <li key={i} className="flex items-center justify-between p-3 text-sm">
                <span>
                  {new Date(f.data + "T00:00:00").toLocaleDateString("pt-BR", {
                    weekday: "short",
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}
                </span>
                <span className="flex items-center gap-2">
                  {f.justificativa && (
                    <span className="text-xs text-muted-foreground">{f.justificativa}</span>
                  )}
                  {f.presente ? (
                    <Badge className="bg-emerald-600">Presente</Badge>
                  ) : (
                    <Badge variant="destructive">Falta</Badge>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ============ AUTORIZAÇÕES ============
type Autorizacao = {
  id: string;
  titulo: string;
  descricao: string;
  data_evento: string | null;
  prazo_resposta: string | null;
  turma_ids: string[];
  aluno_ids: string[];
  ativo: boolean;
  created_at: string;
};

type Resposta = {
  id: string;
  autorizacao_id: string;
  aluno_id: string;
  autorizado: boolean;
  observacao: string | null;
  assinatura_nome: string;
  assinado_em: string;
};

function AutorizacoesTab({
  alunoId,
  turmaId,
  userId,
}: {
  alunoId: string;
  turmaId: string | null;
  userId: string | null;
}) {
  const qc = useQueryClient();

  const { data: autorizacoes, isLoading } = useQuery({
    queryKey: ["autorizacoes", alunoId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("autorizacoes")
        .select("*")
        .eq("ativo", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      const list = (data ?? []) as Autorizacao[];
      return list.filter(
        (a) =>
          a.aluno_ids.includes(alunoId) ||
          (turmaId && a.turma_ids.includes(turmaId)) ||
          (a.aluno_ids.length === 0 && a.turma_ids.length === 0),
      );
    },
  });

  const { data: respostas } = useQuery({
    queryKey: ["respostas", alunoId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("autorizacao_respostas")
        .select("*")
        .eq("aluno_id", alunoId);

      if (error) throw error;
      return (data ?? []) as Resposta[];
    },
  });

  const respMap = new Map((respostas ?? []).map((r) => [r.autorizacao_id, r]));

  const responder = useMutation({
    mutationFn: async (payload: {
      autorizacaoId: string;
      autorizado: boolean;
      observacao: string;
      assinaturaNome: string;
    }) => {
      if (!userId) throw new Error("Não autenticado");
      const { error } = await (supabase as any).from("autorizacao_respostas").upsert(
        {
          autorizacao_id: payload.autorizacaoId,
          aluno_id: alunoId,
          respondido_por: userId,
          autorizado: payload.autorizado,
          observacao: payload.observacao || null,
          assinatura_nome: payload.assinaturaNome,
          user_agent: navigator.userAgent,
          assinado_em: new Date().toISOString(),
        },
        { onConflict: "autorizacao_id,aluno_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Resposta registrada.");
      qc.invalidateQueries({ queryKey: ["respostas", alunoId] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (isLoading) return <Skeleton className="h-64 rounded-2xl" />;

  if (!autorizacoes || autorizacoes.length === 0) {
    return (
      <div className="rounded-2xl border p-8 text-center text-sm text-muted-foreground">
        Nenhuma autorização pendente para este aluno.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {autorizacoes.map((a) => (
        <AutorizacaoCard
          key={a.id}
          autorizacao={a}
          resposta={respMap.get(a.id)}
          onResponder={(autorizado, observacao, assinaturaNome) =>
            responder.mutate({ autorizacaoId: a.id, autorizado, observacao, assinaturaNome })
          }
          disabled={responder.isPending}
        />
      ))}
    </div>
  );
}

function AutorizacaoCard({
  autorizacao,
  resposta,
  onResponder,
  disabled,
}: {
  autorizacao: Autorizacao;
  resposta: Resposta | undefined;
  onResponder: (autorizado: boolean, obs: string, assinatura: string) => void;
  disabled: boolean;
}) {
  const [obs, setObs] = useState("");
  const [nome, setNome] = useState("");
  const prazoVencido =
    autorizacao.prazo_resposta && new Date(autorizacao.prazo_resposta) < new Date();

  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-lg font-semibold">{autorizacao.titulo}</h3>
          {autorizacao.data_evento && (
            <p className="text-xs text-muted-foreground">
              Evento em{" "}
              {new Date(autorizacao.data_evento + "T00:00:00").toLocaleDateString("pt-BR")}
            </p>
          )}
        </div>
        {resposta ? (
          resposta.autorizado ? (
            <Badge className="bg-emerald-600">
              <Check className="mr-1 size-3" /> Autorizado
            </Badge>
          ) : (
            <Badge variant="destructive">
              <X className="mr-1 size-3" /> Recusado
            </Badge>
          )
        ) : prazoVencido ? (
          <Badge variant="secondary">Prazo encerrado</Badge>
        ) : (
          <Badge variant="outline">Pendente</Badge>
        )}
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
        {autorizacao.descricao}
      </p>

      {resposta ? (
        <p className="mt-3 rounded-lg bg-secondary p-3 text-xs text-muted-foreground">
          Assinado por <strong>{resposta.assinatura_nome}</strong> em{" "}
          {new Date(resposta.assinado_em).toLocaleString("pt-BR")}.
          {resposta.observacao && (
            <>
              <br />
              Observação: {resposta.observacao}
            </>
          )}
        </p>
      ) : (
        !prazoVencido && (
          <div className="mt-4 space-y-3 border-t pt-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium">Seu nome completo (assinatura)</label>
                <Input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Digite seu nome"
                  maxLength={120}
                />
              </div>
              <div>
                <label className="text-xs font-medium">Observação (opcional)</label>
                <Textarea
                  value={obs}
                  onChange={(e) => setObs(e.target.value)}
                  rows={1}
                  maxLength={500}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  if (nome.trim().length < 3) {
                    toast.error("Informe seu nome completo para assinar.");
                    return;
                  }
                  onResponder(true, obs, nome.trim());
                }}
                disabled={disabled}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Check className="size-4" /> Autorizar
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (nome.trim().length < 3) {
                    toast.error("Informe seu nome completo para assinar.");
                    return;
                  }
                  onResponder(false, obs, nome.trim());
                }}
                disabled={disabled}
              >
                <X className="size-4" /> Recusar
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Ao clicar, você declara ser responsável legal e concorda com o registro digital (nome,
              data/hora e dispositivo) para fins escolares.
            </p>
          </div>
        )
      )}
    </div>
  );
}

// ============ JUSTIFICAR FALTA ============
function JustificarTab({ alunoId, userId }: { alunoId: string; userId: string | null }) {
  const qc = useQueryClient();
  const [dataIni, setDataIni] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [motivo, setMotivo] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);

  const { data: pedidos, isLoading } = useQuery({
    queryKey: ["justificativas", alunoId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("justificativas_faltas")
        .select("*")
        .eq("aluno_id", alunoId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function enviar() {
    if (!userId) return toast.error("Faça login");
    if (!dataIni || !dataFim || !motivo.trim()) return toast.error("Preencha data e motivo");
    if (dataFim < dataIni) return toast.error("Data final anterior à inicial");
    setEnviando(true);
    try {
      let arquivo_url: string | null = null;
      if (arquivo) {
        if (arquivo.size > 5 * 1024 * 1024) throw new Error("Arquivo maior que 5MB");
        const path = `${userId}/${Date.now()}-${arquivo.name.replace(/[^\w.-]/g, "_")}`;
        const { error: upErr } = await supabase.storage
          .from("justificativas")
          .upload(path, arquivo);
        if (upErr) throw upErr;
        arquivo_url = path;
      }
      const { error } = await (supabase as any).from("justificativas_faltas").insert({
        aluno_id: alunoId,
        solicitante_user_id: userId,
        data_inicio: dataIni,
        data_fim: dataFim,
        motivo: motivo.trim(),
        arquivo_url,
      });
      if (error) throw error;
      toast.success("Justificativa enviada. A escola será notificada.");
      setDataIni("");
      setDataFim("");
      setMotivo("");
      setArquivo(null);
      qc.invalidateQueries({ queryKey: ["justificativas", alunoId] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-card p-4">
        <p className="mb-3 font-semibold">Nova justificativa</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium">Data inicial</label>
            <Input type="date" value={dataIni} onChange={(e) => setDataIni(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium">Data final</label>
            <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
          </div>
        </div>
        <div className="mt-3">
          <label className="text-xs font-medium">Motivo</label>
          <Textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            maxLength={800}
            placeholder="Ex.: consulta médica com atestado"
          />
        </div>
        <div className="mt-3">
          <label className="text-xs font-medium">Anexo (opcional, até 5MB)</label>
          <Input
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
          />
        </div>
        <Button onClick={enviar} disabled={enviando} className="mt-4">
          {enviando ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          Enviar justificativa
        </Button>
      </div>

      <div className="rounded-2xl border">
        <div className="border-b bg-secondary/50 p-3 text-sm font-semibold">Histórico</div>
        {isLoading ? (
          <Skeleton className="m-4 h-24" />
        ) : (pedidos ?? []).length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Nenhuma justificativa enviada.
          </p>
        ) : (
          <div className="divide-y">
            {(pedidos ?? []).map((p: any) => (
              <div key={p.id} className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    {new Date(p.data_inicio).toLocaleDateString("pt-BR")}
                    {p.data_fim !== p.data_inicio &&
                      ` até ${new Date(p.data_fim).toLocaleDateString("pt-BR")}`}
                  </p>
                  <Badge
                    variant={
                      p.status === "aceita"
                        ? "default"
                        : p.status === "recusada"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {p.status}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{p.motivo}</p>
                {p.resposta_observacao && (
                  <p className="mt-2 text-xs italic text-muted-foreground">
                    Resposta da escola: {p.resposta_observacao}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============ REUNIÃO ============
function ReuniaoTab({ alunoNome }: { alunoNome: string }) {
  return (
    <div className="rounded-2xl border bg-card p-6 text-center">
      <CalendarPlus className="mx-auto mb-3 size-10 text-primary" />
      <p className="mb-1 text-lg font-semibold">Agendar reunião</p>
      <p className="mx-auto max-w-md text-sm text-muted-foreground">
        Marque um horário com o professor responsável, coordenação ou direção para conversar sobre{" "}
        <strong>{alunoNome}</strong>.
      </p>
      <Button asChild className="mt-4">
        <Link to="/agendar">
          <CalendarPlus className="size-4" /> Ir para agendamento
        </Link>
      </Button>
    </div>
  );
}

function ChatProfessorButton({ alunoId }: { alunoId: string }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  async function open() {
    setLoading(true);
    try {
      const threadId = await abrirOuCriarThread({ aluno_id: alunoId, papel: "responsavel" });
      navigate({ to: "/chat-aluno/$id", params: { id: threadId } });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao abrir conversa");
    } finally {
      setLoading(false);
    }
  }
  return (
    <Button size="sm" onClick={open} disabled={loading} className="gap-1">
      {loading ? <Loader2 className="size-4 animate-spin" /> : <MessageCircle className="size-4" />}
      Conversar com o professor
    </Button>
  );
}

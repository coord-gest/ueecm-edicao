import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Upload,
  Loader2,
  Trash2,
  FileText,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  History,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/escola/alunos-importar")({
  ssr: false,
  head: () => ({ meta: [{ title: "Importar alunos por documentos | Painel" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: ImportarAlunosPorDocumentos,
});

type Turma = {
  id: string;
  nome: string;
  ano_serie: string;
  ano_letivo: number;
  turno: string;
};

type ExtractedAluno = {
  key: string;
  nome: string;
  ok: boolean;
};

type ArquivoParsed = {
  key: string;
  filename: string;
  turmaId: string | null; // turma escolhida/detectada
  turmaSugerida: string; // nome derivado do arquivo
  alunos: ExtractedAluno[];
  erro?: string;
};

function slug(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toUpperCase();
}

/** Deriva um nome legível de turma a partir do arquivo, ex.: "06°_Ano_A.docx" → "6º Ano A" */
function derivarTurmaDoArquivo(filename: string): string {
  const base = filename
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/°|º/g, "º")
    .replace(/\s+/g, " ")
    .trim();
  // remove zero à esquerda (06 → 6)
  return base.replace(/\b0(\d)/g, "$1");
}

/** Faz match com turma existente por normalização */
function matchTurma(sugestao: string, turmas: Turma[]): Turma | null {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "");
  const alvo = norm(sugestao);
  // tenta match exato do nome
  let hit = turmas.find((t) => norm(`${t.ano_serie} ${t.nome}`) === alvo);
  if (hit) return hit;
  hit = turmas.find((t) => norm(t.nome) === alvo);
  if (hit) return hit;
  // tenta contém
  hit = turmas.find((t) => alvo.includes(norm(t.nome)) && alvo.includes(norm(t.ano_serie)));
  return hit ?? null;
}

/** Extrai nomes de alunos da tabela do .docx usando mammoth. */
async function extrairAlunosDoDocx(file: File): Promise<string[]> {
  const mammoth = await import("mammoth");
  const buf = await file.arrayBuffer();
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: buf });
  const doc = new DOMParser().parseFromString(html, "text/html");
  const nomes: string[] = [];
  const tabelas = Array.from(doc.querySelectorAll("table"));
  for (const tabela of tabelas) {
    const rows = Array.from(tabela.querySelectorAll("tr"));
    for (const row of rows) {
      const cells = Array.from(row.querySelectorAll("td, th"));
      if (cells.length < 2) continue;
      const numero = cells[0]?.textContent?.trim() ?? "";
      const nome = cells[1]?.textContent?.trim() ?? "";
      // Ignora cabeçalho
      if (/^n[ºo°]?$/i.test(numero) || /nome/i.test(nome)) continue;
      // Ignora números vazios ou nome vazio
      if (!nome) continue;
      // Nome deve ter pelo menos 2 palavras razoáveis
      if (nome.split(/\s+/).filter((p) => p.length >= 2).length < 2) continue;
      // Capitaliza
      const capital = nome
        .toLowerCase()
        .split(/\s+/)
        .map((p) => (p.length <= 2 ? p : p.charAt(0).toUpperCase() + p.slice(1)))
        .join(" ")
        .trim();
      nomes.push(capital);
    }
  }
  return nomes;
}

type TurmaLegacy = {
  id: string;
  nome: string;
  serie: string | null;
  ano: number | null;
  turno: string | null;
};

type DisciplinaLegacy = {
  id: string;
  nome: string;
  turma: string | null;
};

type SyncDetalheItem = {
  turma: string;
  ano_letivo: number;
  status: "criada" | "pulada" | "erro";
  motivo?: string;
  disciplinas: string[];
};

type SyncLog = {
  id: string;
  created_at: string;
  turmas_criadas: number;
  turmas_puladas: number;
  turmas_com_erro: number;
  disciplinas_relacionadas: number;
  detalhes: SyncDetalheItem[];
};

type SyncProgresso = {
  total: number;
  done: number;
  atual: string;
} | null;

function normalizeKey(nome: string, ano: number) {
  return (
    nome
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "") +
    "|" +
    String(ano)
  );
}

function ImportarAlunosPorDocumentos() {
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [turmasLegacy, setTurmasLegacy] = useState<TurmaLegacy[]>([]);
  const [disciplinasLegacy, setDisciplinasLegacy] = useState<DisciplinaLegacy[]>([]);
  const [loading, setLoading] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [syncProgresso, setSyncProgresso] = useState<SyncProgresso>(null);
  const [historico, setHistorico] = useState<SyncLog[]>([]);
  const [arquivos, setArquivos] = useState<ArquivoParsed[]>([]);
  const [processando, setProcessando] = useState(false);
  const [saving, setSaving] = useState(false);

  async function carregarTurmas() {
    setLoading(true);
    const [{ data: escolares, error }, { data: legacy }, { data: discs }] = await Promise.all([
      supabase
        .from("turmas_escolares")
        .select("id, nome, ano_serie, ano_letivo, turno")
        .order("ano_serie")
        .order("nome"),
      supabase.from("turmas").select("id, nome, serie, ano, turno").eq("ativo", true).order("nome"),
      supabase.from("disciplinas").select("id, nome, turma").eq("ativo", true),
    ]);
    if (error) toast.error("Erro ao carregar turmas: " + error.message);
    setTurmas((escolares ?? []) as Turma[]);
    setTurmasLegacy((legacy ?? []) as TurmaLegacy[]);
    setDisciplinasLegacy((discs ?? []) as DisciplinaLegacy[]);
    setLoading(false);
  }

  async function carregarHistorico() {
    const { data, error } = await (
      supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            order: (
              c: string,
              o: { ascending: boolean },
            ) => {
              limit: (
                n: number,
              ) => Promise<{ data: SyncLog[] | null; error: { message: string } | null }>;
            };
          };
        };
      }
    )
      .from("turma_sync_logs")
      .select(
        "id, created_at, turmas_criadas, turmas_puladas, turmas_com_erro, disciplinas_relacionadas, detalhes",
      )
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) return; // tabela pode não existir ainda
    setHistorico(data ?? []);
  }

  useEffect(() => {
    carregarTurmas();
    carregarHistorico();
  }, []);

  async function sincronizarDeTurmasLegacy() {
    if (turmasLegacy.length === 0) return;
    setSincronizando(true);
    const anoAtual = new Date().getFullYear();

    // Índice de turmas existentes (idempotência por nome normalizado + ano_letivo)
    const existentes = new Set(turmas.map((t) => normalizeKey(t.nome, t.ano_letivo)));

    // Índice de disciplinas por nome de turma normalizado
    const discPorTurma = new Map<string, string[]>();
    for (const d of disciplinasLegacy) {
      if (!d.turma) continue;
      const k = d.turma
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "");
      const arr = discPorTurma.get(k) ?? [];
      arr.push(d.nome);
      discPorTurma.set(k, arr);
    }

    setSyncProgresso({ total: turmasLegacy.length, done: 0, atual: "" });

    const detalhes: SyncDetalheItem[] = [];
    let criadas = 0;
    let puladas = 0;
    let erros = 0;
    let totalDisc = 0;

    for (let i = 0; i < turmasLegacy.length; i++) {
      const t = turmasLegacy[i];
      const ano = t.ano ?? anoAtual;
      const key = normalizeKey(t.nome, ano);
      const discKey = t.nome
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "");
      const disciplinas = discPorTurma.get(discKey) ?? [];

      setSyncProgresso({ total: turmasLegacy.length, done: i, atual: t.nome });

      if (existentes.has(key)) {
        puladas += 1;
        detalhes.push({
          turma: t.nome,
          ano_letivo: ano,
          status: "pulada",
          motivo: "Já existe no módulo escolar",
          disciplinas,
        });
        continue;
      }

      const { error } = await supabase.from("turmas_escolares").insert({
        nome: t.nome,
        ano_serie: t.serie ?? t.nome,
        ano_letivo: ano,
        turno: (t.turno ?? "manha") as string,
      });

      if (error) {
        erros += 1;
        detalhes.push({
          turma: t.nome,
          ano_letivo: ano,
          status: "erro",
          motivo: error.message,
          disciplinas,
        });
      } else {
        criadas += 1;
        totalDisc += disciplinas.length;
        existentes.add(key);
        detalhes.push({
          turma: t.nome,
          ano_letivo: ano,
          status: "criada",
          disciplinas,
        });
      }
    }

    setSyncProgresso({ total: turmasLegacy.length, done: turmasLegacy.length, atual: "" });

    // Registra log (tabela pode não existir; ignora erro silenciosamente)
    const { data: userData } = await supabase.auth.getUser();
    await (
      supabase as unknown as {
        from: (t: string) => { insert: (v: unknown) => Promise<{ error: unknown }> };
      }
    )
      .from("turma_sync_logs")
      .insert({
        user_id: userData.user?.id ?? null,
        turmas_criadas: criadas,
        turmas_puladas: puladas,
        turmas_com_erro: erros,
        disciplinas_relacionadas: totalDisc,
        detalhes,
      });

    setSincronizando(false);
    setTimeout(() => setSyncProgresso(null), 1500);

    if (erros > 0) {
      toast.warning(
        `Sincronização concluída com avisos: ${criadas} criada(s), ${puladas} já existente(s), ${erros} erro(s).`,
        { description: `${totalDisc} disciplina(s) relacionada(s).` },
      );
    } else if (criadas === 0) {
      toast.info(`Nada novo: todas as ${puladas} turma(s) já estavam sincronizadas.`);
    } else {
      toast.success(
        `${criadas} turma(s) sincronizada(s). ${puladas} já existia(m). ${totalDisc} disciplina(s) relacionada(s).`,
      );
    }

    await Promise.all([carregarTurmas(), carregarHistorico()]);
  }

  const totalAlunos = useMemo(
    () =>
      arquivos.reduce((acc, a) => acc + (a.turmaId ? a.alunos.filter((x) => x.ok).length : 0), 0),
    [arquivos],
  );

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setProcessando(true);
    const novos: ArquivoParsed[] = [];
    for (const file of Array.from(files)) {
      const sugestao = derivarTurmaDoArquivo(file.name);
      const match = matchTurma(sugestao, turmas);
      try {
        const nomes = await extrairAlunosDoDocx(file);
        novos.push({
          key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          filename: file.name,
          turmaId: match?.id ?? null,
          turmaSugerida: sugestao,
          alunos: nomes.map((n, i) => ({
            key: `${i}-${Math.random().toString(36).slice(2, 6)}`,
            nome: n,
            ok: n.trim().length >= 3,
          })),
        });
      } catch (e) {
        novos.push({
          key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          filename: file.name,
          turmaId: match?.id ?? null,
          turmaSugerida: sugestao,
          alunos: [],
          erro: e instanceof Error ? e.message : "Falha ao ler arquivo",
        });
      }
    }
    setArquivos((prev) => [...prev, ...novos]);
    setProcessando(false);
    toast.success(`${novos.length} arquivo(s) processado(s).`);
  }

  function setTurmaArquivo(arquivoKey: string, turmaId: string) {
    setArquivos((prev) =>
      prev.map((a) => (a.key === arquivoKey ? { ...a, turmaId: turmaId || null } : a)),
    );
  }

  function updateNome(arquivoKey: string, alunoKey: string, nome: string) {
    setArquivos((prev) =>
      prev.map((a) =>
        a.key === arquivoKey
          ? {
              ...a,
              alunos: a.alunos.map((x) =>
                x.key === alunoKey ? { ...x, nome, ok: nome.trim().length >= 3 } : x,
              ),
            }
          : a,
      ),
    );
  }

  function removerAluno(arquivoKey: string, alunoKey: string) {
    setArquivos((prev) =>
      prev.map((a) =>
        a.key === arquivoKey ? { ...a, alunos: a.alunos.filter((x) => x.key !== alunoKey) } : a,
      ),
    );
  }

  function removerArquivo(arquivoKey: string) {
    setArquivos((prev) => prev.filter((a) => a.key !== arquivoKey));
  }

  async function importar() {
    if (totalAlunos === 0) {
      toast.warning("Nenhum aluno pronto para importar.");
      return;
    }
    const semTurma = arquivos.filter((a) => !a.turmaId && a.alunos.length > 0);
    if (semTurma.length > 0) {
      toast.error(`Selecione a turma para ${semTurma.length} arquivo(s) antes de importar.`);
      return;
    }
    setSaving(true);
    try {
      const { data: existentes, error: errExist } = await supabase
        .from("alunos")
        .select("matricula");
      if (errExist) throw errExist;
      const usadas = new Set((existentes ?? []).map((r) => r.matricula));

      // Agrupa por turma para gerar matrículas sequenciais consistentes
      const porTurma = new Map<string, ExtractedAluno[]>();
      for (const arq of arquivos) {
        if (!arq.turmaId) continue;
        const lista = arq.alunos.filter((a) => a.ok);
        const atual = porTurma.get(arq.turmaId) ?? [];
        porTurma.set(arq.turmaId, [...atual, ...lista]);
      }

      let totalInseridos = 0;
      const erros: string[] = [];

      for (const [turmaId, lista] of porTurma) {
        const turma = turmas.find((t) => t.id === turmaId);
        if (!turma) continue;
        const prefixo = `${turma.ano_letivo}${slug(turma.nome)}`;
        let seq = 1;
        const payload = lista.map((a) => {
          let matricula = `${prefixo}${String(seq).padStart(3, "0")}`;
          while (usadas.has(matricula)) {
            seq += 1;
            matricula = `${prefixo}${String(seq).padStart(3, "0")}`;
          }
          usadas.add(matricula);
          seq += 1;
          return {
            matricula,
            nome_completo: a.nome.trim(),
            turma_id: turmaId,
            ativo: true,
          };
        });

        const { error } = await supabase.from("alunos").insert(payload);
        if (error) erros.push(`${turma.nome}: ${error.message}`);
        else totalInseridos += payload.length;
      }

      if (erros.length > 0) {
        toast.warning(
          `${totalInseridos} aluno(s) importado(s). ${erros.length} turma(s) com erro.`,
          { description: erros.slice(0, 3).join(" • ") },
        );
      } else {
        toast.success(`${totalInseridos} aluno(s) importado(s) com sucesso!`);
        setArquivos([]);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao importar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <Breadcrumbs
          items={[
            { label: "Painel", to: "/painel" },
            { label: "Alunos", to: "/escola/alunos" },
            { label: "Importar por documentos" },
          ]}
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Importar alunos por documentos</h1>
            <p className="text-sm text-muted-foreground">
              Envie os arquivos <code>.docx</code> das turmas (com a tabela de Nº e Nome). O sistema
              lê a tabela, detecta a turma pelo nome do arquivo e mostra os alunos para revisão
              antes de importar.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/escola/alunos">
              <ArrowLeft className="size-4" /> Voltar
            </Link>
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Carregando turmas…
          </div>
        ) : (
          <>
            {turmasLegacy.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <RefreshCw className="size-4" /> Sincronizar com Turmas e Disciplinas
                  </CardTitle>
                  <CardDescription>
                    {turmas.length === 0 ? (
                      <>
                        Encontramos <strong>{turmasLegacy.length}</strong> turma(s) em{" "}
                        <em>Turmas e Disciplinas</em> ainda não presentes no módulo escolar.
                      </>
                    ) : (
                      <>
                        <strong>{turmasLegacy.length}</strong> turma(s) em{" "}
                        <em>Turmas e Disciplinas</em> · <strong>{turmas.length}</strong> no módulo
                        escolar. A sincronização é idempotente: pode rodar quantas vezes quiser sem
                        duplicar nem alterar registros já existentes.
                      </>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <Button onClick={sincronizarDeTurmasLegacy} disabled={sincronizando}>
                      {sincronizando ? (
                        <>
                          <Loader2 className="size-4 animate-spin" /> Sincronizando…
                        </>
                      ) : (
                        <>
                          <RefreshCw className="size-4" />
                          {turmas.length === 0
                            ? `Sincronizar ${turmasLegacy.length} turma(s) agora`
                            : "Reexecutar sincronização"}
                        </>
                      )}
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {disciplinasLegacy.length} disciplina(s) serão relacionadas quando aplicável.
                    </span>
                  </div>

                  {syncProgresso && (
                    <div className="space-y-1">
                      <Progress
                        value={
                          syncProgresso.total > 0
                            ? (syncProgresso.done / syncProgresso.total) * 100
                            : 0
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        {syncProgresso.done}/{syncProgresso.total}
                        {syncProgresso.atual ? ` · ${syncProgresso.atual}` : ""}
                      </p>
                    </div>
                  )}

                  {historico.length > 0 && (
                    <Accordion type="single" collapsible className="mt-2">
                      <AccordionItem value="hist" className="border-0">
                        <AccordionTrigger className="py-2 text-sm">
                          <span className="flex items-center gap-2">
                            <History className="size-4" /> Histórico de sincronizações (
                            {historico.length})
                          </span>
                        </AccordionTrigger>
                        <AccordionContent>
                          <ul className="space-y-2">
                            {historico.map((h) => (
                              <li key={h.id} className="rounded-md border p-2 text-xs">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="font-medium">
                                    {new Date(h.created_at).toLocaleString("pt-BR")}
                                  </span>
                                  <span className="text-muted-foreground">
                                    <CheckCircle2 className="mr-1 inline size-3 text-emerald-600" />
                                    {h.turmas_criadas} criada(s) ·{" "}
                                    <span className="text-muted-foreground">
                                      {h.turmas_puladas} pulada(s)
                                    </span>{" "}
                                    ·{" "}
                                    <span
                                      className={h.turmas_com_erro > 0 ? "text-destructive" : ""}
                                    >
                                      {h.turmas_com_erro} erro(s)
                                    </span>{" "}
                                    · {h.disciplinas_relacionadas} disciplina(s)
                                  </span>
                                </div>
                                {h.detalhes && h.detalhes.length > 0 && (
                                  <details className="mt-1">
                                    <summary className="cursor-pointer text-muted-foreground">
                                      Ver detalhes
                                    </summary>
                                    <ul className="mt-1 space-y-0.5 pl-3">
                                      {h.detalhes.map((d, i) => (
                                        <li key={i}>
                                          {d.status === "criada" && "✅ "}
                                          {d.status === "pulada" && "⏭ "}
                                          {d.status === "erro" && "❌ "}
                                          <strong>{d.turma}</strong> ({d.ano_letivo})
                                          {d.motivo ? ` — ${d.motivo}` : ""}
                                          {d.disciplinas.length > 0
                                            ? ` · ${d.disciplinas.length} disciplina(s)`
                                            : ""}
                                        </li>
                                      ))}
                                    </ul>
                                  </details>
                                )}
                              </li>
                            ))}
                          </ul>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}

        {!loading && turmas.length === 0 ? (
          turmasLegacy.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                Nenhuma turma cadastrada. Crie turmas em{" "}
                <Link to="/escola/turmas" className="underline">
                  Turmas
                </Link>{" "}
                antes de importar alunos.
              </CardContent>
            </Card>
          ) : null
        ) : !loading ? (
          <>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Enviar arquivos das turmas</CardTitle>
                <CardDescription>
                  Selecione um ou vários arquivos <code>.docx</code>. Cada arquivo corresponde a uma
                  turma inteira.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Label htmlFor="uploader" className="sr-only">
                  Arquivos
                </Label>
                <Input
                  id="uploader"
                  type="file"
                  multiple
                  accept=".docx"
                  disabled={processando || saving}
                  onChange={(e) => {
                    handleFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
                {processando && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" /> Lendo arquivos…
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4">
              {arquivos.map((arq) => {
                const validos = arq.alunos.filter((a) => a.ok).length;
                const turmaSel = turmas.find((t) => t.id === arq.turmaId);
                return (
                  <Card key={arq.key}>
                    <CardHeader className="pb-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <CardTitle className="flex items-center gap-2 text-base">
                            <FileText className="size-4" />
                            <span className="truncate">{arq.filename}</span>
                          </CardTitle>
                          <CardDescription>
                            Sugestão: <strong>{arq.turmaSugerida}</strong> ·{" "}
                            {arq.erro ? (
                              <span className="text-destructive">
                                <AlertTriangle className="mr-1 inline size-3" />
                                {arq.erro}
                              </span>
                            ) : (
                              <>
                                <CheckCircle2 className="mr-1 inline size-3 text-emerald-600" />
                                {validos} aluno(s) detectado(s)
                              </>
                            )}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <Select
                            value={arq.turmaId ?? ""}
                            onValueChange={(v) => setTurmaArquivo(arq.key, v)}
                          >
                            <SelectTrigger className="w-[240px]">
                              <SelectValue placeholder="Selecione a turma" />
                            </SelectTrigger>
                            <SelectContent>
                              {turmas.map((t) => (
                                <SelectItem key={t.id} value={t.id}>
                                  {t.ano_serie} · {t.nome} · {t.turno}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removerArquivo(arq.key)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    {arq.alunos.length > 0 && (
                      <CardContent>
                        {!turmaSel && (
                          <p className="mb-2 text-xs text-amber-600">
                            ⚠ Selecione a turma acima para incluir estes alunos no total.
                          </p>
                        )}
                        <div className="rounded-md border">
                          <div className="max-h-80 overflow-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-muted/50 text-xs">
                                <tr>
                                  <th className="px-2 py-1.5 text-left">#</th>
                                  <th className="px-2 py-1.5 text-left">Nome do aluno</th>
                                  <th className="px-2 py-1.5"></th>
                                </tr>
                              </thead>
                              <tbody>
                                {arq.alunos.map((a, i) => (
                                  <tr key={a.key} className="border-t">
                                    <td className="px-2 py-1 text-muted-foreground">{i + 1}</td>
                                    <td className="px-2 py-1">
                                      <Input
                                        value={a.nome}
                                        onChange={(e) => updateNome(arq.key, a.key, e.target.value)}
                                        className={`h-8 ${!a.ok ? "border-destructive" : ""}`}
                                      />
                                    </td>
                                    <td className="px-2 py-1 text-right">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removerAluno(arq.key, a.key)}
                                      >
                                        <Trash2 className="size-4" />
                                      </Button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>

            {arquivos.length > 0 && (
              <div className="sticky bottom-4 z-10 flex items-center justify-between rounded-lg border bg-card p-3 shadow-lg">
                <div className="text-sm">
                  <strong>{totalAlunos}</strong> aluno(s) prontos para importar em{" "}
                  <strong>
                    {new Set(arquivos.filter((a) => a.turmaId).map((a) => a.turmaId)).size}
                  </strong>{" "}
                  turma(s)
                </div>
                <Button onClick={importar} disabled={saving || totalAlunos === 0}>
                  {saving ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Upload className="size-4" />
                  )}
                  Importar {totalAlunos} aluno(s)
                </Button>
              </div>
            )}
          </>
        ) : null}
      </div>
    </main>
  );
}

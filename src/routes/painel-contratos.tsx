import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { FileSignature, Plus, X, PenSquare, CheckCircle2, XCircle } from "lucide-react";
import { Eye } from "lucide-react";
import { ContratoView } from "@/components/ContratoView";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  criarContrato,
  listarContratosProfessor,
  assinarContratoProfessor,
  encerrarContrato,
  addCheckpoint,
  corStatus,
  rotuloStatus,
  type Contrato,
  type Objetivo,
} from "@/lib/contratos.functions";
import { listMinhasTurmasMeritos, listAlunosDaTurmaMeritos } from "@/lib/meritos.functions";

export const Route = createFileRoute("/painel-contratos")({
  ssr: false,
  component: PainelContratos,
  head: () => ({
    meta: [
      { title: "Contratos de Compromisso | Conecta UEECM" },
      {
        name: "description",
        content: "Registre acordos entre professor, aluno e responsável para melhorar engajamento e resultados.",
      },
      { property: "og:title", content: "Contratos de Compromisso Digital" },
      { property: "og:description", content: "Acordos pedagógicos assinados por professor, aluno e família." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function PainelContratos() {
  const qc = useQueryClient();
  const listar = useServerFn(listarContratosProfessor);
  const query = useQuery({ queryKey: ["contratos-professor"], queryFn: () => listar() });
  const [open, setOpen] = useState(false);
  const [viewContrato, setViewContrato] = useState<Contrato | null>(null);

  const contratos = (query.data ?? []) as Contrato[];
  const ativos = contratos.filter((c) => c.status === "ativo").length;
  const aguardando = contratos.filter((c) => c.status === "aguardando_assinaturas").length;

  return (
    <div className="container mx-auto px-4 py-6 space-y-6 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <FileSignature className="h-7 w-7 sm:h-8 sm:w-8 text-primary shrink-0" />
            Contratos de Compromisso
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1 max-w-2xl">
            Combine metas claras com o aluno e a família. Após as três assinaturas o contrato fica ativo
            e vocês acompanham juntos pelos checkpoints semanais.
          </p>
        </div>
        <Button onClick={() => setOpen(true)} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" /> Novo contrato
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MiniCard label="Ativos" value={ativos} />
        <MiniCard label="Aguardando assinatura" value={aguardando} />
        <MiniCard label="Total" value={contratos.length} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contratos ({contratos.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {query.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : contratos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum contrato ainda. Comece criando um para um aluno que precisa de acompanhamento próximo.
            </p>
          ) : (
            contratos.map((c) => (
              <ContratoRow
                key={c.id}
                contrato={c}
                onView={() => setViewContrato(c)}
                onChanged={() => qc.invalidateQueries({ queryKey: ["contratos-professor"] })}
              />
            ))
          )}
        </CardContent>
      </Card>

      <NovoContratoDialog
        open={open}
        onOpenChange={setOpen}
        onCreated={() => qc.invalidateQueries({ queryKey: ["contratos-professor"] })}
      />

      <ContratoView
        contrato={viewContrato}
        open={!!viewContrato}
        onOpenChange={(o) => !o && setViewContrato(null)}
        viewer="professor"
      />
    </div>
  );
}

function MiniCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="text-3xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function ContratoRow({
  contrato,
  onChanged,
  onView,
}: {
  contrato: Contrato;
  onChanged: () => void;
  onView: () => void;
}) {
  const assinar = useServerFn(assinarContratoProfessor);
  const encerrar = useServerFn(encerrarContrato);
  const check = useServerFn(addCheckpoint);
  const [busy, setBusy] = useState(false);

  const doAssinar = async () => {
    setBusy(true);
    try {
      await assinar({ data: { contratoId: contrato.id } });
      toast.success("Contrato assinado pelo professor.");
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const doEncerrar = async (status: "concluido" | "cancelado") => {
    setBusy(true);
    try {
      await encerrar({ data: { contratoId: contrato.id, status } });
      toast.success(status === "concluido" ? "Contrato concluído!" : "Contrato cancelado.");
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const doCheck = async (status: "cumprido" | "parcial" | "nao_cumprido") => {
    setBusy(true);
    try {
      await check({ data: { contratoId: contrato.id, status } });
      toast.success("Checkpoint registrado.");
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border rounded-md p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold">{contrato.titulo}</h3>
            <Badge className={corStatus(contrato.status)}>{rotuloStatus(contrato.status)}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {contrato.aluno_nome ?? "Aluno"} · {contrato.turma_nome ?? "Sem turma"}
            {contrato.prazo ? ` · Prazo ${new Date(contrato.prazo).toLocaleDateString("pt-BR")}` : ""}
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <SignPill label="Prof." on={!!contrato.assinado_professor_em} />
          <SignPill label="Família" on={!!contrato.assinado_responsavel_em} />
          <SignPill label="Aluno" on={!!contrato.assinado_aluno_em} />
        </div>
      </div>

      {contrato.objetivos.length > 0 && (
        <ul className="text-sm space-y-1 pl-4 list-disc marker:text-primary">
          {contrato.objetivos.map((o, i) => (
            <li key={i}>{o.texto}</li>
          ))}
        </ul>
      )}

      {(contrato.status === "ativo" || contrato.status === "aguardando_assinaturas") && (
        <div className="flex flex-wrap gap-2 pt-1 border-t">
          <Button size="sm" variant="outline" onClick={onView}>
            <Eye className="mr-1 h-3 w-3" /> Ver contrato
          </Button>
          {!contrato.assinado_professor_em && (
            <Button size="sm" variant="outline" onClick={doAssinar} disabled={busy}>
              <PenSquare className="mr-1 h-3 w-3" /> Assinar como professor
            </Button>
          )}
          {contrato.status === "ativo" && (
            <>
              <Button size="sm" variant="outline" onClick={() => doCheck("cumprido")} disabled={busy}>
                ✅ Cumprido
              </Button>
              <Button size="sm" variant="outline" onClick={() => doCheck("parcial")} disabled={busy}>
                ➖ Parcial
              </Button>
              <Button size="sm" variant="outline" onClick={() => doCheck("nao_cumprido")} disabled={busy}>
                ❌ Não cumpriu
              </Button>
              <Button size="sm" variant="ghost" className="text-emerald-600" onClick={() => doEncerrar("concluido")} disabled={busy}>
                <CheckCircle2 className="mr-1 h-3 w-3" /> Concluir
              </Button>
            </>
          )}
          <Button size="sm" variant="ghost" className="text-red-600" onClick={() => doEncerrar("cancelado")} disabled={busy}>
            <XCircle className="mr-1 h-3 w-3" /> Cancelar
          </Button>
        </div>
      )}
    </div>
  );
}

function SignPill({ label, on }: { label: string; on: boolean }) {
  return (
    <span
      className={`px-2 py-0.5 rounded-full border text-[10px] uppercase tracking-wide ${
        on ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" : "bg-muted text-muted-foreground"
      }`}
    >
      {label} {on ? "✓" : "…"}
    </span>
  );
}

function NovoContratoDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
}) {
  const listTurmas = useServerFn(listMinhasTurmasMeritos);
  const listAlunos = useServerFn(listAlunosDaTurmaMeritos);
  const criar = useServerFn(criarContrato);

  const turmasQ = useQuery({ queryKey: ["contratos-turmas"], queryFn: () => listTurmas(), enabled: open });
  const [turmaId, setTurmaId] = useState("");
  const [alunoId, setAlunoId] = useState("");
  const alunosQ = useQuery({
    queryKey: ["contratos-alunos", turmaId],
    queryFn: () => listAlunos({ data: { turmaId } }),
    enabled: open && !!turmaId,
  });

  const [titulo, setTitulo] = useState("");
  const [motivo, setMotivo] = useState("");
  const [prazo, setPrazo] = useState("");
  const [objetivos, setObjetivos] = useState<Objetivo[]>([{ texto: "" }]);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setTurmaId("");
    setAlunoId("");
    setTitulo("");
    setMotivo("");
    setPrazo("");
    setObjetivos([{ texto: "" }]);
  };

  const submit = async (assinarAgora: boolean) => {
    const obj = objetivos.map((o) => ({ texto: o.texto.trim() })).filter((o) => o.texto.length >= 3);
    if (!alunoId || !titulo.trim() || obj.length === 0) {
      toast.error("Preencha aluno, título e ao menos um objetivo.");
      return;
    }
    setBusy(true);
    try {
      await criar({
        data: {
          alunoId,
          turmaId: turmaId || null,
          titulo: titulo.trim(),
          motivo: motivo.trim() || undefined,
          objetivos: obj,
          prazo: prazo || null,
          assinarAgora,
        },
      });
      toast.success(assinarAgora ? "Contrato criado e assinado!" : "Contrato salvo como rascunho.");
      onCreated();
      reset();
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo contrato de compromisso</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Turma</Label>
              <Select
                value={turmaId}
                onValueChange={(v) => {
                  setTurmaId(v);
                  setAlunoId("");
                }}
              >
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {(turmasQ.data ?? []).map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Aluno</Label>
              <Select value={alunoId} onValueChange={setAlunoId} disabled={!turmaId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {(alunosQ.data ?? []).map((a: { id: string; nome_completo: string }) => (
                    <SelectItem key={a.id} value={a.id}>{a.nome_completo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Título do compromisso</Label>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Melhorar a frequência e as tarefas de matemática"
            />
          </div>

          <div>
            <Label>Motivo / contexto (opcional)</Label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={2}
              placeholder="Por que este contrato está sendo proposto?"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <Label>Objetivos combinados</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setObjetivos((o) => [...o, { texto: "" }])}
              >
                <Plus className="h-3 w-3 mr-1" /> Adicionar
              </Button>
            </div>
            <div className="space-y-2">
              {objetivos.map((o, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={o.texto}
                    onChange={(e) =>
                      setObjetivos((arr) => arr.map((x, idx) => (idx === i ? { texto: e.target.value } : x)))
                    }
                    placeholder={`Objetivo ${i + 1}`}
                  />
                  {objetivos.length > 1 && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => setObjetivos((arr) => arr.filter((_, idx) => idx !== i))}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label>Prazo (opcional)</Label>
            <Input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="outline" onClick={() => submit(false)} disabled={busy}>
            Salvar rascunho
          </Button>
          <Button onClick={() => submit(true)} disabled={busy}>
            <PenSquare className="mr-1 h-4 w-4" /> Assinar e enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
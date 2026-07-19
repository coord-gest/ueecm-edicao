import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Database,
  Loader2,
  Sprout,
  Trash2,
  Users,
  GraduationCap,
  Megaphone,
  BellRing,
  Vote,
  FileCheck,
  CalendarClock,
  Inbox,
  Star,
  Quote,
  MessageSquare,
  ListChecks,
  UserCog,
  Trash,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  seedAlunos, wipeAlunos,
  seedResponsaveis, wipeResponsaveis,
  seedNotas, wipeNotas,
  seedFrequencia, wipeFrequencia,
  seedJustificativas, wipeJustificativas,
  seedComunicados, wipeComunicados,
  seedAlertas, wipeAlertas,
  seedEnquetes, wipeEnquetes,
  seedAutorizacoes, wipeAutorizacoes,
  seedAgendamentos, wipeAgendamentos,
  seedMensagensCoord, wipeMensagensCoord,
  seedAlunosDestaque, wipeAlunosDestaque,
  seedDepoimentos, wipeDepoimentos,
  seedComentariosPosts, wipeComentariosPosts,
  seedReminders, wipeReminders,
  wipeAllExtended,
} from "@/lib/seed-extended.functions";

type Block = {
  key: string;
  label: string;
  descricao: string;
  icon: React.ComponentType<{ className?: string }>;
  seed: () => Promise<unknown>;
  wipe: () => Promise<unknown>;
  formatResult: (r: unknown) => string;
  requires?: string;
};

type Category = "pessoas" | "academico" | "comunicacao" | "engajamento";

export function SeedExtendedCard() {
  const qc = useQueryClient();
  const [log, setLog] = useState<Array<{ label: string; msg: string; at: string }>>([]);

  const record = (label: string, msg: string) =>
    setLog((h) => [{ label, msg, at: new Date().toLocaleTimeString("pt-BR") }, ...h].slice(0, 20));

  const invalidateAll = () => {
    qc.invalidateQueries();
  };

  // Bind server fn callers
  const fns = {
    alunosSeed: useServerFn(seedAlunos), alunosWipe: useServerFn(wipeAlunos),
    respSeed: useServerFn(seedResponsaveis), respWipe: useServerFn(wipeResponsaveis),
    notasSeed: useServerFn(seedNotas), notasWipe: useServerFn(wipeNotas),
    freqSeed: useServerFn(seedFrequencia), freqWipe: useServerFn(wipeFrequencia),
    justSeed: useServerFn(seedJustificativas), justWipe: useServerFn(wipeJustificativas),
    comSeed: useServerFn(seedComunicados), comWipe: useServerFn(wipeComunicados),
    alrSeed: useServerFn(seedAlertas), alrWipe: useServerFn(wipeAlertas),
    enqSeed: useServerFn(seedEnquetes), enqWipe: useServerFn(wipeEnquetes),
    autSeed: useServerFn(seedAutorizacoes), autWipe: useServerFn(wipeAutorizacoes),
    ageSeed: useServerFn(seedAgendamentos), ageWipe: useServerFn(wipeAgendamentos),
    msgSeed: useServerFn(seedMensagensCoord), msgWipe: useServerFn(wipeMensagensCoord),
    desSeed: useServerFn(seedAlunosDestaque), desWipe: useServerFn(wipeAlunosDestaque),
    depSeed: useServerFn(seedDepoimentos), depWipe: useServerFn(wipeDepoimentos),
    cmtSeed: useServerFn(seedComentariosPosts), cmtWipe: useServerFn(wipeComentariosPosts),
    remSeed: useServerFn(seedReminders), remWipe: useServerFn(wipeReminders),
    wipeAll: useServerFn(wipeAllExtended),
  };

  const blocks: Array<Block & { cat: Category }> = [
    // Pessoas
    {
      cat: "pessoas", key: "alunos", label: "Alunos", icon: GraduationCap,
      descricao: "24 alunos fictícios distribuídos nas turmas seed (matrícula SEED-*).",
      seed: () => fns.alunosSeed({}), wipe: () => fns.alunosWipe({}),
      formatResult: (r) => `${(r as { created?: number; deleted?: number }).created ?? (r as { deleted?: number }).deleted ?? 0} registros`,
      requires: "Turmas + Disciplinas",
    },
    {
      cat: "pessoas", key: "responsaveis", label: "Responsáveis + vínculos", icon: UserCog,
      descricao: "Responsáveis fictícios ligados aos alunos, incluindo os usuários seed.family.*.",
      seed: () => fns.respSeed({}), wipe: () => fns.respWipe({}),
      formatResult: (r) => {
        const x = r as { responsaveis?: number; vinculos?: number; deleted?: number };
        return x.deleted != null ? `${x.deleted} removidos` : `${x.responsaveis ?? 0} resp / ${x.vinculos ?? 0} vínculos`;
      },
      requires: "Alunos",
    },
    // Acadêmico
    {
      cat: "academico", key: "notas", label: "Notas (3 bimestres)", icon: ListChecks,
      descricao: "Notas de 5.0 a 9.5 em todas as disciplinas seed, 3 bimestres.",
      seed: () => fns.notasSeed({}), wipe: () => fns.notasWipe({}),
      formatResult: (r) => `${(r as { created?: number; deleted?: number }).created ?? (r as { deleted?: number }).deleted ?? 0} lançamentos`,
      requires: "Alunos + Disciplinas",
    },
    {
      cat: "academico", key: "frequencia", label: "Frequência (30 dias)", icon: CalendarClock,
      descricao: "~30 dias úteis com ~5% de faltas para cada aluno.",
      seed: () => fns.freqSeed({}), wipe: () => fns.freqWipe({}),
      formatResult: (r) => `${(r as { created?: number; deleted?: number }).created ?? (r as { deleted?: number }).deleted ?? 0} registros`,
      requires: "Alunos",
    },
    {
      cat: "academico", key: "justificativas", label: "Justificativas de falta", icon: FileCheck,
      descricao: "6 pedidos (aprovado / pendente / rejeitado) para testar o fluxo da família.",
      seed: () => fns.justSeed({}), wipe: () => fns.justWipe({}),
      formatResult: (r) => `${(r as { created?: number; deleted?: number }).created ?? (r as { deleted?: number }).deleted ?? 0} justificativas`,
      requires: "Alunos + seed.family",
    },
    {
      cat: "academico", key: "destaques", label: "Alunos em destaque", icon: Star,
      descricao: "Ranking mensal com 4 posições marcadas [Seed].",
      seed: () => fns.desSeed({}), wipe: () => fns.desWipe({}),
      formatResult: (r) => `${(r as { created?: number; deleted?: number }).created ?? (r as { deleted?: number }).deleted ?? 0} destaques`,
      requires: "Alunos",
    },
    // Comunicação
    {
      cat: "comunicacao", key: "comunicados", label: "Comunicados", icon: Megaphone,
      descricao: "8 comunicados (informativos, urgentes, eventos) + leituras simuladas.",
      seed: () => fns.comSeed({}), wipe: () => fns.comWipe({}),
      formatResult: (r) => {
        const x = r as { created?: number; leituras?: number; deleted?: number };
        return x.deleted != null ? `${x.deleted} removidos` : `${x.created ?? 0} comunicados / ${x.leituras ?? 0} leituras`;
      },
      requires: "seed.coordenador.1",
    },
    {
      cat: "comunicacao", key: "alertas", label: "Alertas globais", icon: BellRing,
      descricao: "3 alertas (info, warning, destructive) com prazos e links.",
      seed: () => fns.alrSeed({}), wipe: () => fns.alrWipe({}),
      formatResult: (r) => `${(r as { created?: number; deleted?: number }).created ?? (r as { deleted?: number }).deleted ?? 0} alertas`,
    },
    {
      cat: "comunicacao", key: "mensagens", label: "Mensagens Coordenação", icon: MessageSquare,
      descricao: "4 threads (algumas já respondidas pela coordenação).",
      seed: () => fns.msgSeed({}), wipe: () => fns.msgWipe({}),
      formatResult: (r) => `${(r as { created?: number; deleted?: number }).created ?? (r as { deleted?: number }).deleted ?? 0} mensagens`,
      requires: "seed.family + coordenador",
    },
    {
      cat: "comunicacao", key: "agendamentos", label: "Agendamentos", icon: Inbox,
      descricao: "5 agendamentos (pendente / confirmado / concluído / recusado / cancelado).",
      seed: () => fns.ageSeed({}), wipe: () => fns.ageWipe({}),
      formatResult: (r) => `${(r as { created?: number; deleted?: number }).created ?? (r as { deleted?: number }).deleted ?? 0} agendamentos`,
      requires: "seed.family",
    },
    // Engajamento
    {
      cat: "engajamento", key: "enquetes", label: "Enquetes", icon: Vote,
      descricao: "3 enquetes (ativa pública, encerrada, staff) com opções.",
      seed: () => fns.enqSeed({}), wipe: () => fns.enqWipe({}),
      formatResult: (r) => {
        const x = r as { enquetes?: number; opcoes?: number; deleted?: number };
        return x.deleted != null ? `${x.deleted} removidos` : `${x.enquetes ?? 0} enquetes / ${x.opcoes ?? 0} opções`;
      },
    },
    {
      cat: "engajamento", key: "autorizacoes", label: "Autorizações", icon: FileCheck,
      descricao: "2 autorizações (passeio + uso de imagem) com respostas simuladas.",
      seed: () => fns.autSeed({}), wipe: () => fns.autWipe({}),
      formatResult: (r) => {
        const x = r as { autorizacoes?: number; respostas?: number; deleted?: number };
        return x.deleted != null ? `${x.deleted} removidos` : `${x.autorizacoes ?? 0} autorizações / ${x.respostas ?? 0} respostas`;
      },
      requires: "Alunos + seed.family.1",
    },
    {
      cat: "engajamento", key: "depoimentos", label: "Depoimentos de famílias", icon: Quote,
      descricao: "4 depoimentos (elogios, sugestões) aprovados.",
      seed: () => fns.depSeed({}), wipe: () => fns.depWipe({}),
      formatResult: (r) => `${(r as { created?: number; deleted?: number }).created ?? (r as { deleted?: number }).deleted ?? 0} depoimentos`,
    },
    {
      cat: "engajamento", key: "comentarios", label: "Comentários em posts", icon: MessageSquare,
      descricao: "6 comentários (aprovados, pendentes, rejeitado) para testar moderação.",
      seed: () => fns.cmtSeed({}), wipe: () => fns.cmtWipe({}),
      formatResult: (r) => `${(r as { created?: number; deleted?: number }).created ?? (r as { deleted?: number }).deleted ?? 0} comentários`,
      requires: "Posts",
    },
    {
      cat: "engajamento", key: "reminders", label: "Lembretes (staff)", icon: BellRing,
      descricao: "Lembretes para os usuários seed do time pedagógico.",
      seed: () => fns.remSeed({}), wipe: () => fns.remWipe({}),
      formatResult: (r) => `${(r as { created?: number; deleted?: number }).created ?? (r as { deleted?: number }).deleted ?? 0} lembretes`,
      requires: "Usuários demo",
    },
  ];

  const seedMut = useMutation({
    mutationFn: async (b: Block) => {
      const r = await b.seed();
      return { label: b.label, msg: `+ ${b.formatResult(r)}` };
    },
    onSuccess: ({ label, msg }) => {
      record(label, msg);
      toast.success(`${label}: ${msg}`);
      invalidateAll();
    },
    onError: (e: Error, b) => toast.error(`${b.label}: ${e.message}`),
  });
  const wipeMut = useMutation({
    mutationFn: async (b: Block) => {
      const r = await b.wipe();
      return { label: b.label, msg: b.formatResult(r) };
    },
    onSuccess: ({ label, msg }) => {
      record(label, `— ${msg}`);
      toast.success(`${label} limpo: ${msg}`);
      invalidateAll();
    },
    onError: (e: Error, b) => toast.error(`${b.label}: ${e.message}`),
  });
  const wipeAllMut = useMutation({
    mutationFn: async () => fns.wipeAll({}),
    onSuccess: (r) => {
      const total = Object.values(r as Record<string, number>).reduce((a, b) => a + (b ?? 0), 0);
      record("Reset total", `— ${total} registros`);
      toast.success(`Reset total: ${total} registros removidos`);
      invalidateAll();
    },
    onError: (e: Error) => toast.error(`Reset falhou: ${e.message}`),
  });

  const pending = (key: string) =>
    (seedMut.isPending && seedMut.variables?.key === key) ||
    (wipeMut.isPending && wipeMut.variables?.key === key);

  const cats: Array<{ id: Category; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: "pessoas", label: "Pessoas", icon: Users },
    { id: "academico", label: "Acadêmico", icon: GraduationCap },
    { id: "comunicacao", label: "Comunicação", icon: Megaphone },
    { id: "engajamento", label: "Engajamento", icon: Vote },
  ];

  return (
    <section className="rounded-3xl border border-border/60 bg-card p-6 shadow-elegant">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Database className="size-5" />
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold text-foreground">
              Seed estendido (dados fictícios)
            </h2>
            <p className="text-sm text-muted-foreground">
              Popula alunos, notas, comunicados, enquetes e mais — todos com marcadores para wipe seguro.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="text-destructive hover:bg-destructive/10"
          onClick={() => {
            if (confirm("Remover TODOS os dados fictícios do seed estendido? Ação irreversível.")) {
              wipeAllMut.mutate();
            }
          }}
          disabled={wipeAllMut.isPending}
        >
          {wipeAllMut.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Trash className="mr-2 size-4" />}
          Reset total
        </Button>
      </header>

      <Tabs defaultValue="pessoas" className="mt-5">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-muted/60 p-1">
          {cats.map((c) => {
            const count = blocks.filter((b) => b.cat === c.id).length;
            const Icon = c.icon;
            return (
              <TabsTrigger key={c.id} value={c.id} className="rounded-full gap-1.5">
                <Icon className="size-3.5" />
                {c.label} ({count})
              </TabsTrigger>
            );
          })}
        </TabsList>

        {cats.map((c) => (
          <TabsContent key={c.id} value={c.id} className="mt-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {blocks.filter((b) => b.cat === c.id).map((b) => {
                const Icon = b.icon;
                return (
                  <article
                    key={b.key}
                    className="flex flex-col justify-between gap-3 rounded-2xl border border-border/50 bg-background/60 p-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <Icon className="size-4 text-primary" />
                        <h3 className="text-sm font-semibold text-foreground">{b.label}</h3>
                      </div>
                      <p className="mt-1.5 text-xs text-muted-foreground">{b.descricao}</p>
                      {b.requires && (
                        <p className="mt-1 text-[11px] text-muted-foreground/80">
                          Requer: <span className="font-medium">{b.requires}</span>
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => seedMut.mutate(b)}
                        disabled={pending(b.key)}
                      >
                        {seedMut.isPending && seedMut.variables?.key === b.key ? (
                          <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                        ) : (
                          <Sprout className="mr-1.5 size-3.5" />
                        )}
                        Gerar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => wipeMut.mutate(b)}
                        disabled={pending(b.key)}
                      >
                        {wipeMut.isPending && wipeMut.variables?.key === b.key ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="size-3.5" />
                        )}
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {log.length > 0 && (
        <div className="mt-5 rounded-2xl border border-border/50 bg-muted/40 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Histórico da sessão
          </p>
          <ul className="mt-2 space-y-1 text-xs">
            {log.map((h, i) => (
              <li key={i} className="flex justify-between gap-4">
                <span className="text-foreground">
                  <span className="font-medium">{h.label}</span> <span className="text-muted-foreground">{h.msg}</span>
                </span>
                <span className="text-muted-foreground">{h.at}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

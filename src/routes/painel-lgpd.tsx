import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ScrollText, RefreshCw, Filter, Clock, Mail, Phone, User, FileText } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { PainelLayout } from "@/components/PainelLayout";

type DsrStatus = "pendente" | "em_analise" | "concluida" | "rejeitada";
type DsrTipo =
  "acesso" | "correcao" | "exclusao" | "portabilidade" | "oposicao" | "anonimizacao" | "informacao";

type DsrRow = {
  id: string;
  protocolo: string;
  user_id: string | null;
  solicitante_nome: string;
  solicitante_email: string;
  solicitante_cpf: string | null;
  solicitante_telefone: string | null;
  tipo: DsrTipo;
  descricao: string;
  status: DsrStatus;
  admin_notes: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
};

const STATUS_LABEL: Record<DsrStatus, string> = {
  pendente: "Pendente",
  em_analise: "Em análise",
  concluida: "Concluída",
  rejeitada: "Rejeitada",
};

const STATUS_TONE: Record<DsrStatus, "default" | "secondary" | "destructive" | "outline"> = {
  pendente: "secondary",
  em_analise: "default",
  concluida: "outline",
  rejeitada: "destructive",
};

const TIPO_LABEL: Record<DsrTipo, string> = {
  acesso: "Acesso",
  correcao: "Correção",
  exclusao: "Exclusão",
  portabilidade: "Portabilidade",
  oposicao: "Oposição",
  anonimizacao: "Anonimização",
  informacao: "Informação",
};

/** Dias corridos entre criação e hoje. Prazo legal LGPD = 15 dias. */
function diasDesde(iso: string): number {
  const created = new Date(iso).getTime();
  const now = Date.now();
  return Math.max(0, Math.floor((now - created) / (1000 * 60 * 60 * 24)));
}

export const Route = createFileRoute("/painel-lgpd")({
  ssr: false,
  head: () => ({ meta: [{ title: "Solicitações LGPD | Painel" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: PainelLGPD,
});

function PainelLGPD() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<DsrStatus | "todas">("todas");
  const [tipoFilter, setTipoFilter] = useState<DsrTipo | "todos">("todos");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<DsrRow | null>(null);

  const q = useQuery({
    queryKey: ["dsr-requests", statusFilter, tipoFilter],
    queryFn: async () => {
      let query = supabase
        .from("data_subject_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (statusFilter !== "todas") query = query.eq("status", statusFilter);
      if (tipoFilter !== "todos") query = query.eq("tipo", tipoFilter);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as DsrRow[];
    },
    refetchInterval: 60_000,
  });

  const filtered = (q.data ?? []).filter((r) => {
    if (!search.trim()) return true;
    const needle = search.toLowerCase();
    return (
      r.protocolo.toLowerCase().includes(needle) ||
      r.solicitante_nome.toLowerCase().includes(needle) ||
      r.solicitante_email.toLowerCase().includes(needle)
    );
  });

  const pendentes = (q.data ?? []).filter((r) => r.status === "pendente").length;
  const emAnalise = (q.data ?? []).filter((r) => r.status === "em_analise").length;
  const vencendo = (q.data ?? []).filter(
    (r) => (r.status === "pendente" || r.status === "em_analise") && diasDesde(r.created_at) >= 10,
  ).length;

  return (
    <PainelLayout>
      <div className="space-y-6 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
              <ScrollText className="h-6 w-6 text-primary" />
              Solicitações LGPD
            </h1>
            <p className="text-sm text-muted-foreground">
              Titulares exercendo direitos garantidos pelo Art. 18 da LGPD. Prazo legal de resposta:
              15 dias corridos.
            </p>
          </div>
          <Button variant="outline" size="icon" onClick={() => q.refetch()} aria-label="Atualizar">
            <RefreshCw className={q.isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Total" value={(q.data ?? []).length} />
          <StatCard label="Pendentes" value={pendentes} tone="warning" />
          <StatCard label="Em análise" value={emAnalise} tone="info" />
          <StatCard label="Vencendo (≥10d)" value={vencendo} tone="danger" />
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todos os status</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="em_analise">Em análise</SelectItem>
              <SelectItem value="concluida">Concluída</SelectItem>
              <SelectItem value="rejeitada">Rejeitada</SelectItem>
            </SelectContent>
          </Select>
          <Select value={tipoFilter} onValueChange={(v) => setTipoFilter(v as typeof tipoFilter)}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              {(Object.keys(TIPO_LABEL) as DsrTipo[]).map((t) => (
                <SelectItem key={t} value={t}>
                  {TIPO_LABEL[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Buscar por protocolo, nome ou e-mail…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs flex-1"
          />
        </div>

        {/* Lista */}
        {q.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : q.error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            Sem permissão. Este painel é restrito à Direção, Coordenação, Secretaria e
            Desenvolvimento.
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-md border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
            Nenhuma solicitação encontrada com os filtros atuais.
          </div>
        ) : (
          <ul className="space-y-3">
            {filtered.map((row) => (
              <li
                key={row.id}
                className="cursor-pointer rounded-lg border bg-card p-4 shadow-sm transition hover:border-primary/40"
                onClick={() => setSelected(row)}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Badge>
                  <Badge variant="outline">{TIPO_LABEL[row.tipo]}</Badge>
                  <span className="font-mono text-xs text-muted-foreground">{row.protocolo}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {new Date(row.created_at).toLocaleString("pt-BR")}
                  </span>
                </div>
                <p className="mt-2 text-sm font-medium">{row.solicitante_nome}</p>
                <p className="text-xs text-muted-foreground">{row.solicitante_email}</p>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{row.descricao}</p>
                {(row.status === "pendente" || row.status === "em_analise") && (
                  <p
                    className={`mt-2 flex items-center gap-1 text-xs ${
                      diasDesde(row.created_at) >= 10 ? "text-destructive" : "text-muted-foreground"
                    }`}
                  >
                    <Clock className="h-3 w-3" />
                    {diasDesde(row.created_at)} dia(s) desde o registro (prazo LGPD: 15 dias)
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <DsrDetailDialog
        row={selected}
        onClose={() => setSelected(null)}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["dsr-requests"] });
          setSelected(null);
        }}
      />
    </PainelLayout>
  );
}

function StatCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "warning" | "info" | "danger";
}) {
  const toneClass =
    tone === "warning"
      ? "text-amber-600 dark:text-amber-400"
      : tone === "info"
        ? "text-primary"
        : tone === "danger"
          ? "text-destructive"
          : "text-foreground";
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${toneClass}`}>{value}</p>
    </div>
  );
}

function DsrDetailDialog({
  row,
  onClose,
  onSaved,
}: {
  row: DsrRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState<DsrStatus>(row?.status ?? "pendente");
  const [notes, setNotes] = useState(row?.admin_notes ?? "");

  // Reset local state quando muda a linha selecionada
  useEffect(() => {
    if (row) {
      setStatus(row.status);
      setNotes(row.admin_notes ?? "");
    }
  }, [row]);

  const mut = useMutation({
    mutationFn: async () => {
      if (!row) return;
      const patch: Partial<DsrRow> = {
        status,
        admin_notes: notes.trim() || null,
      };
      if (status === "concluida" || status === "rejeitada") {
        patch.resolved_at = new Date().toISOString();
        const { data: userData } = await supabase.auth.getUser();
        patch.resolved_by = userData.user?.id ?? null;
      } else {
        patch.resolved_at = null;
        patch.resolved_by = null;
      }
      const { error } = await supabase.from("data_subject_requests").update(patch).eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Solicitação atualizada");
      onSaved();
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      toast.error("Falha ao atualizar", { description: msg });
    },
  });

  if (!row) return null;

  return (
    <Dialog
      open={!!row}
      onOpenChange={(open) => {
        if (!open) onClose();
        else {
          setStatus(row.status);
          setNotes(row.admin_notes ?? "");
        }
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {row.protocolo}
          </DialogTitle>
          <DialogDescription>
            Solicitação de {TIPO_LABEL[row.tipo]} · registrada em{" "}
            {new Date(row.created_at).toLocaleString("pt-BR")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 rounded-lg border bg-muted/30 p-4 text-sm md:grid-cols-2">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{row.solicitante_nome}</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <a href={`mailto:${row.solicitante_email}`} className="text-primary hover:underline">
                {row.solicitante_email}
              </a>
            </div>
            {row.solicitante_telefone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{row.solicitante_telefone}</span>
              </div>
            )}
            {row.solicitante_cpf && (
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase text-muted-foreground">CPF:</span>
                <span className="font-mono">{row.solicitante_cpf}</span>
              </div>
            )}
          </div>

          <div>
            <Label className="text-xs uppercase text-muted-foreground">Descrição do titular</Label>
            <div className="mt-1 whitespace-pre-wrap rounded-lg border bg-background p-3 text-sm">
              {row.descricao}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as DsrStatus)}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="em_analise">Em análise</SelectItem>
                  <SelectItem value="concluida">Concluída</SelectItem>
                  <SelectItem value="rejeitada">Rejeitada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end text-xs text-muted-foreground">
              {diasDesde(row.created_at)} dia(s) desde o registro · prazo LGPD 15 dias
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Notas internas</Label>
            <Textarea
              id="notes"
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Registre o que foi feito, a decisão tomada e o motivo. Estas notas não são enviadas ao titular."
              maxLength={4000}
            />
          </div>

          {row.resolved_at && (
            <p className="text-xs text-muted-foreground">
              Resolvida em {new Date(row.resolved_at).toLocaleString("pt-BR")}.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? "Salvando…" : "Salvar alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

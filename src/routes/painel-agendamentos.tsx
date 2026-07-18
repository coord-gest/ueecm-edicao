import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Calendar,
  Clock,
  User,
  Phone,
  MessageSquare,
  Loader2,
  Check,
  X,
  Trash2,
  Download,
  ShieldCheck,
  Filter,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { PainelLayout } from "@/components/PainelLayout";
import { exportRowsAsCsv } from "@/lib/csv-export";
import { PARENTAL_CSV_HEADERS, formatCpf } from "@/lib/parental-consent";

export const Route = createFileRoute("/painel-agendamentos")({
  ssr: false,
  head: () => ({ meta: [{ title: "Painel • Agendamentos" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
    // Verificação de staff via has_role acontece via RLS na consulta
  },
  component: PainelAgendamentosPage,
});

const STATUS_LABEL: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  pendente: { label: "Pendente", variant: "secondary" },
  confirmado: { label: "Confirmado", variant: "default" },
  recusado: { label: "Recusado", variant: "destructive" },
  cancelado: { label: "Cancelado", variant: "outline" },
  concluido: { label: "Concluído", variant: "outline" },
};

const CARGO_LABEL: Record<string, string> = {
  diretor: "Direção",
  coordenador: "Coordenação",
  professor: "Professor",
};

function PainelAgendamentosPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [obs, setObs] = useState<Record<string, string>>({});

  const q = useQuery({
    queryKey: ["painel-agendamentos", filtroStatus, user?.id],
    enabled: !!user,
    queryFn: async () => {
      let query = supabase
        .from("agendamentos")
        .select(
          "id, protocolo, status, motivo, inicio_at, fim_at, alvo_cargo, observacoes_staff, solicitante_nome, solicitante_relacao, solicitante_contato, profissional_id, profissionais(nome, cargo)",
        )
        .order("inicio_at", { ascending: true });

      if (filtroStatus !== "todos") {
        query = query.eq("status", filtroStatus);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const atualizar = useMutation({
    mutationFn: async (input: { id: string; status?: string; observacoes_staff?: string }) => {
      const patch: { status?: string; observacoes_staff?: string | null } = {};
      if (input.status) patch.status = input.status;
      if (input.observacoes_staff !== undefined)
        patch.observacoes_staff = input.observacoes_staff || null;
      const { error } = await supabase.from("agendamentos").update(patch).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["painel-agendamentos"] });
      toast.success("Agendamento atualizado.");
    },
    onError: (err: Error) => toast.error(err.message ?? "Erro ao atualizar."),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("agendamentos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["painel-agendamentos"] });
      toast.success("Agendamento excluído.");
    },
    onError: (err: Error) => toast.error(err.message ?? "Erro ao excluir."),
  });

  return (
    <PainelLayout>
      <div className="space-y-6 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">Agendamentos</h1>
            <p className="text-sm text-muted-foreground">
              Reuniões e visitas solicitadas pela comunidade escolar.
            </p>
          </div>
          <div className="w-full sm:w-56">
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="pendente">Pendentes</SelectItem>
                <SelectItem value="confirmado">Confirmados</SelectItem>
                <SelectItem value="recusado">Recusados</SelectItem>
                <SelectItem value="cancelado">Cancelados</SelectItem>
                <SelectItem value="concluido">Concluídos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <ParentalConsentsSection />

        {q.isLoading ? (
          <div className="grid gap-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : q.error ? (
          <Card>
            <CardContent className="py-10 text-center">
              <p className="text-sm text-destructive">
                Você não tem permissão para ver esta página, ou ocorreu um erro ao carregar.
              </p>
            </CardContent>
          </Card>
        ) : (q.data ?? []).length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <Calendar className="h-10 w-10 text-muted-foreground" />
              <p className="text-muted-foreground">Nenhum agendamento neste filtro.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {(q.data ?? []).map((a) => {
              const st = STATUS_LABEL[a.status] ?? { label: a.status, variant: "outline" as const };
              const inicio = new Date(a.inicio_at);
              const currentObs = obs[a.id] ?? a.observacoes_staff ?? "";
              return (
                <Card key={a.id}>
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-base">
                          {a.profissionais?.nome
                            ? `Com ${a.profissionais.nome}`
                            : `Com a ${CARGO_LABEL[a.alvo_cargo ?? ""] ?? a.alvo_cargo ?? "escola"}`}
                        </CardTitle>
                        <CardDescription className="font-mono text-xs">
                          {a.protocolo}
                        </CardDescription>
                      </div>
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <p className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        {format(inicio, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                      <p className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {a.solicitante_nome}
                        <span className="text-xs text-muted-foreground">
                          ({a.solicitante_relacao})
                        </span>
                      </p>
                      {a.solicitante_contato && (
                        <p className="flex items-center gap-2 sm:col-span-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          {a.solicitante_contato}
                        </p>
                      )}
                    </div>
                    <p className="flex items-start gap-2 text-muted-foreground">
                      <MessageSquare className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{a.motivo}</span>
                    </p>

                    <Textarea
                      placeholder="Observação interna / mensagem para o solicitante..."
                      value={currentObs}
                      onChange={(e) => setObs((prev) => ({ ...prev, [a.id]: e.target.value }))}
                      rows={2}
                    />

                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="default"
                        disabled={atualizar.isPending}
                        onClick={() =>
                          atualizar.mutate({
                            id: a.id,
                            status: "confirmado",
                            observacoes_staff: currentObs,
                          })
                        }
                      >
                        <Check className="mr-1 h-4 w-4" /> Confirmar
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={atualizar.isPending}
                        onClick={() =>
                          atualizar.mutate({
                            id: a.id,
                            status: "recusado",
                            observacoes_staff: currentObs,
                          })
                        }
                      >
                        <X className="mr-1 h-4 w-4" /> Recusar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={atualizar.isPending}
                        onClick={() =>
                          atualizar.mutate({
                            id: a.id,
                            status: "concluido",
                            observacoes_staff: currentObs,
                          })
                        }
                      >
                        Marcar como concluído
                      </Button>
                      {currentObs !== (a.observacoes_staff ?? "") && (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={atualizar.isPending}
                          onClick={() =>
                            atualizar.mutate({ id: a.id, observacoes_staff: currentObs })
                          }
                        >
                          {atualizar.isPending ? (
                            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                          ) : null}
                          Salvar observação
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-auto text-destructive hover:bg-destructive/10"
                        disabled={excluir.isPending}
                        onClick={() => {
                          if (confirm(`Excluir agendamento ${a.protocolo}?`)) {
                            excluir.mutate(a.id);
                          }
                        }}
                      >
                        <Trash2 className="mr-1 h-4 w-4" /> Excluir
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </PainelLayout>
  );
}

// ---------------------------------------------------------------------------
// Seção: Consentimentos parentais (LGPD Art. 14)
// ---------------------------------------------------------------------------
// Acesso restrito por RLS a `is_school_admin(auth.uid())`. Renderiza filtros
// (protocolo, período, responsável) + tabela + exportação CSV.

type ParentalConsentRow = {
  id: string;
  protocolo: string;
  minor_name: string;
  minor_dob: string;
  guardian_name: string;
  guardian_cpf: string;
  guardian_email: string;
  guardian_phone: string | null;
  term_version: string;
  ip_address: string | null;
  user_agent: string | null;
  consented_at: string;
};

function ParentalConsentsSection() {
  const [filtroProtocolo, setFiltroProtocolo] = useState("");
  const [filtroResponsavel, setFiltroResponsavel] = useState("");
  const [filtroDataInicial, setFiltroDataInicial] = useState("");
  const [filtroDataFinal, setFiltroDataFinal] = useState("");

  const q = useQuery({
    queryKey: [
      "parental-consents",
      filtroProtocolo,
      filtroResponsavel,
      filtroDataInicial,
      filtroDataFinal,
    ],
    queryFn: async () => {
      let query = supabase
        .from("parental_consents")
        .select(
          "id, protocolo, minor_name, minor_dob, guardian_name, guardian_cpf, guardian_email, guardian_phone, term_version, ip_address, user_agent, consented_at",
        )
        .order("consented_at", { ascending: false })
        .limit(500);

      // Filtros combinam com AND. Cada `ilike` cobre busca parcial case-insensitive.
      if (filtroProtocolo.trim()) {
        query = query.ilike("protocolo", `%${filtroProtocolo.trim()}%`);
      }
      if (filtroResponsavel.trim()) {
        const term = `%${filtroResponsavel.trim()}%`;
        query = query.or(`guardian_name.ilike.${term},guardian_email.ilike.${term}`);
      }
      if (filtroDataInicial) {
        query = query.gte("consented_at", `${filtroDataInicial}T00:00:00-03:00`);
      }
      if (filtroDataFinal) {
        query = query.lte("consented_at", `${filtroDataFinal}T23:59:59-03:00`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as ParentalConsentRow[];
    },
  });

  const rows = q.data ?? [];

  // Máscara aplicada apenas para exibição/exportação; no banco continua só dígitos.
  const displayRows = useMemo(
    () =>
      rows.map((r) => ({
        ...r,
        guardian_cpf: r.guardian_cpf ? formatCpf(r.guardian_cpf) : r.guardian_cpf,
      })),
    [rows],
  );

  function limparFiltros() {
    setFiltroProtocolo("");
    setFiltroResponsavel("");
    setFiltroDataInicial("");
    setFiltroDataFinal("");
  }

  function exportar() {
    if (displayRows.length === 0) {
      toast.info("Nenhum registro para exportar com os filtros atuais.");
      return;
    }
    const stamp = format(new Date(), "yyyy-MM-dd_HHmm");
    exportRowsAsCsv(`parental_consents_${stamp}.csv`, displayRows, [...PARENTAL_CSV_HEADERS]);
    toast.success(`${displayRows.length} registro(s) exportado(s).`);
  }

  // RLS retorna 401/permission error para não-admins — mostramos aviso discreto.
  const isForbidden = q.error && /permission|denied|401|403/i.test(String(q.error.message ?? ""));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-1 grid h-9 w-9 place-items-center rounded-md bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">Consentimentos parentais</CardTitle>
              <CardDescription>
                Logs de autorização de responsáveis legais para tratamento de dados de menores (LGPD
                Art. 14).
              </CardDescription>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={exportar}
            disabled={displayRows.length === 0 || q.isLoading}
          >
            <Download className="mr-1.5 h-4 w-4" />
            Exportar CSV ({displayRows.length})
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="fc-protocolo" className="text-xs">
              Protocolo
            </Label>
            <Input
              id="fc-protocolo"
              placeholder="AG-2026-…"
              value={filtroProtocolo}
              onChange={(e) => setFiltroProtocolo(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fc-responsavel" className="text-xs">
              Responsável (nome ou e-mail)
            </Label>
            <Input
              id="fc-responsavel"
              placeholder="Maria Silva ou maria@…"
              value={filtroResponsavel}
              onChange={(e) => setFiltroResponsavel(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fc-data-ini" className="text-xs">
              De
            </Label>
            <Input
              id="fc-data-ini"
              type="date"
              value={filtroDataInicial}
              onChange={(e) => setFiltroDataInicial(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fc-data-fim" className="text-xs">
              Até
            </Label>
            <Input
              id="fc-data-fim"
              type="date"
              value={filtroDataFinal}
              onChange={(e) => setFiltroDataFinal(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" onClick={limparFiltros}>
            <Filter className="mr-1.5 h-4 w-4" />
            Limpar filtros
          </Button>
        </div>

        {q.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : isForbidden ? (
          <p className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
            Você não tem permissão para ver os logs de consentimento parental. Fale com o
            administrador da escola.
          </p>
        ) : q.error ? (
          <p className="text-sm text-destructive">
            Erro ao carregar consentimentos: {String(q.error.message ?? q.error)}
          </p>
        ) : displayRows.length === 0 ? (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nenhum consentimento parental encontrado com os filtros atuais.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Protocolo</th>
                  <th className="px-3 py-2">Menor</th>
                  <th className="px-3 py-2">Responsável</th>
                  <th className="px-3 py-2">Contato</th>
                  <th className="px-3 py-2">IP</th>
                  <th className="px-3 py-2">Termo</th>
                  <th className="px-3 py-2">Data</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0 align-top">
                    <td className="px-3 py-2 font-mono text-xs">{r.protocolo}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{r.minor_name}</div>
                      <div className="text-xs text-muted-foreground">
                        Nasc.: {format(new Date(`${r.minor_dob}T00:00:00`), "dd/MM/yyyy")}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{r.guardian_name}</div>
                      <div className="font-mono text-xs text-muted-foreground">
                        CPF: {r.guardian_cpf}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <div>{r.guardian_email}</div>
                      {r.guardian_phone && <div>{r.guardian_phone}</div>}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{r.ip_address ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.term_version}</td>
                    <td className="px-3 py-2 text-xs">
                      {format(new Date(r.consented_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

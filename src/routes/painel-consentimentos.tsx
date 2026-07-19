import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck, RefreshCw, Search, Download, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { PainelLayout } from "@/components/PainelLayout";
import { listAlunoConsents } from "@/lib/aluno-parental-consent.functions";
import { exportRowsAsCsv } from "@/lib/csv-export";

export const Route = createFileRoute("/painel-consentimentos")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Consentimentos parentais | Painel" }],
  }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: PainelConsentimentos,
});

type ConsentRow = {
  id: string;
  aluno_id: string | null;
  protocolo: string | null;
  minor_name: string;
  minor_dob: string;
  guardian_name: string;
  guardian_cpf: string | null;
  guardian_email: string;
  guardian_phone: string | null;
  term_version: string;
  ip_address: string | null;
  user_agent: string | null;
  consented_at: string;
};

function maskCpf(digits: string | null): string {
  if (!digits) return "—";
  const d = digits.replace(/\D/g, "");
  if (d.length !== 11) return d;
  // Preserva os 3 primeiros e os 2 últimos, mascara o meio.
  return `${d.slice(0, 3)}.***.***-${d.slice(9)}`;
}

function PainelConsentimentos() {
  const list = useServerFn(listAlunoConsents);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

  // Debounce leve para não bater no servidor a cada tecla.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const q = useQuery({
    queryKey: ["parental-consents-audit", debounced],
    queryFn: async () => {
      const r = await list({ data: { search: debounced || null, limit: 500 } });
      return r.rows as ConsentRow[];
    },
    refetchInterval: 60_000,
  });

  const rows = q.data ?? [];

  function exportar() {
    exportRowsAsCsv(
      "consentimentos-parentais.csv",
      rows.map((r) => ({
        protocolo: r.protocolo ?? "",
        minor_name: r.minor_name,
        minor_dob: r.minor_dob,
        guardian_name: r.guardian_name,
        guardian_cpf: r.guardian_cpf ?? "",
        guardian_email: r.guardian_email,
        guardian_phone: r.guardian_phone ?? "",
        ip_address: r.ip_address ?? "",
        user_agent: r.user_agent ?? "",
        term_version: r.term_version,
        consented_at: r.consented_at,
      })),
      [
        { key: "protocolo", label: "Protocolo" },
        { key: "minor_name", label: "Nome do menor" },
        { key: "minor_dob", label: "Data de nascimento do menor" },
        { key: "guardian_name", label: "Nome do responsável" },
        { key: "guardian_cpf", label: "CPF do responsável" },
        { key: "guardian_email", label: "E-mail do responsável" },
        { key: "guardian_phone", label: "Telefone do responsável" },
        { key: "ip_address", label: "IP" },
        { key: "user_agent", label: "User-Agent" },
        { key: "term_version", label: "Versão do termo" },
        { key: "consented_at", label: "Data/hora do consentimento" },
      ],
    );
  }

  return (
    <PainelLayout>
      <div className="space-y-6 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
              <ShieldCheck className="h-6 w-6 text-primary" />
              Consentimentos parentais
            </h1>
            <p className="text-sm text-muted-foreground">
              Registros de autorização de responsáveis legais (LGPD Art. 14). Inclui protocolo, IP,
              user-agent e versão do termo aceito.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => q.refetch()} aria-label="Atualizar">
              <RefreshCw className={q.isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            </Button>
            <Button variant="outline" onClick={exportar} disabled={rows.length === 0}>
              <Download className="mr-2 h-4 w-4" /> Exportar CSV
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, e-mail ou protocolo"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Badge variant="outline">{rows.length} registro(s)</Badge>
        </div>

        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Protocolo</th>
                <th className="px-4 py-3">Menor</th>
                <th className="px-4 py-3">Responsável</th>
                <th className="px-4 py-3">Contato</th>
                <th className="px-4 py-3">CPF</th>
                <th className="px-4 py-3">IP</th>
                <th className="px-4 py-3">Termo</th>
                <th className="px-4 py-3">Registrado em</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    <FileText className="mx-auto mb-2 size-6 opacity-60" />
                    Nenhum consentimento registrado ainda.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0 align-top">
                    <td className="px-4 py-3 font-mono text-xs">{r.protocolo ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{r.minor_name}</div>
                      <div className="text-xs text-muted-foreground">
                        Nasc.: {new Date(r.minor_dob).toLocaleDateString("pt-BR")}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium">{r.guardian_name}</td>
                    <td className="px-4 py-3 text-xs">
                      <div>{r.guardian_email}</div>
                      {r.guardian_phone && (
                        <div className="text-muted-foreground">{r.guardian_phone}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{maskCpf(r.guardian_cpf)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {r.ip_address ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <Badge variant="outline">{r.term_version}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(r.consented_at).toLocaleString("pt-BR")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-muted-foreground">
          CPF exibido com máscara parcial por privacidade. A exportação CSV traz o valor completo
          para auditoria e deve ser tratada como dado sensível.
        </p>
      </div>
    </PainelLayout>
  );
}
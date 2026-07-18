import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Plus,
  Megaphone,
  Paperclip,
  Users,
  User,
  Loader2,
  Download,
  BarChart3,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { EscolaShell } from "@/components/escola/EscolaShell";
import { ComunicadoDownloadImage } from "@/components/comunicados/ComunicadoImageCard";

export const Route = createFileRoute("/escola/comunicados/")({
  ssr: false,
  head: () => ({ meta: [{ title: "Comunicados | Escola" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: ComunicadosPage,
});

type Anexo = { path: string; name: string; size?: number; type?: string };
type Comunicado = {
  id: string;
  tipo: "turma" | "individual";
  titulo: string;
  mensagem: string;
  anexos: Anexo[];
  turma_id: string | null;
  aluno_id: string | null;
  autor_id: string;
  created_at: string;
};

function ComunicadosPage() {
  const { user, hasRole, loading } = useAuth();
  const canCreate =
    hasRole("professor") ||
    hasRole("admin") ||
    hasRole("diretor") ||
    hasRole("coordenador") ||
    hasRole("secretario") ||
    hasRole("desenvolvedor");

  const { data, isLoading } = useQuery({
    queryKey: ["escola", "comunicados", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Comunicado[]> => {
      const { data, error } = await supabase
        .from("comunicados")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as Comunicado[];
    },
  });

  if (loading) return null;

  return (
    <EscolaShell
      title="Comunicados"
      description="Mensagens para turmas e responsáveis"
      actions={
        <div className="flex flex-wrap gap-2">
          {canCreate && (
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <Link to="/escola/comunicados/dashboard">
                <BarChart3 className="size-4" /> Painel de leituras
              </Link>
            </Button>
          )}
          {canCreate && (
            <Button asChild>
              <Link to="/escola/comunicados/novo">
                <Plus className="size-4" /> Novo comunicado
              </Link>
            </Button>
          )}
        </div>
      }
    >
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : !data?.length ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <Megaphone className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Nenhum comunicado por enquanto.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {data.map((c) => (
            <ComunicadoCard key={c.id} c={c} />
          ))}
        </ul>
      )}
    </EscolaShell>
  );
}

function ComunicadoCard({ c }: { c: Comunicado }) {
  return (
    <li className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-display text-lg font-semibold text-foreground">{c.titulo}</p>
          <p className="text-xs text-muted-foreground">
            {format(new Date(c.created_at), "dd 'de' MMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
        </div>
        <Badge variant="secondary" className="gap-1">
          {c.tipo === "turma" ? <Users className="size-3" /> : <User className="size-3" />}
          {c.tipo === "turma" ? "Turma" : "Individual"}
        </Badge>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm text-foreground/90">{c.mensagem}</p>
      {Array.isArray(c.anexos) && c.anexos.length > 0 && (
        <div className="mt-4 space-y-2">
          {c.anexos.map((a) => (
            <AnexoLink key={a.path} anexo={a} />
          ))}
        </div>
      )}
      <div className="mt-4 flex justify-end">
        <ComunicadoDownloadImage
          data={{
            titulo: c.titulo,
            mensagem: c.mensagem,
            destino: c.tipo === "turma" ? "Comunicado para a turma" : "Comunicado individual",
            data: c.created_at,
          }}
          triggerLabel="Baixar como imagem"
          variant="outline"
          size="sm"
        />
      </div>
    </li>
  );
}

function AnexoLink({ anexo }: { anexo: Anexo }) {
  const [loading, setLoading] = useState(false);
  const handleOpen = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.storage
        .from("comunicados-anexos")
        .createSignedUrl(anexo.path, 60 * 10);
      if (error || !data) throw error ?? new Error("URL inválida");
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error("Não foi possível abrir o anexo", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  };
  return (
    <button
      type="button"
      onClick={handleOpen}
      className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs font-medium hover:bg-accent"
    >
      {loading ? <Loader2 className="size-3 animate-spin" /> : <Paperclip className="size-3" />}
      {anexo.name}
      <Download className="size-3 opacity-60" />
    </button>
  );
}

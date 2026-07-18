import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Send, Loader2, MessageSquare, Check } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { PainelLayout } from "@/components/PainelLayout";
import { EscolaShell } from "@/components/escola/EscolaShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useRolePainelGuard } from "@/lib/use-role-guard";
import { useAdminAccessAudit } from "@/lib/use-admin-access-audit";
import { uniqueRealtimeChannelName } from "@/lib/realtime-channel";

export const Route = createFileRoute("/painel-mensagens")({
  ssr: false,
  head: () => ({ meta: [{ title: "Mensagens de Responsáveis" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: PainelMensagensPage,
});

type Msg = {
  id: string;
  thread_id: string;
  remetente_id: string;
  remetente_nome: string;
  remetente_tipo: "responsavel" | "coordenacao";
  assunto: string;
  mensagem: string;
  created_at: string;
  lida_em: string | null;
};

function PainelMensagensPage() {
  useRolePainelGuard(["diretor", "coordenador", "desenvolvedor"]);
  useAdminAccessAudit("/painel-mensagens");
  const { user } = useAuth();
  const qc = useQueryClient();
  const [threadAberta, setThreadAberta] = useState<string | null>(null);

  const { data: msgs, isLoading } = useQuery({
    queryKey: ["staff-mensagens"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("mensagens_coordenacao")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Msg[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(uniqueRealtimeChannelName("mensagens_staff_rt"))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mensagens_coordenacao" },
        () => qc.invalidateQueries({ queryKey: ["staff-mensagens"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const threads = useMemo(() => {
    const map = new Map<string, Msg[]>();
    (msgs ?? []).forEach((m) => {
      if (!map.has(m.thread_id)) map.set(m.thread_id, []);
      map.get(m.thread_id)!.push(m);
    });
    map.forEach((arr) => arr.sort((a, b) => a.created_at.localeCompare(b.created_at)));
    return Array.from(map.entries()).sort((a, b) => {
      const la = a[1][a[1].length - 1].created_at;
      const lb = b[1][b[1].length - 1].created_at;
      return lb.localeCompare(la);
    });
  }, [msgs]);

  const responder = useMutation({
    mutationFn: async (p: { threadId: string; assunto: string; texto: string }) => {
      if (!user) throw new Error("Login necessário");
      const nome = user.user_metadata?.display_name ?? user.email?.split("@")[0] ?? "Coordenação";
      const { error } = await (supabase as any).from("mensagens_coordenacao").insert({
        thread_id: p.threadId,
        remetente_id: user.id,
        remetente_nome: nome,
        remetente_tipo: "coordenacao",
        assunto: p.assunto,
        mensagem: p.texto,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Resposta enviada");
      qc.invalidateQueries({ queryKey: ["staff-mensagens"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const marcarLida = useMutation({
    mutationFn: async (threadId: string) => {
      const { error } = await (supabase as any)
        .from("mensagens_coordenacao")
        .update({ lida_em: new Date().toISOString() })
        .eq("thread_id", threadId)
        .eq("remetente_tipo", "responsavel")
        .is("lida_em", null);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff-mensagens"] }),
  });

  const naoRespondidas = threads.filter(
    ([, arr]) => arr[arr.length - 1].remetente_tipo === "responsavel",
  ).length;

  return (
    <PainelLayout>
      <EscolaShell
        title="Mensagens de Responsáveis"
        description={`${threads.length} conversa(s), ${naoRespondidas} aguardando resposta.`}
        current="mensagens"
      >
        <div className="mb-4">
          <Button asChild size="sm" variant="ghost">
            <Link to="/painel">
              <ArrowLeft className="size-4" /> Voltar ao painel
            </Link>
          </Button>
        </div>

        {isLoading ? (
          <Skeleton className="h-96 rounded-2xl" />
        ) : threads.length === 0 ? (
          <div className="rounded-2xl border p-8 text-center text-sm text-muted-foreground">
            <MessageSquare className="mx-auto mb-2 size-8 opacity-50" />
            Nenhuma mensagem ainda.
          </div>
        ) : (
          <div className="space-y-3">
            {threads.map(([tid, arr]) => {
              const first = arr[0];
              const ultima = arr[arr.length - 1];
              const aberta = threadAberta === tid;
              const naoLidas = arr.filter(
                (m) => m.remetente_tipo === "responsavel" && !m.lida_em,
              ).length;
              const aguardando = ultima.remetente_tipo === "responsavel";
              return (
                <div key={tid} className="rounded-2xl border bg-card p-4">
                  <button
                    className="w-full text-left"
                    onClick={() => {
                      setThreadAberta(aberta ? null : tid);
                      if (!aberta && naoLidas > 0) marcarLida.mutate(tid);
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{first.assunto}</p>
                        <p className="text-xs text-muted-foreground">
                          De: {first.remetente_nome} · {arr.length} mensagem(ns)
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {aguardando && <Badge variant="destructive">Aguardando</Badge>}
                        {naoLidas > 0 && <Badge>{naoLidas} nova(s)</Badge>}
                      </div>
                    </div>
                  </button>

                  {aberta && (
                    <div className="mt-4 space-y-3 border-t pt-4">
                      {arr.map((m) => (
                        <div
                          key={m.id}
                          className={`rounded-xl p-3 text-sm ${
                            m.remetente_tipo === "coordenacao"
                              ? "ml-8 bg-primary/10"
                              : "mr-8 bg-secondary"
                          }`}
                        >
                          <p className="mb-1 flex items-center gap-2 text-xs font-semibold">
                            {m.remetente_tipo === "coordenacao" ? "Coordenação" : m.remetente_nome}{" "}
                            · {new Date(m.created_at).toLocaleString("pt-BR")}
                            {m.remetente_tipo === "responsavel" && m.lida_em && (
                              <Check className="size-3 text-primary" />
                            )}
                          </p>
                          <p className="whitespace-pre-wrap">{m.mensagem}</p>
                        </div>
                      ))}
                      <RespostaBox
                        onEnviar={(texto) =>
                          responder.mutate({
                            threadId: tid,
                            assunto: `Re: ${first.assunto}`,
                            texto,
                          })
                        }
                        pending={responder.isPending}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </EscolaShell>
    </PainelLayout>
  );
}

function RespostaBox({ onEnviar, pending }: { onEnviar: (t: string) => void; pending: boolean }) {
  const [txt, setTxt] = useState("");
  return (
    <div className="space-y-2">
      <Textarea
        value={txt}
        onChange={(e) => setTxt(e.target.value)}
        placeholder="Responder ao responsável..."
        rows={3}
        maxLength={2000}
      />
      <Button
        size="sm"
        onClick={() => {
          if (!txt.trim()) return;
          onEnviar(txt.trim());
          setTxt("");
        }}
        disabled={pending || !txt.trim()}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        Enviar resposta
      </Button>
    </div>
  );
}

import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Send, Loader2, MessageSquare } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { PainelLayout } from "@/components/PainelLayout";
import { EscolaShell } from "@/components/escola/EscolaShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { uniqueRealtimeChannelName } from "@/lib/realtime-channel";

export const Route = createFileRoute("/mensagens-coordenacao")({
  ssr: false,
  head: () => ({ meta: [{ title: "Fale com a Coordenação" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: MensagensCoordenacaoPage,
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

function MensagensCoordenacaoPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [assunto, setAssunto] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [threadAberta, setThreadAberta] = useState<string | null>(null);

  const { data: msgs, isLoading } = useQuery({
    queryKey: ["mensagens-coord", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("mensagens_coordenacao")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Msg[];
    },
  });

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel(uniqueRealtimeChannelName("mensagens_coord_rt"))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mensagens_coordenacao" },
        () => qc.invalidateQueries({ queryKey: ["mensagens-coord"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  // Agrupa por thread
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

  const enviarNovo = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Faça login");
      if (!assunto.trim() || !mensagem.trim()) throw new Error("Preencha assunto e mensagem");
      const nome =
        user.user_metadata?.display_name ??
        user.user_metadata?.nome ??
        user.email?.split("@")[0] ??
        "Responsável";
      const { error } = await (supabase as any).from("mensagens_coordenacao").insert({
        remetente_id: user.id,
        remetente_nome: nome,
        remetente_tipo: "responsavel",
        assunto: assunto.trim(),
        mensagem: mensagem.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Mensagem enviada à coordenação");
      setAssunto("");
      setMensagem("");
      qc.invalidateQueries({ queryKey: ["mensagens-coord"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const responder = useMutation({
    mutationFn: async (payload: { threadId: string; assunto: string; texto: string }) => {
      if (!user) throw new Error("Faça login");
      const nome = user.user_metadata?.display_name ?? user.email?.split("@")[0] ?? "Responsável";
      const { error } = await (supabase as any).from("mensagens_coordenacao").insert({
        thread_id: payload.threadId,
        remetente_id: user.id,
        remetente_nome: nome,
        remetente_tipo: "responsavel",
        assunto: payload.assunto,
        mensagem: payload.texto,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Resposta enviada");
      qc.invalidateQueries({ queryKey: ["mensagens-coord"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <PainelLayout>
      <EscolaShell
        title="Fale com a Coordenação"
        description="Envie dúvidas, sugestões ou solicitações. Resposta em até 48h úteis."
        current="mensagens"
      >
        <div className="mb-6 flex items-center gap-3">
          <Button asChild size="icon" variant="ghost">
            <Link to="/painel-responsavel">
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Fale com a Coordenação</h1>
            <p className="text-sm text-muted-foreground">
              Envie dúvidas, sugestões ou solicitações. A escola responderá em até 48h úteis.
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
          {/* Nova mensagem */}
          <div className="rounded-2xl border bg-card p-4">
            <p className="mb-3 text-sm font-semibold">Nova mensagem</p>
            <div className="space-y-3">
              <Input
                placeholder="Assunto"
                value={assunto}
                onChange={(e) => setAssunto(e.target.value)}
                maxLength={100}
              />
              <Textarea
                placeholder="Escreva sua mensagem..."
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                rows={5}
                maxLength={2000}
              />
              <Button
                onClick={() => enviarNovo.mutate()}
                disabled={enviarNovo.isPending}
                className="w-full"
              >
                {enviarNovo.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                Enviar
              </Button>
            </div>
          </div>

          {/* Threads */}
          <div className="space-y-3">
            <p className="text-sm font-semibold">Suas conversas ({threads.length})</p>
            {isLoading ? (
              <Skeleton className="h-64 rounded-2xl" />
            ) : threads.length === 0 ? (
              <div className="rounded-2xl border p-8 text-center text-sm text-muted-foreground">
                <MessageSquare className="mx-auto mb-2 size-8 opacity-50" />
                Nenhuma conversa ainda. Envie sua primeira mensagem ao lado.
              </div>
            ) : (
              threads.map(([tid, arr]) => {
                const first = arr[0];
                const aberta = threadAberta === tid;
                const naoLidas = arr.filter(
                  (m) => m.remetente_tipo === "coordenacao" && !m.lida_em,
                ).length;
                return (
                  <div key={tid} className="rounded-2xl border bg-card p-4">
                    <button
                      className="w-full text-left"
                      onClick={() => setThreadAberta(aberta ? null : tid)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold">{first.assunto}</p>
                        {naoLidas > 0 && <Badge variant="destructive">{naoLidas} nova(s)</Badge>}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {arr.length} mensagem(ns) ·{" "}
                        {new Date(arr[arr.length - 1].created_at).toLocaleString("pt-BR")}
                      </p>
                    </button>

                    {aberta && (
                      <div className="mt-4 space-y-3 border-t pt-4">
                        {arr.map((m) => (
                          <div
                            key={m.id}
                            className={`rounded-xl p-3 text-sm ${
                              m.remetente_tipo === "responsavel"
                                ? "ml-8 bg-primary/10"
                                : "mr-8 bg-secondary"
                            }`}
                          >
                            <p className="mb-1 text-xs font-semibold">
                              {m.remetente_tipo === "coordenacao" ? "Coordenação" : "Você"} ·{" "}
                              {new Date(m.created_at).toLocaleString("pt-BR")}
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
              })
            )}
          </div>
        </div>
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
        placeholder="Responder..."
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
        Responder
      </Button>
    </div>
  );
}

import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Send, Loader2, Paperclip, Download } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import {
  enviarMensagem,
  marcarLidas,
  uploadAnexo,
  getAnexoUrl,
  type ChatMensagem,
  getChatModeration,
  janelaChatAberta,
  type ChatModerationConfig,
} from "@/lib/chat-aluno";
import { PainelLayout } from "@/components/PainelLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { uniqueRealtimeChannelName } from "@/lib/realtime-channel";

export const Route = createFileRoute("/chat-aluno/$id")({
  ssr: false,
  head: () => ({ meta: [{ title: "Conversa | UEECM" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: ChatAlunoThread,
});

type ThreadFull = {
  id: string;
  aluno_id: string;
  responsavel_user_id: string;
  professor_user_id: string;
  aluno_nome: string;
  contraparte_nome: string;
};

function ChatAlunoThread() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [texto, setTexto] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: moderacao } = useQuery<ChatModerationConfig>({
    queryKey: ["chat-moderation"],
    queryFn: getChatModeration,
    staleTime: 60_000,
  });
  const janela = moderacao ? janelaChatAberta(moderacao) : { aberta: true };

  const { data: thread } = useQuery<ThreadFull | null>({
    queryKey: ["chat-thread-info", id],
    enabled: !!user,
    queryFn: async () => {
      const { data: t } = await supabase
        .from("chat_alunos_threads")
        .select("id, aluno_id, responsavel_user_id, professor_user_id")
        .eq("id", id)
        .maybeSingle();
      if (!t) return null;
      const uid = user!.id;
      const contraId = t.responsavel_user_id === uid ? t.professor_user_id : t.responsavel_user_id;
      const [{ data: al }, { data: perfil }] = await Promise.all([
        supabase.from("alunos").select("nome_completo").eq("id", t.aluno_id).maybeSingle(),
        supabase
          .from("profiles")
          .select("display_name, email")
          .eq("user_id", contraId)
          .maybeSingle(),
      ]);
      return {
        ...(t as ThreadFull),
        aluno_nome: (al as { nome_completo?: string } | null)?.nome_completo ?? "Aluno",
        contraparte_nome:
          (perfil as { display_name?: string; email?: string } | null)?.display_name ||
          (perfil as { email?: string } | null)?.email ||
          "Contato",
      };
    },
  });

  const { data: mensagens = [], refetch } = useQuery<ChatMensagem[]>({
    queryKey: ["chat-mensagens", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("chat_alunos_mensagens")
        .select("*")
        .eq("thread_id", id)
        .order("created_at", { ascending: true });
      return (data ?? []) as ChatMensagem[];
    },
  });

  // Realtime + marcar leitura
  useEffect(() => {
    marcarLidas(id).catch(() => {});
    const ch = supabase
      .channel(uniqueRealtimeChannelName(`chat-${id}`))
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_alunos_mensagens",
          filter: `thread_id=eq.${id}`,
        },
        () => {
          refetch();
          marcarLidas(id).catch(() => {});
          qc.invalidateQueries({ queryKey: ["chat-alunos-threads"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id, refetch, qc]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [mensagens.length]);

  async function handleSend() {
    if (!texto.trim() || sending) return;
    setSending(true);
    try {
      await enviarMensagem({ thread_id: id, conteudo: texto });
      setTexto("");
      refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar mensagem");
    } finally {
      setSending(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const path = await uploadAnexo(id, file);
      await enviarMensagem({
        thread_id: id,
        conteudo: `📎 ${file.name}`,
        anexo_url: path,
      });
      refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar anexo");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <PainelLayout>
      <div className="mx-auto flex h-[calc(100vh-9rem)] max-w-3xl flex-col">
        <div className="border-b p-3">
          <h1 className="text-lg font-semibold">{thread?.aluno_nome ?? "Conversa"}</h1>
          {thread && <p className="text-xs text-muted-foreground">Com {thread.contraparte_nome}</p>}
        </div>
        <div className="border-b p-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/chat-aluno">
              <ArrowLeft className="mr-1 h-4 w-4" /> Todas as conversas
            </Link>
          </Button>
        </div>

        {moderacao?.ativo && (
          <div
            className={cn(
              "border-b px-3 py-2 text-xs",
              janela.aberta
                ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                : "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
            )}
            role="status"
          >
            {janela.aberta
              ? `🟢 Chat aberto — janela ${moderacao.janela_inicio}–${moderacao.janela_fim} · limite ${moderacao.max_msgs_dia} msg/dia por conversa.`
              : `🟡 ${janela.motivo} Você ainda pode ler mensagens anteriores.`}
          </div>
        )}

        <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-4">
          {mensagens.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Nenhuma mensagem ainda. Envie a primeira!
            </p>
          ) : (
            mensagens.map((m) => (
              <MessageBubble key={m.id} m={m} isMine={m.autor_user_id === user?.id} />
            ))
          )}
        </div>

        <div className="border-t bg-background p-3">
          <div className="flex items-end gap-2">
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={handleUpload}
              accept="image/*,application/pdf"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => fileRef.current?.click()}
              disabled={uploading || !janela.aberta}
              aria-label="Anexar"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Paperclip className="h-4 w-4" />
              )}
            </Button>
            <Textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Escreva sua mensagem…"
              className="max-h-32 min-h-[42px] flex-1 resize-none"
              rows={1}
            />
            <Button
              onClick={handleSend}
              disabled={!texto.trim() || sending || !janela.aberta}
              size="icon"
              aria-label="Enviar mensagem"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </PainelLayout>
  );
}

function MessageBubble({ m, isMine }: { m: ChatMensagem; isMine: boolean }) {
  const [anexo, setAnexo] = useState<string | null>(null);
  useEffect(() => {
    if (m.anexo_url) getAnexoUrl(m.anexo_url).then(setAnexo);
  }, [m.anexo_url]);

  return (
    <div className={cn("flex", isMine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow-sm",
          isMine ? "bg-primary text-primary-foreground" : "bg-muted",
        )}
      >
        <p className="whitespace-pre-wrap break-words">{m.conteudo}</p>
        {anexo && (
          <a
            href={anexo}
            target="_blank"
            rel="noreferrer"
            className={cn(
              "mt-1 inline-flex items-center gap-1 text-xs underline",
              isMine ? "text-primary-foreground/90" : "text-primary",
            )}
          >
            <Download className="h-3 w-3" /> Abrir anexo
          </a>
        )}
        <p
          className={cn(
            "mt-1 text-[10px] opacity-70",
            isMine ? "text-primary-foreground/80" : "text-muted-foreground",
          )}
        >
          {new Date(m.created_at).toLocaleString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })}
          {isMine && m.lida_em ? " · lida" : ""}
        </p>
      </div>
    </div>
  );
}

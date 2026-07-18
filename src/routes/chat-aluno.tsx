import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { MessageCircle, Loader2, GraduationCap } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { listarMinhasThreads } from "@/lib/chat-aluno";
import { PainelLayout } from "@/components/PainelLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { uniqueRealtimeChannelName } from "@/lib/realtime-channel";

export const Route = createFileRoute("/chat-aluno")({
  ssr: false,
  head: () => ({ meta: [{ title: "Conversas por aluno | UEECM" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: ChatAlunoIndex,
});

function ChatAlunoIndex() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["chat-alunos-threads"],
    queryFn: listarMinhasThreads,
  });

  useEffect(() => {
    const ch = supabase
      .channel(uniqueRealtimeChannelName("chat-alunos-threads-list"))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_alunos_threads" },
        () => refetch(),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_alunos_mensagens" },
        () => refetch(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [refetch]);

  return (
    <PainelLayout>
      <div className="mx-auto max-w-3xl space-y-4 p-4">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold">Conversas por aluno</h1>
          <p className="text-sm text-muted-foreground">Chat direto Responsável ↔ Professor</p>
        </header>
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando…
          </div>
        ) : !data || data.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
              <MessageCircle className="h-12 w-12 opacity-40" />
              <p className="text-sm">Nenhuma conversa ainda.</p>
              <p className="text-xs">
                Responsáveis: abra a página do seu filho em <strong>Meus filhos</strong> e clique em
                “Conversar com o professor”.
              </p>
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-2">
            {data.map((t) => (
              <li key={t.id}>
                <Link
                  to="/chat-aluno/$id"
                  params={{ id: t.id }}
                  className="flex items-start gap-3 rounded-xl border bg-card p-4 transition hover:border-primary hover:shadow-sm"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <GraduationCap className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="truncate text-sm font-semibold">{t.aluno_nome}</h3>
                      {t.nao_lidas > 0 && (
                        <Badge className="h-5 px-2 text-[10px]">{t.nao_lidas}</Badge>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {t.contraparte_papel === "professor" ? "Professor" : "Responsável"}:{" "}
                      {t.contraparte_nome}
                      {t.turma_nome ? ` · ${t.turma_nome}` : ""}
                    </p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {t.last_message_preview || "Sem mensagens ainda"}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PainelLayout>
  );
}

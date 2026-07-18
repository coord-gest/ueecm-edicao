import { useEffect, useState, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Loader2, Send, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { moderarComentarioIA } from "@/lib/ai-moderation.functions";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { verifyCaptchaToken } from "@/lib/turnstile.functions";
import { uniqueRealtimeChannelName } from "@/lib/realtime-channel";

interface PostComentariosProps {
  postId: string;
}

interface Comentario {
  id: string;
  conteudo: string;
  autor_nome: string;
  autor_avatar: string | null;
  user_id: string;
  status: "pendente" | "aprovado" | "rejeitado";
  created_at: string;
}

const MAX_LEN = 2000;

function formatData(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function iniciais(nome: string) {
  return nome
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function PostComentarios({ postId }: PostComentariosProps) {
  const { isStaff } = useAuth();
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [idade, setIdade] = useState("");
  const [sexo, setSexo] = useState<string>("");
  const [texto, setTexto] = useState("");
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const queryKey = ["post-comentarios", postId];

  const { data: comentarios = [], isLoading } = useQuery({
    queryKey,
    queryFn: async (): Promise<Comentario[]> => {
      const { data, error } = await supabase
        .from("post_comentarios_publicos")
        .select("id, conteudo, autor_nome, autor_avatar, user_id, status, created_at")
        .eq("post_id", postId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Comentario[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(uniqueRealtimeChannelName(`post-comentarios-${postId}`))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "post_comentarios", filter: `post_id=eq.${postId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["post-comentarios", postId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [postId, qc]);

  const enviar = useMutation({
    mutationFn: async () => {
      const conteudo = texto.trim();
      const autor_nome = nome.trim();
      const autor_email = email.trim() || null;
      const idadeNum = idade ? Number(idade) : null;
      if (!autor_nome) throw new Error("Informe seu nome.");
      if (!conteudo) throw new Error("Escreva seu comentário.");
      if (conteudo.length > MAX_LEN) throw new Error("Comentário muito longo.");
      if (autor_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(autor_email)) {
        throw new Error("E-mail inválido.");
      }
      if (idadeNum !== null && (Number.isNaN(idadeNum) || idadeNum < 1 || idadeNum > 120)) {
        throw new Error("Idade inválida.");
      }
      // Comentários de visitantes exigem Turnstile; usuários staff/logados são isentos.
      if (!isStaff) {
        if (!captchaToken) throw new Error("Complete a verificação anti-bot antes de enviar.");
        await verifyCaptchaToken({ data: { token: captchaToken, action: "comment" } });
      }
      const { data: inserted, error } = await supabase
        .from("post_comentarios")
        .insert({
          post_id: postId,
          user_id: null,
          conteudo,
          autor_nome,
          autor_avatar: null,
          autor_email,
          autor_idade: idadeNum,
          autor_sexo: sexo || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      // Moderação IA (fire-and-forget): pode aprovar/bloquear ou deixar pendente
      if (inserted?.id) {
        moderarComentarioIA({ data: { comentario_id: inserted.id } }).catch(() => {
          // silencioso: comentário fica pendente para revisão manual
        });
      }
    },
    onSuccess: () => {
      toast.success("Comentário enviado!", {
        description: "Aguardando aprovação da direção/coordenação.",
      });
      setNome("");
      setEmail("");
      setIdade("");
      setSexo("");
      setTexto("");
      setCaptchaToken(null);
      setMostrarFormulario(false);
      qc.invalidateQueries({ queryKey: ["post-comentarios", postId] });
    },
    onError: (e: Error) => {
      setCaptchaToken(null);
      toast.error(e.message);
    },
  });

  const apagar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("post_comentarios").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Comentário apagado");
      qc.invalidateQueries({ queryKey: ["post-comentarios", postId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    enviar.mutate();
  };

  return (
    <section className="mt-10" aria-labelledby="comentarios-titulo">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="size-5 text-primary" />
          <h2 id="comentarios-titulo" className="font-display text-xl font-semibold">
            Comentários
            {comentarios.length > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({comentarios.length})
              </span>
            )}
          </h2>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="rounded-full"
          onClick={() => setMostrarFormulario((v) => !v)}
        >
          <Plus className="size-4" />
          {mostrarFormulario ? "Fechar" : "Comentar"}
        </Button>
      </div>

      {mostrarFormulario && (
        <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="c-nome">Nome *</Label>
                <Input
                  id="c-nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value.slice(0, 100))}
                  placeholder="Seu nome"
                  required
                  disabled={enviar.isPending}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-email">E-mail</Label>
                <Input
                  id="c-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value.slice(0, 255))}
                  placeholder="opcional"
                  disabled={enviar.isPending}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-idade">Idade</Label>
                <Input
                  id="c-idade"
                  type="number"
                  min={1}
                  max={120}
                  value={idade}
                  onChange={(e) => setIdade(e.target.value)}
                  placeholder="opcional"
                  disabled={enviar.isPending}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-sexo">Sexo</Label>
                <Select value={sexo} onValueChange={setSexo} disabled={enviar.isPending}>
                  <SelectTrigger id="c-sexo">
                    <SelectValue placeholder="opcional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="feminino">Feminino</SelectItem>
                    <SelectItem value="masculino">Masculino</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                    <SelectItem value="prefiro_nao_dizer">Prefiro não dizer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-msg">Comentário *</Label>
              <Textarea
                id="c-msg"
                value={texto}
                onChange={(e) => setTexto(e.target.value.slice(0, MAX_LEN))}
                placeholder="Escreva seu comentário…"
                rows={4}
                className="resize-none"
                required
                disabled={enviar.isPending}
              />
            </div>
            {!isStaff && (
              <TurnstileWidget
                action="comment"
                size="compact"
                onToken={setCaptchaToken}
                onExpire={() => setCaptchaToken(null)}
                onError={() => setCaptchaToken(null)}
              />
            )}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs text-muted-foreground">
                {texto.length}/{MAX_LEN} · seu comentário será publicado após aprovação da direção,
                coordenação ou desenvolvedor.
              </span>
              <Button
                type="submit"
                size="sm"
                className="rounded-full"
                disabled={
                  enviar.isPending || !texto.trim() || !nome.trim() || (!isStaff && !captchaToken)
                }
              >
                {enviar.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                Enviar
              </Button>
            </div>
          </form>
        </div>
      )}

      <ul className="mt-6 space-y-4">
        {isLoading && <li className="text-sm text-muted-foreground">Carregando comentários…</li>}
        {!isLoading && comentarios.length === 0 && (
          <li className="rounded-xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
            Ainda não há comentários. Seja o primeiro a comentar!
          </li>
        )}
        {comentarios.map((c) => {
          return (
            <li key={c.id} className="rounded-2xl border border-border/60 bg-card/30 p-4">
              <div className="flex items-start gap-3">
                <Avatar className="size-9">
                  <AvatarImage src={c.autor_avatar ?? undefined} alt="" />
                  <AvatarFallback>{iniciais(c.autor_nome)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{c.autor_nome}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatData(c.created_at)}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/90">
                    {c.conteudo}
                  </p>
                </div>
                {isStaff && (
                  <Button
                    onClick={() => apagar.mutate(c.id)}
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    aria-label="Apagar comentário"
                    disabled={apagar.isPending}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

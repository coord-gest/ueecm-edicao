import { useEffect, useRef, useState } from "react";
import { X, Send, Loader2, Sparkles, RotateCcw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
const titoAvatar = { url: "/tito-avatar.webp" };
const titoHead = { url: "/tito-head.webp" };

type TitoAvatarProps = {
  variant?: "head" | "full";
  size: number;
  className?: string;
  alt?: string;
  decorative?: boolean;
};

function TitoAvatar({
  variant = "head",
  size,
  className,
  alt = "Titinho, mascote e assistente virtual da U.E. Evaristo Campelo de Matos",
  decorative = false,
}: TitoAvatarProps) {
  const [failed, setFailed] = useState(false);
  const [triedFallback, setTriedFallback] = useState(false);
  const primary = variant === "head" ? titoHead.url : titoAvatar.url;

  if (failed) {
    return (
      <span
        role={decorative ? "presentation" : "img"}
        aria-label={decorative ? undefined : alt}
        aria-hidden={decorative || undefined}
        style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.42)) }}
        className={cn(
          "inline-flex items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground ring-1 ring-primary/30 select-none",
          className,
        )}
      >
        T
      </span>
    );
  }

  return (
    <img
      src={primary}
      width={size}
      height={size}
      alt={decorative ? "" : alt}
      aria-hidden={decorative || undefined}
      draggable={false}
      loading="lazy"
      decoding="async"
      onError={(e) => {
        if (!triedFallback && variant === "head") {
          setTriedFallback(true);
          (e.currentTarget as HTMLImageElement).src = titoAvatar.url;
          return;
        }
        setFailed(true);
      }}
      style={{ width: size, height: size }}
      className={cn("rounded-full object-cover", className)}
    />
  );
}

type ChatMessage = { role: "user" | "assistant"; content: string };
type ChatResponse = {
  conversationId?: string;
  reply?: string;
  error?: string;
  message?: string;
};

const SESSION_KEY = "ue-chat-session-id";
const CONVERSATION_KEY = "ue-chat-conversation-id";
const POSITION_KEY = "ue-chat-fab-position";
const FAB_SIZE = 56;
const MARGIN = 8;

const SUGGESTED_QUESTIONS = [
  "Quero agendar uma visita à Direção da escola",
  "Quem são os diretores da escola?",
  "Quem são os coordenadores pedagógicos?",
  "Qual o endereço e como chegar até a escola?",
  "Onde vejo o calendário escolar e as próximas provas?",
];

function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pos, setPos] = useState<{ right: number; bottom: number }>({ right: 20, bottom: 20 });
  const draggingRef = useRef(false);
  const movedRef = useRef(false);
  const startRef = useRef<{ x: number; y: number; right: number; bottom: number }>({
    x: 0,
    y: 0,
    right: 20,
    bottom: 20,
  });
  const fabRef = useRef<HTMLButtonElement>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Olá! Eu sou o **Tito**, o assistente virtual do Evaristo Campelo. Mas, para os íntimos, pode me chamar de **Titinho**! 🦉",
    },
  ]);
  const sessionIdRef = useRef<string>("");
  const conversationIdRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Permite abrir o chat via evento global disparado por CTAs (ex: TitinhoCta na home).
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("open-titinho", onOpen);
    return () => window.removeEventListener("open-titinho", onOpen);
  }, []);

  useEffect(() => {
    sessionIdRef.current = getOrCreateSessionId();
    conversationIdRef.current = localStorage.getItem(CONVERSATION_KEY);
    try {
      const saved = localStorage.getItem(POSITION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed?.right === "number" && typeof parsed?.bottom === "number") {
          setPos(clampToViewport(parsed));
        }
      }
    } catch {
      /* ignora */
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  async function send(textArg?: string) {
    const text = (textArg ?? input).trim();
    if (!text || loading) return;
    if (!textArg) setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          conversationId: conversationIdRef.current,
          message: text,
        }),
      });
      const rawBody = await res.text();
      let data: ChatResponse | null = null;
      try {
        data = rawBody ? (JSON.parse(rawBody) as ChatResponse) : null;
      } catch {
        data = null;
      }
      if (!res.ok) {
        throw new Error(data?.error || "Erro ao consultar a IA");
      }
      const chatData = data ?? {};
      if (chatData.conversationId) {
        conversationIdRef.current = chatData.conversationId;
        localStorage.setItem(CONVERSATION_KEY, chatData.conversationId);
      }
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content:
            chatData.reply ||
            chatData.message ||
            "Desculpe, tive um problema ao responder agora. Por favor, tente novamente em instantes.",
        },
      ]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content:
            "Desculpe, tive um problema ao responder agora. Por favor, tente novamente em instantes.",
        },
      ]);
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function resetConversation() {
    conversationIdRef.current = null;
    localStorage.removeItem(CONVERSATION_KEY);
    setMessages([
      {
        role: "assistant",
        content: "Nova conversa iniciada. Como posso ajudar?",
      },
    ]);
  }

  function clampToViewport(p: { right: number; bottom: number }) {
    if (typeof window === "undefined") return p;
    const maxRight = Math.max(MARGIN, window.innerWidth - FAB_SIZE - MARGIN);
    const maxBottom = Math.max(MARGIN, window.innerHeight - FAB_SIZE - MARGIN);
    return {
      right: Math.min(Math.max(MARGIN, p.right), maxRight),
      bottom: Math.min(Math.max(MARGIN, p.bottom), maxBottom),
    };
  }

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    draggingRef.current = true;
    movedRef.current = false;
    startRef.current = { x: e.clientX, y: e.clientY, right: pos.right, bottom: pos.bottom };
    fabRef.current?.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!draggingRef.current) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    if (!movedRef.current && Math.hypot(dx, dy) > 5) movedRef.current = true;
    if (!movedRef.current) return;
    const next = clampToViewport({
      right: startRef.current.right - dx,
      bottom: startRef.current.bottom - dy,
    });
    setPos(next);
  }

  function onPointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    fabRef.current?.releasePointerCapture(e.pointerId);
    if (movedRef.current) {
      try {
        localStorage.setItem(POSITION_KEY, JSON.stringify(pos));
      } catch {
        /* ignora */
      }
    }
  }

  function onClickFab() {
    if (movedRef.current) {
      movedRef.current = false;
      return;
    }
    setOpen((o) => !o);
  }

  useEffect(() => {
    function onResize() {
      setPos((p) => clampToViewport(p));
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const showSuggestions = messages.length <= 1 && !loading;

  return (
    <>
      {/* Botão flutuante */}
      <button
        ref={fabRef}
        type="button"
        onClick={onClickFab}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        aria-label={open ? "Fechar chat" : "Abrir chat de atendimento"}
        style={{ right: pos.right, bottom: pos.bottom, touchAction: "none" }}
        className={cn(
          "fixed z-50 h-14 w-14 cursor-grab rounded-full shadow-xl ring-4 ring-primary/15",
          open
            ? "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground"
            : "bg-white text-primary dark:bg-neutral-900",
          "flex items-center justify-center transition-all hover:scale-105 active:scale-95 active:cursor-grabbing",
          "select-none group overflow-hidden",
        )}
      >
        {open ? (
          <X className="h-6 w-6" />
        ) : (
          <>
            <TitoAvatar
              variant="head"
              size={56}
              alt="Titinho, mascote e assistente virtual"
              className="scale-110"
            />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500 ring-2 ring-background" />
            </span>
          </>
        )}
      </button>

      {/* Janela do chat */}
      {open && (
        <div
          className={cn(
            "fixed z-50 flex flex-col overflow-hidden border bg-background shadow-2xl",
            // Mobile: 70% da tela com margens em todos os lados, centralizado
            "left-[5%] right-[5%] top-[10%] bottom-[10%] rounded-2xl",
            // Desktop: floating card
            "sm:inset-auto sm:bottom-24 sm:right-6 sm:top-auto sm:left-auto sm:rounded-2xl",
            "sm:w-[400px] sm:h-[min(85vh,640px)]",
            "animate-in fade-in slide-in-from-bottom-4 duration-200",
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b bg-gradient-to-r from-primary to-primary/85 px-4 py-3 text-primary-foreground">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative shrink-0">
                <TitoAvatar
                  variant="head"
                  size={40}
                  alt="Titinho"
                  className="ring-2 ring-primary-foreground/40 bg-white dark:bg-neutral-900"
                />
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-400 ring-2 ring-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">Tito · Mascote da Escola</p>
                <p className="text-[11px] opacity-80 truncate flex items-center gap-1">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400" />
                  Online agora
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={resetConversation}
                aria-label="Nova conversa"
                title="Iniciar nova conversa"
                className="flex h-9 w-9 items-center justify-center rounded-full text-primary-foreground/90 transition hover:bg-primary-foreground/15"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fechar chat"
                className="flex h-9 w-9 items-center justify-center rounded-full text-primary-foreground/90 transition hover:bg-primary-foreground/15"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Mensagens */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-3 py-4 space-y-3 bg-gradient-to-b from-muted/30 to-background"
          >
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-end gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200",
                  m.role === "user" ? "justify-end" : "justify-start",
                )}
              >
                {m.role === "assistant" && (
                  <TitoAvatar
                    variant="head"
                    size={28}
                    decorative
                    className="shrink-0 ring-1 ring-border"
                  />
                )}
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-card border text-card-foreground rounded-bl-sm",
                  )}
                >
                  {m.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-a:text-primary">
                      <ReactMarkdown
                        components={{
                          a: ({ href, children, ...props }) => {
                            const url = href ?? "";
                            const isInternal = url.startsWith("/") && !url.startsWith("//");
                            const isSameTab =
                              isInternal || url.startsWith("tel:") || url.startsWith("mailto:");
                            return (
                              <a
                                {...props}
                                href={url}
                                target={isSameTab ? undefined : "_blank"}
                                rel={isSameTab ? undefined : "noopener noreferrer"}
                                className="underline underline-offset-2 hover:opacity-80"
                              >
                                {children}
                              </a>
                            );
                          },
                        }}
                      >
                        {m.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-end gap-2">
                <TitoAvatar
                  variant="head"
                  size={28}
                  decorative
                  className="shrink-0 ring-1 ring-border"
                />
                <div className="bg-card border rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-sm flex items-center gap-1.5 shadow-sm">
                  <span className="h-2 w-2 rounded-full bg-primary/60 animate-bounce [animation-delay:-0.3s]" />
                  <span className="h-2 w-2 rounded-full bg-primary/60 animate-bounce [animation-delay:-0.15s]" />
                  <span className="h-2 w-2 rounded-full bg-primary/60 animate-bounce" />
                </div>
              </div>
            )}

            {/* Perguntas sugeridas */}
            {showSuggestions && (
              <div className="pt-2 space-y-2 animate-in fade-in duration-300">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 px-1">
                  <Sparkles className="h-3.5 w-3.5" />
                  Perguntas frequentes
                </p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => send(q)}
                      className="text-left text-xs rounded-full border bg-card px-3 py-1.5 shadow-sm transition hover:border-primary hover:bg-primary/5 hover:text-primary"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="border-t bg-background p-2.5">
            <div className="flex items-end gap-2 rounded-2xl border bg-card p-1.5 shadow-sm focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Digite sua mensagem..."
                rows={1}
                className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm focus:outline-none max-h-32 placeholder:text-muted-foreground"
                disabled={loading}
              />
              <Button
                type="button"
                size="icon"
                onClick={() => send()}
                disabled={loading || !input.trim()}
                aria-label="Enviar mensagem"
                className="h-9 w-9 shrink-0 rounded-xl"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
              Powered by IA · U.E. Evaristo Campelo de Matos
            </p>
          </div>
        </div>
      )}
    </>
  );
}

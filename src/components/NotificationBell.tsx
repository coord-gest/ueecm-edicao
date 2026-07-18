import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  Bell,
  CheckCheck,
  Megaphone,
  AlertTriangle,
  CalendarClock,
  BookOpen,
  UserCheck,
  MessageCircle,
  Sparkles,
  Info,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { formatarDataHora } from "@/data/mock";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";
import { uniqueRealtimeChannelName } from "@/lib/realtime-channel";

type NotifRow = Database["public"]["Tables"]["notificacoes_inapp"]["Row"];

const TIPO_META: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; color: string; label: string }
> = {
  comunicado: { icon: Megaphone, color: "text-blue-500", label: "Comunicado" },
  alerta: { icon: AlertTriangle, color: "text-amber-500", label: "Alerta" },
  agendamento: { icon: CalendarClock, color: "text-emerald-500", label: "Agendamento" },
  nota: { icon: BookOpen, color: "text-violet-500", label: "Nota" },
  frequencia: { icon: UserCheck, color: "text-cyan-500", label: "Frequência" },
  comentario: { icon: MessageCircle, color: "text-pink-500", label: "Comentário" },
  evento: { icon: Sparkles, color: "text-rose-500", label: "Evento" },
  sistema: { icon: Info, color: "text-muted-foreground", label: "Sistema" },
};

function TipoIcone({ tipo, className }: { tipo: string; className?: string }) {
  const meta = TIPO_META[tipo] ?? TIPO_META.sistema;
  const Icon = meta.icon;
  return <Icon className={cn("size-4 shrink-0", meta.color, className)} />;
}

export function NotificationBell() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: items = [] } = useQuery({
    queryKey: ["notificacoes-inapp", user?.id],
    enabled: !!user,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("notificacoes_inapp")
        .select("*")
        .eq("arquivada", false)
        .order("created_at", { ascending: false })
        .limit(15);
      return (data ?? []) as NotifRow[];
    },
  });

  const unread = items.filter((n) => !n.lida).length;

  // Badge do app
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const nav = navigator as Navigator & {
      setAppBadge?: (n?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (unread > 0) nav.setAppBadge?.(unread).catch(() => undefined);
    else nav.clearAppBadge?.().catch(() => undefined);
  }, [unread]);

  // Realtime — guard against StrictMode/HMR double-invoke
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  useEffect(() => {
    if (!user) return;
    // Se já existe um canal ativo (StrictMode remount), remove antes de criar novo
    if (channelRef.current) {
      void supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    const channelName = uniqueRealtimeChannelName(`notif-inapp-${user.id}`);
    const ch = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notificacoes_inapp",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["notificacoes-inapp", user.id] });
          qc.invalidateQueries({ queryKey: ["notificacoes-inapp-all", user.id] });
        },
      )
      .subscribe();
    channelRef.current = ch;
    return () => {
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user, qc]);


  const markAllRead = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase
        .from("notificacoes_inapp")
        .update({ lida: true, read_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("lida", false);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notificacoes-inapp", user?.id] });
      qc.invalidateQueries({ queryKey: ["notificacoes-inapp-all", user?.id] });
      toast.success("Todas marcadas como lidas");
    },
    onError: (err) => {
      toast.error("Erro ao marcar como lidas", {
        description: err instanceof Error ? err.message : undefined,
      });
    },
  });

  const markOneRead = async (id: string) => {
    await supabase
      .from("notificacoes_inapp")
      .update({ lida: true, read_at: new Date().toISOString() })
      .eq("id", id);
    qc.invalidateQueries({ queryKey: ["notificacoes-inapp", user?.id] });
  };

  const handleOpen = (o: boolean) => {
    setOpen(o);
  };

  if (!user) return null;

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-full"
          aria-label={`Notificações${unread > 0 ? ` (${unread} não lidas)` : ""}`}
        >
          <Bell className="size-5" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex min-w-[18px] items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-background">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0 max-w-[calc(100vw-2rem)]">
        <div className="flex items-start justify-between gap-2 border-b border-border/60 px-4 py-3">
          <div className="min-w-0">
            <p className="font-display text-sm font-semibold">Notificações</p>
            <p className="text-xs text-muted-foreground">
              {unread > 0
                ? `${unread} não lida${unread === 1 ? "" : "s"}`
                : "Você está em dia"}
            </p>
          </div>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              className="h-7 shrink-0 gap-1 px-2 text-xs"
            >
              <CheckCheck className="size-3.5" />
              Marcar todas
            </Button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Sem novidades por aqui.
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {items.slice(0, 10).map((n) => {
                const meta = TIPO_META[n.tipo] ?? TIPO_META.sistema;
                const content = (
                  <div
                    className={cn(
                      "flex items-start gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/50",
                      !n.lida && "bg-primary/5",
                    )}
                  >
                    <TipoIcone tipo={n.tipo} className="mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          {meta.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatarDataHora(n.created_at)}
                        </span>
                        {!n.lida && (
                          <span className="ml-auto size-1.5 rounded-full bg-blue-500" />
                        )}
                      </div>
                      <p className="mt-1 truncate font-medium">{n.titulo}</p>
                      {n.mensagem && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {n.mensagem}
                        </p>
                      )}
                    </div>
                  </div>
                );
                return (
                  <li key={n.id}>
                    {n.link ? (
                      <a
                        href={n.link}
                        onClick={() => {
                          if (!n.lida) void markOneRead(n.id);
                          setOpen(false);
                        }}
                      >
                        {content}
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          if (!n.lida) void markOneRead(n.id);
                        }}
                        className="w-full text-left"
                      >
                        {content}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="border-t border-border/60 p-2">
          <Button asChild variant="ghost" size="sm" className="w-full justify-between text-xs">
            <Link to="/notificacoes" onClick={() => setOpen(false)}>
              Ver todas as notificações
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

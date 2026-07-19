import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  Bell,
  CheckCheck,
  Archive,
  Trash2,
  Search,
  ArchiveRestore,
  Megaphone,
  AlertTriangle,
  CalendarClock,
  BookOpen,
  UserCheck,
  MessageCircle,
  Sparkles,
  Info,
  Inbox,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { formatarDataHora } from "@/data/mock";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type NotifRow = Database["public"]["Tables"]["notificacoes_inapp"]["Row"];
type Tipo = NotifRow["tipo"];

const TIPO_META: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; color: string; bg: string; label: string }
> = {
  comunicado: {
    icon: Megaphone,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    label: "Comunicado",
  },
  alerta: { icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/10", label: "Alerta" },
  agendamento: {
    icon: CalendarClock,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    label: "Agendamento",
  },
  nota: { icon: BookOpen, color: "text-violet-500", bg: "bg-violet-500/10", label: "Nota" },
  frequencia: {
    icon: UserCheck,
    color: "text-cyan-500",
    bg: "bg-cyan-500/10",
    label: "Frequência",
  },
  comentario: {
    icon: MessageCircle,
    color: "text-pink-500",
    bg: "bg-pink-500/10",
    label: "Comentário",
  },
  evento: { icon: Sparkles, color: "text-rose-500", bg: "bg-rose-500/10", label: "Evento" },
  sistema: { icon: Info, color: "text-muted-foreground", bg: "bg-muted", label: "Sistema" },
};

export const Route = createFileRoute("/notificacoes")({
  head: () => ({
    meta: [
      { title: "Notificações — U.E. Evaristo Campelo de Matos" },
      {
        name: "description",
        content: "Histórico completo de comunicados, alertas e atualizações da escola.",
      },
    ],
  }),
  component: NotificacoesPage,
});

function NotificacoesPage() {
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const [aba, setAba] = useState<"caixa" | "arquivadas">("caixa");
  const [filtroLida, setFiltroLida] = useState<"todas" | "nao-lidas" | "lidas">("todas");
  const [filtroTipo, setFiltroTipo] = useState<"todos" | Tipo>("todos");
  const [busca, setBusca] = useState("");

  const { data: allItems = [], isLoading } = useQuery({
    queryKey: ["notificacoes-inapp-all", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notificacoes_inapp")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as NotifRow[];
    },
  });

  const filtered = useMemo(() => {
    return allItems.filter((n) => {
      if (aba === "caixa" && n.arquivada) return false;
      if (aba === "arquivadas" && !n.arquivada) return false;
      if (filtroLida === "nao-lidas" && n.lida) return false;
      if (filtroLida === "lidas" && !n.lida) return false;
      if (filtroTipo !== "todos" && n.tipo !== filtroTipo) return false;
      if (busca.trim()) {
        const q = busca.toLowerCase();
        const hay = `${n.titulo} ${n.mensagem ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allItems, aba, filtroLida, filtroTipo, busca]);

  const unread = allItems.filter((n) => !n.lida && !n.arquivada).length;

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["notificacoes-inapp-all", user?.id] });
    qc.invalidateQueries({ queryKey: ["notificacoes-inapp", user?.id] });
  };

  const marcarLida = useMutation({
    mutationFn: async ({ id, lida }: { id: string; lida: boolean }) => {
      const { error } = await supabase
        .from("notificacoes_inapp")
        .update({ lida, read_at: lida ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidar,
  });

  const arquivar = useMutation({
    mutationFn: async ({ id, arquivada }: { id: string; arquivada: boolean }) => {
      const { error } = await supabase
        .from("notificacoes_inapp")
        .update({ arquivada })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      invalidar();
      toast.success(vars.arquivada ? "Arquivada" : "Restaurada");
    },
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notificacoes_inapp").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidar();
      toast.success("Notificação excluída");
    },
  });

  const marcarTodasLidas = useMutation({
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
      invalidar();
      toast.success("Todas marcadas como lidas");
    },
  });

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="h-40 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <Bell className="mx-auto size-12 text-muted-foreground" />
        <h1 className="mt-4 font-display text-2xl font-bold">Entre para ver suas notificações</h1>
        <p className="mt-2 text-muted-foreground">
          Você precisa estar autenticado para acessar seu histórico.
        </p>
        <Button asChild className="mt-6">
          <Link to="/login">Entrar</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:py-10">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold sm:text-3xl">
            <Bell className="size-6 text-primary" />
            Notificações
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {unread > 0
              ? `${unread} não lida${unread === 1 ? "" : "s"} • ${allItems.length} no total`
              : `${allItems.length} notificaç${allItems.length === 1 ? "ão" : "ões"} no total`}
          </p>
        </div>
        {unread > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => marcarTodasLidas.mutate()}
            disabled={marcarTodasLidas.isPending}
          >
            <CheckCheck className="mr-2 size-4" />
            Marcar todas
          </Button>
        )}
      </div>

      <Tabs value={aba} onValueChange={(v) => setAba(v as "caixa" | "arquivadas")}>
        <TabsList className="mb-4">
          <TabsTrigger value="caixa">
            <Inbox className="mr-2 size-4" />
            Caixa
          </TabsTrigger>
          <TabsTrigger value="arquivadas">
            <Archive className="mr-2 size-4" />
            Arquivadas
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar título ou mensagem..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filtroLida} onValueChange={(v) => setFiltroLida(v as typeof filtroLida)}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="nao-lidas">Não lidas</SelectItem>
            <SelectItem value="lidas">Lidas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroTipo} onValueChange={(v) => setFiltroTipo(v as typeof filtroTipo)}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {Object.entries(TIPO_META).map(([key, meta]) => (
              <SelectItem key={key} value={key}>
                {meta.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Inbox className="mx-auto size-12 text-muted-foreground" />
          <p className="mt-4 text-sm text-muted-foreground">
            {allItems.length === 0
              ? "Você ainda não recebeu nenhuma notificação."
              : "Nenhuma notificação corresponde aos filtros."}
          </p>
        </Card>
      ) : (
        <ul className="space-y-2">
          {filtered.map((n) => {
            const meta = TIPO_META[n.tipo] ?? TIPO_META.sistema;
            const Icon = meta.icon;
            return (
              <Card
                key={n.id}
                className={cn(
                  "overflow-hidden transition-all",
                  !n.lida && !n.arquivada && "ring-1 ring-primary/30",
                )}
              >
                <div className="flex gap-3 p-4">
                  <div
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-full",
                      meta.bg,
                    )}
                  >
                    <Icon className={cn("size-5", meta.color)} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {meta.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatarDataHora(n.created_at)}
                      </span>
                      {!n.lida && !n.arquivada && (
                        <span className="text-[10px] font-semibold text-primary">NOVA</span>
                      )}
                    </div>
                    <h3 className="mt-1 font-medium leading-snug">{n.titulo}</h3>
                    {n.mensagem && (
                      <p className="mt-1 text-sm text-muted-foreground">{n.mensagem}</p>
                    )}
                    {n.link && (
                      <a
                        href={n.link}
                        onClick={() => {
                          if (!n.lida) marcarLida.mutate({ id: n.id, lida: true });
                        }}
                        className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
                      >
                        Abrir →
                      </a>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    {!n.arquivada && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => marcarLida.mutate({ id: n.id, lida: !n.lida })}
                        title={n.lida ? "Marcar como não lida" : "Marcar como lida"}
                        aria-label={n.lida ? "Marcar como não lida" : "Marcar como lida"}
                      >
                        <CheckCheck
                          className={cn(
                            "size-4",
                            n.lida ? "text-muted-foreground" : "text-primary",
                          )}
                        />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => arquivar.mutate({ id: n.id, arquivada: !n.arquivada })}
                      title={n.arquivada ? "Restaurar" : "Arquivar"}
                      aria-label={n.arquivada ? "Restaurar notificação" : "Arquivar notificação"}
                    >
                      {n.arquivada ? (
                        <ArchiveRestore className="size-4" />
                      ) : (
                        <Archive className="size-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm("Excluir esta notificação permanentemente?")) {
                          excluir.mutate(n.id);
                        }
                      }}
                      title="Excluir"
                      aria-label="Excluir notificação"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </ul>
      )}
    </div>
  );
}

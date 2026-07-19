import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  ArrowLeft,
  Megaphone,
  Plus,
  Trash2,
  Power,
  PowerOff,
  ExternalLink,
  Loader2,
  ImagePlus,
  X,
  Pencil,
  Copy,
  Send,
  Zap,
  StopCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { dispatchPush } from "@/lib/push.functions";
import { sendAlertPushNow } from "@/lib/alert-burst.functions";
import { useServerFn } from "@tanstack/react-start";

import { PainelLayout } from "@/components/PainelLayout";

type Variant = "info" | "success" | "warning" | "destructive";

const variantLabels: Record<Variant, string> = {
  info: "Informação",
  success: "Sucesso",
  warning: "Aviso",
  destructive: "Urgente",
};

const variantTone: Record<Variant, string> = {
  info: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  warning: "bg-amber-500/20 text-amber-800 dark:text-amber-200",
  destructive: "bg-red-500/15 text-red-700 dark:text-red-300",
};

export const Route = createFileRoute("/painel-alertas")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Alertas | Painel" }],
  }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: PainelAlertas,
});

function PainelAlertas() {
  const { user, hasRole, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const canManage = hasRole("desenvolvedor") || hasRole("diretor") || hasRole("coordenador");

  const sendPushNow = useServerFn(sendAlertPushNow);

  // Rajada de notificações (client-side).
  const [burstAlertId, setBurstAlertId] = useState<string>("");
  const [burstCount, setBurstCount] = useState<number>(5);
  const [burstInterval, setBurstInterval] = useState<number>(2);
  const [burstProgress, setBurstProgress] = useState<{
    sent: number;
    total: number;
    nextAt: number | null;
  } | null>(null);
  const burstCancelRef = useRef<{ cancelled: boolean; timer: number | null }>({
    cancelled: false,
    timer: null,
  });
  const [resendingId, setResendingId] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (burstCancelRef.current.timer) window.clearTimeout(burstCancelRef.current.timer);
      burstCancelRef.current.cancelled = true;
    };
  }, []);

  const resendAlert = async (id: string) => {
    setResendingId(id);
    try {
      await sendPushNow({ data: { alertId: id } });
      toast.success("Push reenviado", { description: "Enfileirado e disparado agora." });
    } catch (e) {
      toast.error("Falha ao reenviar", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setResendingId(null);
    }
  };

  const cancelBurst = () => {
    burstCancelRef.current.cancelled = true;
    if (burstCancelRef.current.timer) {
      window.clearTimeout(burstCancelRef.current.timer);
      burstCancelRef.current.timer = null;
    }
    setBurstProgress(null);
    toast.info("Rajada cancelada");
  };

  const startBurst = async () => {
    if (!burstAlertId) {
      toast.error("Escolha um alerta para a rajada");
      return;
    }
    if (burstCount < 1 || burstCount > 20) {
      toast.error("Quantidade inválida", { description: "Envie entre 1 e 20 pushes." });
      return;
    }
    if (burstInterval < 1 || burstInterval > 120) {
      toast.error("Intervalo inválido", { description: "Use entre 1 e 120 minutos." });
      return;
    }
    if (
      !confirm(
        `Enviar ${burstCount} notificações a cada ${burstInterval} minuto(s)?\n` +
          `Duração total ≈ ${burstInterval * (burstCount - 1)} min.\n` +
          `Mantenha esta aba aberta durante a rajada.`,
      )
    )
      return;

    burstCancelRef.current.cancelled = false;
    setBurstProgress({ sent: 0, total: burstCount, nextAt: Date.now() });

    const runOne = async (index: number) => {
      if (burstCancelRef.current.cancelled) return;
      try {
        await sendPushNow({ data: { alertId: burstAlertId } });
        setBurstProgress((p) =>
          p ? { ...p, sent: index + 1, nextAt: Date.now() + burstInterval * 60_000 } : p,
        );
        toast.success(`Push ${index + 1}/${burstCount} enviado`);
      } catch (e) {
        toast.error(`Falha no push ${index + 1}`, {
          description: e instanceof Error ? e.message : String(e),
        });
      }
      if (index + 1 >= burstCount) {
        setBurstProgress(null);
        toast.success("Rajada concluída");
        return;
      }
      burstCancelRef.current.timer = window.setTimeout(
        () => runOne(index + 1),
        burstInterval * 60_000,
      );
    };
    runOne(0);
  };

  const [message, setMessage] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [variant, setVariant] = useState<Variant>("info");
  const [expiresAt, setExpiresAt] = useState("");
  const [scheduleStart, setScheduleStart] = useState(false);
  const [startsAt, setStartsAt] = useState("");
  const [dailyStart, setDailyStart] = useState("");
  const [dailyEnd, setDailyEnd] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const toLocalInput = (iso: string | null | undefined) => {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const resetForm = () => {
    setMessage("");
    setLinkUrl("");
    setLinkLabel("");
    clearImage();
    setExistingImageUrl(null);
    setVariant("info");
    setExpiresAt("");
    setScheduleStart(false);
    setStartsAt("");
    setDailyStart("");
    setDailyEnd("");
    setEditingId(null);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loadIntoForm = (a: any, mode: "edit" | "reuse") => {
    setMessage(a.message ?? "");
    setLinkUrl(a.link_url ?? "");
    setLinkLabel(a.link_label ?? "");
    setVariant((a.variant ?? "info") as Variant);
    setExpiresAt(toLocalInput(a.expires_at));
    if (a.starts_at) {
      setScheduleStart(true);
      setStartsAt(toLocalInput(a.starts_at));
    } else {
      setScheduleStart(false);
      setStartsAt("");
    }
    setDailyStart(a.daily_start_time ? String(a.daily_start_time).slice(0, 5) : "");
    setDailyEnd(a.daily_end_time ? String(a.daily_end_time).slice(0, 5) : "");
    clearImage();
    setExistingImageUrl(mode === "edit" ? (a.image_url ?? null) : null);
    setEditingId(mode === "edit" ? a.id : null);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    toast.info(mode === "edit" ? "Editando alerta" : "Reutilizando alerta", {
      description:
        mode === "edit"
          ? "As alterações substituirão o alerta original."
          : "Ajuste os campos e publique como um novo alerta.",
    });
  };

  const handleFilePick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande", { description: "Máximo 5MB." });
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const clearImage = () => {
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const { data: alerts, isLoading } = useQuery({
    queryKey: ["alerts-admin"],
    enabled: canManage,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alerts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!loading && !canManage) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="font-display text-xl font-semibold">Acesso restrito</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Apenas Desenvolvedor, Diretor e Coordenador podem gerenciar alertas.
          </p>
          <Button asChild className="mt-4 rounded-full">
            <Link to="/painel">Voltar ao painel</Link>
          </Button>
        </div>
      </div>
    );
  }

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const trimmed = message.trim();
    if (!trimmed) {
      toast.error("Digite a mensagem do alerta");
      return;
    }
    if (linkUrl && !/^(https?:\/\/|\/)/i.test(linkUrl.trim())) {
      toast.error("Link inválido", {
        description: "Use uma URL completa (https://...) ou um caminho interno (/...)",
      });
      return;
    }
    // Validações de agendamento: evita alertas que "expiram antes de começar"
    // — bug clássico que fazia o cron descartar o push (expires_at > now()).
    const startsAtDateValidation = scheduleStart && startsAt ? new Date(startsAt) : null;
    const expiresAtDateValidation = expiresAt ? new Date(expiresAt) : null;
    if (expiresAtDateValidation && expiresAtDateValidation.getTime() <= Date.now()) {
      toast.error("Data de expiração inválida", {
        description: "A expiração precisa estar no futuro.",
      });
      return;
    }
    if (
      startsAtDateValidation &&
      expiresAtDateValidation &&
      expiresAtDateValidation.getTime() <= startsAtDateValidation.getTime()
    ) {
      toast.error("Agendamento inválido", {
        description: "A expiração precisa ser posterior ao início agendado.",
      });
      return;
    }
    if (dailyStart && dailyEnd && dailyEnd <= dailyStart) {
      toast.error("Janela diária inválida", {
        description: "O horário final precisa ser maior que o inicial.",
      });
      return;
    }
    setSubmitting(true);

    let uploadedImageUrl: string | null = editingId ? existingImageUrl : null;
    if (imageFile) {
      setUploading(true);
      const ext = imageFile.name.split(".").pop() || "jpg";
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("alert-images").upload(path, imageFile, {
        cacheControl: "3600",
        upsert: false,
        contentType: imageFile.type,
      });
      setUploading(false);
      if (upErr) {
        setSubmitting(false);
        toast.error("Falha no upload da imagem", { description: upErr.message });
        return;
      }
      const { data: pub } = supabase.storage.from("alert-images").getPublicUrl(path);
      uploadedImageUrl = pub.publicUrl;
    }

    const payload = {
      message: trimmed,
      link_url: linkUrl.trim() || null,
      link_label: linkLabel.trim() || null,
      image_url: uploadedImageUrl,
      variant,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      starts_at: scheduleStart && startsAt ? new Date(startsAt).toISOString() : null,
      daily_start_time: dailyStart || null,
      daily_end_time: dailyEnd || null,
    };

    if (editingId) {
      const { error } = await supabase
        .from("alerts")
        .update(payload as never)
        .eq("id", editingId);
      setSubmitting(false);
      if (error) {
        toast.error("Não foi possível salvar as alterações", { description: error.message });
        return;
      }
      toast.success("Alerta atualizado");
      resetForm();
      qc.invalidateQueries({ queryKey: ["alerts-admin"] });
      return;
    }

    const { error } = await supabase.from("alerts").insert({
      ...payload,
      active: true,
      created_by: user.id,
    } as never);
    setSubmitting(false);
    if (error) {
      toast.error("Não foi possível criar o alerta", { description: error.message });
      return;
    }
    toast.success("Alerta publicado", {
      description: "Visível em todos os dispositivos imediatamente.",
    });
    // Só dispara o envio imediato quando o alerta NÃO está agendado para
    // o futuro. Caso contrário, o cron `enqueue-due-alert-pushes` cuida do
    // enfileiramento na hora certa e o trigger em push_notifications_queue
    // dispara o envio automaticamente. Chamar dispatchPush() aqui drenaria
    // qualquer item pendente (inclusive de outros alertas), o que faz
    // parecer que o alerta agendado foi enviado imediatamente.
    const startsAtDate = scheduleStart && startsAt ? new Date(startsAt) : null;
    const isScheduledFuture = startsAtDate && startsAtDate.getTime() > Date.now();
    if (!isScheduledFuture) {
      dispatchPush().catch(() => {});
    }
    resetForm();
    qc.invalidateQueries({ queryKey: ["alerts-admin"] });
  };

  const toggleActive = async (id: string, next: boolean) => {
    const { error } = await supabase.from("alerts").update({ active: next }).eq("id", id);
    if (error) {
      toast.error("Falha ao atualizar", { description: error.message });
      return;
    }
    toast.success(next ? "Alerta reativado" : "Alerta desativado");
    qc.invalidateQueries({ queryKey: ["alerts-admin"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este alerta permanentemente?")) return;
    const { error } = await supabase.from("alerts").delete().eq("id", id);
    if (error) {
      toast.error("Falha ao excluir", { description: error.message });
      return;
    }
    toast.success("Alerta excluído");
    qc.invalidateQueries({ queryKey: ["alerts-admin"] });
  };

  return (
    <PainelLayout>
      <div className="min-h-screen bg-secondary">
        <header className="border-b border-border/60 bg-background/85 backdrop-blur-lg">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
            <button
              type="button"
              onClick={() => navigate({ to: "/painel" })}
              className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
            >
              <ArrowLeft className="size-4" /> Voltar ao painel
            </button>
            <div className="flex items-center gap-2">
              <Megaphone className="size-5 text-primary" />
              <h1 className="font-display text-lg font-semibold">Alertas globais</h1>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
          {/* Rajada de notificações */}
          <section className="rounded-3xl border border-border/70 bg-card p-6 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Zap className="size-5 text-amber-500" />
              <h2 className="font-display text-lg font-semibold">Rajada de notificações</h2>
              <Badge variant="outline" className="ml-auto text-xs">
                Reenvia N pushes em intervalos definidos
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Reforce um alerta importante enviando várias notificações espaçadas (ex.: 5 pushes a
              cada 2 minutos). A rajada roda enquanto esta aba estiver aberta.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
              <div className="space-y-1.5">
                <Label htmlFor="burstAlert" className="text-xs">
                  Alerta a repetir
                </Label>
                <Select
                  value={burstAlertId}
                  onValueChange={setBurstAlertId}
                  disabled={!!burstProgress}
                >
                  <SelectTrigger id="burstAlert">
                    <SelectValue placeholder="Selecione um alerta ativo" />
                  </SelectTrigger>
                  <SelectContent>
                    {(alerts ?? [])
                      .filter((a) => a.active)
                      .map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          [{variantLabels[(a.variant ?? "info") as Variant]}]{" "}
                          {a.message.slice(0, 60)}
                          {a.message.length > 60 ? "…" : ""}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="burstCount" className="text-xs">
                  Quantidade
                </Label>
                <Input
                  id="burstCount"
                  type="number"
                  min={1}
                  max={20}
                  value={burstCount}
                  onChange={(e) => setBurstCount(Number(e.target.value))}
                  className="w-24"
                  disabled={!!burstProgress}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="burstInterval" className="text-xs">
                  Intervalo (min)
                </Label>
                <Input
                  id="burstInterval"
                  type="number"
                  min={1}
                  max={120}
                  value={burstInterval}
                  onChange={(e) => setBurstInterval(Number(e.target.value))}
                  className="w-24"
                  disabled={!!burstProgress}
                />
              </div>
              <div className="flex items-end">
                {burstProgress ? (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={cancelBurst}
                    className="rounded-xl"
                  >
                    <StopCircle className="size-4" /> Cancelar
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={startBurst}
                    disabled={!burstAlertId}
                    className="rounded-xl"
                  >
                    <Zap className="size-4" /> Iniciar rajada
                  </Button>
                )}
              </div>
            </div>

            {burstProgress && (
              <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    Enviados {burstProgress.sent}/{burstProgress.total}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Próximo em ~{burstInterval} min
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-background/60">
                  <div
                    className="h-full bg-amber-500 transition-all"
                    style={{ width: `${(burstProgress.sent / burstProgress.total) * 100}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Não feche esta aba — a rajada é executada no navegador.
                </p>
              </div>
            )}
          </section>

          <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
          {/* Formulário */}
          <form
            onSubmit={handleCreate}
            ref={formRef}
            className="rounded-3xl border border-border/70 bg-card p-6 shadow-sm"
          >
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
              {editingId ? (
                <>
                  <Pencil className="size-4 text-primary" /> Editar alerta
                </>
              ) : (
                <>
                  <Plus className="size-4 text-primary" /> Novo alerta
                </>
              )}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Exibido no topo de todas as páginas, para todos os dispositivos. O visitante pode
              fechar — depois disso não verá mais aquele alerta específico.
            </p>

            <div className="mt-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="msg">Mensagem *</Label>
                <Textarea
                  id="msg"
                  required
                  maxLength={500}
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Ex.: Reunião de pais nesta sexta às 19h no auditório."
                />
                <p className="text-right text-xs text-muted-foreground">{message.length}/500</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="variant">Tipo</Label>
                <Select value={variant} onValueChange={(v) => setVariant(v as Variant)}>
                  <SelectTrigger id="variant">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(variantLabels) as Variant[]).map((v) => (
                      <SelectItem key={v} value={v}>
                        {variantLabels[v]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="linkUrl">Link (opcional)</Label>
                  <Input
                    id="linkUrl"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://... ou /calendario"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="linkLabel">Rótulo do link</Label>
                  <Input
                    id="linkLabel"
                    value={linkLabel}
                    onChange={(e) => setLinkLabel(e.target.value)}
                    placeholder="Saiba mais"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="imageFile">Imagem (opcional)</Label>
                <input
                  ref={fileInputRef}
                  id="imageFile"
                  type="file"
                  accept="image/*"
                  onChange={handleFilePick}
                  className="hidden"
                />
                {!imagePreview && !existingImageUrl ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/70 bg-background/40 px-4 py-6 text-sm text-muted-foreground transition hover:border-primary hover:bg-background/70 hover:text-foreground"
                  >
                    <ImagePlus className="size-6" />
                    <span>Clique para enviar uma imagem</span>
                    <span className="text-xs">PNG, JPG ou WEBP — até 5MB</span>
                  </button>
                ) : (
                  <div className="relative overflow-hidden rounded-xl border border-border/60 bg-background/60 p-2">
                    <img
                      src={imagePreview || existingImageUrl || ""}
                      alt="Pré-visualização"
                      className="mx-auto max-h-40 rounded object-contain"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        clearImage();
                        setExistingImageUrl(null);
                      }}
                      aria-label="Remover imagem"
                      className="absolute right-2 top-2 inline-flex size-7 items-center justify-center rounded-full bg-background/90 text-foreground shadow ring-1 ring-border hover:bg-destructive hover:text-destructive-foreground"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="expires">Expira em (opcional)</Label>
                <Input
                  id="expires"
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Se vazio, fica ativo até ser desativado manualmente.
                </p>
              </div>

              <div className="space-y-2 rounded-xl border border-border/60 bg-background/40 p-3">
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={scheduleStart}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setScheduleStart(on);
                      if (!on) setStartsAt("");
                    }}
                    className="mt-0.5 size-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span>
                    <span className="font-medium">Agendar para depois</span>
                    <span className="ml-1 text-xs text-muted-foreground">
                      (por padrão, publica agora)
                    </span>
                  </span>
                </label>
                {scheduleStart && (
                  <div className="space-y-1.5 pl-6">
                    <Label htmlFor="starts" className="text-xs">
                      Começa em
                    </Label>
                    <Input
                      id="starts"
                      type="datetime-local"
                      value={startsAt}
                      onChange={(e) => setStartsAt(e.target.value)}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      O alerta será enviado automaticamente no horário definido.
                    </p>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-border/60 bg-background/40 p-3">
                <Label className="text-sm font-medium">Janela diária (opcional)</Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Exibe o alerta somente entre estes horários, todos os dias.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="dailyStart" className="text-xs">
                      A partir das
                    </Label>
                    <Input
                      id="dailyStart"
                      type="time"
                      value={dailyStart}
                      onChange={(e) => setDailyStart(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="dailyEnd" className="text-xs">
                      Até as
                    </Label>
                    <Input
                      id="dailyEnd"
                      type="time"
                      value={dailyEnd}
                      onChange={(e) => setDailyEnd(e.target.value)}
                    />
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Dica: se o fim for menor que o início (ex: 22:00 às 06:00), a janela cruza a
                  meia-noite.
                </p>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={submitting} className="flex-1 rounded-xl">
                  {submitting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : editingId ? (
                    <Pencil className="size-4" />
                  ) : (
                    <Megaphone className="size-4" />
                  )}
                  {uploading
                    ? "Enviando imagem..."
                    : editingId
                      ? "Salvar alterações"
                      : "Publicar alerta"}
                </Button>
                {editingId && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetForm}
                    className="rounded-xl"
                  >
                    Cancelar
                  </Button>
                )}
              </div>
            </div>
          </form>

          {/* Lista */}
          <div className="rounded-3xl border border-border/70 bg-card p-6 shadow-sm">
            <h2 className="font-display text-lg font-semibold">Alertas existentes</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Ative, desative ou exclua alertas. Mudanças aparecem em tempo real.
            </p>

            <div className="mt-4 space-y-3">
              {isLoading && (
                <>
                  <Skeleton className="h-24 w-full rounded-2xl" />
                  <Skeleton className="h-24 w-full rounded-2xl" />
                </>
              )}
              {!isLoading && alerts?.length === 0 && (
                <p className="rounded-2xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
                  Nenhum alerta cadastrado ainda.
                </p>
              )}
              {alerts?.map((a) => {
                const ax = a as typeof a & {
                  starts_at?: string | null;
                  daily_start_time?: string | null;
                  daily_end_time?: string | null;
                };
                const v = (a.variant ?? "info") as Variant;
                const expired = a.expires_at && new Date(a.expires_at) <= new Date();
                const scheduled = ax.starts_at && new Date(ax.starts_at) > new Date();
                const dailyStartT = ax.daily_start_time ?? null;
                const dailyEndT = ax.daily_end_time ?? null;
                return (
                  <div
                    key={a.id}
                    className="rounded-2xl border border-border/70 bg-background/60 p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={variantTone[v]} variant="outline">
                        {variantLabels[v]}
                      </Badge>
                      {a.active && !expired ? (
                        scheduled ? (
                          <Badge
                            className="bg-indigo-500/15 text-indigo-700 dark:text-indigo-300"
                            variant="outline"
                          >
                            Agendado
                          </Badge>
                        ) : (
                          <Badge
                            className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                            variant="outline"
                          >
                            Ativo
                          </Badge>
                        )
                      ) : (
                        <Badge variant="secondary">{expired ? "Expirado" : "Inativo"}</Badge>
                      )}
                      {ax.starts_at && (
                        <span className="text-xs text-muted-foreground">
                          Início: {new Date(ax.starts_at).toLocaleString("pt-BR")}
                        </span>
                      )}
                      {a.expires_at && (
                        <span className="text-xs text-muted-foreground">
                          Expira: {new Date(a.expires_at).toLocaleString("pt-BR")}
                        </span>
                      )}
                      {(dailyStartT || dailyEndT) && (
                        <span className="text-xs text-muted-foreground">
                          Diário: {dailyStartT?.slice(0, 5) ?? "00:00"} –{" "}
                          {dailyEndT?.slice(0, 5) ?? "23:59"}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-foreground">{a.message}</p>
                    {a.image_url && (
                      <img
                        src={a.image_url}
                        alt=""
                        loading="lazy"
                        className="mt-2 max-h-32 rounded-md border border-border/60 object-contain"
                      />
                    )}
                    {a.link_url && (
                      <a
                        href={a.link_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        {a.link_label || a.link_url}
                        <ExternalLink className="size-3" />
                      </a>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => loadIntoForm(a, "edit")}
                        className="rounded-full"
                      >
                        <Pencil className="size-3.5" /> Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => loadIntoForm(a, "reuse")}
                        className="rounded-full"
                      >
                        <Copy className="size-3.5" /> Reutilizar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleActive(a.id, !a.active)}
                        className="rounded-full"
                      >
                        {a.active ? (
                          <>
                            <PowerOff className="size-3.5" /> Desativar
                          </>
                        ) : (
                          <>
                            <Power className="size-3.5" /> Ativar
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => remove(a.id)}
                        className="rounded-full"
                      >
                        <Trash2 className="size-3.5" /> Excluir
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          </div>
        </main>
      </div>
    </PainelLayout>
  );
}

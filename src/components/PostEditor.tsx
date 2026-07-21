import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  Loader2,
  Save,
  Send,
  Image as ImageIcon,
  X,
  Check,
  Sparkles,
  FolderOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { roleLabels, type AppRole } from "@/lib/roles";
import { gerarPostComIA, type GerarOutput } from "@/lib/post-ai.functions";
import { sanitizeHtml } from "@/lib/sanitize";
const RichEditor = lazy(() =>
  import("@/components/RichEditor").then((m) => ({ default: m.RichEditor })),
);
import { PostVersionHistory } from "@/components/PostVersionHistory";
import { useRealtimeInvalidate } from "@/lib/use-realtime-invalidate";
import { uploadResponsiveImage, ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE_MB } from "@/lib/image-upload";
import { DrivePicker, type DrivePickerPick } from "@/components/DrivePicker";
import {
  DriveImage,
  getDriveFileIdFromUrl,
  isDriveProxyUrl,
  type DriveStatus,
} from "@/components/DriveImage";
import {
  DriveGalleryManager,
  parseGalleryFromContent,
  replaceGalleryInContent,
  type GalleryItem,
} from "@/components/DriveGalleryManager";
import { verifyDriveFiles } from "@/lib/google-drive.functions";
import { RefreshCw } from "lucide-react";

type PostRow = {
  id: string;
  titulo: string;
  resumo: string;
  conteudo: string | null;
  imagem: string | null;
  autor: string;
  autor_id: string | null;
  autor_modo?: string | null;
  turma: string | null;
  disciplina: string | null;
  destaque: boolean;
  geral: boolean;
  status: string;
  motivo_rejeicao: string | null;
};

interface Props {
  title: string;
  post?: PostRow;
  onSaved: () => void;
  onCancel: () => void;
}

const statusLabel: Record<string, string> = {
  rascunho: "Rascunho",
  em_revisao: "Em revisão",
  publicado: "Publicado",
  rejeitado: "Rejeitado",
};

export function PostEditor({ title, post, onSaved, onCancel }: Props) {
  const { user, hasRole, roles } = useAuth();
  const qc = useQueryClient();
  const canApprove = hasRole("desenvolvedor") || hasRole("diretor") || hasRole("coordenador");

  const [titulo, setTitulo] = useState(post?.titulo ?? "");
  const [resumo, setResumo] = useState(post?.resumo ?? "");
  const [conteudo, setConteudo] = useState(post?.conteudo ?? "");
  const [imagem, setImagem] = useState(post?.imagem ?? "");
  const [turma, setTurma] = useState<string>(post?.turma ?? "nenhuma");
  const [disciplina, setDisciplina] = useState<string>(post?.disciplina ?? "nenhuma");
  const [destaque, setDestaque] = useState(post?.destaque ?? false);
  const [geral, setGeral] = useState(post?.geral ?? false);
  const [autorModo, setAutorModo] = useState<"real" | "cargo" | "institucional">(
    (post?.autor_modo as "real" | "cargo" | "institucional" | null) ?? "real",
  );
  const [uploadingCover, setUploadingCover] = useState(false);
  const [lastAutosave, setLastAutosave] = useState<Date | null>(null);
  const [autosaving, setAutosaving] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiTema, setAiTema] = useState("");
  const [aiTom, setAiTom] = useState("");
  const [aiPreview, setAiPreview] = useState<GerarOutput | null>(null);
  const [drivePickerOpen, setDrivePickerOpen] = useState(false);
  const [galleryPickerOpen, setGalleryPickerOpen] = useState(false);
  const [validating, setValidating] = useState(false);
  const imagemDriveFileId = getDriveFileIdFromUrl(imagem);
  const autosaveEligible = !!post && (post.status === "rascunho" || post.status === "rejeitado");

  // Galeria do Drive (gerenciada fora do RichEditor, serializada no conteúdo)
  const [gallery, setGallery] = useState<GalleryItem[]>(() =>
    parseGalleryFromContent(post?.conteudo ?? ""),
  );
  const [galleryStatuses, setGalleryStatuses] = useState<Record<string, DriveStatus>>({});

  // Status do fileId da capa
  const [coverStatus, setCoverStatus] = useState<DriveStatus>("idle");
  const [coverRetryToken, setCoverRetryToken] = useState(0);
  const coverSrc = imagemDriveFileId
    ? `/api/public/drive-foto/${imagemDriveFileId}${coverRetryToken ? `?r=${coverRetryToken}` : ""}`
    : imagem;

  // Valida a capa quando muda o fileId (ou quando o usuário pede retry)
  useEffect(() => {
    if (!imagemDriveFileId) {
      setCoverStatus("idle");
      return;
    }
    let cancelled = false;
    setCoverStatus("validating");
    verifyDriveFiles({ data: { fileIds: [imagemDriveFileId] } })
      .then((res) => {
        if (cancelled) return;
        setCoverStatus(res.valid.includes(imagemDriveFileId) ? "ok" : "error");
      })
      .catch(() => {
        if (!cancelled) setCoverStatus("idle"); // rede: não bloqueia
      });
    return () => {
      cancelled = true;
    };
  }, [imagemDriveFileId, coverRetryToken]);

  // Sempre que a galeria muda, reescreve o bloco marcado no conteúdo
  useEffect(() => {
    setConteudo((prev) => replaceGalleryInContent(prev ?? "", gallery));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gallery]);

  const aiGenerate = useMutation({
    mutationFn: async () => {
      return gerarPostComIA({
        data: {
          tema: aiTema,
          turma: turma === "nenhuma" ? null : turma,
          disciplina: disciplina === "nenhuma" ? null : disciplina,
          tom: aiTom || null,
        },
      });
    },
    onSuccess: (out) => {
      setAiPreview(out);
      if (out.truncado) {
        toast.warning("O conteúdo pode estar incompleto", {
          description: "A resposta da IA parece truncada. Revise a prévia ou clique em Regerar.",
        });
      } else {
        toast.success("Prévia gerada — revise antes de aplicar");
      }
    },
    onError: (e: unknown) =>
      toast.error("Erro ao gerar com IA", {
        description: e instanceof Error ? e.message : undefined,
      }),
  });

  const applyPreview = () => {
    if (!aiPreview) return;
    setTitulo(aiPreview.titulo);
    setResumo(aiPreview.resumo);
    setConteudo(aiPreview.conteudo);
    setAiPreview(null);
    setAiOpen(false);
    setAiTema("");
    setAiTom("");
    toast.success("Rascunho aplicado ao editor");
  };

  // Autosave silencioso (rascunhos / rejeitados) a cada 3s de inatividade
  useEffect(() => {
    if (!autosaveEligible || !post) return;
    const t = setTimeout(async () => {
      setAutosaving(true);
      const { error } = await supabase
        .from("posts")
        .update({
          titulo: titulo.trim(),
          resumo: resumo.trim(),
          conteudo,
          imagem: imagem || null,
          turma: turma === "nenhuma" ? null : turma,
          disciplina: disciplina === "nenhuma" ? null : disciplina,
          destaque,
          geral,
        })
        .eq("id", post.id);
      setAutosaving(false);
      if (!error) {
        setLastAutosave(new Date());
      }
    }, 3000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titulo, resumo, conteudo, imagem, turma, disciplina, destaque, geral]);

  // Sincroniza dropdowns em tempo real quando o painel acadêmico muda
  useRealtimeInvalidate("post-editor-academic", [
    { table: "turmas", queryKey: ["turmas"] },
    { table: "disciplinas", queryKey: ["disciplinas"] },
  ]);

  const { data: turmas } = useQuery({
    queryKey: ["turmas"],
    queryFn: async () => (await supabase.from("turmas").select("nome").order("nome")).data ?? [],
  });
  const { data: disciplinas } = useQuery({
    queryKey: ["disciplinas"],
    queryFn: async () =>
      (await supabase.from("disciplinas").select("nome").order("nome")).data ?? [],
  });

  const save = useMutation({
    mutationFn: async (newStatus: "rascunho" | "em_revisao") => {
      const payload = {
        titulo: titulo.trim(),
        resumo: resumo.trim(),
        conteudo,
        imagem: imagem || null,
        turma: turma === "nenhuma" ? null : turma,
        disciplina: disciplina === "nenhuma" ? null : disciplina,
        destaque,
        geral,
        status: newStatus,
        autor:
          user?.user_metadata?.display_name ?? (user?.email ? user.email.split("@")[0] : "Equipe"),
        autor_id: user?.id,
      };
      if (post) {
        const { error } = await supabase.from("posts").update(payload).eq("id", post.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("posts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: (_d, status) => {
      toast.success(status === "em_revisao" ? "Enviado para aprovação!" : "Rascunho salvo!");
      qc.invalidateQueries({ queryKey: ["painel-posts"] });
      qc.invalidateQueries({ queryKey: ["aprovacao-fila"] });
      onSaved();
    },
    onError: (e: unknown) =>
      toast.error("Erro ao salvar", { description: e instanceof Error ? e.message : undefined }),
  });

  const publishDirect = useMutation({
    mutationFn: async () => {
      const payload = {
        titulo: titulo.trim(),
        resumo: resumo.trim(),
        conteudo,
        imagem: imagem || null,
        turma: turma === "nenhuma" ? null : turma,
        disciplina: disciplina === "nenhuma" ? null : disciplina,
        destaque,
        geral,
        status: "publicado" as const,
        aprovado_por: user?.id,
        aprovado_em: new Date().toISOString(),
        autor:
          user?.user_metadata?.display_name ?? (user?.email ? user.email.split("@")[0] : "Equipe"),
        autor_id: user?.id,
      };
      if (post) {
        const { error } = await supabase.from("posts").update(payload).eq("id", post.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("posts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Post publicado!");
      import("@/lib/push.functions").then(({ dispatchPush }) => dispatchPush().catch(() => {}));
      qc.invalidateQueries({ queryKey: ["painel-posts"] });
      onSaved();
    },
    onError: (e: unknown) =>
      toast.error("Erro ao publicar", { description: e instanceof Error ? e.message : undefined }),
  });

  const handleCoverUpload = async (file: File) => {
    setUploadingCover(true);
    try {
      const result = await uploadResponsiveImage(file, "covers");
      if (!result.ok) {
        toast.error(result.error.title, { description: result.error.description, duration: 10000 });
        return;
      }
      setImagem(result.url);
      toast.success("Imagem de capa enviada");
    } finally {
      setUploadingCover(false);
    }
  };

  const validate = () => {
    if (!titulo.trim()) {
      toast.error("Informe o título");
      return false;
    }
    if (!resumo.trim()) {
      toast.error("Informe o resumo");
      return false;
    }
    return true;
  };

  /** Coleta fileIds do Drive presentes na capa e no HTML do conteúdo. */
  const collectDriveFileIds = (): string[] => {
    const ids = new Set<string>();
    if (imagemDriveFileId) ids.add(imagemDriveFileId);
    const re = /\/api\/public\/(?:drive-foto|momentos-foto)\/([\w-]{10,})/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(conteudo || "")) !== null) ids.add(m[1]);
    return Array.from(ids);
  };

  /** Confirma que os arquivos do Drive ainda existem e são imagens. */
  const validateDriveAssets = async (): Promise<boolean> => {
    if (galleryHasErrors) {
      toast.error("Corrija a galeria antes de publicar", {
        description: "Há imagens do Drive com status de erro. Remova-as ou tente recarregar.",
      });
      return false;
    }
    const ids = collectDriveFileIds();
    if (ids.length === 0) return true;
    setValidating(true);
    try {
      const res = await verifyDriveFiles({ data: { fileIds: ids } });
      if (res.missing.length > 0 || res.notImage.length > 0) {
        toast.error("Algumas imagens do Drive estão inválidas", {
          description:
            res.missing.length > 0
              ? `${res.missing.length} arquivo(s) não encontrado(s) no Drive. Remova antes de publicar.`
              : `${res.notImage.length} arquivo(s) não são mais imagens válidas.`,
          duration: 10000,
        });
        return false;
      }
      return true;
    } catch (e) {
      toast.warning("Não foi possível validar imagens do Drive", {
        description: e instanceof Error ? e.message : undefined,
      });
      // Falha na verificação não bloqueia rascunho; segue mesmo assim.
      return true;
    } finally {
      setValidating(false);
    }
  };

  const handleSubmit = async (e: FormEvent, status: "rascunho" | "em_revisao") => {
    e.preventDefault();
    if (!validate()) return;
    if (status === "em_revisao" && !(await validateDriveAssets())) return;
    save.mutate(status);
  };

  const handlePublishDirect = async () => {
    if (!validate()) return;
    if (!(await validateDriveAssets())) return;
    publishDirect.mutate();
  };

  const handleGalleryPick = (picks: DrivePickerPick[]) => {
    if (picks.length === 0) return;
    setGallery((prev) => {
      const existing = new Set(prev.map((p) => p.fileId));
      const additions = picks
        .filter((p) => !existing.has(p.fileId))
        .map((p) => ({ fileId: p.fileId, name: p.name }));
      return [...prev, ...additions];
    });
    toast.success(
      `${picks.length} imagem${picks.length === 1 ? "" : "s"} adicionada${picks.length === 1 ? "" : "s"} à galeria`,
    );
  };

  const galleryHasErrors = Object.values(galleryStatuses).some((s) => s === "error");

  return (
    <div className="min-h-dvh bg-secondary">
      <header className="border-b border-border/60 bg-background/85 backdrop-blur-lg">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <p className="font-display text-lg font-semibold text-primary">{title}</p>
            {post && (
              <Badge variant="secondary" className="mt-1">
                Status: {statusLabel[post.status]}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              className="rounded-full"
              onClick={() => setAiOpen(true)}
            >
              <Sparkles className="size-4" />
              <span className="hidden sm:inline">Gerar com IA</span>
              <span className="sm:hidden">IA</span>
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/painel-posts">
                <ArrowLeft className="size-4" /> Voltar
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {post?.status === "rejeitado" && post.motivo_rejeicao && (
          <div className="mb-4 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
            <p className="font-semibold text-destructive">Post rejeitado</p>
            <p className="mt-1 text-foreground">Motivo: {post.motivo_rejeicao}</p>
          </div>
        )}

        <form className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <div>
              <Label htmlFor="titulo">Título</Label>
              <Input
                id="titulo"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Título da publicação"
                maxLength={200}
              />
            </div>
            <div>
              <Label htmlFor="resumo">Resumo</Label>
              <Textarea
                id="resumo"
                value={resumo}
                onChange={(e) => setResumo(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Texto curto que aparece no card do blog"
              />
            </div>
            <div>
              <Label>Conteúdo</Label>
              <Suspense
                fallback={
                  <div className="flex h-64 items-center justify-center rounded-md border border-border/60 bg-muted/20">
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  </div>
                }
              >
                <RichEditor value={conteudo} onChange={setConteudo} />
              </Suspense>
              <p className="mt-1 text-xs text-muted-foreground">
                Use a barra de ferramentas para formatar, inserir imagens, vídeos do YouTube/Vimeo e
                links.
              </p>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-border/70 bg-card p-4">
              <Label>Imagem de capa</Label>
              {imagem ? (
                <div className="relative mt-2 aspect-video overflow-hidden rounded-xl">
                  {isDriveProxyUrl(imagem) ? (
                    <DriveImage
                      key={`cover-${imagemDriveFileId}-${coverRetryToken}`}
                      src={coverSrc}
                      alt="Capa"
                      showBadge
                      status={coverStatus}
                      loading="eager"
                    />
                  ) : (
                    <img
                      src={imagem}
                      alt="Capa"
                      className="size-full object-cover"
                      loading="eager"
                      decoding="async"
                    />
                  )}
                  <div className="absolute right-2 top-2 flex gap-1">
                    {imagemDriveFileId && coverStatus === "error" && (
                      <Button
                        type="button"
                        size="icon"
                        variant="secondary"
                        onClick={() => setCoverRetryToken((t) => t + 1)}
                        aria-label="Tentar novamente"
                        title="Tentar carregar novamente"
                      >
                        <RefreshCw className="size-4" />
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="icon"
                      variant="destructive"
                      onClick={() => setImagem("")}
                      aria-label="Remover capa"
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <label className="mt-2 flex aspect-video cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-muted-foreground hover:bg-secondary">
                  {uploadingCover ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <ImageIcon className="size-6" />
                  )}
                  <span className="text-xs">Clique para enviar</span>
                  <span className="text-[10px] text-muted-foreground">
                    PNG, JPG ou WebP — até {MAX_IMAGE_SIZE_MB} MB
                  </span>
                  <input
                    type="file"
                    accept={ALLOWED_IMAGE_TYPES.join(",")}
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleCoverUpload(f);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 w-full"
                onClick={() => setDrivePickerOpen(true)}
              >
                <FolderOpen className="size-4" />
                Escolher do Google Drive
              </Button>
              <Input
                className="mt-2"
                placeholder="ou cole uma URL"
                value={imagem}
                onChange={(e) => setImagem(e.target.value)}
              />
              {/* Campo oculto com o fileId para revalidação e debug via dev-tools */}
              <input
                type="hidden"
                name="imagem_drive_file_id"
                data-testid="imagem-drive-file-id"
                value={imagemDriveFileId ?? ""}
                readOnly
              />
              {imagemDriveFileId && (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Servido do Drive ·{" "}
                  <code className="font-mono">{imagemDriveFileId.slice(0, 12)}…</code>
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-border/70 bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <Label>Galeria (Drive)</Label>
                {gallery.length > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    {gallery.length} item{gallery.length === 1 ? "" : "s"} · arraste para reordenar
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Adicione várias fotos do Drive. Elas são servidas via proxy com lazy loading.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 w-full"
                onClick={() => setGalleryPickerOpen(true)}
              >
                <FolderOpen className="size-4" />
                Adicionar fotos do Drive
              </Button>
              <div className="mt-3">
                <DriveGalleryManager
                  items={gallery}
                  onChange={setGallery}
                  onStatusesChange={setGalleryStatuses}
                />
              </div>
              {galleryHasErrors && (
                <p className="mt-2 text-[11px] font-medium text-destructive">
                  Existem imagens indisponíveis na galeria. Remova-as ou tente recarregar antes de
                  publicar.
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-border/70 bg-card p-4 space-y-3">
              <div>
                <Label>Turma</Label>
                <Select value={turma} onValueChange={setTurma}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhuma">Nenhuma</SelectItem>
                    {(turmas ?? []).map((t) => (
                      <SelectItem key={t.nome} value={t.nome}>
                        {t.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Disciplina</Label>
                <Select value={disciplina} onValueChange={setDisciplina}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhuma">Nenhuma</SelectItem>
                    {(disciplinas ?? []).map((d) => (
                      <SelectItem key={d.nome} value={d.nome}>
                        {d.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="destaque" className="cursor-pointer">
                  Em destaque
                </Label>
                <Switch id="destaque" checked={destaque} onCheckedChange={setDestaque} />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="geral" className="cursor-pointer">
                  Comunicado geral
                </Label>
                <Switch id="geral" checked={geral} onCheckedChange={setGeral} />
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-card p-4 space-y-2">
              {canApprove && (
                <p className="text-xs text-muted-foreground">
                  Seu cargo permite publicar diretamente, sem precisar de aprovação.
                </p>
              )}
              {autosaveEligible && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {autosaving ? (
                    <>
                      <Loader2 className="size-3 animate-spin" /> Salvando…
                    </>
                  ) : lastAutosave ? (
                    <>
                      <Check className="size-3 text-accent" /> Salvo automaticamente às{" "}
                      {lastAutosave.toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </>
                  ) : (
                    <>Rascunho com salvamento automático ativado</>
                  )}
                </p>
              )}
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-full"
                onClick={(e) => handleSubmit(e, "rascunho")}
                disabled={save.isPending}
              >
                {save.isPending && <Loader2 className="size-4 animate-spin" />}
                <Save className="size-4" /> Salvar rascunho
              </Button>
              {canApprove ? (
                <Button
                  type="button"
                  className="w-full rounded-full"
                  onClick={handlePublishDirect}
                  disabled={publishDirect.isPending || validating}
                >
                  {(publishDirect.isPending || validating) && (
                    <Loader2 className="size-4 animate-spin" />
                  )}
                  <Send className="size-4" /> {validating ? "Validando…" : "Publicar agora"}
                </Button>
              ) : (
                <Button
                  type="button"
                  className="w-full rounded-full"
                  onClick={(e) => handleSubmit(e, "em_revisao")}
                  disabled={save.isPending || validating}
                >
                  {validating && <Loader2 className="size-4 animate-spin" />}
                  <Send className="size-4" /> {validating ? "Validando…" : "Enviar para aprovação"}
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                className="w-full rounded-full"
                onClick={onCancel}
              >
                Cancelar
              </Button>
            </div>

            {post && <PostVersionHistory postId={post.id} />}
          </aside>
        </form>
      </main>

      <Dialog
        open={aiOpen}
        onOpenChange={(o) => {
          if (aiGenerate.isPending) return;
          setAiOpen(o);
          if (!o) setAiPreview(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" /> Gerar post com IA
            </DialogTitle>
            <DialogDescription>
              {aiPreview
                ? "Revise a prévia abaixo. Você pode aplicar ao editor, regerar mantendo o mesmo relato, ou cancelar."
                : "Escreva livremente o que aconteceu. A IA (Gemini) vai transformar seu relato em um rascunho com título, resumo e conteúdo."}
            </DialogDescription>
          </DialogHeader>

          {!aiPreview ? (
            <div className="space-y-3 py-2">
              <div>
                <Label htmlFor="ai-tema">Conte o que aconteceu</Label>
                <Textarea
                  id="ai-tema"
                  value={aiTema}
                  onChange={(e) => setAiTema(e.target.value)}
                  rows={8}
                  maxLength={4000}
                  placeholder="Ex: Hoje realizamos a feira de ciências com os 9º anos. Os alunos apresentaram projetos sobre energia solar e reciclagem…"
                  disabled={aiGenerate.isPending}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {aiTema.length}/4000 · quanto mais detalhes (datas, turmas, resultados), melhor o
                  rascunho.
                </p>
              </div>
              <div>
                <Label htmlFor="ai-tom">Tom (opcional)</Label>
                <Input
                  id="ai-tom"
                  value={aiTom}
                  onChange={(e) => setAiTom(e.target.value)}
                  placeholder="Ex: formal, comemorativo, informativo"
                  disabled={aiGenerate.isPending}
                />
              </div>
              {(turma !== "nenhuma" || disciplina !== "nenhuma") && (
                <p className="text-xs text-muted-foreground">
                  A IA vai considerar
                  {turma !== "nenhuma" && (
                    <>
                      {" "}
                      a turma <strong>{turma}</strong>
                    </>
                  )}
                  {turma !== "nenhuma" && disciplina !== "nenhuma" && " e"}
                  {disciplina !== "nenhuma" && (
                    <>
                      {" "}
                      a disciplina <strong>{disciplina}</strong>
                    </>
                  )}
                  .
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4 py-2">
              {aiPreview.truncado && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                  ⚠️ O conteúdo pode estar incompleto ou truncado. Considere regerar antes de
                  aplicar.
                </div>
              )}
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Título</p>
                <p className="mt-1 font-display text-lg font-semibold">{aiPreview.titulo}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Resumo</p>
                <p className="mt-1 text-sm">{aiPreview.resumo}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  Conteúdo ({aiPreview.conteudo.length} caracteres)
                </p>
                <div
                  className="prose prose-sm mt-1 max-h-72 max-w-none overflow-y-auto rounded-lg border border-border bg-muted/30 p-3 dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(aiPreview.conteudo) }}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setAiOpen(false);
                setAiPreview(null);
              }}
              disabled={aiGenerate.isPending}
            >
              Cancelar
            </Button>
            {aiPreview ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setAiPreview(null);
                    aiGenerate.mutate();
                  }}
                  disabled={aiGenerate.isPending}
                >
                  {aiGenerate.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  Regerar rascunho
                </Button>
                <Button type="button" onClick={applyPreview} disabled={aiGenerate.isPending}>
                  <Check className="size-4" /> Aplicar ao editor
                </Button>
              </>
            ) : (
              <Button
                type="button"
                onClick={() => aiGenerate.mutate()}
                disabled={aiGenerate.isPending || aiTema.trim().length < 10}
              >
                {aiGenerate.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                Gerar rascunho
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DrivePicker
        open={drivePickerOpen}
        onOpenChange={setDrivePickerOpen}
        onPick={(proxyUrl, meta) => {
          setImagem(proxyUrl);
          toast.success("Imagem escolhida do Drive", { description: meta.name });
        }}
      />

      <DrivePicker
        open={galleryPickerOpen}
        onOpenChange={setGalleryPickerOpen}
        multiple
        onPickMultiple={handleGalleryPick}
      />
    </div>
  );
}

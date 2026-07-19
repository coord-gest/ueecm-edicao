import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, type FormEvent, type ChangeEvent } from "react";
import {
  Plus,
  Trash2,
  Pencil,
  Loader2,
  Images,
  Upload,
  Eye,
  EyeOff,
  Star,
  ExternalLink,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  listAlbunsAdmin,
  upsertAlbum,
  deleteAlbum,
  registrarFotos,
  deleteFoto,
  definirCapa,
  getAlbumPublico,
  type GaleriaAlbum,
} from "@/lib/galeria.functions";
import { compressImage } from "@/lib/image-compress";
import { PainelLayout } from "@/components/PainelLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/painel-galeria")({
  ssr: false,
  head: () => ({ meta: [{ title: "Galeria de Eventos | Painel" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: PainelGaleria,
});

type FormState = {
  id?: string;
  titulo: string;
  descricao: string;
  data_evento: string;
  publicado: boolean;
};

const emptyForm: FormState = {
  titulo: "",
  descricao: "",
  data_evento: "",
  publicado: true,
};

function PainelGaleria() {
  const qc = useQueryClient();
  const [openForm, setOpenForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [managingId, setManagingId] = useState<string | null>(null);

  const { data: albuns = [], isLoading } = useQuery({
    queryKey: ["galeria-albuns-admin"],
    queryFn: () => listAlbunsAdmin(),
  });

  const salvar = useMutation({
    mutationFn: () =>
      upsertAlbum({
        data: {
          id: form.id,
          titulo: form.titulo,
          descricao: form.descricao || null,
          data_evento: form.data_evento || null,
          publicado: form.publicado,
        },
      }),
    onSuccess: () => {
      toast.success(form.id ? "Álbum atualizado" : "Álbum criado");
      qc.invalidateQueries({ queryKey: ["galeria-albuns-admin"] });
      setOpenForm(false);
      setForm(emptyForm);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: (id: string) => deleteAlbum({ data: { id } }),
    onSuccess: () => {
      toast.success("Álbum removido");
      qc.invalidateQueries({ queryKey: ["galeria-albuns-admin"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (form.titulo.trim().length < 2) return toast.error("Título é obrigatório");
    salvar.mutate();
  };

  return (
    <PainelLayout>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Images className="h-7 w-7" /> Galeria de Eventos
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Álbuns com upload em massa e compressão automática
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/galeria">
                <ExternalLink className="h-4 w-4 mr-2" /> Ver pública
              </Link>
            </Button>
            <Button
              onClick={() => {
                setForm(emptyForm);
                setOpenForm(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" /> Novo álbum
            </Button>
          </div>
        </header>

        {isLoading ? (
          <div className="text-center py-16">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
          </div>
        ) : albuns.length === 0 ? (
          <div className="text-center py-16 border rounded-xl bg-muted/30">
            <Images className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Nenhum álbum criado ainda.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {albuns.map((a) => (
              <article
                key={a.id}
                className="group relative overflow-hidden rounded-xl border bg-card"
              >
                <div className="aspect-[4/3] overflow-hidden bg-muted">
                  {a.capa_url ? (
                    <img
                      src={a.capa_url}
                      alt={a.titulo}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="h-full w-full grid place-items-center text-muted-foreground">
                      <Images className="h-10 w-10" />
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold truncate flex-1">{a.titulo}</h3>
                    {a.publicado ? (
                      <Badge variant="default" className="gap-1">
                        <Eye className="h-3 w-3" /> público
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1">
                        <EyeOff className="h-3 w-3" /> oculto
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {a.total_fotos} foto{a.total_fotos === 1 ? "" : "s"}
                    {a.data_evento && ` · ${new Date(a.data_evento).toLocaleDateString("pt-BR")}`}
                  </p>
                  <div className="flex gap-1 mt-3">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="flex-1"
                      onClick={() => setManagingId(a.id)}
                    >
                      <Upload className="h-3 w-3 mr-1" /> Fotos
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Editar álbum "${a.titulo}"`}
                      onClick={() => {
                        setForm({
                          id: a.id,
                          titulo: a.titulo,
                          descricao: a.descricao ?? "",
                          data_evento: a.data_evento ?? "",
                          publicado: a.publicado,
                        });
                        setOpenForm(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Excluir álbum "${a.titulo}"`}
                      onClick={() => {
                        if (confirm(`Excluir "${a.titulo}" e todas as fotos?`))
                          excluir.mutate(a.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar álbum" : "Novo álbum"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input
                value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                required
                maxLength={240}
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                rows={3}
                maxLength={4000}
              />
            </div>
            <div>
              <Label>Data do evento</Label>
              <Input
                type="date"
                value={form.data_evento}
                onChange={(e) => setForm({ ...form, data_evento: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
              <Label htmlFor="pub">Publicar (visível ao público)</Label>
              <Switch
                id="pub"
                checked={form.publicado}
                onCheckedChange={(v) => setForm({ ...form, publicado: v })}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpenForm(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={salvar.isPending}>
                {salvar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {form.id ? "Salvar" : "Criar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {managingId && (
        <FotosDialog
          albumId={managingId}
          onClose={() => {
            setManagingId(null);
            qc.invalidateQueries({ queryKey: ["galeria-albuns-admin"] });
          }}
        />
      )}
    </PainelLayout>
  );
}

// -------- Diálogo de gerenciar fotos --------
function FotosDialog({ albumId, onClose }: { albumId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["galeria-fotos-admin", albumId],
    queryFn: () => getAlbumPublico({ data: { id: albumId } }),
  });

  const excluirFoto = useMutation({
    mutationFn: (id: string) => deleteFoto({ data: { id } }),
    onSuccess: () => {
      toast.success("Foto removida");
      refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const capa = useMutation({
    mutationFn: (url: string) => definirCapa({ data: { album_id: albumId, url } }),
    onSuccess: () => {
      toast.success("Capa definida");
      qc.invalidateQueries({ queryKey: ["galeria-albuns-admin"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function onSelectFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    if (files.length > 100) {
      toast.error("Máximo 100 fotos por vez");
      return;
    }
    setUploading(true);
    setProgress(0);
    const uploadedRows: Array<{
      url: string;
      storage_path: string;
      largura: number;
      altura: number;
      tamanho_bytes: number;
    }> = [];
    let done = 0;
    let failed = 0;

    for (const file of files) {
      try {
        setStatusText(`Comprimindo ${file.name}...`);
        const compressed = await compressImage(file);
        const ext = compressed.file.type === "image/png" ? "png" : "jpg";
        const path = `${albumId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        setStatusText(`Enviando ${file.name}...`);
        const { error: upErr } = await supabase.storage
          .from("galeria-eventos")
          .upload(path, compressed.file, {
            cacheControl: "31536000",
            upsert: false,
            contentType: compressed.file.type,
          });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("galeria-eventos").getPublicUrl(path);
        uploadedRows.push({
          url: pub.publicUrl,
          storage_path: path,
          largura: compressed.width,
          altura: compressed.height,
          tamanho_bytes: compressed.size,
        });
      } catch (err) {
        console.error("upload falhou", file.name, err);
        failed++;
      } finally {
        done++;
        setProgress(Math.round((done / files.length) * 100));
      }
    }

    if (uploadedRows.length > 0) {
      try {
        await registrarFotos({ data: { galeria_id: albumId, fotos: uploadedRows } });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Falha ao registrar fotos");
      }
    }
    setUploading(false);
    setStatusText("");
    if (fileRef.current) fileRef.current.value = "";
    toast.success(
      `${uploadedRows.length} foto(s) enviadas${failed > 0 ? ` · ${failed} falha(s)` : ""}`,
    );
    refetch();
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Fotos do álbum</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border border-dashed p-4 bg-muted/20">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={onSelectFiles}
              disabled={uploading}
            />
            <Button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-full"
              size="lg"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando... ({progress}%)
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Selecionar fotos (até 100 por vez)
                </>
              )}
            </Button>
            {uploading && (
              <div className="mt-3 space-y-2">
                <Progress value={progress} />
                <p className="text-xs text-muted-foreground text-center">{statusText}</p>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Compressão automática · máx 1600px · ~1MB por foto
            </p>
          </div>

          {isLoading ? (
            <div className="text-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
            </div>
          ) : !data?.fotos.length ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              Nenhuma foto ainda. Faça upload acima.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {data.fotos.map((f) => (
                <div
                  key={f.id}
                  className="group relative aspect-square overflow-hidden rounded-lg border bg-muted"
                >
                  <img
                    src={f.url}
                    alt={f.legenda ?? ""}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1">
                    <Button
                      size="icon"
                      variant="secondary"
                      title="Definir como capa"
                      onClick={() => capa.mutate(f.url)}
                    >
                      <Star className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="destructive"
                      title="Remover"
                      onClick={() => {
                        if (confirm("Remover esta foto?")) excluirFoto.mutate(f.id);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

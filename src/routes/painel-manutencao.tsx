import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  Download,
  Trash2,
  RefreshCw,
  DatabaseBackup,
  HardDrive,
  ImageDown,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { PainelLayout } from "@/components/PainelLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  runBackupNow,
  listBackups,
  getBackupDownloadUrl,
  deleteBackup,
  getResourceStats,
  listLargeImages,
  replaceImageWithCompressed,
  type BackupFile,
  type ResourceStats,
  type LargeImage,
} from "@/lib/manutencao.functions";

export const Route = createFileRoute("/painel-manutencao")({
  ssr: false,
  head: () => ({ meta: [{ title: "Manutenção | Painel" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: PainelManutencao,
});

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function PainelManutencao() {
  return (
    <PainelLayout>
      <div className="mx-auto w-full max-w-6xl space-y-4 p-4 sm:p-6">
        <header>
          <h1 className="text-2xl font-semibold">Manutenção</h1>
          <p className="text-sm text-muted-foreground">
            Backup, monitoramento de recursos e otimização de imagens.
          </p>
        </header>
        <Tabs defaultValue="backup" className="w-full">
          <TabsList className="grid w-full max-w-lg grid-cols-3">
            <TabsTrigger value="backup" className="gap-1.5">
              <DatabaseBackup className="h-4 w-4" /> Backup
            </TabsTrigger>
            <TabsTrigger value="recursos" className="gap-1.5">
              <HardDrive className="h-4 w-4" /> Recursos
            </TabsTrigger>
            <TabsTrigger value="imagens" className="gap-1.5">
              <ImageDown className="h-4 w-4" /> Imagens
            </TabsTrigger>
          </TabsList>

          <TabsContent value="backup" className="mt-4">
            <BackupTab />
          </TabsContent>
          <TabsContent value="recursos" className="mt-4">
            <RecursosTab />
          </TabsContent>
          <TabsContent value="imagens" className="mt-4">
            <ImagensTab />
          </TabsContent>
        </Tabs>
      </div>
    </PainelLayout>
  );
}

/* ==================== BACKUP ==================== */

function BackupTab() {
  const qc = useQueryClient();
  const run = useServerFn(runBackupNow);
  const list = useServerFn(listBackups);
  const getUrl = useServerFn(getBackupDownloadUrl);
  const del = useServerFn(deleteBackup);
  const [running, setRunning] = useState(false);

  const q = useQuery({
    queryKey: ["backups"],
    queryFn: () => list(),
  });

  const files = (q.data ?? []) as BackupFile[];

  async function handleRun() {
    setRunning(true);
    try {
      const res = await run();
      toast.success(
        `Backup criado: ${res.rows.toLocaleString("pt-BR")} linhas / ${formatBytes(res.bytes)}`,
      );
      qc.invalidateQueries({ queryKey: ["backups"] });
    } catch (e) {
      toast.error(`Falha ao gerar backup: ${(e as Error).message}`);
    } finally {
      setRunning(false);
    }
  }

  async function handleDownload(path: string) {
    try {
      const { url } = await getUrl({ data: { path } });
      window.open(url, "_blank");
    } catch (e) {
      toast.error(`Falha: ${(e as Error).message}`);
    }
  }

  async function handleDelete(path: string) {
    try {
      await del({ data: { path } });
      toast.success("Backup removido");
      qc.invalidateQueries({ queryKey: ["backups"] });
    } catch (e) {
      toast.error(`Falha: ${(e as Error).message}`);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Backup do sistema</CardTitle>
            <CardDescription>
              Snapshot JSON das tabelas críticas (alunos, notas, comunicados, patrocinadores,
              autorizações etc). Backups automáticos rodam semanalmente em segundo plano; os últimos
              12 automáticos são preservados.
            </CardDescription>
          </div>
          <Button onClick={handleRun} disabled={running}>
            {running ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <DatabaseBackup className="mr-2 h-4 w-4" />
            )}
            Fazer backup agora
          </Button>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Arquivos disponíveis</CardTitle>
          <CardDescription>
            Clique em Baixar para obter o JSON assinado (válido por 5 min).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {q.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : files.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum backup ainda. Clique em "Fazer backup agora".
            </p>
          ) : (
            <div className="divide-y">
              {files.map((f) => (
                <div key={f.path} className="flex items-center justify-between py-2 gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={f.kind === "manual" ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {f.kind}
                      </Badge>
                      <span className="truncate text-sm font-medium">{f.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(f.size)} ·{" "}
                      {f.created_at ? new Date(f.created_at).toLocaleString("pt-BR") : "—"}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => handleDownload(f.path)}>
                      <Download className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover este backup?</AlertDialogTitle>
                          <AlertDialogDescription>
                            {f.name} — {formatBytes(f.size)}. Ação irreversível.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(f.path)}>
                            Remover
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ==================== RECURSOS ==================== */

const FREE_STORAGE_LIMIT = 1024 * 1024 * 1024; // 1 GB

function RecursosTab() {
  const stats = useServerFn(getResourceStats);
  const q = useQuery({
    queryKey: ["resource-stats"],
    queryFn: () => stats() as Promise<ResourceStats>,
  });

  if (q.isLoading) return <Skeleton className="h-64 w-full" />;
  if (!q.data) return <p className="text-sm text-muted-foreground">Sem dados.</p>;

  const usedPct = Math.min(100, (q.data.totalBytes / FREE_STORAGE_LIMIT) * 100);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Storage total</CardTitle>
            <CardDescription>
              {formatBytes(q.data.totalBytes)} de 1 GB (plano Free do Supabase)
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => q.refetch()}>
            <RefreshCw className="mr-1.5 h-4 w-4" /> Atualizar
          </Button>
        </CardHeader>
        <CardContent>
          <Progress value={usedPct} className="h-3" />
          <p className="mt-2 text-xs text-muted-foreground">
            {usedPct.toFixed(1)}% utilizado ·{" "}
            {usedPct > 85 ? (
              <span className="text-destructive font-medium">
                Atenção — considere limpar imagens antigas.
              </span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">Saudável</span>
            )}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Storage por bucket</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {q.data.buckets.map((b) => (
              <div key={b.name} className="flex justify-between text-sm">
                <span className="font-medium">{b.name}</span>
                <span className="text-muted-foreground">
                  {b.files} arq · {formatBytes(b.bytes)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Tabelas ({q.data.totalRows.toLocaleString("pt-BR")} linhas)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {q.data.tables.map((t) => (
              <div key={t.name} className="flex justify-between text-sm">
                <span className="font-medium">{t.name}</span>
                <span className="text-muted-foreground">{t.rows.toLocaleString("pt-BR")}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ==================== OTIMIZAÇÃO DE IMAGENS ==================== */

/** Comprime uma imagem no navegador via canvas. Devolve base64 + tipo. */
async function compressImageInBrowser(
  url: string,
  maxWidth = 1200,
  quality = 0.8,
): Promise<{ base64: string; contentType: string; bytes: number }> {
  const resp = await fetch(url, { cache: "no-store" });
  const blob = await resp.blob();
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, maxWidth / bitmap.width);
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível");
  ctx.drawImage(bitmap, 0, 0, w, h);
  const outBlob: Blob = await new Promise((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("toBlob falhou"))), "image/webp", quality),
  );
  const buf = new Uint8Array(await outBlob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.byteLength; i++) bin += String.fromCharCode(buf[i]);
  return { base64: btoa(bin), contentType: "image/webp", bytes: buf.byteLength };
}

function ImagensTab() {
  const qc = useQueryClient();
  const list = useServerFn(listLargeImages);
  const replace = useServerFn(replaceImageWithCompressed);
  const [minKB, setMinKB] = useState(200);
  const [processing, setProcessing] = useState<string | null>(null);
  const [batching, setBatching] = useState(false);

  const q = useQuery({
    queryKey: ["large-images", minKB],
    queryFn: () => list({ data: { minKB } }) as Promise<LargeImage[]>,
  });

  const items = (q.data ?? []) as LargeImage[];

  async function compressOne(img: LargeImage) {
    setProcessing(img.path);
    try {
      const out = await compressImageInBrowser(img.publicUrl);
      if (out.bytes >= img.size) {
        toast.info(`${img.path}: já está otimizado`);
      } else {
        await replace({
          data: {
            bucket: img.bucket,
            path: img.path,
            base64: out.base64,
            contentType: out.contentType,
          },
        });
        toast.success(
          `${img.path}: ${formatBytes(img.size)} → ${formatBytes(out.bytes)} (-${Math.round(
            (1 - out.bytes / img.size) * 100,
          )}%)`,
        );
      }
    } catch (e) {
      toast.error(`${img.path}: ${(e as Error).message}`);
    } finally {
      setProcessing(null);
    }
  }

  async function compressAll() {
    setBatching(true);
    for (const img of items) {
      if (processing) break;
      await compressOne(img);
    }
    setBatching(false);
    qc.invalidateQueries({ queryKey: ["large-images"] });
    qc.invalidateQueries({ queryKey: ["resource-stats"] });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Otimização retroativa de imagens</CardTitle>
          <CardDescription>
            Imagens {">"} {minKB} KB armazenadas nos buckets públicos. A compressão roda no seu
            navegador (WebP, 1200px máx, qualidade 80%) e substitui o arquivo original.
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <select
            className="rounded border bg-background px-2 text-sm"
            value={minKB}
            onChange={(e) => setMinKB(Number(e.target.value))}
          >
            <option value={100}>&gt; 100 KB</option>
            <option value={200}>&gt; 200 KB</option>
            <option value={500}>&gt; 500 KB</option>
            <option value={1000}>&gt; 1 MB</option>
          </select>
          <Button onClick={compressAll} disabled={batching || items.length === 0}>
            {batching ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ImageDown className="mr-2 h-4 w-4" />
            )}
            Comprimir todas ({items.length})
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {q.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma imagem grande encontrada. Tudo otimizado! 🎉
          </p>
        ) : (
          <div className="space-y-2">
            {items.map((img) => (
              <div
                key={`${img.bucket}/${img.path}`}
                className="flex items-center gap-3 rounded border p-2"
              >
                <img
                  src={img.publicUrl}
                  alt=""
                  className="h-12 w-12 rounded object-cover"
                  loading="lazy"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{img.path}</p>
                  <p className="text-xs text-muted-foreground">
                    {img.bucket} · {formatBytes(img.size)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={processing === img.path || batching}
                  onClick={() => compressOne(img)}
                >
                  {processing === img.path ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Comprimir"
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import {
  FolderPlus,
  Upload,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Loader2,
  Folder as FolderIcon,
  FileIcon,
  Trash2,
  Cloud,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { PainelLayout } from "@/components/PainelLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  getDriveStatus,
  listDriveFiles,
  createDriveFolder,
  uploadFileToDrive,
  deleteDriveFile,
  ensureUEECMFolders,
} from "@/lib/google-drive.functions";
import {
  getMigrationOverview,
  migrateStorageBatch,
  migrateMomentosBatch,
} from "@/lib/drive-migration.functions";
import { runDriveDiagnostics, type DiagnosticStep } from "@/lib/drive-diagnostics.functions";

export const Route = createFileRoute("/painel-google-drive")({
  ssr: false,
  head: () => ({ meta: [{ title: "Google Drive | Painel" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: PainelGoogleDrive,
});

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
  thumbnailLink?: string;
  parents?: string[];
};

function formatBytes(n: number) {
  if (!Number.isFinite(n)) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function PainelGoogleDrive() {
  const qc = useQueryClient();
  const fetchStatus = useServerFn(getDriveStatus);
  const fetchList = useServerFn(listDriveFiles);
  const runEnsure = useServerFn(ensureUEECMFolders);
  const runCreate = useServerFn(createDriveFolder);
  const runUpload = useServerFn(uploadFileToDrive);
  const runDelete = useServerFn(deleteDriveFile);

  const [folderStack, setFolderStack] = useState<Array<{ id?: string; name: string }>>([
    { name: "Meu Drive" },
  ]);
  const [newFolder, setNewFolder] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const current = folderStack[folderStack.length - 1]!;

  const statusQuery = useQuery({
    queryKey: ["drive-status"],
    queryFn: () => fetchStatus(),
    staleTime: 60_000,
  });

  const listQuery = useQuery({
    queryKey: ["drive-list", current.id ?? "root"],
    queryFn: () => fetchList({ data: { folderId: current.id, pageSize: 100 } }),
    enabled: statusQuery.data?.connected === true,
  });

  const files = ((listQuery.data?.files as DriveFile[]) ?? []).filter(Boolean);

  async function handleEnsure() {
    try {
      await runEnsure();
      toast.success("Pastas UEECM/Backups e UEECM/Momentos prontas.");
      qc.invalidateQueries({ queryKey: ["drive-list"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function handleCreateFolder() {
    const name = newFolder.trim();
    if (!name) return;
    try {
      await runCreate({ data: { name, parentId: current.id } });
      setNewFolder("");
      toast.success("Pasta criada.");
      qc.invalidateQueries({ queryKey: ["drive-list", current.id ?? "root"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function handleUpload(list: FileList | null) {
    if (!list || list.length === 0) return;
    setUploading(true);
    setUploadPct(0);
    let ok = 0;
    try {
      for (let i = 0; i < list.length; i++) {
        const f = list.item(i)!;
        if (f.size > 15 * 1024 * 1024) {
          toast.error(`${f.name}: acima de 15 MB. Faça upload direto no Drive.`);
          continue;
        }
        const contentBase64 = await fileToBase64(f);
        await runUpload({
          data: {
            name: f.name,
            mimeType: f.type || "application/octet-stream",
            parentId: current.id,
            contentBase64,
          },
        });
        ok++;
        setUploadPct(Math.round(((i + 1) / list.length) * 100));
      }
      toast.success(`${ok} arquivo(s) enviado(s).`);
      qc.invalidateQueries({ queryKey: ["drive-list", current.id ?? "root"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function handleDelete(f: DriveFile) {
    if (!confirm(`Mover "${f.name}" para a lixeira do Drive?`)) return;
    try {
      await runDelete({ data: { fileId: f.id } });
      qc.invalidateQueries({ queryKey: ["drive-list", current.id ?? "root"] });
      toast.success("Movido para a lixeira.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function openFolder(f: DriveFile) {
    setFolderStack((s) => [...s, { id: f.id, name: f.name }]);
  }
  function goTo(index: number) {
    setFolderStack((s) => s.slice(0, index + 1));
  }

  const status = statusQuery.data;
  const usage = status?.connected ? Number(status.storageQuota?.usage ?? 0) : 0;
  const limit = status?.connected ? Number(status.storageQuota?.limit ?? 0) : 0;
  const pct = limit > 0 ? Math.min(100, (usage / limit) * 100) : 0;

  return (
    <PainelLayout>
      <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
        <header className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Cloud className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Google Drive</h1>
            <p className="text-sm text-muted-foreground">
              Backup dos documentos e biblioteca de Momentos na conta institucional.
            </p>
          </div>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Conexão
              {statusQuery.isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : status?.connected ? (
                <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600">
                  <CheckCircle2 className="h-3 w-3" /> Conectado
                </Badge>
              ) : (
                <Badge variant="destructive" className="gap-1">
                  <XCircle className="h-3 w-3" /> Desconectado
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Conta autorizada pelo administrador em Integrações do projeto.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {statusQuery.isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : status?.connected ? (
              <>
                <div className="flex items-center gap-3">
                  {status.user?.photoLink ? (
                    <img
                      src={status.user.photoLink}
                      alt=""
                      className="h-10 w-10 rounded-full"
                      referrerPolicy="no-referrer"
                    />
                  ) : null}
                  <div>
                    <div className="font-medium">{status.user?.displayName ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      {status.user?.emailAddress ?? "—"}
                    </div>
                  </div>
                </div>
                {limit > 0 && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{formatBytes(usage)} usados</span>
                      <span>de {formatBytes(limit)}</span>
                    </div>
                    <Progress value={pct} />
                  </div>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={handleEnsure}>
                    <FolderPlus className="mr-1.5 h-4 w-4" />
                    Criar pastas UEECM/Backups e UEECM/Momentos
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      qc.invalidateQueries({ queryKey: ["drive-status"] });
                      qc.invalidateQueries({ queryKey: ["drive-list"] });
                    }}
                  >
                    <RefreshCw className="mr-1.5 h-4 w-4" /> Atualizar
                  </Button>
                </div>
              </>
            ) : (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
                Google Drive não está conectado a este projeto. Peça a um administrador para
                conectar em <strong>Project Settings → Integrations</strong>.
                {status?.error && (
                  <div className="mt-2 text-xs text-muted-foreground">{status.error}</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {status?.connected && (
          <Card>
            <CardHeader>
              <CardTitle>Navegar</CardTitle>
              <CardDescription className="flex flex-wrap items-center gap-1 text-xs">
                {folderStack.map((f, i) => (
                  <span key={i} className="flex items-center gap-1">
                    <button type="button" className="hover:underline" onClick={() => goTo(i)}>
                      {f.name}
                    </button>
                    {i < folderStack.length - 1 && <span>/</span>}
                  </span>
                ))}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  placeholder="Nome da nova pasta"
                  value={newFolder}
                  onChange={(e) => setNewFolder(e.target.value)}
                  className="max-w-xs"
                />
                <Button size="sm" variant="outline" onClick={handleCreateFolder}>
                  <FolderPlus className="mr-1.5 h-4 w-4" /> Criar pasta
                </Button>
                <input
                  ref={fileInput}
                  type="file"
                  multiple
                  hidden
                  onChange={(e) => handleUpload(e.target.files)}
                />
                <Button size="sm" onClick={() => fileInput.current?.click()} disabled={uploading}>
                  {uploading ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-1.5 h-4 w-4" />
                  )}
                  Enviar arquivos
                </Button>
                {uploading && (
                  <div className="ml-2 flex w-40 flex-col gap-1">
                    <Progress value={uploadPct} />
                    <span className="text-xs text-muted-foreground">{uploadPct}%</span>
                  </div>
                )}
              </div>

              {listQuery.isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : files.length === 0 ? (
                <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
                  Pasta vazia.
                </div>
              ) : (
                <ul className="divide-y rounded-md border">
                  {files.map((f) => {
                    const isFolder = f.mimeType === "application/vnd.google-apps.folder";
                    return (
                      <li key={f.id} className="flex items-center gap-3 p-2 hover:bg-muted/50">
                        {isFolder ? (
                          <FolderIcon className="h-5 w-5 text-primary" />
                        ) : f.thumbnailLink ? (
                          <img
                            src={f.thumbnailLink}
                            alt=""
                            className="h-10 w-10 rounded object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <FileIcon className="h-5 w-5 text-muted-foreground" />
                        )}
                        <div className="min-w-0 flex-1">
                          {isFolder ? (
                            <button
                              type="button"
                              className="truncate text-left font-medium hover:underline"
                              onClick={() => openFolder(f)}
                            >
                              {f.name}
                            </button>
                          ) : (
                            <div className="truncate font-medium">{f.name}</div>
                          )}
                          <div className="text-xs text-muted-foreground">
                            {isFolder
                              ? "Pasta"
                              : `${f.mimeType.split("/").pop()} · ${formatBytes(Number(f.size ?? 0))}`}
                            {f.modifiedTime &&
                              ` · ${new Date(f.modifiedTime).toLocaleDateString("pt-BR")}`}
                          </div>
                        </div>
                        {f.webViewLink && (
                          <a
                            href={f.webViewLink}
                            target="_blank"
                            rel="noreferrer"
                            className="text-muted-foreground hover:text-foreground"
                            title="Abrir no Drive"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(f)}
                          title="Mover para lixeira"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        {status?.connected && <MigrationCard />}
        <DiagnosticsCard />
      </div>
    </PainelLayout>
  );
}

function DiagnosticsCard() {
  const run = useServerFn(runDriveDiagnostics);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    steps: DiagnosticStep[];
    serviceAccount: string | null;
  } | null>(null);

  async function handleRun() {
    setLoading(true);
    try {
      const res = await run();
      setResult(res);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">Diagnóstico de acesso</CardTitle>
        <CardDescription>
          Testa credenciais, OAuth, Drive API e visibilidade da pasta UEECM. Mostra o status HTTP e
          o corpo bruto do erro (útil para 401/403).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={handleRun} disabled={loading}>
            {loading ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 h-4 w-4" />
            )}
            Executar diagnóstico
          </Button>
          {result?.serviceAccount && (
            <span className="text-xs text-muted-foreground">
              Service account:{" "}
              <code className="rounded bg-muted px-1">{result.serviceAccount}</code>
            </span>
          )}
        </div>

        {result && (
          <ul className="space-y-2">
            {result.steps.map((s) => (
              <li
                key={s.id}
                className={`rounded-md border p-3 text-sm ${
                  s.status === "ok"
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : s.status === "warn"
                      ? "border-amber-500/30 bg-amber-500/5"
                      : "border-destructive/30 bg-destructive/5"
                }`}
              >
                <div className="flex items-center gap-2 font-medium">
                  {s.status === "ok" ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <XCircle
                      className={`h-4 w-4 ${
                        s.status === "warn" ? "text-amber-600" : "text-destructive"
                      }`}
                    />
                  )}
                  <span>{s.label}</span>
                  {typeof s.httpStatus === "number" && (
                    <Badge variant="outline" className="ml-1 font-mono text-xs">
                      HTTP {s.httpStatus}
                    </Badge>
                  )}
                </div>
                {s.detail && <p className="mt-1 text-xs text-muted-foreground">{s.detail}</p>}
                {s.raw && (
                  <pre className="mt-2 max-h-40 overflow-auto rounded bg-background/60 p-2 text-[11px] leading-tight text-foreground/80">
                    {s.raw}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

type BucketKey = "comunicados-anexos" | "justificativas" | "boletins-importados" | "alert-images";
const BUCKETS: BucketKey[] = [
  "comunicados-anexos",
  "justificativas",
  "boletins-importados",
  "alert-images",
];

function MigrationCard() {
  const fetchOverview = useServerFn(getMigrationOverview);
  const runStorage = useServerFn(migrateStorageBatch);
  const runMomentos = useServerFn(migrateMomentosBatch);

  const overview = useQuery({
    queryKey: ["drive-migration-overview"],
    queryFn: () => fetchOverview(),
    staleTime: 60_000,
  });

  const [running, setRunning] = useState<null | "momentos" | BucketKey>(null);
  const [progress, setProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [log, setLog] = useState<string[]>([]);
  const cancelRef = useRef(false);

  function appendLog(line: string) {
    setLog((prev) => [line, ...prev].slice(0, 30));
  }

  async function migrateBucket(bucket: BucketKey) {
    if (running) return;
    setRunning(bucket);
    cancelRef.current = false;
    setLog([]);
    setProgress({ done: 0, total: 0 });
    try {
      let offset = 0;
      while (!cancelRef.current) {
        const res = await runStorage({ data: { bucket, offset, limit: 5 } });
        offset = res.processed;
        setProgress({ done: res.processed, total: res.total });
        const ok = res.results.filter((r) => r.status === "ok").length;
        const skip = res.results.filter((r) => r.status === "skipped").length;
        const err = res.results.filter((r) => r.status === "error").length;
        appendLog(
          `${bucket}: +${ok} enviados · ${skip} já existentes · ${err} erros (${res.processed}/${res.total})`,
        );
        if (res.nextOffset === null) break;
      }
      toast.success(`Migração de ${bucket} concluída.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRunning(null);
      overview.refetch();
    }
  }

  async function migrateMomentosAll() {
    if (running) return;
    setRunning("momentos");
    cancelRef.current = false;
    setLog([]);
    setProgress({ done: 0, total: 0 });
    try {
      let offset = 0;
      while (!cancelRef.current) {
        const res = await runMomentos({ data: { offset, limit: 3 } });
        offset = res.processed;
        setProgress({ done: res.processed, total: res.total });
        const up = res.results.reduce((s, r) => s + r.uploaded, 0);
        const sk = res.results.reduce((s, r) => s + r.skipped, 0);
        const er = res.results.reduce((s, r) => s + r.errors, 0);
        appendLog(
          `Momentos: +${up} fotos · ${sk} já existentes · ${er} falhas (${res.processed}/${res.total} posts)`,
        );
        if (res.nextOffset === null) break;
      }
      toast.success("Migração de Momentos concluída.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRunning(null);
      overview.refetch();
    }
  }

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Migrar acervo existente para o Drive</CardTitle>
        <CardDescription>
          Copia documentos do Supabase Storage e fotos das publicações para as pastas
          <code className="mx-1">UEECM/Backups</code> e<code className="mx-1">UEECM/Momentos</code>.
          Arquivos já existentes no Drive são ignorados automaticamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {overview.isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-md border p-3">
              <div className="text-xs uppercase text-muted-foreground">Momentos</div>
              <div className="text-lg font-semibold">
                {overview.data?.postsPublicados ?? 0} posts
              </div>
              <Button
                size="sm"
                className="mt-2 w-full"
                disabled={!!running}
                onClick={migrateMomentosAll}
              >
                {running === "momentos" ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-1.5 h-4 w-4" />
                )}
                Migrar fotos
              </Button>
            </div>
            {BUCKETS.map((b) => (
              <div key={b} className="rounded-md border p-3">
                <div className="text-xs uppercase text-muted-foreground">{b}</div>
                <div className="text-lg font-semibold">
                  {overview.data?.buckets?.[b] ?? 0} itens
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 w-full"
                  disabled={!!running || (overview.data?.buckets?.[b] ?? 0) === 0}
                  onClick={() => migrateBucket(b)}
                >
                  {running === b ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-1.5 h-4 w-4" />
                  )}
                  Migrar
                </Button>
              </div>
            ))}
          </div>
        )}

        {running && (
          <div className="space-y-2 rounded-md border bg-muted/40 p-3">
            <div className="flex items-center justify-between text-sm">
              <span>
                Migrando <strong>{running}</strong>…
              </span>
              <span className="text-muted-foreground">
                {progress.done}/{progress.total} ({pct}%)
              </span>
            </div>
            <Progress value={pct} />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                cancelRef.current = true;
              }}
            >
              Interromper após o lote atual
            </Button>
          </div>
        )}

        {log.length > 0 && (
          <div className="max-h-48 overflow-auto rounded-md border bg-muted/30 p-2 font-mono text-xs">
            {log.map((l, i) => (
              <div key={i}>{l}</div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

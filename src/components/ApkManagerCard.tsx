import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, Trash2, CheckCircle2, Loader2, Package, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

type ApkRow = {
  id: string;
  version: string;
  notes: string | null;
  file_path: string;
  file_size: number;
  is_current: boolean;
  created_at: string;
};

const BUCKET = "app-releases";
// deno-lint-ignore no-explicit-any — tabela recém-criada, tipos ainda não regenerados
const db = supabase.from("app_apk_releases" as never) as any;

function formatBytes(n: number) {
  if (!n) return "0 B";
  const mb = n / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(n / 1024).toFixed(0)} KB`;
}

const MAX_SIZE_MB = 150;
const MAX_SIZE = MAX_SIZE_MB * 1024 * 1024;
const VERSION_RE = /^\d+\.\d+\.\d+(?:[-.][a-zA-Z0-9]+)*$/;

export function ApkManagerCard() {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [version, setVersion] = useState("");
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [versionError, setVersionError] = useState<string | null>(null);

  const { data: releases = [], isLoading } = useQuery<ApkRow[]>({
    queryKey: ["app_apk_releases"],
    queryFn: async () => {
      const { data, error } = await db
        .select("id, version, notes, file_path, file_size, is_current, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ApkRow[];
    },
  });

  function validateFile(f: File | null): string | null {
    if (!f) return "Selecione um arquivo .apk";
    const nameOk = /\.apk$/i.test(f.name);
    const typeOk =
      !f.type ||
      f.type === "application/vnd.android.package-archive" ||
      f.type === "application/octet-stream";
    if (!nameOk || !typeOk) return "Apenas arquivos .apk são permitidos";
    if (f.size <= 0) return "Arquivo vazio";
    if (f.size > MAX_SIZE) return `Tamanho máximo permitido: ${MAX_SIZE_MB} MB`;
    return null;
  }

  function validateVersion(v: string): string | null {
    const trimmed = v.trim();
    if (!trimmed) return "Informe a versão";
    if (!VERSION_RE.test(trimmed))
      return "Use o formato semver, ex: 1.0.0 ou 1.2.3-beta";
    return null;
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    const err = validateFile(f);
    setFileError(err);
    setFile(err ? null : f);
  }

  function handleVersionChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setVersion(v);
    setVersionError(v.length ? validateVersion(v) : null);
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    const vErr = validateVersion(version);
    const fErr = validateFile(file);
    setVersionError(vErr);
    setFileError(fErr);
    if (vErr || fErr) {
      toast.error(vErr ?? fErr ?? "Dados inválidos");
      return;
    }
    setUploading(true);
    try {
      const cleanVersion = version.trim().replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `releases/conecta-ueecm-${cleanVersion}-${Date.now()}.apk`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file!, {
          contentType: "application/vnd.android.package-archive",
          upsert: false,
        });
      if (upErr) throw upErr;

      // desmarca current anterior
      await db.update({ is_current: false }).eq("is_current", true);

      const { error: dbErr } = await db.insert({
        version: version.trim(),
        notes: notes.trim() || null,
        file_path: path,
        file_size: file!.size,
        is_current: true,
      });
      if (dbErr) throw dbErr;

      toast.success("APK publicado com sucesso");
      setFile(null);
      setVersion("");
      setNotes("");
      const input = document.getElementById("apk-file-input") as HTMLInputElement | null;
      if (input) input.value = "";
      qc.invalidateQueries({ queryKey: ["app_apk_releases"] });
      qc.invalidateQueries({ queryKey: ["app_apk_current"] });
    } catch (err) {
      toast.error("Erro ao publicar APK", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setUploading(false);
    }
  }


  async function handleSetCurrent(row: ApkRow) {
    await db.update({ is_current: false }).eq("is_current", true);
    const { error } = await db.update({ is_current: true }).eq("id", row.id);
    if (error) {
      toast.error("Erro ao marcar como atual", { description: error.message });
      return;
    }
    toast.success(`Versão ${row.version} definida como atual`);
    qc.invalidateQueries({ queryKey: ["app_apk_releases"] });
    qc.invalidateQueries({ queryKey: ["app_apk_current"] });
  }

  async function handleDelete(row: ApkRow) {
    if (!confirm(`Remover a versão ${row.version} definitivamente?`)) return;
    await supabase.storage.from(BUCKET).remove([row.file_path]);
    const { error } = await db.delete().eq("id", row.id);
    if (error) {
      toast.error("Erro ao remover", { description: error.message });
      return;
    }
    toast.success("Release removida");
    qc.invalidateQueries({ queryKey: ["app_apk_releases"] });
    qc.invalidateQueries({ queryKey: ["app_apk_current"] });
  }

  async function handleDownload(row: ApkRow) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(row.file_path, 60 * 10);
    if (error || !data) {
      toast.error("Erro ao gerar link", { description: error?.message });
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  return (
    <section className="mt-10 rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
          <Package className="size-5" />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold">Releases do APK</h2>
          <p className="text-sm text-muted-foreground">
            Envie o APK gerado pelo PWABuilder. A versão marcada como atual fica disponível para
            download público em <code>/instalar</code>.
          </p>
        </div>
      </div>

      <form onSubmit={handleUpload} className="grid gap-3 rounded-xl border border-dashed p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="apk-version">Versão (semver)</Label>
            <Input
              id="apk-version"
              value={version}
              onChange={handleVersionChange}
              placeholder="1.0.0"
              pattern="\d+\.\d+\.\d+([-.][a-zA-Z0-9]+)*"
              aria-invalid={!!versionError}
              required
            />
            {versionError && (
              <p className="mt-1 text-xs text-destructive">{versionError}</p>
            )}
          </div>
          <div>
            <Label htmlFor="apk-file-input">Arquivo .apk (máx. {MAX_SIZE_MB} MB)</Label>
            <Input
              id="apk-file-input"
              type="file"
              accept=".apk,application/vnd.android.package-archive"
              onChange={handleFileChange}
              aria-invalid={!!fileError}
              required
            />
            {fileError && <p className="mt-1 text-xs text-destructive">{fileError}</p>}
          </div>
        </div>
        <div>
          <Label htmlFor="apk-notes">Notas da versão (opcional)</Label>
          <Textarea
            id="apk-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Correções e melhorias desta versão"
            rows={2}
          />
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={uploading}>
            {uploading ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Enviando…
              </>
            ) : (
              <>
                <Upload className="size-4" /> Publicar APK
              </>
            )}
          </Button>
        </div>
      </form>

      <div className="mt-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando releases…</p>
        ) : releases.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum APK enviado ainda.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {releases.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">v{r.version}</span>
                    {r.is_current && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 className="size-3" /> Atual
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(r.file_size)} · {new Date(r.created_at).toLocaleString("pt-BR")}
                  </p>
                  {r.notes && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleDownload(r)}>
                    <Download className="size-4" />
                  </Button>
                  {!r.is_current && (
                    <Button size="sm" variant="secondary" onClick={() => handleSetCurrent(r)}>
                      Marcar atual
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(r)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

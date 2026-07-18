import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Cloud, Upload, Loader2, CheckCircle2, XCircle, Camera, FolderArchive } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { PainelLayout } from "@/components/PainelLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { uploadToUEECM } from "@/lib/google-drive.functions";

const MAX_MB = 15;

export const Route = createFileRoute("/painel-enviar-drive")({
  ssr: false,
  head: () => ({ meta: [{ title: "Enviar para o Drive | Painel" }] }),
  beforeLoad: async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/login" });
  },
  component: EnviarDrivePage,
});

type Sent = {
  id: string;
  name: string;
  ok: boolean;
  error?: string;
  webViewLink?: string;
};

function EnviarDrivePage() {
  const uploadFn = useServerFn(uploadToUEECM);
  const [tab, setTab] = useState<"momentos" | "backups">("momentos");
  const [ano, setAno] = useState(String(new Date().getFullYear()));
  const [evento, setEvento] = useState("");
  const [subpasta, setSubpasta] = useState("professores");
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [sent, setSent] = useState<Sent[]>([]);
  const [busy, setBusy] = useState(false);

  function pickFiles(list: FileList | null) {
    if (!list) return;
    const arr = Array.from(list);
    const oversized = arr.filter((f) => f.size > MAX_MB * 1024 * 1024);
    if (oversized.length) {
      toast.error(`${oversized.length} arquivo(s) acima de ${MAX_MB} MB serão ignorados.`);
    }
    setFiles(arr.filter((f) => f.size <= MAX_MB * 1024 * 1024));
  }

  async function toBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const b64 = result.split(",", 2)[1] ?? "";
        resolve(b64);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!files.length) {
      toast.error("Selecione ao menos um arquivo.");
      return;
    }
    if (tab === "momentos" && !evento.trim()) {
      toast.error("Informe o nome do evento (ex.: Festa Junina, Formatura).");
      return;
    }

    setBusy(true);
    setSent([]);
    setProgress({ current: 0, total: files.length });

    const results: Sent[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i]!;
      try {
        const base64 = await toBase64(f);
        const payload =
          tab === "momentos"
            ? {
                destino: "momentos" as const,
                ano: ano.trim(),
                evento: evento.trim(),
                name: f.name,
                mimeType: f.type || "application/octet-stream",
                contentBase64: base64,
              }
            : {
                destino: "backups" as const,
                subpasta: subpasta.trim() || "professores",
                name: f.name,
                mimeType: f.type || "application/octet-stream",
                contentBase64: base64,
              };
        const r = await uploadFn({ data: payload });
        results.push({
          id: r.id,
          name: r.name,
          ok: true,
          webViewLink: r.webViewLink,
        });
      } catch (err) {
        results.push({
          id: `${i}`,
          name: f.name,
          ok: false,
          error: (err as Error).message,
        });
      }
      setProgress({ current: i + 1, total: files.length });
      setSent([...results]);
    }

    const okCount = results.filter((r) => r.ok).length;
    if (okCount === files.length) toast.success(`${okCount} arquivo(s) enviados.`);
    else if (okCount > 0) toast.warning(`${okCount}/${files.length} enviados.`);
    else toast.error("Nenhum arquivo enviado.");
    setBusy(false);
    setFiles([]);
  }

  return (
    <PainelLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <Cloud className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-semibold">Enviar para o Google Drive</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Envie fotos para a galeria pública <b>Momentos</b> ou documentos para <b>Backups</b>.
            Todos os arquivos ficam no Drive institucional da UEECM.
          </p>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "momentos" | "backups")}>
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="momentos" className="gap-2">
              <Camera className="h-4 w-4" /> Momentos
            </TabsTrigger>
            <TabsTrigger value="backups" className="gap-2">
              <FolderArchive className="h-4 w-4" /> Backups / Documentos
            </TabsTrigger>
          </TabsList>

          <form onSubmit={handleSubmit}>
            <TabsContent value="momentos">
              <Card>
                <CardHeader>
                  <CardTitle>Fotos & vídeos do evento</CardTitle>
                  <CardDescription>
                    Vão para{" "}
                    <code className="text-xs">
                      UEECM/Momentos/{ano || "…"}/{evento || "…"}
                    </code>{" "}
                    e aparecem na galeria pública.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="ano">Ano</Label>
                      <Input
                        id="ano"
                        value={ano}
                        onChange={(e) => setAno(e.target.value)}
                        placeholder="2026"
                      />
                    </div>
                    <div>
                      <Label htmlFor="evento">Evento</Label>
                      <Input
                        id="evento"
                        value={evento}
                        onChange={(e) => setEvento(e.target.value)}
                        placeholder="Festa Junina, Formatura, Feira de Ciências…"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="backups">
              <Card>
                <CardHeader>
                  <CardTitle>Documentos e backups</CardTitle>
                  <CardDescription>
                    Vão para <code className="text-xs">UEECM/Backups/{subpasta || "…"}</code>.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Label htmlFor="subpasta">Subpasta</Label>
                  <Input
                    id="subpasta"
                    value={subpasta}
                    onChange={(e) => setSubpasta(e.target.value)}
                    placeholder="professores / diários / boletins…"
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Arquivos</CardTitle>
                <CardDescription>
                  Até {MAX_MB} MB por arquivo. Pode selecionar vários.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  type="file"
                  multiple
                  accept={tab === "momentos" ? "image/*,video/*" : undefined}
                  onChange={(e) => pickFiles(e.target.files)}
                />
                {files.length > 0 && (
                  <div className="text-sm text-muted-foreground">
                    {files.length} arquivo(s) selecionado(s) ·{" "}
                    {(files.reduce((s, f) => s + f.size, 0) / 1024 / 1024).toFixed(1)} MB
                  </div>
                )}
                {progress && (
                  <div className="space-y-1">
                    <Progress value={(progress.current / progress.total) * 100} />
                    <div className="text-xs text-muted-foreground">
                      {progress.current} / {progress.total}
                    </div>
                  </div>
                )}
                <Button type="submit" disabled={busy || !files.length} className="gap-2">
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  Enviar para o Drive
                </Button>
              </CardContent>
            </Card>
          </form>
        </Tabs>

        {sent.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resultado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {sent.map((s) => (
                <div key={s.id} className="flex items-center gap-2 text-sm">
                  {s.ok ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                  <span className="flex-1 truncate">{s.name}</span>
                  {s.ok && s.webViewLink && (
                    <a
                      href={s.webViewLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary hover:underline"
                    >
                      abrir
                    </a>
                  )}
                  {!s.ok && (
                    <Badge variant="destructive" className="text-[10px]">
                      {s.error?.slice(0, 40)}
                    </Badge>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </PainelLayout>
  );
}

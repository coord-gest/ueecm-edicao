import { useQuery } from "@tanstack/react-query";
import { Download, Loader2, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "app-releases";
// deno-lint-ignore no-explicit-any
const db = supabase.from("app_apk_releases" as never) as any;

type CurrentApk = {
  id: string;
  version: string;
  notes: string | null;
  file_path: string;
  file_size: number;
  created_at: string;
};

function formatBytes(n: number) {
  const mb = n / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(n / 1024).toFixed(0)} KB`;
}

export function ApkDownloadCard() {
  const { data, isLoading } = useQuery<CurrentApk | null>({
    queryKey: ["app_apk_current"],
    queryFn: async () => {
      const { data, error } = await db
        .select("id, version, notes, file_path, file_size, created_at")
        .eq("is_current", true)
        .maybeSingle();
      if (error) throw error;
      return (data as CurrentApk) ?? null;
    },
  });

  async function handleDownload() {
    if (!data) return;
    const { data: signed, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(data.file_path, 60 * 10);
    if (error || !signed) {
      toast.error("Não foi possível gerar o link", { description: error?.message });
      return;
    }
    window.location.href = signed.signedUrl;
  }

  if (isLoading || !data) return null;

  return (
    <section className="mt-8 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6">
      <div className="flex flex-wrap items-center gap-4">
        <div className="grid size-12 place-items-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
          <Smartphone className="size-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg font-semibold">
            APK oficial disponível — v{data.version}
          </h3>
          <p className="text-sm text-muted-foreground">
            {formatBytes(data.file_size)} · Publicado em{" "}
            {new Date(data.created_at).toLocaleDateString("pt-BR")}
          </p>
          {data.notes && (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{data.notes}</p>
          )}
        </div>
        <Button size="lg" onClick={handleDownload} className="gap-2">
          <Download className="size-5" /> Baixar APK
        </Button>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Após baixar, abra o arquivo no Android e permita a instalação de fontes desconhecidas se
        solicitado.
      </p>
    </section>
  );
}

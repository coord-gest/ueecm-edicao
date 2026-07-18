import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles, Save, Loader2, Eye } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { useRolePainelGuard } from "@/lib/use-role-guard";
import { RolePainelShell } from "@/components/RolePainelShell";
import { RolesFallback } from "@/components/RolesFallback";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DEFAULT_THEME_CONFIG,
  THEME_PRESETS,
  fetchThemeConfig,
  saveThemeConfig,
  type ThemeConfig,
  type ThemeEffectId,
} from "@/lib/theme-effects";

export const Route = createFileRoute("/painel-tema")({
  ssr: false,
  head: () => ({ meta: [{ title: "Animações do Tema | Painel" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: PainelTema,
});

function PainelTema() {
  useRolePainelGuard(["desenvolvedor", "diretor", "coordenador"]);
  const { roles, loading: authLoading } = useAuth();
  const [config, setConfig] = useState<ThemeConfig>(DEFAULT_THEME_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchThemeConfig()
      .then(setConfig)
      .finally(() => setLoading(false));
  }, []);

  if (!authLoading && roles.length === 0) {
    return (
      <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <RolesFallback />
      </main>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveThemeConfig(config);
      toast.success("Animações atualizadas para todos os usuários.");
    } catch (e) {
      toast.error("Erro ao salvar", { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const preview = THEME_PRESETS.find((p) => p.id === config.tema) ?? THEME_PRESETS[0];

  return (
    <RolePainelShell
      title="Animações do Tema"
      subtitle="Ative efeitos sazonais (Festa Junina, Natal, Carnaval...) que aparecem para todos os visitantes."
    >
      <div className="rounded-3xl border border-border/70 bg-card p-6 shadow-sm">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
          <Sparkles className="size-5 text-primary" /> Configuração
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          As alterações são aplicadas imediatamente em toda a aplicação (visitantes e usuários
          logados).
        </p>

        {loading ? (
          <div className="mt-6 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-muted/30 px-4 py-3">
              <div>
                <Label className="text-base">Ativar animações</Label>
                <p className="text-xs text-muted-foreground">
                  Quando desligado, nada é exibido — mesmo com tema selecionado.
                </p>
              </div>
              <Switch
                checked={config.ativo}
                onCheckedChange={(v) => setConfig((c) => ({ ...c, ativo: v }))}
              />
            </div>

            <div>
              <Label className="mb-3 block">Tema sazonal</Label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {THEME_PRESETS.map((p) => {
                  const active = config.tema === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setConfig((c) => ({ ...c, tema: p.id as ThemeEffectId }))}
                      className={`relative rounded-2xl border p-4 text-left transition-all ${
                        active
                          ? "border-primary bg-primary/5 ring-2 ring-primary/40"
                          : "border-border/60 bg-background hover:border-primary/40"
                      }`}
                    >
                      <div className="mb-2 flex gap-1 text-2xl">
                        {p.emojis.length === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          p.emojis.slice(0, 4).map((e, i) => <span key={i}>{e}</span>)
                        )}
                      </div>
                      <p className="font-medium text-foreground">{p.label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{p.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label>Intensidade</Label>
                <span className="text-sm font-medium text-foreground">
                  {config.intensidade} partículas
                </span>
              </div>
              <Slider
                min={5}
                max={80}
                step={5}
                value={[config.intensidade]}
                onValueChange={(v) => setConfig((c) => ({ ...c, intensidade: v[0] ?? 30 }))}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Valores altos podem impactar a performance em aparelhos antigos.
              </p>
            </div>

            {config.ativo && preview.emojis.length > 0 && (
              <div className="rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-4">
                <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Eye className="size-4" /> Prévia: {preview.label}
                </p>
                <p className="mt-1 text-3xl leading-relaxed">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <span key={i} className="mr-2">
                      {preview.emojis[i % preview.emojis.length]}
                    </span>
                  ))}
                </p>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving} size="lg">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Salvar e aplicar
              </Button>
            </div>
          </div>
        )}
      </div>
    </RolePainelShell>
  );
}

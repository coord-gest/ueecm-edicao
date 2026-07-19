import { useRef, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Download, Image as ImageIcon, Sparkles } from "lucide-react";
import { toPng } from "html-to-image";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { RolePainelShell } from "@/components/RolePainelShell";
import { useRolePainelGuard } from "@/lib/use-role-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent } from "@/components/ui/card";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/painel-cards")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Cards de Anotação | U.E. - Evaristo Campelo de Matos" }],
  }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: PainelCards,
});

type Theme = {
  id: string;
  label: string;
  bg: string;
  fg: string;
  accent: string;
};

const THEMES: Theme[] = [
  {
    id: "sunset",
    label: "Pôr do sol",
    bg: "linear-gradient(135deg,#ff9a56 0%,#ff6a88 50%,#c471ed 100%)",
    fg: "#ffffff",
    accent: "rgba(255,255,255,0.85)",
  },
  {
    id: "ocean",
    label: "Oceano",
    bg: "linear-gradient(135deg,#0ea5e9 0%,#2563eb 60%,#4f46e5 100%)",
    fg: "#ffffff",
    accent: "rgba(255,255,255,0.85)",
  },
  {
    id: "forest",
    label: "Floresta",
    bg: "linear-gradient(135deg,#059669 0%,#0d9488 60%,#065f46 100%)",
    fg: "#ffffff",
    accent: "rgba(255,255,255,0.85)",
  },
  {
    id: "cream",
    label: "Papel",
    bg: "linear-gradient(135deg,#fdf6e3 0%,#f5e9c8 100%)",
    fg: "#1f2937",
    accent: "rgba(31,41,55,0.75)",
  },
  {
    id: "night",
    label: "Noite",
    bg: "linear-gradient(135deg,#0f172a 0%,#1e293b 60%,#334155 100%)",
    fg: "#f8fafc",
    accent: "rgba(248,250,252,0.75)",
  },
  {
    id: "rose",
    label: "Rosé",
    bg: "linear-gradient(135deg,#fda4af 0%,#f472b6 60%,#a855f7 100%)",
    fg: "#ffffff",
    accent: "rgba(255,255,255,0.9)",
  },
];

const FORMATS = [
  { id: "square", label: "Quadrado 1:1", w: 1080, h: 1080 },
  { id: "story", label: "Story 9:16", w: 1080, h: 1920 },
  { id: "post", label: "Post 4:5", w: 1080, h: 1350 },
] as const;
type FormatId = (typeof FORMATS)[number]["id"];

function PainelCards() {
  const { checking } = useRolePainelGuard([
    "desenvolvedor",
    "admin",
    "diretor",
    "coordenador",
    "secretario",
    "professor",
  ]);
  const [titulo, setTitulo] = useState("Anotação do dia");
  const [conteudo, setConteudo] = useState(
    "Escreva aqui a mensagem que você quer transformar em imagem. Ideal para posts, avisos, lembretes e frases motivacionais.",
  );
  const [autor, setAutor] = useState("U.E. Evaristo Campelo de Matos");
  const [themeId, setThemeId] = useState<Theme["id"]>("sunset");
  const [format, setFormat] = useState<FormatId>("square");
  const [fontSize, setFontSize] = useState<number>(44);
  const [showLogo, setShowLogo] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const theme = THEMES.find((t) => t.id === themeId) ?? THEMES[0];
  const fmt = FORMATS.find((f) => f.id === format) ?? FORMATS[0];

  async function handleDownload() {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const scale = fmt.w / cardRef.current.offsetWidth;
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: Math.max(2, scale),
        cacheBust: true,
        backgroundColor: "transparent",
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      const slug =
        (titulo || "card")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "")
          .slice(0, 40) || "card";
      a.download = `${slug}-${fmt.id}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("Imagem baixada!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar imagem");
    } finally {
      setDownloading(false);
    }
  }

  // Preview aspect ratio
  const previewMaxW = 480;
  const previewH = (previewMaxW * fmt.h) / fmt.w;

  if (checking) return null;

  return (
    <RolePainelShell
      title="Cards de Anotação"
      subtitle="Transforme suas anotações em cards elegantes para baixar e compartilhar."
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
        {/* Preview */}
        <div className="flex flex-col items-center gap-4">
          <div className="w-full max-w-[480px]">
            <div
              ref={cardRef}
              style={{
                width: "100%",
                height: previewH,
                background: theme.bg,
                color: theme.fg,
              }}
              className="relative flex flex-col justify-between overflow-hidden rounded-3xl p-8 shadow-2xl"
            >
              {/* padrão decorativo sutil */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-30"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.25), transparent 40%), radial-gradient(circle at 80% 80%, rgba(0,0,0,0.15), transparent 40%)",
                }}
              />

              {/* topo: logo */}
              <div className="relative z-10 flex items-center gap-3">
                {showLogo && (
                  <img
                    src={logo}
                    alt=""
                    crossOrigin="anonymous"
                    style={{ width: 44, height: 44 }}
                    className="rounded-xl bg-white/90 object-contain p-1"
                  />
                )}
                <div className="min-w-0">
                  <p
                    className="text-[10px] font-bold uppercase tracking-[0.2em]"
                    style={{ color: theme.accent }}
                  >
                    Conecta UEECM
                  </p>
                  <p className="truncate text-[11px]" style={{ color: theme.accent }}>
                    conectaueecm.com
                  </p>
                </div>
              </div>

              {/* conteúdo central */}
              <div className="relative z-10 flex flex-1 flex-col justify-center py-6">
                {titulo && (
                  <h2
                    className="mb-4 font-bold leading-tight"
                    style={{ fontSize: Math.max(20, fontSize * 0.55) }}
                  >
                    {titulo}
                  </h2>
                )}
                <p className="whitespace-pre-wrap font-medium leading-snug" style={{ fontSize }}>
                  {conteudo}
                </p>
              </div>

              {/* rodapé */}
              <div className="relative z-10 flex items-end justify-between gap-2">
                <p className="text-[13px] font-semibold" style={{ color: theme.accent }}>
                  — {autor}
                </p>
                <div
                  className="h-1 w-16 rounded-full"
                  style={{ backgroundColor: theme.fg, opacity: 0.6 }}
                />
              </div>
            </div>
          </div>
          <Button
            size="lg"
            className="rounded-full"
            onClick={handleDownload}
            disabled={downloading}
          >
            <Download className="size-4" />
            {downloading ? "Gerando..." : `Baixar imagem (${fmt.w}×${fmt.h})`}
          </Button>
        </div>

        {/* Editor */}
        <Card>
          <CardContent className="space-y-5 p-5">
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Sparkles className="mr-1 inline size-3" /> Conteúdo
              </Label>
              <div className="mt-2 space-y-3">
                <div>
                  <Label htmlFor="titulo" className="text-xs">
                    Título
                  </Label>
                  <Input
                    id="titulo"
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    placeholder="Ex.: Aviso importante"
                  />
                </div>
                <div>
                  <Label htmlFor="conteudo" className="text-xs">
                    Mensagem
                  </Label>
                  <Textarea
                    id="conteudo"
                    value={conteudo}
                    onChange={(e) => setConteudo(e.target.value)}
                    rows={5}
                    placeholder="Escreva sua mensagem"
                  />
                </div>
                <div>
                  <Label htmlFor="autor" className="text-xs">
                    Assinatura
                  </Label>
                  <Input id="autor" value={autor} onChange={(e) => setAutor(e.target.value)} />
                </div>
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <ImageIcon className="mr-1 inline size-3" /> Aparência
              </Label>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setThemeId(t.id)}
                    aria-label={t.label}
                    className={`h-14 overflow-hidden rounded-xl border-2 transition ${
                      themeId === t.id
                        ? "border-primary ring-2 ring-primary/30"
                        : "border-transparent"
                    }`}
                    style={{ background: t.bg }}
                  >
                    <span className="sr-only">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs">Formato</Label>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {FORMATS.map((f) => (
                  <Button
                    key={f.id}
                    type="button"
                    size="sm"
                    variant={format === f.id ? "default" : "outline"}
                    className="rounded-full text-xs"
                    onClick={() => setFormat(f.id)}
                  >
                    {f.label}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs">Tamanho da fonte: {fontSize}px</Label>
              <Slider
                value={[fontSize]}
                min={24}
                max={72}
                step={2}
                onValueChange={(v) => setFontSize(v[0] ?? 44)}
                className="mt-2"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 p-3">
              <Label htmlFor="showLogo" className="text-sm">
                Exibir logo da escola
              </Label>
              <input
                id="showLogo"
                type="checkbox"
                checked={showLogo}
                onChange={(e) => setShowLogo(e.target.checked)}
                className="size-4 accent-primary"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </RolePainelShell>
  );
}

import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  Play,
  Save,
  Upload,
  Loader2,
  ImagePlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RolePainelShell } from "@/components/RolePainelShell";
import { supabase } from "@/integrations/supabase/client";
import { uploadImage } from "@/lib/image-upload";
import {
  getApresentacao,
  updateApresentacao,
  importarMarkdown,
  slideVazio,
  type Apresentacao,
  type Slide,
  type Tema,
  type Visibilidade,
} from "@/lib/apresentacoes";
import {
  ScaledSlide,
  SLIDE_KINDS,
  slideResumo,
} from "@/components/apresentacao/SlideRenderer";

export const Route = createFileRoute("/painel-apresentacoes/$id")({
  ssr: false,
  head: () => ({ meta: [{ title: "Editar apresentação | Painel" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: Editor,
});

function Editor() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [ap, setAp] = useState<Apresentacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  const [importMd, setImportMd] = useState("");

  useEffect(() => {
    getApresentacao(id)
      .then((res) => {
        if (!res) setErro("Apresentação não encontrada");
        else setAp(res);
      })
      .catch((e) => setErro(e instanceof Error ? e.message : "Falha ao carregar"));
  }, [id]);

  const active = ap?.slides[activeIdx];

  function patchAp(p: Partial<Apresentacao>) {
    setAp((cur) => (cur ? { ...cur, ...p } : cur));
    setDirty(true);
  }

  function patchSlide(next: Slide) {
    setAp((cur) => {
      if (!cur) return cur;
      const slides = cur.slides.map((s, i) => (i === activeIdx ? next : s));
      return { ...cur, slides };
    });
    setDirty(true);
  }

  function addSlide(kind: Slide["kind"]) {
    setAp((cur) => {
      if (!cur) return cur;
      const slides = [...cur.slides, slideVazio(kind)];
      setActiveIdx(slides.length - 1);
      return { ...cur, slides };
    });
    setDirty(true);
  }

  function moveSlide(dir: -1 | 1) {
    setAp((cur) => {
      if (!cur) return cur;
      const j = activeIdx + dir;
      if (j < 0 || j >= cur.slides.length) return cur;
      const slides = [...cur.slides];
      [slides[activeIdx], slides[j]] = [slides[j], slides[activeIdx]];
      setActiveIdx(j);
      setDirty(true);
      return { ...cur, slides };
    });
  }

  function removeSlide(idx: number) {
    setAp((cur) => {
      if (!cur || cur.slides.length <= 1) {
        toast.info("A apresentação precisa ter pelo menos 1 slide.");
        return cur;
      }
      const slides = cur.slides.filter((_, i) => i !== idx);
      const nextIdx = Math.min(activeIdx, slides.length - 1);
      setActiveIdx(nextIdx);
      setDirty(true);
      return { ...cur, slides };
    });
  }

  async function salvar() {
    if (!ap) return;
    setSaving(true);
    try {
      await updateApresentacao(ap.id, {
        titulo: ap.titulo,
        descricao: ap.descricao,
        slides: ap.slides,
        tema: ap.tema,
        visibilidade: ap.visibilidade,
      });
      setDirty(false);
      toast.success("Apresentação salva");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  }

  function aplicarImport() {
    const slides = importarMarkdown(importMd);
    if (!slides.length) {
      toast.error("Nenhum slide reconhecido no texto.");
      return;
    }
    setAp((cur) => (cur ? { ...cur, slides: [...cur.slides, ...slides] } : cur));
    setActiveIdx((idx) => idx);
    setDirty(true);
    setImportOpen(false);
    setImportMd("");
    toast.success(`${slides.length} slide(s) adicionados`);
  }

  if (erro) {
    return (
      <RolePainelShell title="Apresentações" subtitle="Editar apresentação">
        <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-6">
          <p className="font-medium text-destructive">{erro}</p>
          <Button asChild variant="outline" className="mt-3">
            <Link to="/painel-apresentacoes">Voltar</Link>
          </Button>
        </div>
      </RolePainelShell>
    );
  }
  if (!ap || !active) {
    return (
      <RolePainelShell title="Apresentações" subtitle="Carregando…">
        <div className="grid place-items-center py-20 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </RolePainelShell>
    );
  }

  return (
    <RolePainelShell title={ap.titulo} subtitle="Edite os slides e apresente em tela cheia.">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/painel-apresentacoes">
            <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
          </Link>
        </Button>
        <div className="flex-1" />
        <Button size="sm" variant="outline" onClick={() => setImportOpen((v) => !v)}>
          <Upload className="mr-1 h-4 w-4" /> Importar Markdown
        </Button>
        <Button size="sm" variant="outline" asChild>
          <a href={`/apresentar/${ap.id}`} target="_blank" rel="noreferrer">
            <Play className="mr-1 h-4 w-4" /> Apresentar
          </a>
        </Button>
        <Button size="sm" onClick={salvar} disabled={saving || !dirty}>
          {saving ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-1 h-4 w-4" />
          )}
          {dirty ? "Salvar alterações" : "Tudo salvo"}
        </Button>
      </div>

      {importOpen ? (
        <div className="mb-4 rounded-2xl border border-border/70 bg-card p-4">
          <p className="text-sm text-muted-foreground">
            Cole texto Markdown. Use <code>---</code> para separar slides, <code>#</code> título,
            <code> ##</code> subtítulo, <code>-</code> tópicos, <code>&gt;</code> citação,
            <code> ![](url)</code> imagem.
          </p>
          <Textarea
            className="mt-2 min-h-[160px] font-mono text-xs"
            value={importMd}
            onChange={(e) => setImportMd(e.target.value)}
            placeholder={"# Reunião de fevereiro\n## Pauta e resultados\n\n---\n\n# Metas\n- Meta A\n- Meta B"}
          />
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={aplicarImport}>
              Adicionar slides
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setImportOpen(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[240px_1fr_360px]">
        {/* Miniaturas */}
        <aside className="rounded-2xl border border-border/70 bg-card p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Slides ({ap.slides.length})
            </span>
          </div>
          <ol className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto">
            {ap.slides.map((s, i) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setActiveIdx(i)}
                  className={`w-full rounded-lg border p-2 text-left text-xs transition ${
                    i === activeIdx
                      ? "border-primary bg-primary/10"
                      : "border-border/60 hover:bg-muted"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">#{i + 1}</span>
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {s.kind}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 opacity-80">{slideResumo(s)}</p>
                </button>
              </li>
            ))}
          </ol>
          <div className="mt-3 border-t pt-3">
            <Label className="text-xs">Adicionar slide</Label>
            <div className="mt-1 grid grid-cols-2 gap-1">
              {SLIDE_KINDS.map((k) => (
                <Button
                  key={k.value}
                  size="sm"
                  variant="outline"
                  className="justify-start text-xs"
                  onClick={() => addSlide(k.value)}
                >
                  <Plus className="mr-1 h-3 w-3" /> {k.label}
                </Button>
              ))}
            </div>
          </div>
        </aside>

        {/* Preview */}
        <div className="flex flex-col gap-3">
          <div className="aspect-video overflow-hidden rounded-2xl border border-border/70 bg-black shadow-sm">
            <ScaledSlide slide={active} tema={ap.tema} className="h-full w-full" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Slide {activeIdx + 1} de {ap.slides.length}
            </span>
            <div className="flex-1" />
            <Button size="sm" variant="ghost" onClick={() => moveSlide(-1)} disabled={activeIdx === 0}>
              <ArrowUp className="mr-1 h-3.5 w-3.5" /> Subir
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => moveSlide(1)}
              disabled={activeIdx === ap.slides.length - 1}
            >
              <ArrowDown className="mr-1 h-3.5 w-3.5" /> Descer
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => removeSlide(activeIdx)}
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" /> Remover
            </Button>
          </div>
        </div>

        {/* Inspector */}
        <aside className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card p-4">
          <div>
            <Label className="text-xs">Título da apresentação</Label>
            <Input value={ap.titulo} onChange={(e) => patchAp({ titulo: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Descrição</Label>
            <Textarea
              value={ap.descricao ?? ""}
              onChange={(e) => patchAp({ descricao: e.target.value })}
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Tema</Label>
              <Select
                value={ap.tema}
                onValueChange={(v) => patchAp({ tema: v as Tema })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="institucional">Institucional</SelectItem>
                  <SelectItem value="escuro">Escuro</SelectItem>
                  <SelectItem value="claro">Claro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Visibilidade</Label>
              <Select
                value={ap.visibilidade}
                onValueChange={(v) => patchAp({ visibilidade: v as Visibilidade })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="privada">Privada (só você)</SelectItem>
                  <SelectItem value="equipe">Equipe da escola</SelectItem>
                  <SelectItem value="publica">Pública (link)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border-t pt-4">
            <SlideInspector slide={active} onChange={patchSlide} />
          </div>
        </aside>
      </div>
    </RolePainelShell>
  );
}

function SlideInspector({
  slide,
  onChange,
}: {
  slide: Slide;
  onChange: (s: Slide) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function pickImage(cb: (url: string) => void) {
    const el = fileRef.current;
    if (!el) return;
    el.onchange = async () => {
      const f = el.files?.[0];
      el.value = "";
      if (!f) return;
      setUploading(true);
      try {
        const res = await uploadImage(f, "apresentacoes");
        if (!res.ok) throw new Error(`${res.error.title}: ${res.error.description}`);
        cb(res.url);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Falha no upload");
      } finally {
        setUploading(false);
      }
    };
    el.click();
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Conteúdo do slide
      </p>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" />

      {slide.kind === "titulo" && (
        <>
          <Field label="Kicker (opcional)">
            <Input
              value={slide.kicker ?? ""}
              onChange={(e) => onChange({ ...slide, kicker: e.target.value })}
            />
          </Field>
          <Field label="Título">
            <Input value={slide.titulo} onChange={(e) => onChange({ ...slide, titulo: e.target.value })} />
          </Field>
          <Field label="Subtítulo">
            <Textarea
              value={slide.subtitulo ?? ""}
              rows={2}
              onChange={(e) => onChange({ ...slide, subtitulo: e.target.value })}
            />
          </Field>
        </>
      )}

      {slide.kind === "texto" && (
        <>
          <Field label="Título">
            <Input
              value={slide.titulo ?? ""}
              onChange={(e) => onChange({ ...slide, titulo: e.target.value })}
            />
          </Field>
          <Field label="Parágrafo (opcional)">
            <Textarea
              rows={3}
              value={slide.corpo ?? ""}
              onChange={(e) => onChange({ ...slide, corpo: e.target.value })}
            />
          </Field>
          <Field label="Tópicos (um por linha)">
            <Textarea
              rows={5}
              value={(slide.bullets ?? []).join("\n")}
              onChange={(e) =>
                onChange({
                  ...slide,
                  bullets: e.target.value.split("\n").map((l) => l.trim()).filter(Boolean),
                })
              }
            />
          </Field>
        </>
      )}

      {(slide.kind === "imagem" || slide.kind === "imagemTexto") && (
        <>
          <Field label="Imagem">
            <div className="flex flex-col gap-2">
              <Input
                placeholder="https://…"
                value={slide.url}
                onChange={(e) => onChange({ ...slide, url: e.target.value })}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => pickImage((url) => onChange({ ...slide, url }))}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ImagePlus className="mr-1 h-3.5 w-3.5" />
                )}
                Enviar do computador
              </Button>
            </div>
          </Field>
          {slide.kind === "imagem" && (
            <Field label="Legenda">
              <Input
                value={slide.legenda ?? ""}
                onChange={(e) => onChange({ ...slide, legenda: e.target.value })}
              />
            </Field>
          )}
          {slide.kind === "imagemTexto" && (
            <>
              <Field label="Título">
                <Input
                  value={slide.titulo ?? ""}
                  onChange={(e) => onChange({ ...slide, titulo: e.target.value })}
                />
              </Field>
              <Field label="Texto">
                <Textarea
                  rows={4}
                  value={slide.corpo ?? ""}
                  onChange={(e) => onChange({ ...slide, corpo: e.target.value })}
                />
              </Field>
              <Field label="Posição da imagem">
                <Select
                  value={slide.posicao ?? "esquerda"}
                  onValueChange={(v) =>
                    onChange({ ...slide, posicao: v as "esquerda" | "direita" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="esquerda">Esquerda</SelectItem>
                    <SelectItem value="direita">Direita</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </>
          )}
        </>
      )}

      {slide.kind === "citacao" && (
        <>
          <Field label="Frase">
            <Textarea
              rows={3}
              value={slide.frase}
              onChange={(e) => onChange({ ...slide, frase: e.target.value })}
            />
          </Field>
          <Field label="Autor">
            <Input
              value={slide.autor ?? ""}
              onChange={(e) => onChange({ ...slide, autor: e.target.value })}
            />
          </Field>
        </>
      )}

      {slide.kind === "estatistica" && (
        <>
          <Field label="Título">
            <Input
              value={slide.titulo ?? ""}
              onChange={(e) => onChange({ ...slide, titulo: e.target.value })}
            />
          </Field>
          {slide.itens.map((it, i) => (
            <div key={i} className="grid grid-cols-[1fr_2fr_auto] gap-2">
              <Input
                placeholder="Valor"
                value={it.valor}
                onChange={(e) => {
                  const itens = [...slide.itens];
                  itens[i] = { ...itens[i], valor: e.target.value };
                  onChange({ ...slide, itens });
                }}
              />
              <Input
                placeholder="Descrição"
                value={it.descricao}
                onChange={(e) => {
                  const itens = [...slide.itens];
                  itens[i] = { ...itens[i], descricao: e.target.value };
                  onChange({ ...slide, itens });
                }}
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onChange({ ...slide, itens: slide.itens.filter((_, j) => j !== i) })}
                disabled={slide.itens.length <= 1}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <Button
            size="sm"
            variant="outline"
            disabled={slide.itens.length >= 3}
            onClick={() =>
              onChange({ ...slide, itens: [...slide.itens, { valor: "", descricao: "" }] })
            }
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar item
          </Button>
        </>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
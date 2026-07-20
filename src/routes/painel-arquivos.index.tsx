import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { FolderOpen, FileText, Download, LogOut, Tag, Layers, Loader2, Sparkles, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { useAuth } from "@/lib/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { ARQUIVO_TEMPLATES, type ArquivoTemplate } from "@/lib/arquivo-templates";
import { exportBoletimOficial, exportNotasPorArea } from "@/lib/arquivo-export.functions";

export const Route = createFileRoute("/painel-arquivos/")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Arquivos | Painel" }],
  }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/login" });
    }
  },
  component: PainelArquivos,
});

const CATEGORIA_LABEL: Record<ArquivoTemplate["categoria"], string> = {
  avaliacao: "Avaliação",
  planejamento: "Planejamento",
  registro: "Registro",
  comunicado: "Comunicado",
};

const ESCOPO_LABEL: Record<ArquivoTemplate["escopo"], string> = {
  turma: "Por turma",
  escola: "Toda a escola",
  professor: "Por professor",
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function PainelArquivos() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const gerarBoletim = useServerFn(exportBoletimOficial);
  const gerarNotasArea = useServerFn(exportNotasPorArea);
  const [gerando, setGerando] = useState<string | null>(null);

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/", replace: true });
  };

  async function baixarModelo(tpl: ArquivoTemplate) {
    setGerando(tpl.id);
    try {
      let base64: string;
      let filename: string;

      if (tpl.id === "notas-por-area") {
        const res = await gerarNotasArea({
          data: {
            turmaNome: "Modelo",
            anoSerie: "",
            turno: "",
            anoLetivo: new Date().getFullYear(),
            bimestre: 1,
            alunos: [],
          },
        });
        base64 = res.base64;
        filename = res.filename;
      } else {
        const alunosDemo = Array.from({ length: 3 }).map((_, i) => ({
          id: `demo-${i + 1}`,
          nome: `Aluno ${i + 1}`,
        }));
        const res = await gerarBoletim({
          data: {
            turmaNome: "Modelo",
            anoSerie: "",
            turno: "",
            anoLetivo: new Date().getFullYear(),
            alunos: alunosDemo,
            notasBoletim: {},
          },
        });
        base64 = res.base64;
        filename = res.filename;
      }

      const bin = atob(base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = tpl.filename || filename || "modelo.docx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      toast.error("Falha ao gerar o modelo. Tente novamente.");
    } finally {
      setGerando(null);
    }
  }

  return (
    <>
      <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b border-border/60 bg-background/85 px-4 backdrop-blur-lg sm:px-6">
        <div className="ml-1 min-w-0 flex-1">
          <p className="truncate font-display text-sm font-semibold text-foreground sm:text-base">
            Arquivos
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <ThemeToggle className="rounded-full" />
          <Link
            to="/"
            className="hidden h-9 items-center justify-center rounded-full px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground sm:inline-flex"
          >
            Ver blog
          </Link>
          <Button onClick={handleSignOut} variant="outline" size="sm" className="rounded-full">
            <LogOut className="size-4" /> <span className="hidden sm:inline">Sair</span>
          </Button>
        </div>
      </header>

      <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <Breadcrumbs
            className="mb-3"
            items={[
              { label: "Início", to: "/" },
              { label: "Painel", to: "/painel" },
              { label: "Arquivos" },
            ]}
          />

          <div className="rounded-3xl border border-border/70 bg-card p-6 shadow-sm sm:p-8">
            <div className="flex items-start gap-4">
              <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                <FolderOpen className="size-6" />
              </div>
              <div className="min-w-0">
                <h1 className="font-display text-xl font-semibold text-foreground sm:text-2xl">
                  Modelos de Arquivos
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Documentos padronizados prontos para download. Baixe o modelo, preencha offline e
                  mantenha o registro na secretaria da escola.
                </p>
              </div>
            </div>

            <section aria-label="Modelos disponíveis" className="mt-8">
              <Link
                to="/painel-arquivos/planejamentos"
                className="mb-6 flex flex-col items-start gap-3 rounded-[5px] border border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5 p-5 transition-shadow hover:shadow-md sm:flex-row sm:items-center"
              >
                <div className="grid size-12 shrink-0 place-items-center rounded-[5px] bg-primary/15 text-primary">
                  <CalendarDays className="size-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-base font-semibold text-foreground sm:text-lg">
                      Planejamentos Pedagógicos
                    </h2>
                    <span className="inline-flex items-center gap-1 rounded-[5px] bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
                      <Sparkles className="size-3" /> IA Gemini
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Semanais, quinzenais, mensais e semestrais. Coordenação envia por professor e disciplina; cada docente vê apenas os seus.
                  </p>
                </div>
                <span className="rounded-[5px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                  Acessar
                </span>
              </Link>
              {ARQUIVO_TEMPLATES.length === 0 ? (
                <div className="grid place-items-center rounded-2xl border border-dashed border-border/70 bg-muted/30 p-10 text-center">
                  <FileText className="size-10 text-muted-foreground" />
                  <p className="mt-3 font-medium text-foreground">Nenhum modelo cadastrado</p>
                </div>
              ) : (
                <ul className="grid gap-4 md:grid-cols-2">
                  {ARQUIVO_TEMPLATES.map((tpl) => (
                    <li key={tpl.id}>
                      <article className="flex h-full flex-col rounded-2xl border border-border/70 bg-background p-5 shadow-sm transition-shadow hover:shadow-md">
                        <header className="flex items-start gap-3">
                          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                            <FileText className="size-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h2 className="font-display text-base font-semibold text-foreground">
                              {tpl.nome}
                            </h2>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1">
                                <Tag className="size-3" />
                                {CATEGORIA_LABEL[tpl.categoria]}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <Layers className="size-3" />
                                {ESCOPO_LABEL[tpl.escopo]}
                              </span>
                              <span className="uppercase">{tpl.formato}</span>
                              <span>{formatSize(tpl.size)}</span>
                            </div>
                          </div>
                        </header>

                        <p className="mt-3 text-sm text-muted-foreground">{tpl.descricao}</p>

                        <div className="mt-4">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Campos do modelo
                          </p>
                          <ul className="mt-2 flex flex-wrap gap-1.5">
                            {tpl.campos.map((c) => (
                              <li
                                key={c}
                                className="rounded-full border border-border/70 bg-muted/40 px-2.5 py-1 text-[11px] text-foreground"
                              >
                                {c}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="mt-auto flex flex-wrap gap-2 pt-5">
                          <Button
                            size="sm"
                            className="rounded-full"
                            onClick={() => baixarModelo(tpl)}
                            disabled={gerando === tpl.id}
                          >
                            {gerando === tpl.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Download className="size-4" />
                            )}
                            Baixar modelo
                          </Button>
                          {tpl.preenchivel && (
                            <Button asChild size="sm" variant="outline" className="rounded-full">
                              <Link
                                to="/painel-arquivos/$templateId"
                                params={{ templateId: tpl.id }}
                              >
                                <FileText className="size-4" /> Preencher online
                              </Link>
                            </Button>
                          )}
                        </div>
                      </article>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </main>
    </>
  );
}

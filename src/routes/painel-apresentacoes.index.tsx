import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Presentation, Copy, Trash2, Play, Pencil, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RolePainelShell } from "@/components/RolePainelShell";
import { supabase } from "@/integrations/supabase/client";
import {
  listApresentacoes,
  createApresentacao,
  deleteApresentacao,
  duplicateApresentacao,
  type Apresentacao,
} from "@/lib/apresentacoes";

export const Route = createFileRoute("/painel-apresentacoes/")({
  ssr: false,
  head: () => ({ meta: [{ title: "Apresentações | Painel" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: Lista,
});

type Item = Omit<Apresentacao, "slides">;

function Lista() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function reload() {
    try {
      setItems(await listApresentacoes());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao carregar apresentações");
      setItems([]);
    }
  }
  useEffect(() => {
    reload();
  }, []);

  async function nova() {
    setBusy(true);
    try {
      const id = await createApresentacao();
      toast.success("Apresentação criada");
      navigate({ to: "/painel-apresentacoes/$id", params: { id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao criar");
    } finally {
      setBusy(false);
    }
  }

  async function duplicar(id: string) {
    try {
      const novo = await duplicateApresentacao(id);
      toast.success("Duplicada");
      navigate({ to: "/painel-apresentacoes/$id", params: { id: novo } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao duplicar");
    }
  }

  async function excluir(id: string, titulo: string) {
    if (!confirm(`Excluir "${titulo}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await deleteApresentacao(id);
      toast.success("Excluída");
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao excluir");
    }
  }

  return (
    <RolePainelShell
      title="Apresentações"
      subtitle="Slides para reuniões, comunicados e formaturas."
    >
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Presentation className="h-4 w-4" /> {items?.length ?? 0} apresentação(ões)
        </div>
        <Button onClick={nova} disabled={busy}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
          Nova apresentação
        </Button>
      </div>

      {items === null ? (
        <div className="grid place-items-center py-20 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border/70 p-10 text-center">
          <Presentation className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-medium">Nenhuma apresentação ainda</p>
          <p className="text-sm text-muted-foreground">
            Crie a primeira para começar a montar seus slides.
          </p>
          <Button className="mt-4" onClick={nova} disabled={busy}>
            <Plus className="mr-2 h-4 w-4" /> Criar apresentação
          </Button>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => (
            <li
              key={it.id}
              className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <Link
                  to="/painel-apresentacoes/$id"
                  params={{ id: it.id }}
                  className="font-semibold hover:underline"
                >
                  {it.titulo}
                </Link>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {it.visibilidade}
                </span>
              </div>
              {it.descricao ? (
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{it.descricao}</p>
              ) : null}
              <p className="mt-2 text-[11px] text-muted-foreground">
                Atualizada em {new Date(it.updated_at).toLocaleString("pt-BR")}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link to="/painel-apresentacoes/$id" params={{ id: it.id }}>
                    <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
                  </Link>
                </Button>
                <Button asChild size="sm">
                  <a href={`/apresentar/${it.id}`} target="_blank" rel="noreferrer">
                    <Play className="mr-1 h-3.5 w-3.5" /> Apresentar
                  </a>
                </Button>
                <Button size="sm" variant="ghost" onClick={() => duplicar(it.id)}>
                  <Copy className="mr-1 h-3.5 w-3.5" /> Duplicar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => excluir(it.id, it.titulo)}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Excluir
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </RolePainelShell>
  );
}
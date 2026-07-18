import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Plus, Trash2, Power, PowerOff, Pencil, Loader2, X, BarChart3, Vote } from "lucide-react";
import { toast } from "sonner";
import {
  listEnquetesAdmin,
  upsertEnquete,
  toggleEnqueteAtivo,
  deleteEnquete,
  getEnqueteAdmin,
  type Enquete,
} from "@/lib/enquetes.functions";
import { PainelLayout } from "@/components/PainelLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/painel-enquetes")({
  ssr: false,
  head: () => ({ meta: [{ title: "Enquetes | Painel" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: PainelEnquetes,
});

type FormState = {
  id?: string;
  titulo: string;
  descricao: string;
  tipo: "unica" | "multipla";
  publico: "todos" | "autenticados" | "staff";
  permite_anonimo: boolean;
  mostrar_resultados_antes: boolean;
  ativo: boolean;
  encerra_em: string;
  opcoes: string[];
};

const emptyForm: FormState = {
  titulo: "",
  descricao: "",
  tipo: "unica",
  publico: "todos",
  permite_anonimo: true,
  mostrar_resultados_antes: false,
  ativo: true,
  encerra_em: "",
  opcoes: ["", ""],
};

function PainelEnquetes() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const { data: enquetes = [], isLoading } = useQuery({
    queryKey: ["enquetes-admin"],
    queryFn: () => listEnquetesAdmin(),
  });

  const salvar = useMutation({
    mutationFn: () =>
      upsertEnquete({
        data: {
          id: form.id,
          titulo: form.titulo,
          descricao: form.descricao || null,
          tipo: form.tipo,
          publico: form.publico,
          permite_anonimo: form.permite_anonimo,
          mostrar_resultados_antes: form.mostrar_resultados_antes,
          ativo: form.ativo,
          encerra_em: form.encerra_em ? new Date(form.encerra_em).toISOString() : null,
          opcoes: form.opcoes.map((o) => o.trim()).filter(Boolean),
        },
      }),
    onSuccess: () => {
      toast.success(form.id ? "Enquete atualizada" : "Enquete criada");
      qc.invalidateQueries({ queryKey: ["enquetes-admin"] });
      setOpen(false);
      setForm(emptyForm);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: (v: { id: string; ativo: boolean }) => toggleEnqueteAtivo({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["enquetes-admin"] }),
  });

  const excluir = useMutation({
    mutationFn: (id: string) => deleteEnquete({ data: { id } }),
    onSuccess: () => {
      toast.success("Enquete removida");
      qc.invalidateQueries({ queryKey: ["enquetes-admin"] });
    },
  });

  async function openEdit(e: Enquete) {
    const { enquete, opcoes } = await getEnqueteAdmin({ data: { id: e.id } });
    if (!enquete) return;
    setForm({
      id: enquete.id,
      titulo: enquete.titulo,
      descricao: enquete.descricao ?? "",
      tipo: enquete.tipo,
      publico: enquete.publico,
      permite_anonimo: enquete.permite_anonimo,
      mostrar_resultados_antes: enquete.mostrar_resultados_antes,
      ativo: enquete.ativo,
      encerra_em: enquete.encerra_em ? enquete.encerra_em.slice(0, 16) : "",
      opcoes: opcoes.length > 0 ? opcoes.map((o) => o.texto) : ["", ""],
    });
    setOpen(true);
  }

  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    if (form.titulo.trim().length < 3) return toast.error("Título é obrigatório");
    if (form.opcoes.filter((o) => o.trim()).length < 2)
      return toast.error("Adicione ao menos 2 opções");
    salvar.mutate();
  };

  return (
    <PainelLayout>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Vote className="h-7 w-7" /> Enquetes & Pesquisas
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Crie enquetes com resultados em tempo real
            </p>
          </div>
          <Button
            onClick={() => {
              setForm(emptyForm);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" /> Nova enquete
          </Button>
        </header>

        {isLoading ? (
          <div className="text-center py-16">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
          </div>
        ) : enquetes.length === 0 ? (
          <div className="text-center py-16 border rounded-xl bg-muted/30">
            <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Nenhuma enquete criada ainda.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {enquetes.map((e) => {
              const encerrada = e.encerra_em && new Date(e.encerra_em) < new Date();
              return (
                <div key={e.id} className="flex items-center gap-3 p-4 rounded-lg border bg-card">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{e.titulo}</div>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      <Badge variant={e.ativo ? "default" : "outline"}>
                        {e.ativo ? "Ativa" : "Inativa"}
                      </Badge>
                      <Badge variant="secondary">{e.tipo === "unica" ? "Única" : "Múltipla"}</Badge>
                      {encerrada && <Badge variant="destructive">Encerrada</Badge>}
                      <Badge variant="outline">{e.publico}</Badge>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggle.mutate({ id: e.id, ativo: !e.ativo })}
                    title={e.ativo ? "Desativar" : "Ativar"}
                  >
                    {e.ativo ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(e)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (confirm("Excluir esta enquete e todos os votos?")) excluir.mutate(e.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar enquete" : "Nova enquete"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input
                value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                required
                maxLength={240}
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                maxLength={2000}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo</Label>
                <Select
                  value={form.tipo}
                  onValueChange={(v: "unica" | "multipla") => setForm({ ...form, tipo: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unica">Escolha única</SelectItem>
                    <SelectItem value="multipla">Múltipla escolha</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Quem pode responder</Label>
                <Select
                  value={form.publico}
                  onValueChange={(v: "todos" | "autenticados" | "staff") =>
                    setForm({ ...form, publico: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos (público)</SelectItem>
                    <SelectItem value="autenticados">Somente autenticados</SelectItem>
                    <SelectItem value="staff">Apenas equipe</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Encerra em (opcional)</Label>
              <Input
                type="datetime-local"
                value={form.encerra_em}
                onChange={(e) => setForm({ ...form, encerra_em: e.target.value })}
              />
            </div>
            <div className="space-y-3 p-3 rounded-lg bg-muted/30 border">
              <div className="flex items-center justify-between">
                <Label htmlFor="ativo">Enquete ativa</Label>
                <Switch
                  id="ativo"
                  checked={form.ativo}
                  onCheckedChange={(v) => setForm({ ...form, ativo: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="anon">Permitir voto anônimo (sem login)</Label>
                <Switch
                  id="anon"
                  checked={form.permite_anonimo}
                  onCheckedChange={(v) => setForm({ ...form, permite_anonimo: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="pre">Mostrar resultados antes de votar</Label>
                <Switch
                  id="pre"
                  checked={form.mostrar_resultados_antes}
                  onCheckedChange={(v) => setForm({ ...form, mostrar_resultados_antes: v })}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Opções * (mínimo 2)</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setForm({ ...form, opcoes: [...form.opcoes, ""] })}
                  disabled={form.opcoes.length >= 20}
                >
                  <Plus className="h-3 w-3 mr-1" /> Adicionar
                </Button>
              </div>
              <div className="space-y-2">
                {form.opcoes.map((o, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input
                      value={o}
                      onChange={(e) => {
                        const next = [...form.opcoes];
                        next[idx] = e.target.value;
                        setForm({ ...form, opcoes: next });
                      }}
                      placeholder={`Opção ${idx + 1}`}
                      maxLength={240}
                    />
                    {form.opcoes.length > 2 && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          const next = form.opcoes.filter((_, i) => i !== idx);
                          setForm({ ...form, opcoes: next });
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={salvar.isPending}>
                {salvar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {form.id ? "Salvar alterações" : "Criar enquete"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </PainelLayout>
  );
}

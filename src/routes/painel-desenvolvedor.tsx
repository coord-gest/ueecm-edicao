import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  Code2,
  Loader2,
  Plus,
  Save,
  Trash2,
  GripVertical,
  Sparkles,
  Heart,
  NotebookPen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";

import { PainelLayout } from "@/components/PainelLayout";
import { ApkManagerCard } from "@/components/ApkManagerCard";

type ProfileForm = {
  nome: string;
  cargo: string;
  instituicao: string;
  descricao: string;
  localizacao: string;
  contato: string;
  fallback_message: string;
};

type FaqRow = {
  id: string;
  question: string;
  answer: string;
  sort_order: number;
};

export const Route = createFileRoute("/painel-desenvolvedor")({
  ssr: false,
  head: () => ({
    meta: [{ title: "FAQ do Desenvolvedor | Painel" }],
  }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: PainelDesenvolvedor,
});

function PainelDesenvolvedor() {
  const { user, loading, isDeveloper } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [profile, setProfile] = useState<ProfileForm | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingFaq, setSavingFaq] = useState<string | null>(null);
  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    if (!isDeveloper) {
      toast.error("Acesso restrito ao desenvolvedor");
      navigate({ to: "/painel" });
    }
  }, [user, loading, isDeveloper, navigate]);

  if (!loading && user && !isDeveloper) {
    return (
      <PainelLayout>
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="text-xl font-semibold">Acesso restrito</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Esta área é exclusiva do papel <strong>desenvolvedor</strong>.
          </p>
        </div>
      </PainelLayout>
    );
  }

  const { data: profileData, isLoading: loadingProfile } = useQuery({
    queryKey: ["developer_profile"],
    queryFn: async () => {
      const { data, error } = await supabase.from("developer_profile").select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: faqList, isLoading: loadingFaq } = useQuery({
    queryKey: ["developer_faq"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("developer_faq")
        .select("id, question, answer, sort_order")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as FaqRow[];
    },
  });

  useEffect(() => {
    if (profileData && !profile) {
      setProfile({
        nome: profileData.nome,
        cargo: profileData.cargo,
        instituicao: profileData.instituicao,
        descricao: profileData.descricao,
        localizacao: profileData.localizacao,
        contato: profileData.contato,
        fallback_message: profileData.fallback_message,
      });
    }
  }, [profileData, profile]);

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile || !profileData) return;
    setSavingProfile(true);
    const { error } = await supabase
      .from("developer_profile")
      .update(profile)
      .eq("id", profileData.id);
    setSavingProfile(false);
    if (error) {
      toast.error("Erro ao salvar perfil", { description: error.message });
      return;
    }
    toast.success("Perfil do desenvolvedor atualizado");
    qc.invalidateQueries({ queryKey: ["developer_profile"] });
  };

  const handleCreateFaq = async (e: FormEvent) => {
    e.preventDefault();
    if (!newQuestion.trim() || !newAnswer.trim()) return;
    setCreating(true);
    const nextOrder = (faqList?.length ?? 0) + 1;
    const { error } = await supabase.from("developer_faq").insert({
      question: newQuestion.trim(),
      answer: newAnswer.trim(),
      sort_order: nextOrder,
    });
    setCreating(false);
    if (error) {
      toast.error("Erro ao adicionar pergunta", { description: error.message });
      return;
    }
    setNewQuestion("");
    setNewAnswer("");
    toast.success("Pergunta adicionada ao FAQ");
    qc.invalidateQueries({ queryKey: ["developer_faq"] });
  };

  const handleUpdateFaq = async (row: FaqRow) => {
    setSavingFaq(row.id);
    const { error } = await supabase
      .from("developer_faq")
      .update({
        question: row.question,
        answer: row.answer,
        sort_order: row.sort_order,
      })
      .eq("id", row.id);
    setSavingFaq(null);
    if (error) {
      toast.error("Erro ao salvar pergunta", { description: error.message });
      return;
    }
    toast.success("Pergunta atualizada");
    qc.invalidateQueries({ queryKey: ["developer_faq"] });
  };

  const handleDeleteFaq = async (id: string) => {
    if (!confirm("Apagar esta pergunta do FAQ?")) return;
    const { error } = await supabase.from("developer_faq").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao apagar", { description: error.message });
      return;
    }
    toast.success("Pergunta removida");
    qc.invalidateQueries({ queryKey: ["developer_faq"] });
  };

  return (
    <PainelLayout>
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-4xl px-4 py-8">
          <div className="mb-6 flex items-center justify-between">
            <Button asChild variant="ghost" size="sm">
              <Link to="/painel">
                <ArrowLeft className="size-4" /> Painel
              </Link>
            </Button>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Code2 className="size-4" /> FAQ do Desenvolvedor
            </div>
          </div>

          <h1 className="mb-2 text-2xl font-bold">Informações do Desenvolvedor</h1>
          <p className="mb-8 text-sm text-muted-foreground">
            Edite estas informações para mudar como o chat responde sobre o desenvolvedor. As
            alterações são aplicadas imediatamente, sem precisar mexer no código.
          </p>

          <Link
            to="/painel-tema"
            className="mb-8 flex items-center gap-4 rounded-xl border border-primary/30 bg-primary/5 p-5 transition-colors hover:border-primary/60 hover:bg-primary/10"
          >
            <div className="flex size-11 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Sparkles className="size-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">Animações do tema</h3>
              <p className="text-sm text-muted-foreground">
                Ative efeitos sazonais (Festa Junina, Natal, 7 de Setembro, Dia do Professor...)
                para todos os visitantes.
              </p>
            </div>
          </Link>

          <Link
            to="/painel-patrocinadores"
            className="mb-8 flex items-center gap-4 rounded-xl border border-accent/30 bg-accent/5 p-5 transition-colors hover:border-accent/60 hover:bg-accent/10"
          >
            <div className="flex size-11 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <Heart className="size-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">Nossos Patrocinadores</h3>
              <p className="text-sm text-muted-foreground">
                Cadastre eventos (festas, aniversário da escola) e seus patrocinadores. Habilite um
                evento para exibir a seção na Home.
              </p>
            </div>
          </Link>

          <Link
            to="/painel-anotacoes"
            className="mb-8 flex items-center gap-4 rounded-xl border border-primary/30 bg-primary/5 p-5 transition-colors hover:border-primary/60 hover:bg-primary/10"
          >
            <div className="flex size-11 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <NotebookPen className="size-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">Anotações & Lembretes</h3>
              <p className="text-sm text-muted-foreground">
                Guarde anotações rápidas e crie lembretes agendados que te avisam por push no
                horário exato.
              </p>
            </div>
          </Link>

          <section className="mb-10 rounded-xl border bg-card p-6">
            <h2 className="mb-4 text-lg font-semibold">Perfil</h2>
            {loadingProfile || !profile ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="nome">Nome</Label>
                    <Input
                      id="nome"
                      value={profile.nome}
                      onChange={(e) => setProfile({ ...profile, nome: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="cargo">Cargo</Label>
                    <Input
                      id="cargo"
                      value={profile.cargo}
                      onChange={(e) => setProfile({ ...profile, cargo: e.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="instituicao">Instituição</Label>
                    <Input
                      id="instituicao"
                      value={profile.instituicao}
                      onChange={(e) => setProfile({ ...profile, instituicao: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="localizacao">Localização</Label>
                    <Input
                      id="localizacao"
                      value={profile.localizacao}
                      onChange={(e) => setProfile({ ...profile, localizacao: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="contato">Contato</Label>
                    <Input
                      id="contato"
                      value={profile.contato}
                      onChange={(e) => setProfile({ ...profile, contato: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="descricao">Descrição curta</Label>
                  <Textarea
                    id="descricao"
                    rows={3}
                    value={profile.descricao}
                    onChange={(e) => setProfile({ ...profile, descricao: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="fallback">Mensagem de fallback do chat</Label>
                  <Textarea
                    id="fallback"
                    rows={3}
                    value={profile.fallback_message}
                    onChange={(e) => setProfile({ ...profile, fallback_message: e.target.value })}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Frase usada quando o usuário perguntar algo fora do FAQ.
                  </p>
                </div>
                <Button type="submit" disabled={savingProfile}>
                  {savingProfile ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  Salvar perfil
                </Button>
              </form>
            )}
          </section>

          <section className="rounded-xl border bg-card p-6">
            <h2 className="mb-4 text-lg font-semibold">Perguntas do FAQ</h2>

            <form
              onSubmit={handleCreateFaq}
              className="mb-6 space-y-3 rounded-lg border border-dashed p-4"
            >
              <div>
                <Label htmlFor="new-q">Nova pergunta</Label>
                <Input
                  id="new-q"
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  placeholder="Ex: Trabalha com mobile?"
                />
              </div>
              <div>
                <Label htmlFor="new-a">Resposta</Label>
                <Textarea
                  id="new-a"
                  rows={2}
                  value={newAnswer}
                  onChange={(e) => setNewAnswer(e.target.value)}
                  placeholder="Resposta que o chat deve dar."
                />
              </div>
              <Button type="submit" disabled={creating} size="sm">
                {creating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                Adicionar pergunta
              </Button>
            </form>

            {loadingFaq ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : (
              <div className="space-y-4">
                {(faqList ?? []).map((row, idx) => (
                  <FaqItemEditor
                    key={row.id}
                    row={row}
                    index={idx}
                    saving={savingFaq === row.id}
                    onSave={handleUpdateFaq}
                    onDelete={handleDeleteFaq}
                  />
                ))}
                {(faqList ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma pergunta cadastrada. Adicione a primeira acima.
                  </p>
                )}
              </div>
            )}
          </section>

          <ApkManagerCard />
        </div>
      </div>
    </PainelLayout>
  );
}

function FaqItemEditor({
  row,
  index,
  saving,
  onSave,
  onDelete,
}: {
  row: FaqRow;
  index: number;
  saving: boolean;
  onSave: (row: FaqRow) => void;
  onDelete: (id: string) => void;
}) {
  const [local, setLocal] = useState(row);
  useEffect(() => setLocal(row), [row]);

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <GripVertical className="size-4" /> #{index + 1}
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => onSave(local)} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Salvar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onDelete(row.id)}
            className="text-destructive"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        <Input
          value={local.question}
          onChange={(e) => setLocal({ ...local, question: e.target.value })}
          placeholder="Pergunta"
        />
        <Textarea
          rows={2}
          value={local.answer}
          onChange={(e) => setLocal({ ...local, answer: e.target.value })}
          placeholder="Resposta"
        />
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Ordem</Label>
          <Input
            type="number"
            className="w-24"
            value={local.sort_order}
            onChange={(e) => setLocal({ ...local, sort_order: Number(e.target.value) || 0 })}
          />
        </div>
      </div>
    </div>
  );
}

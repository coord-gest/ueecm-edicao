import { createFileRoute, redirect } from "@tanstack/react-router";
import {
  FileText,
  Star,
  Sparkles,
  LayoutDashboard,
  StickyNote,
  Image as ImageIcon,
  PenSquare,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { useRolePainelGuard } from "@/lib/use-role-guard";
import { RolePainelShell, ShortcutSection } from "@/components/RolePainelShell";
import { RolesFallback } from "@/components/RolesFallback";

export const Route = createFileRoute("/painel-social-media")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Painel Social Media | U.E. - Evaristo Campelo de Matos" }],
  }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: PainelSocialMedia,
});

function PainelSocialMedia() {
  useRolePainelGuard([
    "social_media",
    "desenvolvedor",
    "admin",
    "diretor",
    "coordenador",
  ]);
  const { roles, loading } = useAuth();

  if (!loading && roles.length === 0) {
    return (
      <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <RolesFallback />
      </main>
    );
  }

  return (
    <RolePainelShell
      title="Painel Social Media"
      subtitle="Crie conteúdo, publicações e imagens — envie para aprovação da Coordenação."
    >
      <ShortcutSection
        title="Publicações"
        description="Escreva posts e envie para análise da Coordenação antes da publicação."
        icon={<FileText className="size-5 text-primary" />}
        items={[
          {
            label: "Nova publicação",
            to: "/painel-posts/novo",
            icon: <PenSquare className="size-4" />,
          },
          {
            label: "Minhas publicações",
            to: "/painel-posts",
            icon: <LayoutDashboard className="size-4" />,
          },
        ]}
      />

      <ShortcutSection
        title="Destaques da Home"
        description="Sugira quais posts devem aparecer em destaque na página inicial."
        icon={<Star className="size-5 text-primary" />}
        items={[
          {
            label: "Destaques da Home",
            to: "/painel-destaques",
            icon: <Star className="size-4" />,
          },
        ]}
      />

      <ShortcutSection
        title="Identidade visual"
        description="Animações e efeitos do tema visual do site."
        icon={<Sparkles className="size-5 text-primary" />}
        items={[
          {
            label: "Animações do Tema",
            to: "/painel-tema",
            icon: <Sparkles className="size-4" />,
          },
        ]}
      />

      <ShortcutSection
        title="Cards e Anotações"
        description="Crie cards visuais e anotações para divulgação."
        icon={<ImageIcon className="size-5 text-primary" />}
        items={[
          {
            label: "Cards e Anotações",
            to: "/painel-cards",
            icon: <ImageIcon className="size-4" />,
          },
          {
            label: "Anotações",
            to: "/painel-anotacoes",
            icon: <StickyNote className="size-4" />,
          },
        ]}
      />
    </RolePainelShell>
  );
}

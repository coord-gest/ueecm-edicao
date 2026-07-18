import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { PostEditor } from "@/components/PostEditor";
import { supabase } from "@/integrations/supabase/client";

import { PainelLayout } from "@/components/PainelLayout";

export const Route = createFileRoute("/painel-posts/novo")({
  ssr: false,
  head: () => ({ meta: [{ title: "Novo post | Painel" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: NovoPost,
});

function NovoPost() {
  const navigate = useNavigate();
  return (
    <PainelLayout>
      <PostEditor
        title="Novo post"
        onSaved={() => navigate({ to: "/painel-posts" })}
        onCancel={() => navigate({ to: "/painel-posts" })}
      />
    </PainelLayout>
  );
}

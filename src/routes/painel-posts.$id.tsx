import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { PostEditor } from "@/components/PostEditor";
import { supabase } from "@/integrations/supabase/client";

import { PainelLayout } from "@/components/PainelLayout";

export const Route = createFileRoute("/painel-posts/$id")({
  ssr: false,
  head: () => ({ meta: [{ title: "Editar post | Painel" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: EditarPost,
});

function EditarPost() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const { data: post, isLoading } = useQuery({
    queryKey: ["post", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("posts").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading || !post) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-secondary">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <PainelLayout>
      <PostEditor
        title="Editar post"
        post={post}
        onSaved={() => navigate({ to: "/painel-posts" })}
        onCancel={() => navigate({ to: "/painel-posts" })}
      />
    </PainelLayout>
  );
}

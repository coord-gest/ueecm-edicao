import { useQuery } from "@tanstack/react-query";
import { History, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { formatarDataHora } from "@/data/mock";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type AuditRow = {
  id: string;
  action: string;
  created_at: string;
  actor_email: string | null;
  before: { titulo?: string; status?: string } | null;
  after: { titulo?: string; status?: string } | null;
};

export function PostVersionHistory({ postId }: { postId: string }) {
  const { isStaff } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["audit", "posts", postId],
    enabled: isStaff,
    queryFn: async () => {
      const { data } = await supabase
        .from("audit_logs")
        .select("id, action, created_at, actor_email, before, after")
        .eq("table_name", "posts")
        .eq("record_id", postId)
        .order("created_at", { ascending: false })
        .limit(20);
      return (data ?? []) as AuditRow[];
    },
  });

  if (!isStaff) return null;

  return (
    <Collapsible className="rounded-2xl border border-border/70 bg-card p-4">
      <CollapsibleTrigger className="flex w-full items-center justify-between text-left">
        <span className="flex items-center gap-2 text-sm font-medium">
          <History className="size-4" /> Histórico de versões
        </span>
        <span className="text-xs text-muted-foreground">{data?.length ?? 0}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3 space-y-2 text-xs">
        {isLoading ? (
          <Loader2 className="mx-auto size-4 animate-spin text-muted-foreground" />
        ) : (data ?? []).length === 0 ? (
          <p className="text-muted-foreground">Sem alterações registradas.</p>
        ) : (
          (data ?? []).map((row) => {
            const beforeStatus = row.before?.status;
            const afterStatus = row.after?.status;
            return (
              <div key={row.id} className="rounded-lg border border-border/60 bg-background p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium uppercase">{row.action}</span>
                  <span className="text-muted-foreground">{formatarDataHora(row.created_at)}</span>
                </div>
                <p className="mt-1 text-muted-foreground">por {row.actor_email ?? "—"}</p>
                {beforeStatus && afterStatus && beforeStatus !== afterStatus && (
                  <p className="mt-0.5 text-muted-foreground">
                    status: <span className="font-mono">{beforeStatus}</span> →{" "}
                    <span className="font-mono">{afterStatus}</span>
                  </p>
                )}
              </div>
            );
          })
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

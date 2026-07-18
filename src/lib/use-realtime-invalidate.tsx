import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { uniqueRealtimeChannelName } from "@/lib/realtime-channel";

/**
 * Subscribe to postgres_changes on the given tables and invalidate the
 * matching React Query keys whenever something changes. Use this to keep
 * dropdowns / grids / pickers in sync with the academic panel in real time.
 */
export function useRealtimeInvalidate(
  channel: string,
  bindings: { table: string; queryKey: readonly unknown[] }[],
) {
  const qc = useQueryClient();
  useEffect(() => {
    let ch = supabase.channel(uniqueRealtimeChannelName(channel));
    bindings.forEach(({ table, queryKey }) => {
      ch = ch.on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "postgres_changes" as any,
        { event: "*", schema: "public", table },
        () => qc.invalidateQueries({ queryKey }),
      );
    });
    ch.subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel]);
}

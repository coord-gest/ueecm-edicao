/**
 * Teste manual de RLS no Realtime.
 *
 * Confirma que um cliente *anônimo* (sem login) NÃO recebe eventos de
 * postgres_changes em tabelas cujas policies de SELECT exigem auth/role.
 *
 * Tabelas testadas:
 *  - audit_logs  -> SELECT só para has_role(uid,'desenvolvedor')  => ZERO eventos esperados
 *  - user_roles  -> SELECT só para authenticated                  => ZERO eventos esperados
 *  - profiles    -> SELECT só para o próprio usuário/staff        => ZERO eventos esperados
 *
 * Como rodar:
 *   bun scripts/test-realtime-rls.ts
 *
 * Para gerar tráfego real durante o teste, abra o painel em outra aba e
 * faça uma ação que escreva nessas tabelas (ex.: aprovar/rejeitar um post
 * dispara audit_logs). O script aguarda 15s e falha se qualquer evento
 * chegar no cliente anônimo.
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL!;
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY env vars");
  process.exit(1);
}

const WAIT_MS = 15_000;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Hit = { table: string; event: string; payload: unknown };
const hits: Hit[] = [];

const tables = ["audit_logs", "user_roles", "profiles"] as const;

const channel = supabase.channel("rls-leak-test");
for (const table of tables) {
  channel.on(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    "postgres_changes" as any,
    { event: "*", schema: "public", table },
    (payload) => {
      hits.push({ table, event: payload.eventType, payload });
      console.error(`❌ LEAK: recebeu evento ${payload.eventType} em ${table}`);
    },
  );
}

await new Promise<void>((resolve, reject) => {
  channel.subscribe((status, err) => {
    console.log("channel status:", status);
    if (status === "SUBSCRIBED") resolve();
    if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") reject(err ?? new Error(status));
  });
});

console.log(
  `Inscrito como anônimo em ${tables.join(", ")}. Aguardando ${WAIT_MS / 1000}s por eventos...`,
);
console.log("Dica: enquanto isso, dispare INSERT/UPDATE/DELETE nessas tabelas via painel logado.");

await new Promise((r) => setTimeout(r, WAIT_MS));

await supabase.removeChannel(channel);

if (hits.length === 0) {
  console.log("✅ OK — nenhum evento vazou para o cliente anônimo.");
  process.exit(0);
} else {
  console.error(`❌ FAIL — ${hits.length} evento(s) vazaram:`);
  for (const h of hits) console.error(" -", h.table, h.event);
  process.exit(1);
}

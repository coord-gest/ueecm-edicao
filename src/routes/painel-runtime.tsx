import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { MetricsPanel } from "@/components/painel-runtime/MetricsPanel";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Copy,
  Send,
  Loader2,
  ShieldAlert,
  Trash2,
  Stethoscope,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { getCurrentUserRoles } from "@/lib/auth.functions";
import { roleLabels } from "@/lib/roles";
import { primaryRole, painelPathForRoles } from "@/lib/role-panels";
import { checkRuntimeEnv } from "@/lib/runtime-check.functions";
import { triggerPushDispatch } from "@/lib/push-dispatch.functions";
import {
  getFcmTokenStats,
  listFcmDiagnostics,
  listPushDispatchLogs,
  clearFcmHistory,
} from "@/lib/fcm-diagnostics.functions";

import { PainelLayout } from "@/components/PainelLayout";

export const Route = createFileRoute("/painel-runtime")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Runtime & Secrets | Painel" }],
  }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: PainelRuntime,
});

const SECRETS_DOC: Array<{
  name: string;
  required: boolean;
  example: string;
  where: string;
}> = [
  {
    name: "SUPABASE_URL",
    required: true,
    example: "https://xxxx.supabase.co",
    where: "Supabase → Project Settings → API → Project URL",
  },
  {
    name: "SUPABASE_PUBLISHABLE_KEY",
    required: true,
    example: "eyJhbGciOi…  (anon / publishable)",
    where: "Supabase → Project Settings → API → anon public",
  },
  {
    name: "SUPABASE_SERVICE_ROLE_KEY",
    required: true,
    example: "eyJhbGciOi…  (service_role — NUNCA no front)",
    where: "Supabase → Project Settings → API → service_role",
  },
  {
    name: "FIREBASE_PROJECT_ID",
    required: true,
    example: "ueecm-d7290",
    where: "Firebase Console → Project settings → General",
  },
  {
    name: "FIREBASE_CLIENT_EMAIL",
    required: true,
    example: "firebase-adminsdk-xxxx@<project>.iam.gserviceaccount.com",
    where: "Firebase Console → Service accounts → Generate new private key (JSON)",
  },
  {
    name: "FIREBASE_PRIVATE_KEY",
    required: true,
    example: "-----BEGIN PRIVATE KEY-----\\n…\\n-----END PRIVATE KEY-----\\n",
    where: "Mesmo JSON do service account (campo private_key)",
  },
  {
    name: "FIREBASE_VAPID_PUBLIC_KEY",
    required: true,
    example: "BOK…  (Web Push certificate key pair)",
    where: "Firebase Console → Cloud Messaging → Web configuration",
  },
  {
    name: "FIREBASE_WEB_API_KEY",
    required: true,
    example: "AIzaSy…",
    where: "Firebase Console → Project settings → General → Web app config",
  },
  {
    name: "DISPATCH_SECRET",
    required: true,
    example: "string aleatória 32+ chars",
    where: "Gerada automaticamente; protege /api/public/dispatch-push",
  },
  {
    name: "GEMINI_API_KEY",
    required: true,
    example: "AIzaSy…",
    where: "Google AI Studio → Get API key (usada no chat e embeddings do RAG).",
  },
];

type DispatchResult = {
  processed?: number;
  sent?: number;
  pruned?: number;
  errors?: string[];
  error?: string;
};

function PainelRuntime() {
  const { isDeveloper, user, roles, rolesError, refreshRoles } = useAuth();
  const checkFn = useServerFn(checkRuntimeEnv);
  const dispatchFn = useServerFn(triggerPushDispatch);
  const fcmStatsFn = useServerFn(getFcmTokenStats);
  const fcmDiagsFn = useServerFn(listFcmDiagnostics);
  const clearFn = useServerFn(clearFcmHistory);
  const fetchRoles = useServerFn(getCurrentUserRoles);

  const [session, setSession] = useState<{
    access_token_prefix?: string;
    expires_at?: number | null;
  }>({});
  const [serverRoles, setServerRoles] = useState<{
    status: "idle" | "loading" | "ok" | "error";
    roles?: string[];
    raw?: string;
    message?: string;
  }>({ status: "idle" });
  const [refreshingRoles, setRefreshingRoles] = useState(false);

  useEffect(() => {
    if (!isDeveloper) return;
    supabase.auth.getSession().then(({ data }) => {
      const tok = data.session?.access_token;
      setSession({
        access_token_prefix: tok ? `${tok.slice(0, 12)}…${tok.slice(-6)}` : undefined,
        expires_at: data.session?.expires_at ?? null,
      });
    });
  }, [isDeveloper]);

  const callServerRoles = async () => {
    setServerRoles({ status: "loading" });
    try {
      const result = await fetchRoles();
      const list: string[] = Array.isArray(result?.roles) ? result.roles : [];
      setServerRoles({ status: "ok", roles: list, raw: JSON.stringify(result, null, 2) });
    } catch (err) {
      setServerRoles({
        status: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const handleRefreshRoles = async () => {
    setRefreshingRoles(true);
    try {
      await refreshRoles();
      await callServerRoles();
    } finally {
      setRefreshingRoles(false);
    }
  };

  const envQuery = useQuery({
    queryKey: ["runtime-env-check"],
    queryFn: () => checkFn(),
    refetchOnWindowFocus: false,
  });

  const fcmStats = useQuery({
    queryKey: ["fcm-stats"],
    queryFn: () => fcmStatsFn(),
    refetchOnWindowFocus: false,
    enabled: false, // habilita depois do isDeveloper check
  });

  const fcmDiags = useQuery({
    queryKey: ["fcm-diags"],
    queryFn: () => fcmDiagsFn(),
    refetchOnWindowFocus: false,
    enabled: false,
  });

  const dispatchLogsFn = useServerFn(listPushDispatchLogs);
  const dispatchLogs = useQuery({
    queryKey: ["fcm-dispatch-logs"],
    queryFn: () => dispatchLogsFn(),
    refetchOnWindowFocus: false,
    enabled: false,
  });

  const clearMutation = useMutation<
    { ok: boolean; deleted: Record<string, number> },
    Error,
    { scope: "diagnostics" | "dispatch_logs" | "all"; olderThanDays?: number }
  >({
    mutationFn: async (input) =>
      (await clearFn({ data: input })) as { ok: boolean; deleted: Record<string, number> },
    onSuccess: (r) => {
      const total = Object.values(r.deleted).reduce((a, b) => a + b, 0);
      toast.success(`Histórico limpo — ${total} registro(s) removidos`, {
        description: Object.entries(r.deleted)
          .map(([k, v]) => `${k}: ${v}`)
          .join(" · "),
      });
      fcmDiags.refetch();
      fcmStats.refetch();
      dispatchLogs.refetch();
    },
    onError: (e) => toast.error("Falha ao limpar histórico", { description: e.message }),
  });

  const confirmAndClear = (
    scope: "diagnostics" | "dispatch_logs" | "all",
    label: string,
  ) => {
    if (typeof window === "undefined") return;
    const ok = window.confirm(
      `Tem certeza que deseja apagar ${label}? Esta ação é definitiva e apaga direto no banco de dados do Supabase.`,
    );
    if (!ok) return;
    clearMutation.mutate({ scope });
  };

  const dispatchMutation = useMutation<DispatchResult, Error, void>({
    // S2: agora usamos server fn autenticada em vez do endpoint público
    // /api/public/dispatch-push (que exige DISPATCH_SECRET). O painel não
    // conhece o secret — quem valida é o middleware + has_role('developer').
    mutationFn: async () => (await dispatchFn()) as DispatchResult,
    onSuccess: (r) => {
      if (r.error) toast.error("Dispatcher retornou erro", { description: r.error });
      else if ((r.sent ?? 0) > 0) toast.success(`Push enviado (${r.sent} destinatário(s))`);
      else if ((r.processed ?? 0) === 0) toast.info("Fila vazia — nada a enviar");
      else toast.warning("Fila drenada sem envios bem-sucedidos");
    },
    onError: (e) => toast.error("Falha ao chamar dispatcher", { description: e.message }),
  });

  const installProbe = useMutation<
    {
      step: string;
      status: number;
      ok: boolean;
      body: string;
      headers: Record<string, string>;
      config?: unknown;
      error?: string;
    },
    Error,
    void
  >({
    mutationFn: async () => {
      // 1) Puxa config pública igual o cliente faz
      const cfgRes = await fetch("/api/public/fcm-config", { cache: "no-store" });
      const cfgText = await cfgRes.text();
      if (!cfgRes.ok) {
        return {
          step: "fcm-config",
          status: cfgRes.status,
          ok: false,
          body: cfgText,
          headers: Object.fromEntries(cfgRes.headers.entries()),
          error: "Falha ao obter /api/public/fcm-config",
        };
      }
      const cfg = JSON.parse(cfgText) as {
        apiKey: string;
        projectId: string;
        appId: string;
      };

      // 2) Chama Firebase Installations diretamente (mesmo endpoint que o SDK usa
      //    internamente antes de emitir o token FCM). Se der 403/400 aqui, a causa
      //    é restrição de API key / API desativada / appId inválido.
      const url = `https://firebaseinstallations.googleapis.com/v1/projects/${cfg.projectId}/installations`;
      const fid = crypto.randomUUID().replace(/-/g, "").slice(0, 22);
      const payload = {
        fid,
        authVersion: "FIS_v2",
        appId: cfg.appId,
        sdkVersion: "w:0.6.9",
      };
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": cfg.apiKey,
          "x-firebase-client": "fire-core/probe",
        },
        body: JSON.stringify(payload),
      });
      const body = await res.text();
      return {
        step: "firebase-installations",
        status: res.status,
        ok: res.ok,
        body,
        headers: Object.fromEntries(res.headers.entries()),
        config: {
          projectId: cfg.projectId,
          appId: cfg.appId,
          apiKeyPreview: cfg.apiKey.slice(0, 10) + "…",
        },
      };
    },
    onSuccess: (r) => {
      if (r.ok) toast.success(`Installations OK (${r.status})`);
      else toast.error(`Installations falhou (${r.status})`, { description: r.error ?? r.step });
    },
    onError: (e) => toast.error("Probe falhou", { description: e.message }),
  });

  const vapidProbe = useMutation<
    {
      ok: boolean;
      vapidPreview: string;
      decodedBytes: number;
      firstByteHex: string;
      formatOk: boolean;
      subscribeOk: boolean;
      subscribeError?: string;
      endpoint?: string;
      notes: string[];
    },
    Error,
    void
  >({
    mutationFn: async () => {
      const notes: string[] = [];
      // 1) Puxa a VAPID atual (mesmo endpoint que o cliente usa)
      const cfgRes = await fetch("/api/public/fcm-config", { cache: "no-store" });
      if (!cfgRes.ok) throw new Error(`/api/public/fcm-config → ${cfgRes.status}`);
      const cfg = (await cfgRes.json()) as {
        vapidKey: string;
        apiKey: string;
        projectId: string;
        appId: string;
        messagingSenderId?: string;
        senderId?: string;
      };
      const vapid = cfg.vapidKey ?? "";
      const vapidPreview = vapid
        ? `${vapid.slice(0, 8)}…${vapid.slice(-4)} (len=${vapid.length})`
        : "(vazio)";

      // 2) Decodifica base64url → bytes e valida formato
      const b64 =
        vapid.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (vapid.length % 4)) % 4);
      let bytes: Uint8Array;
      try {
        const bin = atob(b64);
        bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      } catch {
        bytes = new Uint8Array();
        notes.push("VAPID não decodifica como base64url — chave corrompida.");
      }
      const firstByteHex = bytes.length ? `0x${bytes[0].toString(16).padStart(2, "0")}` : "n/a";
      const formatOk = bytes.length === 65 && bytes[0] === 0x04;
      if (!formatOk && bytes.length) {
        notes.push(
          `VAPID inválida: esperado 65 bytes começando com 0x04, recebido ${bytes.length} bytes começando com ${firstByteHex}. Gere um novo par em Firebase Console → Cloud Messaging → Web Push certificates e atualize FIREBASE_VAPID_PUBLIC_KEY.`,
        );
      }

      // 3) Tenta PushManager.subscribe direto (isola do SDK do Firebase)
      let subscribeOk = false;
      let subscribeError: string | undefined;
      let endpoint: string | undefined;
      try {
        if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
          throw new Error("PushManager/ServiceWorker indisponível neste browser");
        }
        if (Notification.permission !== "granted") {
          const p = await Notification.requestPermission();
          if (p !== "granted") throw new Error(`Permissão de notificação = ${p}`);
        }
        const senderId = cfg.messagingSenderId ?? cfg.senderId ?? "";
        const swQs = new URLSearchParams({
          apiKey: cfg.apiKey,
          projectId: cfg.projectId,
          appId: cfg.appId,
          senderId,
        }).toString();
        const reg =
          (await navigator.serviceWorker.getRegistration("/firebase-cloud-messaging-push-scope")) ??
          (await navigator.serviceWorker.getRegistration("/")) ??
          (await navigator.serviceWorker.register(`/firebase-messaging-sw.js?${swQs}`, {
            scope: "/",
          }));
        await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (existing) await existing.unsubscribe().catch(() => undefined);
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: bytes.buffer.slice(0) as ArrayBuffer,
        });
        endpoint = sub.endpoint;
        subscribeOk = true;
        await sub.unsubscribe().catch(() => undefined);
        notes.push(
          "PushManager.subscribe OK — VAPID é aceita pelo navegador. Se getToken ainda falha, o problema é IndexedDB do Firebase Installations no browser (modo anônimo / storage bloqueado).",
        );
      } catch (err) {
        subscribeError = err instanceof Error ? err.message : String(err);
        if (/InvalidAccessError|applicationServerKey/i.test(subscribeError)) {
          notes.push(
            "Navegador rejeitou a VAPID key — ela não é uma chave P-256 válida. Regere no Firebase Console.",
          );
        } else if (/permission/i.test(subscribeError)) {
          notes.push("Permissão de notificação negada — libere no cadeado do site.");
        }
      }

      return {
        ok: formatOk && subscribeOk,
        vapidPreview,
        decodedBytes: bytes.length,
        firstByteHex,
        formatOk,
        subscribeOk,
        subscribeError,
        endpoint,
        notes,
      };
    },
    onSuccess: (r) => {
      if (r.ok) toast.success("VAPID válida e aceita pelo navegador");
      else
        toast.error("Probe VAPID falhou", { description: r.subscribeError ?? "formato inválido" });
    },
    onError: (e) => toast.error("Probe VAPID falhou", { description: e.message }),
  });

  useEffect(() => {
    if (isDeveloper) {
      fcmStats.refetch();
      fcmDiags.refetch();
      dispatchLogs.refetch();
      callServerRoles();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDeveloper]);

  if (!isDeveloper) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-6">
          <ShieldAlert className="size-5 text-destructive" />
          <div>
            <h1 className="text-lg font-semibold">Acesso restrito</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Apenas o Desenvolvedor pode visualizar esta página.
            </p>
            <Link
              to="/painel"
              className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <ArrowLeft className="size-4" /> Voltar ao Painel
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`Copiado: ${text}`);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  return (
    <PainelLayout>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link
              to="/painel"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" /> Painel
            </Link>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Runtime & Secrets</h1>
            <p className="text-sm text-muted-foreground">
              Configuração de Supabase externo, diagnóstico de papéis e histórico do envio de Web
              Push.
            </p>
          </div>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => confirmAndClear("all", "TODO o histórico (diagnósticos + telemetria)")}
            disabled={clearMutation.isPending}
            className="shrink-0"
          >
            {clearMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
            Limpar todo o histórico
          </Button>
        </div>

        {/* Diagnóstico de papéis (integrado do antigo /painel-diagnostico) */}
        <section className="mt-6 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Stethoscope className="size-5 text-primary" />
              <h2 className="text-base font-semibold">Diagnóstico de papéis</h2>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleRefreshRoles}
              disabled={refreshingRoles}
            >
              <RefreshCw className={`size-3.5 ${refreshingRoles ? "animate-spin" : ""}`} />
              {refreshingRoles ? "Atualizando…" : "Recarregar"}
            </Button>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-border/70 bg-background/50 p-3">
              <p className="text-[11px] font-semibold uppercase text-muted-foreground">Sessão</p>
              <dl className="mt-2 space-y-1 text-xs">
                <div className="flex gap-2">
                  <dt className="w-28 shrink-0 text-muted-foreground">Usuário</dt>
                  <dd className="break-all font-medium">{user?.email ?? "-"}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-28 shrink-0 text-muted-foreground">User ID</dt>
                  <dd className="break-all font-mono">{user?.id ?? "-"}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-28 shrink-0 text-muted-foreground">Token</dt>
                  <dd className="break-all font-mono">
                    {session.access_token_prefix ?? "(nenhum)"}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-28 shrink-0 text-muted-foreground">Expira</dt>
                  <dd>
                    {session.expires_at
                      ? new Date(session.expires_at * 1000).toLocaleString("pt-BR")
                      : "—"}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-lg border border-border/70 bg-background/50 p-3">
              <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                Papéis (useAuth)
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {roles.length === 0 ? (
                  <span className="text-xs text-muted-foreground">Nenhum papel</span>
                ) : (
                  roles.map((r) => (
                    <Badge key={r} variant="secondary" className="text-[10px]">
                      {roleLabels[r]}
                    </Badge>
                  ))
                )}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Principal: <strong>{primaryRole(roles) ?? "(nenhum)"}</strong> — destino:{" "}
                <code className="font-mono">{painelPathForRoles(roles)}</code>
              </p>
              {rolesError && (
                <p className="mt-2 rounded border border-destructive/40 bg-destructive/10 p-2 text-[11px] text-destructive">
                  {rolesError}
                </p>
              )}
            </div>
          </div>

          <div className="mt-3">
            <p className="text-[11px] font-semibold uppercase text-muted-foreground">
              Resposta bruta do servidor
            </p>
            {serverRoles.status === "loading" && (
              <p className="mt-1 text-xs text-muted-foreground">Consultando…</p>
            )}
            {serverRoles.status === "ok" && (
              <>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(serverRoles.roles ?? []).length === 0 ? (
                    <span className="text-xs text-muted-foreground">Nenhum papel retornado</span>
                  ) : (
                    (serverRoles.roles ?? []).map((r) => (
                      <Badge key={r} variant="outline" className="text-[10px]">
                        {r}
                      </Badge>
                    ))
                  )}
                </div>
                <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted/60 p-2 text-[11px]">
                  {serverRoles.raw}
                </pre>
              </>
            )}
            {serverRoles.status === "error" && (
              <p className="mt-1 rounded border border-destructive/40 bg-destructive/10 p-2 text-[11px] text-destructive">
                {serverRoles.message}
              </p>
            )}
          </div>
        </section>

        {/* Status ao vivo */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">Status do runtime</h2>
            <Button
              size="sm"
              variant="outline"
              onClick={() => envQuery.refetch()}
              disabled={envQuery.isFetching}
            >
              {envQuery.isFetching ? <Loader2 className="size-3.5 animate-spin" /> : "Re-verificar"}
            </Button>
          </div>

          {envQuery.data ? (
            <ul className="mt-4 space-y-2">
              {envQuery.data.status.map((s) => (
                <li
                  key={s.name}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border/70 bg-background/50 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="font-mono text-sm">{s.name}</code>
                      {!s.critical && <Badge variant="secondary">opcional</Badge>}
                      {s.resolvedFrom && s.resolvedFrom !== s.name && (
                        <Badge variant="outline" className="text-[10px]">
                          via {s.resolvedFrom}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{s.purpose}</p>
                  </div>
                  {s.configured ? (
                    <CheckCircle2 className="size-5 text-emerald-500" />
                  ) : (
                    <XCircle
                      className={`size-5 ${s.critical ? "text-destructive" : "text-muted-foreground"}`}
                    />
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">Verificando…</p>
          )}
        </section>

        {/* Instruções */}
        <section className="mt-6 rounded-2xl border border-border bg-card p-5">
          <h2 className="text-base font-semibold">Como cadastrar os secrets</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>
              Abra <strong>Project Settings → Secrets</strong> no Lovable (não funciona o prefixo{" "}
              <code className="rounded bg-muted px-1">SUPABASE_</code> — é reservado; por isso
              usamos <code className="rounded bg-muted px-1">PROJECT_SUPABASE_*</code>e{" "}
              <code className="rounded bg-muted px-1">SERVICE_ROLE_KEY</code> com fallback no
              código).
            </li>
            <li>Adicione cada secret abaixo com o valor obtido no seu projeto Supabase externo.</li>
            <li>
              Volte aqui e clique em <em>Re-verificar</em>. Quando estiver tudo verde, use o botão{" "}
              <em>Testar envio de push</em> mais abaixo.
            </li>
            <li>
              Em caso de erro no envio, a aba <em>Diagnóstico</em> mostra exatamente em qual etapa
              falhou (env, auth, subs, dispatch).
            </li>
          </ol>

          <div className="mt-4 overflow-hidden rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Secret</th>
                  <th className="px-3 py-2">Onde obter</th>
                  <th className="px-3 py-2">Exemplo</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {SECRETS_DOC.map((s) => (
                  <tr key={s.name} className="border-t border-border/60">
                    <td className="px-3 py-2 align-top">
                      <code className="font-mono text-xs">{s.name}</code>
                      {!s.required && (
                        <Badge variant="secondary" className="ml-1">
                          opcional
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top text-xs text-muted-foreground">{s.where}</td>
                    <td className="px-3 py-2 align-top text-xs text-muted-foreground">
                      {s.example}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copy(s.name)}
                        title="Copiar nome do secret"
                      >
                        <Copy className="size-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Diagnóstico de push */}
        <section className="mt-6 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Drenar fila de push</h2>
              <p className="text-xs text-muted-foreground">
                Chama <code className="rounded bg-muted px-1">/api/public/dispatch-push</code> para
                processar a fila via FCM. Use após publicar novos alertas ou posts se algo não tiver
                disparado sozinho.
              </p>
            </div>
            <Button
              onClick={() => dispatchMutation.mutate()}
              disabled={dispatchMutation.isPending}
              size="sm"
            >
              {dispatchMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              Drenar fila agora
            </Button>
          </div>

          {dispatchMutation.data && (
            <div className="mt-4">
              <div className="flex items-center gap-2 text-sm">
                {dispatchMutation.data.error ? (
                  <>
                    <XCircle className="size-4 text-destructive" />
                    <span className="text-destructive">Erro no dispatcher</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-4 text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400">Fila drenada</span>
                  </>
                )}
              </div>
              <pre className="mt-3 overflow-x-auto rounded bg-muted/60 p-2 text-[11px] leading-snug text-foreground/80">
                {JSON.stringify(dispatchMutation.data, null, 2)}
              </pre>
            </div>
          )}

          {dispatchMutation.error && !dispatchMutation.data && (
            <p className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
              {dispatchMutation.error.message}
            </p>
          )}
        </section>

        {/* Probe direto no Firebase Installations */}
        <section className="mt-6 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Probe · Firebase Installations</h2>
              <p className="text-xs text-muted-foreground">
                Executa <code className="rounded bg-muted px-1">POST</code> em{" "}
                <code className="rounded bg-muted px-1">firebaseinstallations.googleapis.com</code>{" "}
                usando <em>apiKey/appId/projectId</em> reais devolvidos por{" "}
                <code className="rounded bg-muted px-1">/api/public/fcm-config</code>. Mostra status
                HTTP e corpo bruto — 403 = API key restrita/API desativada; 400 = appId inválido;
                200 = credenciais OK (falha está no VAPID/SW).
              </p>
            </div>
            <Button
              onClick={() => installProbe.mutate()}
              disabled={installProbe.isPending}
              size="sm"
              variant="outline"
            >
              {installProbe.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              Rodar probe
            </Button>
          </div>

          {installProbe.data && (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {installProbe.data.ok ? (
                  <CheckCircle2 className="size-4 text-emerald-500" />
                ) : (
                  <XCircle className="size-4 text-destructive" />
                )}
                <Badge variant={installProbe.data.ok ? "default" : "destructive"}>
                  HTTP {installProbe.data.status}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  etapa: <code>{installProbe.data.step}</code>
                </span>
              </div>

              {installProbe.data.config != null && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground">Config usada</div>
                  <pre className="mt-1 overflow-x-auto rounded bg-muted/60 p-2 text-[11px] leading-snug">
                    {JSON.stringify(installProbe.data.config, null, 2)}
                  </pre>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium text-muted-foreground">Response body</div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      void navigator.clipboard.writeText(installProbe.data!.body);
                      toast.success("Body copiado");
                    }}
                  >
                    <Copy className="size-3" /> copiar
                  </Button>
                </div>
                <pre className="mt-1 max-h-64 overflow-auto rounded bg-muted/60 p-2 text-[11px] leading-snug">
                  {installProbe.data.body || "(vazio)"}
                </pre>
              </div>

              <details>
                <summary className="cursor-pointer text-xs text-muted-foreground">
                  Response headers
                </summary>
                <pre className="mt-1 overflow-x-auto rounded bg-muted/60 p-2 text-[11px] leading-snug">
                  {JSON.stringify(installProbe.data.headers, null, 2)}
                </pre>
              </details>
            </div>
          )}

          {installProbe.error && !installProbe.data && (
            <p className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
              {installProbe.error.message}
            </p>
          )}
        </section>

        {/* Probe · VAPID key */}
        <section className="mt-6 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Probe · VAPID key</h2>
              <p className="text-xs text-muted-foreground">
                Valida <code className="rounded bg-muted px-1">FIREBASE_VAPID_PUBLIC_KEY</code> —
                formato P-256 (65 bytes / 0x04) e teste real de{" "}
                <code className="rounded bg-muted px-1">PushManager.subscribe</code> no browser. Se
                Installations = 200 e isso falha, a VAPID está desalinhada com o Web Push
                certificate do Firebase Console.
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => vapidProbe.mutate()}
              disabled={vapidProbe.isPending}
              className="shrink-0"
            >
              {vapidProbe.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Send className="mr-2 size-4" />
              )}
              Rodar probe VAPID
            </Button>
          </div>

          {vapidProbe.data && (
            <div className="mt-4 space-y-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                {vapidProbe.data.formatOk ? (
                  <CheckCircle2 className="size-4 text-emerald-500" />
                ) : (
                  <XCircle className="size-4 text-destructive" />
                )}
                <span>Formato:</span>
                <Badge variant={vapidProbe.data.formatOk ? "default" : "destructive"}>
                  {vapidProbe.data.decodedBytes} bytes · {vapidProbe.data.firstByteHex}
                </Badge>
                <span className="text-muted-foreground">{vapidProbe.data.vapidPreview}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {vapidProbe.data.subscribeOk ? (
                  <CheckCircle2 className="size-4 text-emerald-500" />
                ) : (
                  <XCircle className="size-4 text-destructive" />
                )}
                <span>PushManager.subscribe:</span>
                <Badge variant={vapidProbe.data.subscribeOk ? "default" : "destructive"}>
                  {vapidProbe.data.subscribeOk ? "OK" : "falhou"}
                </Badge>
              </div>
              {vapidProbe.data.subscribeError && (
                <pre className="overflow-x-auto rounded bg-muted/60 p-2 text-[11px] text-destructive">
                  {vapidProbe.data.subscribeError}
                </pre>
              )}
              {vapidProbe.data.endpoint && (
                <p className="break-all text-muted-foreground">
                  endpoint: {vapidProbe.data.endpoint}
                </p>
              )}
              {vapidProbe.data.notes.length > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                  {vapidProbe.data.notes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {vapidProbe.error && !vapidProbe.data && (
            <p className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
              {vapidProbe.error.message}
            </p>
          )}
        </section>

        {/* FCM Tokens & Diagnóstico */}
        <section className="mt-6 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">FCM · tokens e diagnósticos</h2>
              <p className="text-xs text-muted-foreground">
                Distribuição de tokens ativos por plataforma e últimas falhas de{" "}
                <code className="rounded bg-muted px-1">getToken()</code>.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                fcmStats.refetch();
                fcmDiags.refetch();
              }}
              disabled={fcmStats.isFetching || fcmDiags.isFetching}
            >
              {fcmStats.isFetching || fcmDiags.isFetching ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                "Atualizar"
              )}
            </Button>
          </div>

          {fcmStats.data && (
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-border/70 bg-background/50 p-3">
                <p className="text-[11px] uppercase text-muted-foreground">Tokens ativos</p>
                <p className="mt-1 text-2xl font-semibold">{fcmStats.data.tokens.total}</p>
                <p className="text-[11px] text-muted-foreground">
                  {fcmStats.data.tokens.withUser} logados
                </p>
              </div>
              {Object.entries(fcmStats.data.tokens.byPlatform).map(([plat, count]) => (
                <div key={plat} className="rounded-lg border border-border/70 bg-background/50 p-3">
                  <p className="text-[11px] uppercase text-muted-foreground">{plat}</p>
                  <p className="mt-1 text-2xl font-semibold">{count as number}</p>
                </div>
              ))}
              <div className="rounded-lg border border-border/70 bg-background/50 p-3">
                <p className="text-[11px] uppercase text-muted-foreground">Falhas 7d</p>
                <p className="mt-1 text-2xl font-semibold text-destructive">
                  {fcmStats.data.diagnostics7d.failures}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {fcmStats.data.diagnostics7d.successes} sucessos
                </p>
              </div>
            </div>
          )}

          {fcmStats.data && fcmStats.data.queue.length > 0 && (
            <div className="mt-4">
              <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                Últimos envios (fila)
              </p>
              <div className="overflow-hidden rounded-lg border border-border/70">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="px-2 py-1.5">Título</th>
                      <th className="px-2 py-1.5">Origem</th>
                      <th className="px-2 py-1.5">Status</th>
                      <th className="px-2 py-1.5">Quando</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(
                      fcmStats.data.queue as Array<{
                        id: string;
                        title: string;
                        source: string;
                        processed_at: string | null;
                        attempts: number;
                        created_at: string;
                      }>
                    ).map((q) => (
                      <tr key={q.id} className="border-t border-border/60">
                        <td className="px-2 py-1.5 max-w-[220px] truncate">{q.title}</td>
                        <td className="px-2 py-1.5">{q.source}</td>
                        <td className="px-2 py-1.5">
                          {q.processed_at ? (
                            <Badge variant="outline">enviado</Badge>
                          ) : (
                            <Badge variant="secondary">pendente</Badge>
                          )}
                          {q.attempts > 0 && (
                            <span className="ml-1 text-muted-foreground">×{q.attempts}</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-muted-foreground">
                          {new Date(q.created_at).toLocaleString("pt-BR")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {fcmDiags.data && fcmDiags.data.length > 0 && (
            <div className="mt-4">
              <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                Últimos diagnósticos ({fcmDiags.data.length})
              </p>
              <div className="max-h-[320px] overflow-auto rounded-lg border border-border/70">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-muted/60">
                    <tr>
                      <th className="px-2 py-1.5">Quando</th>
                      <th className="px-2 py-1.5">Fase</th>
                      <th className="px-2 py-1.5">OK</th>
                      <th className="px-2 py-1.5">Plataforma</th>
                      <th className="px-2 py-1.5">Contexto</th>
                      <th className="px-2 py-1.5">Erro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fcmDiags.data.map((d) => (
                      <tr key={d.id} className="border-t border-border/60 align-top">
                        <td className="px-2 py-1.5 whitespace-nowrap text-muted-foreground">
                          {new Date(d.created_at).toLocaleString("pt-BR")}
                        </td>
                        <td className="px-2 py-1.5">{d.phase}</td>
                        <td className="px-2 py-1.5">
                          {d.success ? (
                            <CheckCircle2 className="size-3.5 text-emerald-500" />
                          ) : (
                            <XCircle className="size-3.5 text-destructive" />
                          )}
                        </td>
                        <td className="px-2 py-1.5">{d.platform ?? "-"}</td>
                        <td className="px-2 py-1.5 text-[11px] text-muted-foreground">
                          {d.is_iframe && "iframe "}
                          {d.is_preview && "preview "}
                          {d.is_standalone && "PWA "}
                          {d.is_in_app_browser && "in-app "}
                          {d.indexeddb_ok === false && "no-idb "}
                        </td>
                        <td className="px-2 py-1.5 max-w-[280px]">
                          {d.error_code && (
                            <Badge variant="outline" className="mr-1 text-[10px]">
                              {d.error_code}
                            </Badge>
                          )}
                          <span className="text-[11px] text-muted-foreground break-words">
                            {d.error_message}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {(fcmStats.error || fcmDiags.error) && (
            <p className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
              {(fcmStats.error ?? fcmDiags.error)?.message}
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Telemetria de envios (FCM)</h2>
              <p className="text-xs text-muted-foreground">
                Cada execução do dispatcher (fila, testes, cron) grava um log com totais, duração e
                primeiro erro.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => dispatchLogs.refetch()}
              disabled={dispatchLogs.isFetching}
            >
              {dispatchLogs.isFetching ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : null}
              Atualizar
            </Button>
          </div>

          {dispatchLogs.data && dispatchLogs.data.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhum envio registrado ainda. Dispare um push de teste para gerar telemetria.
            </p>
          )}

          {dispatchLogs.data && dispatchLogs.data.length > 0 && (
            <div className="max-h-[360px] overflow-auto rounded-lg border border-border/70">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-muted/60">
                  <tr>
                    <th className="px-2 py-1.5">Quando</th>
                    <th className="px-2 py-1.5">Origem</th>
                    <th className="px-2 py-1.5">OK</th>
                    <th className="px-2 py-1.5">Fila</th>
                    <th className="px-2 py-1.5">Tokens</th>
                    <th className="px-2 py-1.5">Enviados</th>
                    <th className="px-2 py-1.5">Removidos</th>
                    <th className="px-2 py-1.5">Erros</th>
                    <th className="px-2 py-1.5">Duração</th>
                    <th className="px-2 py-1.5">1º erro</th>
                  </tr>
                </thead>
                <tbody>
                  {dispatchLogs.data.map((d: Record<string, unknown>) => (
                    <tr key={String(d.id)} className="border-t border-border/60 align-top">
                      <td className="px-2 py-1.5 whitespace-nowrap text-muted-foreground">
                        {new Date(String(d.created_at)).toLocaleString("pt-BR")}
                      </td>
                      <td className="px-2 py-1.5">{String(d.trigger_source ?? "-")}</td>
                      <td className="px-2 py-1.5">
                        {d.ok ? (
                          <CheckCircle2 className="size-3.5 text-emerald-500" />
                        ) : (
                          <XCircle className="size-3.5 text-destructive" />
                        )}
                      </td>
                      <td className="px-2 py-1.5">{Number(d.queue_processed ?? 0)}</td>
                      <td className="px-2 py-1.5">{Number(d.tokens_total ?? 0)}</td>
                      <td className="px-2 py-1.5 font-medium">{Number(d.sent ?? 0)}</td>
                      <td className="px-2 py-1.5">{Number(d.pruned ?? 0)}</td>
                      <td className="px-2 py-1.5">{Number(d.errors_count ?? 0)}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">
                        {Number(d.duration_ms ?? 0)} ms
                      </td>
                      <td className="px-2 py-1.5 max-w-[260px] text-[11px] text-muted-foreground break-words">
                        {d.error_sample ? String(d.error_sample) : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {dispatchLogs.error && (
            <p className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
              {dispatchLogs.error.message}
            </p>
          )}
        </section>

        <MetricsPanel />
      </div>
    </PainelLayout>
  );
}

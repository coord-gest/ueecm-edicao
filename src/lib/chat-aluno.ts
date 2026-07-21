import { supabase } from "@/integrations/supabase/client";

export type ChatModerationConfig = {
  janela_inicio: string; // "HH:MM"
  janela_fim: string; // "HH:MM"
  dias: number[]; // 0=Dom..6=Sáb
  max_msgs_dia: number;
  ativo: boolean;
  tz: string;
};

const DEFAULT_MODERATION: ChatModerationConfig = {
  janela_inicio: "18:00",
  janela_fim: "20:00",
  dias: [1, 2, 3, 4, 5],
  max_msgs_dia: 20,
  ativo: true,
  tz: "America/Sao_Paulo",
};

export async function getChatModeration(): Promise<ChatModerationConfig> {
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "chat_pai_professor_config")
    .maybeSingle();
  if (!data?.value) return DEFAULT_MODERATION;
  try {
    return { ...DEFAULT_MODERATION, ...(JSON.parse(data.value) as Partial<ChatModerationConfig>) };
  } catch {
    return DEFAULT_MODERATION;
  }
}

function nowInTz(tz: string): { hhmm: string; dow: number; ymd: string } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
  const dowMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    hhmm: `${parts.hour}:${parts.minute}`,
    dow: dowMap[parts.weekday] ?? 0,
    ymd: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

export function janelaChatAberta(cfg: ChatModerationConfig): {
  aberta: boolean;
  motivo?: string;
} {
  if (!cfg.ativo) return { aberta: true };
  const { hhmm, dow } = nowInTz(cfg.tz);
  if (!cfg.dias.includes(dow))
    return { aberta: false, motivo: `Chat disponível apenas em dias úteis.` };
  if (hhmm < cfg.janela_inicio || hhmm > cfg.janela_fim)
    return {
      aberta: false,
      motivo: `Chat aberto das ${cfg.janela_inicio} às ${cfg.janela_fim}.`,
    };
  return { aberta: true };
}

export type ChatThread = {
  id: string;
  aluno_id: string;
  responsavel_user_id: string;
  professor_user_id: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  created_at: string;
};

export type ChatMensagem = {
  id: string;
  thread_id: string;
  autor_user_id: string;
  autor_tipo: "responsavel" | "professor";
  conteudo: string;
  anexo_url: string | null;
  lida_em: string | null;
  created_at: string;
};

export type ThreadInfo = ChatThread & {
  aluno_nome: string;
  turma_nome: string | null;
  contraparte_nome: string;
  contraparte_papel: "responsavel" | "professor";
  nao_lidas: number;
};

/**
 * Abre (ou cria) a thread entre o usuário logado e a contraparte para um aluno.
 * - Se o usuário é responsável do aluno, a contraparte é o professor responsável da turma.
 * - Se o usuário é professor da turma do aluno, precisa informar o responsável (responsavel_user_id).
 */
export async function abrirOuCriarThread(params: {
  aluno_id: string;
  papel: "responsavel" | "professor";
  contraparte_user_id?: string;
}): Promise<string> {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) throw new Error("Sessão expirada.");

  let responsavel_user_id: string;
  let professor_user_id: string;

  if (params.papel === "responsavel") {
    responsavel_user_id = uid;
    if (params.contraparte_user_id) {
      professor_user_id = params.contraparte_user_id;
    } else {
      const { data: al, error } = await supabase
        .from("alunos")
        .select("turma_id, turmas_escolares:turma_id(professor_responsavel_id)")
        .eq("id", params.aluno_id)
        .maybeSingle();
      if (error) throw error;
      const prof = (al as { turmas_escolares?: { professor_responsavel_id?: string } } | null)
        ?.turmas_escolares?.professor_responsavel_id;
      if (!prof) throw new Error("Esta turma ainda não tem um professor responsável designado.");
      professor_user_id = prof;
    }
  } else {
    professor_user_id = uid;
    if (!params.contraparte_user_id)
      throw new Error("Selecione o responsável para iniciar a conversa.");
    responsavel_user_id = params.contraparte_user_id;
  }

  const { data: existing } = await supabase
    .from("chat_alunos_threads")
    .select("id")
    .eq("aluno_id", params.aluno_id)
    .eq("responsavel_user_id", responsavel_user_id)
    .eq("professor_user_id", professor_user_id)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data: novo, error } = await supabase
    .from("chat_alunos_threads")
    .insert({
      aluno_id: params.aluno_id,
      responsavel_user_id,
      professor_user_id,
    })
    .select("id")
    .single();
  if (error) throw error;
  return novo.id as string;
}

export async function listarMinhasThreads(): Promise<ThreadInfo[]> {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) return [];

  const { data: threads, error } = await supabase
    .from("chat_alunos_threads")
    .select("*")
    .or(`responsavel_user_id.eq.${uid},professor_user_id.eq.${uid}`)
    .order("last_message_at", { ascending: false, nullsFirst: false });
  if (error) throw error;
  const list = (threads ?? []) as ChatThread[];
  if (list.length === 0) return [];

  const alunoIds = Array.from(new Set(list.map((t) => t.aluno_id)));
  const contrapartes = Array.from(
    new Set(
      list.map((t) =>
        t.responsavel_user_id === uid ? t.professor_user_id : t.responsavel_user_id,
      ),
    ),
  );

  const [{ data: alunos }, { data: perfis }] = await Promise.all([
    supabase
      .from("alunos")
      .select("id, nome_completo, turmas_escolares:turma_id(nome)")
      .in("id", alunoIds),
    supabase.from("profiles").select("user_id, display_name, email").in("user_id", contrapartes),
  ]);

  const mapAluno = new Map(
    (
      (alunos ?? []) as Array<{
        id: string;
        nome_completo: string;
        turmas_escolares?: { nome?: string } | null;
      }>
    ).map((a) => [a.id, a]),
  );
  const mapPerfil = new Map(
    ((perfis ?? []) as Array<{ user_id: string; display_name?: string; email?: string }>).map(
      (p) => [p.user_id, p],
    ),
  );

  // Contagem não lidas (mensagens do outro sem lida_em)
  const naoLidasByThread = new Map<string, number>();
  for (const t of list) {
    const { count } = await supabase
      .from("chat_alunos_mensagens")
      .select("id", { count: "exact", head: true })
      .eq("thread_id", t.id)
      .neq("autor_user_id", uid)
      .is("lida_em", null);
    naoLidasByThread.set(t.id, count ?? 0);
  }

  return list.map((t) => {
    const meRole: "responsavel" | "professor" =
      t.responsavel_user_id === uid ? "responsavel" : "professor";
    const contraId = meRole === "responsavel" ? t.professor_user_id : t.responsavel_user_id;
    const perfil = mapPerfil.get(contraId);
    const al = mapAluno.get(t.aluno_id);
    return {
      ...t,
      aluno_nome: al?.nome_completo ?? "Aluno",
      turma_nome: al?.turmas_escolares?.nome ?? null,
      contraparte_nome:
        perfil?.display_name ||
        perfil?.email ||
        (meRole === "responsavel" ? "Professor" : "Responsável"),
      contraparte_papel: meRole === "responsavel" ? "professor" : "responsavel",
      nao_lidas: naoLidasByThread.get(t.id) ?? 0,
    } satisfies ThreadInfo;
  });
}

export async function enviarMensagem(params: {
  thread_id: string;
  conteudo: string;
  anexo_url?: string | null;
}) {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) throw new Error("Sessão expirada.");

  // Moderação: janela + limite diário
  const cfg = await getChatModeration();
  const janela = janelaChatAberta(cfg);
  if (!janela.aberta) throw new Error(janela.motivo ?? "Fora do horário permitido.");

  if (cfg.ativo && cfg.max_msgs_dia > 0) {
    const { ymd } = nowInTz(cfg.tz);
    const inicioDia = new Date(`${ymd}T00:00:00`);
    const { count } = await supabase
      .from("chat_alunos_mensagens")
      .select("id", { count: "exact", head: true })
      .eq("thread_id", params.thread_id)
      .eq("autor_user_id", uid)
      .gte("created_at", inicioDia.toISOString());
    if ((count ?? 0) >= cfg.max_msgs_dia) {
      throw new Error(
        `Limite diário de ${cfg.max_msgs_dia} mensagens atingido nesta conversa. Retome amanhã.`,
      );
    }
  }

  const { data: t, error: et } = await supabase
    .from("chat_alunos_threads")
    .select("responsavel_user_id, professor_user_id")
    .eq("id", params.thread_id)
    .maybeSingle();
  if (et) throw et;
  if (!t) throw new Error("Conversa não encontrada.");
  const autor_tipo: "responsavel" | "professor" =
    t.responsavel_user_id === uid ? "responsavel" : "professor";

  const { error } = await supabase.from("chat_alunos_mensagens").insert({
    thread_id: params.thread_id,
    autor_user_id: uid,
    autor_tipo,
    conteudo: params.conteudo.trim(),
    anexo_url: params.anexo_url ?? null,
  });
  if (error) throw error;
}

export async function marcarLidas(thread_id: string) {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) return;
  await supabase
    .from("chat_alunos_mensagens")
    .update({ lida_em: new Date().toISOString() })
    .eq("thread_id", thread_id)
    .neq("autor_user_id", uid)
    .is("lida_em", null);
}

export async function uploadAnexo(thread_id: string, file: File): Promise<string> {
  if (file.size > 10 * 1024 * 1024) throw new Error("Anexo deve ter no máximo 10 MB.");
  const ext = file.name.split(".").pop() || "bin";
  const path = `${thread_id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("chat-alunos-anexos").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function getAnexoUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from("chat-alunos-anexos").createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

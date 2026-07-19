import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SEED_ALUNOS, SEED_RESPONSAVEIS, SEED_FAMILY_USER_VINCULOS } from "@/lib/seed-alunos-data";
import {
  SEED_COMUNICADOS,
  SEED_ENQUETES,
  SEED_AUTORIZACOES,
  SEED_ALERTAS,
  SEED_AGENDAMENTOS,
  SEED_MENSAGENS_COORD,
  SEED_DEPOIMENTOS,
  SEED_COMENTARIOS,
  SEED_REMINDERS,
  SEED_JUSTIFICATIVAS,
  SEED_DESTAQUES,
} from "@/lib/seed-conteudo-data";
import {
  SEED_USER_EMAIL_PATTERN,
  SEED_MATRICULA_PREFIX,
  SEED_RESP_EMAIL_PATTERN,
  SEED_TURMA_ESCOLAR_TAG,
  SEED_COMUNICADO_TAG,
  SEED_ALERT_TAG,
  SEED_ENQUETE_TAG,
  SEED_AUTORIZACAO_TAG,
  SEED_AGENDAMENTO_TAG,
  SEED_MSG_TAG,
  SEED_DEPOIMENTO_TAG,
  SEED_COMENTARIO_TAG,
  SEED_REMINDER_TAG,
  SEED_DESTAQUE_MOTIVO_TAG,
} from "@/lib/seed-markers";

/* ------------------------------ Helpers ---------------------------------- */

async function getAdmin() {
  const mod = await import("@/integrations/supabase/client.server");
  return mod.supabaseAdmin;
}

type Admin = Awaited<ReturnType<typeof getAdmin>>;

async function assertDeveloper(userId: string, admin: Admin) {
  const { data, error } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "desenvolvedor")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Apenas o Desenvolvedor pode executar este seed.");
}

/** Resolve todos os ids das entidades seed (usuários, turmas, alunos, disciplinas). */
async function loadContext(admin: Admin) {
  const [users, turmasE, turmasSeed, alunos, discs, resps, posts] = await Promise.all([
    admin.from("profiles").select("user_id, email, display_name").like("email", SEED_USER_EMAIL_PATTERN),
    admin.from("turmas_escolares").select("id, nome, observacoes").ilike("observacoes", `%${SEED_TURMA_ESCOLAR_TAG}%`),
    admin.from("turmas").select("id, nome, slug").like("slug", "seed-%"),
    admin.from("alunos").select("id, matricula, turma_id").like("matricula", `${SEED_MATRICULA_PREFIX}%`),
    admin.from("disciplinas").select("id, nome, slug").like("slug", "seed-%"),
    admin.from("responsaveis").select("id, email, user_id").or(`email.like.${SEED_RESP_EMAIL_PATTERN},email.like.${SEED_USER_EMAIL_PATTERN}`),
    admin.from("posts").select("id, titulo").like("autor", "Seed Demo%").limit(20),
  ]);
  return {
    users: users.data ?? [],
    turmasEscolares: turmasE.data ?? [],
    turmasSeed: turmasSeed.data ?? [],
    alunos: alunos.data ?? [],
    disciplinas: discs.data ?? [],
    responsaveis: resps.data ?? [],
    posts: posts.data ?? [],
  };
}

function pickUserByEmailPrefix(users: Array<{ user_id: string; email: string | null }>, prefix: string) {
  const u = users.find((x) => (x.email ?? "").toLowerCase().startsWith(prefix.toLowerCase()));
  return u?.user_id ?? null;
}

/* ------------------------------ 1. Alunos -------------------------------- */

/** Cria (ou reusa) `turmas_escolares` marcadas [SEED] espelhando `turmas` seed. */
async function ensureTurmasEscolares(admin: Admin) {
  const { data: turmasSeed } = await admin.from("turmas").select("id, nome, slug").like("slug", "seed-%");
  if (!turmasSeed || turmasSeed.length === 0) {
    throw new Error("Gere antes: Turmas + Disciplinas (aba Estrutura).");
  }
  const nomes = turmasSeed.map((t) => t.nome);
  const { data: existentes } = await admin
    .from("turmas_escolares")
    .select("id, nome, observacoes")
    .ilike("observacoes", `%${SEED_TURMA_ESCOLAR_TAG}%`);
  const existentesByNome = new Map((existentes ?? []).map((t) => [t.nome, t.id] as const));

  const anoLetivo = new Date().getFullYear();
  const faltando = nomes.filter((n) => !existentesByNome.has(n));
  if (faltando.length > 0) {
    const rows = faltando.map((nome) => {
      const inferAno = /(\d+)/.exec(nome)?.[1] ?? "6";
      const turno = /1ª|2ª|3ª/.test(nome) ? "manha" : "manha";
      return {
        nome,
        ano_serie: `${inferAno}º ano`,
        turno,
        ano_letivo: anoLetivo,
        observacoes: SEED_TURMA_ESCOLAR_TAG,
      };
    });
    const { data: created, error } = await admin.from("turmas_escolares").insert(rows).select("id, nome");
    if (error) throw error;
    for (const row of created ?? []) existentesByNome.set(row.nome, row.id);
  }
  return existentesByNome;
}

export const seedAlunos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await getAdmin();
    await assertDeveloper(context.userId, admin);

    const nomeToTurmaEscolarId = await ensureTurmasEscolares(admin);
    const { data: turmasSeed } = await admin.from("turmas").select("id, nome, slug").like("slug", "seed-%");
    const slugToNome = new Map((turmasSeed ?? []).map((t) => [t.slug, t.nome] as const));

    const rows = SEED_ALUNOS.map((a) => {
      const nome = slugToNome.get(a.turmaSlug);
      const turmaId = nome ? nomeToTurmaEscolarId.get(nome) ?? null : null;
      return {
        nome_completo: a.nome,
        matricula: a.matricula,
        turma_id: turmaId,
        data_nascimento: a.dataNascimento,
        ativo: true,
      };
    });

    // Idempotente: upsert por matrícula
    const { error, count } = await admin
      .from("alunos")
      .upsert(rows, { onConflict: "matricula", count: "exact" });
    if (error) throw error;
    return { created: count ?? rows.length };
  });

export const wipeAlunos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await getAdmin();
    await assertDeveloper(context.userId, admin);
    const { count, error } = await admin
      .from("alunos")
      .delete({ count: "exact" })
      .like("matricula", `${SEED_MATRICULA_PREFIX}%`);
    if (error) throw error;
    // Também remove turmas_escolares marcadas
    await admin.from("turmas_escolares").delete().ilike("observacoes", `%${SEED_TURMA_ESCOLAR_TAG}%`);
    return { deleted: count ?? 0 };
  });

/* --------------------- 2. Responsáveis + vínculos ------------------------ */

export const seedResponsaveis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await getAdmin();
    await assertDeveloper(context.userId, admin);
    const ctx = await loadContext(admin);
    if (ctx.alunos.length === 0) throw new Error("Gere antes: Alunos.");

    const matriculaToId = new Map(ctx.alunos.map((a) => [a.matricula, a.id] as const));

    // 2.1 — Cria responsáveis (sem login) e vincula
    const respRows = SEED_RESPONSAVEIS.map((r) => ({
      nome: r.nome,
      email: `${r.key}.resp.seed@escola.demo`,
      telefone: r.telefone,
    }));
    // Idempotente: delete + insert (marcador único @escola.demo + .resp.seed)
    await admin.from("responsaveis").delete().like("email", SEED_RESP_EMAIL_PATTERN);
    const { data: createdResps, error: rerr } = await admin
      .from("responsaveis")
      .insert(respRows)
      .select("id, email");
    if (rerr) throw rerr;

    const respByEmail = new Map((createdResps ?? []).map((r) => [r.email, r.id] as const));
    const vinculos: Array<{ aluno_id: string; responsavel_id: string; parentesco: string; principal: boolean }> = [];
    for (const seed of SEED_RESPONSAVEIS) {
      const respId = respByEmail.get(`${seed.key}.resp.seed@escola.demo`);
      if (!respId) continue;
      seed.vinculos.forEach((matricula, i) => {
        const alunoId = matriculaToId.get(matricula);
        if (alunoId) {
          vinculos.push({
            aluno_id: alunoId,
            responsavel_id: respId,
            parentesco: seed.parentesco,
            principal: i === 0,
          });
        }
      });
    }
    if (vinculos.length > 0) {
      await admin.from("aluno_responsavel").insert(vinculos);
    }

    // 2.2 — Vincula usuários seed.family.* aos alunos
    const familyLinkCount = { responsaveis: 0, vinculos: 0 };
    for (const [emailPrefix, matriculas] of Object.entries(SEED_FAMILY_USER_VINCULOS)) {
      const user = ctx.users.find((u) => (u.email ?? "").toLowerCase().startsWith(emailPrefix.toLowerCase()));
      if (!user) continue;
      // Cria/reusa 1 responsável ligado ao user_id
      let respId: string;
      const { data: existente } = await admin
        .from("responsaveis")
        .select("id")
        .eq("user_id", user.user_id)
        .maybeSingle();
      if (existente) {
        respId = existente.id;
      } else {
        const { data: novo, error: e1 } = await admin
          .from("responsaveis")
          .insert({
            nome: user.display_name ?? user.email ?? "Responsável Demo",
            email: user.email,
            user_id: user.user_id,
          })
          .select("id")
          .single();
        if (e1) throw e1;
        respId = novo!.id;
        familyLinkCount.responsaveis++;
      }
      // Remove vínculos anteriores deste responsável e recria
      await admin.from("aluno_responsavel").delete().eq("responsavel_id", respId);
      const linkRows = matriculas
        .map((m, i) => ({
          aluno_id: matriculaToId.get(m),
          responsavel_id: respId,
          parentesco: "responsavel",
          principal: i === 0,
        }))
        .filter((r) => !!r.aluno_id) as Array<{ aluno_id: string; responsavel_id: string; parentesco: string; principal: boolean }>;
      if (linkRows.length) {
        await admin.from("aluno_responsavel").insert(linkRows);
        familyLinkCount.vinculos += linkRows.length;
      }
    }

    return {
      responsaveis: (createdResps ?? []).length + familyLinkCount.responsaveis,
      vinculos: vinculos.length + familyLinkCount.vinculos,
    };
  });

export const wipeResponsaveis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await getAdmin();
    await assertDeveloper(context.userId, admin);
    // CASCADE em aluno_responsavel via FK
    const { count } = await admin
      .from("responsaveis")
      .delete({ count: "exact" })
      .or(`email.like.${SEED_RESP_EMAIL_PATTERN},email.like.${SEED_USER_EMAIL_PATTERN}`);
    return { deleted: count ?? 0 };
  });

/* ------------------------- 3. Notas + 4. Frequência ---------------------- */

export const seedNotas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await getAdmin();
    await assertDeveloper(context.userId, admin);
    const ctx = await loadContext(admin);
    if (ctx.alunos.length === 0) throw new Error("Gere antes: Alunos.");
    if (ctx.disciplinas.length === 0) throw new Error("Gere antes: Disciplinas.");

    const professorId = pickUserByEmailPrefix(ctx.users, "seed.professor.1");
    const rows: Array<{
      aluno_id: string; disciplina: string; bimestre: number; valor: number; lancado_por: string | null;
    }> = [];
    for (const a of ctx.alunos) {
      for (const d of ctx.disciplinas) {
        for (let bimestre = 1; bimestre <= 3; bimestre++) {
          // Nota determinística entre 5.0 e 9.5 baseada em hash simples
          const seed = (a.id.charCodeAt(0) + d.nome.charCodeAt(0) + bimestre) % 46;
          const valor = 5 + seed / 10;
          rows.push({ aluno_id: a.id, disciplina: d.nome, bimestre, valor: Number(valor.toFixed(1)), lancado_por: professorId });
        }
      }
    }
    // Wipe + insert em lotes
    await admin.from("notas").delete().in("aluno_id", ctx.alunos.map((a) => a.id));
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await admin.from("notas").insert(rows.slice(i, i + 200));
      if (error) throw error;
    }
    return { created: rows.length };
  });

export const wipeNotas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await getAdmin();
    await assertDeveloper(context.userId, admin);
    const ctx = await loadContext(admin);
    const { count } = await admin.from("notas").delete({ count: "exact" }).in("aluno_id", ctx.alunos.map((a) => a.id));
    return { deleted: count ?? 0 };
  });

export const seedFrequencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await getAdmin();
    await assertDeveloper(context.userId, admin);
    const ctx = await loadContext(admin);
    if (ctx.alunos.length === 0) throw new Error("Gere antes: Alunos.");
    const professorId = pickUserByEmailPrefix(ctx.users, "seed.professor.1");

    const dias: string[] = [];
    const hoje = new Date();
    for (let d = 1; d <= 30; d++) {
      const dt = new Date(hoje.getTime() - d * 86_400_000);
      const dow = dt.getDay();
      if (dow === 0 || dow === 6) continue; // pula fim de semana
      dias.push(dt.toISOString().slice(0, 10));
    }
    const rows: Array<{ aluno_id: string; data: string; presente: boolean; registrado_por: string | null }> = [];
    for (const a of ctx.alunos) {
      for (const data of dias) {
        // ~5% de faltas determinístico
        const hash = (a.id.charCodeAt(0) + Number(data.slice(-2))) % 20;
        rows.push({ aluno_id: a.id, data, presente: hash !== 0, registrado_por: professorId });
      }
    }
    await admin.from("frequencia").delete().in("aluno_id", ctx.alunos.map((a) => a.id));
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await admin.from("frequencia").insert(rows.slice(i, i + 200));
      if (error) throw error;
    }
    return { created: rows.length };
  });

export const wipeFrequencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await getAdmin();
    await assertDeveloper(context.userId, admin);
    const ctx = await loadContext(admin);
    const { count } = await admin.from("frequencia").delete({ count: "exact" }).in("aluno_id", ctx.alunos.map((a) => a.id));
    return { deleted: count ?? 0 };
  });

/* ------------------------ 5. Justificativas ------------------------------ */

export const seedJustificativas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await getAdmin();
    await assertDeveloper(context.userId, admin);
    const ctx = await loadContext(admin);
    if (ctx.alunos.length === 0) throw new Error("Gere antes: Alunos.");
    const familyUser = pickUserByEmailPrefix(ctx.users, "seed.family.1");
    if (!familyUser) throw new Error("Gere antes: Usuários demo.");

    const coordId = pickUserByEmailPrefix(ctx.users, "seed.coordenador.1");
    // Marcamos com prefixo no motivo para wipe
    const rows = SEED_JUSTIFICATIVAS.map((j, i) => {
      const aluno = ctx.alunos[i % ctx.alunos.length];
      const start = new Date(Date.now() - j.daysAtras * 86_400_000).toISOString().slice(0, 10);
      return {
        aluno_id: aluno.id,
        solicitante_user_id: familyUser,
        data_inicio: start,
        data_fim: start,
        motivo: `[Seed] ${j.motivo}`,
        status: j.status,
        respondido_por: j.status === "pendente" ? null : coordId,
        respondido_em: j.status === "pendente" ? null : new Date().toISOString(),
      };
    });
    await admin.from("justificativas_faltas").delete().like("motivo", "[Seed]%");
    const { error, count } = await admin.from("justificativas_faltas").insert(rows, { count: "exact" });
    if (error) throw error;
    return { created: count ?? rows.length };
  });

export const wipeJustificativas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await getAdmin();
    await assertDeveloper(context.userId, admin);
    const { count } = await admin.from("justificativas_faltas").delete({ count: "exact" }).like("motivo", "[Seed]%");
    return { deleted: count ?? 0 };
  });

/* ---------------------------- 6. Comunicados ----------------------------- */

export const seedComunicados = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await getAdmin();
    await assertDeveloper(context.userId, admin);
    const ctx = await loadContext(admin);
    const coordId = pickUserByEmailPrefix(ctx.users, "seed.coordenador.1");
    if (!coordId) throw new Error("Gere antes: Usuários demo.");

    const rows = SEED_COMUNICADOS.map((c) => ({
      autor_id: coordId,
      tipo: c.tipo,
      titulo: `${SEED_COMUNICADO_TAG} ${c.titulo}`,
      mensagem: c.mensagem,
      agendado_para: c.agendarEmHoras ? new Date(Date.now() + c.agendarEmHoras * 3_600_000).toISOString() : null,
    }));
    await admin.from("comunicados").delete().like("titulo", `${SEED_COMUNICADO_TAG}%`);
    const { data: inserted, error } = await admin.from("comunicados").insert(rows).select("id");
    if (error) throw error;

    // Simula leituras de 2 comunicados por cada seed.family user
    const familyUsers = ctx.users.filter((u) => (u.email ?? "").includes("seed.family."));
    const leituras: Array<{ comunicado_id: string; usuario_id: string }> = [];
    (inserted ?? []).slice(0, 4).forEach((c) => {
      familyUsers.slice(0, 2).forEach((u) => leituras.push({ comunicado_id: c.id, usuario_id: u.user_id }));
    });
    if (leituras.length) await admin.from("comunicado_leituras").insert(leituras);

    return { created: rows.length, leituras: leituras.length };
  });

export const wipeComunicados = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await getAdmin();
    await assertDeveloper(context.userId, admin);
    const { count } = await admin.from("comunicados").delete({ count: "exact" }).like("titulo", `${SEED_COMUNICADO_TAG}%`);
    return { deleted: count ?? 0 };
  });

/* ------------------------------ 7. Alertas ------------------------------- */

export const seedAlertas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await getAdmin();
    await assertDeveloper(context.userId, admin);
    const rows = SEED_ALERTAS.map((a) => ({
      message: `${SEED_ALERT_TAG} ${a.message}`,
      variant: a.variant,
      link_url: a.linkUrl,
      link_label: a.linkLabel,
      active: true,
      starts_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + a.expiraEmDias * 86_400_000).toISOString(),
      created_by: context.userId,
    }));
    await admin.from("alerts").delete().like("message", `${SEED_ALERT_TAG}%`);
    const { error, count } = await admin.from("alerts").insert(rows, { count: "exact" });
    if (error) throw error;
    return { created: count ?? rows.length };
  });

export const wipeAlertas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await getAdmin();
    await assertDeveloper(context.userId, admin);
    const { count } = await admin.from("alerts").delete({ count: "exact" }).like("message", `${SEED_ALERT_TAG}%`);
    return { deleted: count ?? 0 };
  });

/* ------------------------------ 8. Enquetes ------------------------------ */

export const seedEnquetes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await getAdmin();
    await assertDeveloper(context.userId, admin);
    // Wipe primeiro (CASCADE em opcoes/respostas via FK do banco, se houver)
    const { data: existentes } = await admin.from("enquetes").select("id").like("titulo", `${SEED_ENQUETE_TAG}%`);
    if (existentes && existentes.length) {
      const ids = existentes.map((e) => e.id);
      await admin.from("enquete_respostas").delete().in("enquete_id", ids);
      await admin.from("enquete_opcoes").delete().in("enquete_id", ids);
      await admin.from("enquetes").delete().in("id", ids);
    }

    let totalOpcoes = 0;
    for (const e of SEED_ENQUETES) {
      const { data: enq, error } = await admin
        .from("enquetes")
        .insert({
          titulo: `${SEED_ENQUETE_TAG} ${e.titulo}`,
          descricao: e.descricao,
          tipo: e.tipo,
          publico: e.publico,
          ativo: e.ativo,
          encerra_em: e.encerraEmDias != null ? new Date(Date.now() + e.encerraEmDias * 86_400_000).toISOString() : null,
          criado_por: context.userId,
        })
        .select("id")
        .single();
      if (error) throw error;
      const opcoesRows = e.opcoes.map((texto, i) => ({ enquete_id: enq!.id, texto, ordem: i }));
      const { error: oerr } = await admin.from("enquete_opcoes").insert(opcoesRows);
      if (oerr) throw oerr;
      totalOpcoes += opcoesRows.length;
    }
    return { enquetes: SEED_ENQUETES.length, opcoes: totalOpcoes };
  });

export const wipeEnquetes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await getAdmin();
    await assertDeveloper(context.userId, admin);
    const { data: existentes } = await admin.from("enquetes").select("id").like("titulo", `${SEED_ENQUETE_TAG}%`);
    const ids = (existentes ?? []).map((e) => e.id);
    if (ids.length) {
      await admin.from("enquete_respostas").delete().in("enquete_id", ids);
      await admin.from("enquete_opcoes").delete().in("enquete_id", ids);
      await admin.from("enquetes").delete().in("id", ids);
    }
    return { deleted: ids.length };
  });

/* ---------------------------- 9. Autorizações ---------------------------- */

export const seedAutorizacoes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await getAdmin();
    await assertDeveloper(context.userId, admin);
    const ctx = await loadContext(admin);
    if (ctx.alunos.length === 0) throw new Error("Gere antes: Alunos.");

    // Wipe existente
    const { data: existentes } = await admin.from("autorizacoes").select("id").like("titulo", `${SEED_AUTORIZACAO_TAG}%`);
    const oldIds = (existentes ?? []).map((e) => e.id);
    if (oldIds.length) {
      await admin.from("autorizacao_respostas").delete().in("autorizacao_id", oldIds);
      await admin.from("autorizacoes").delete().in("id", oldIds);
    }

    const turmaIds = Array.from(new Set(ctx.alunos.map((a) => a.turma_id).filter(Boolean))) as string[];
    const familyUser = pickUserByEmailPrefix(ctx.users, "seed.family.1");

    let respostasTotal = 0;
    for (const a of SEED_AUTORIZACOES) {
      const { data: aut, error } = await admin
        .from("autorizacoes")
        .insert({
          titulo: `${SEED_AUTORIZACAO_TAG} ${a.titulo}`,
          descricao: a.descricao,
          data_evento: a.daysAteEvento
            ? new Date(Date.now() + a.daysAteEvento * 86_400_000).toISOString().slice(0, 10)
            : null,
          prazo_resposta: new Date(Date.now() + a.daysAtePrazo * 86_400_000).toISOString(),
          turma_ids: turmaIds,
          aluno_ids: ctx.alunos.map((x) => x.id),
          criado_por: context.userId,
        })
        .select("id")
        .single();
      if (error) throw error;

      // Respostas parciais dos alunos vinculados ao seed.family.1
      if (familyUser) {
        const vinc = SEED_FAMILY_USER_VINCULOS["seed.family.1"] ?? [];
        const alunosDoFamily = ctx.alunos.filter((x) => vinc.includes(x.matricula));
        const respRows = alunosDoFamily.map((al) => ({
          autorizacao_id: aut!.id,
          aluno_id: al.id,
          respondido_por: familyUser,
          autorizado: true,
          assinatura_nome: "Responsável Demo",
        }));
        if (respRows.length) {
          await admin.from("autorizacao_respostas").insert(respRows);
          respostasTotal += respRows.length;
        }
      }
    }
    return { autorizacoes: SEED_AUTORIZACOES.length, respostas: respostasTotal };
  });

export const wipeAutorizacoes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await getAdmin();
    await assertDeveloper(context.userId, admin);
    const { data: existentes } = await admin.from("autorizacoes").select("id").like("titulo", `${SEED_AUTORIZACAO_TAG}%`);
    const ids = (existentes ?? []).map((e) => e.id);
    if (ids.length) {
      await admin.from("autorizacao_respostas").delete().in("autorizacao_id", ids);
      await admin.from("autorizacoes").delete().in("id", ids);
    }
    return { deleted: ids.length };
  });

/* ---------------------------- 10. Agendamentos --------------------------- */

export const seedAgendamentos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await getAdmin();
    await assertDeveloper(context.userId, admin);
    const ctx = await loadContext(admin);
    // Distribui entre os 3 seed.family users (máx 2 por user para não bater rate limit)
    const familyUsers = ctx.users.filter((u) => (u.email ?? "").includes("seed.family."));
    if (familyUsers.length === 0) throw new Error("Gere antes: Usuários demo.");

    const rows = SEED_AGENDAMENTOS.map((a, i) => {
      const inicio = new Date(Date.now() + a.daysUntil * 86_400_000);
      inicio.setHours(14, 0, 0, 0);
      const fim = new Date(inicio.getTime() + 30 * 60_000);
      const user = familyUsers[i % familyUsers.length];
      return {
        solicitante_user_id: user.user_id,
        solicitante_nome: user.display_name ?? "Responsável Demo",
        solicitante_relacao: a.relacao,
        motivo: `${SEED_AGENDAMENTO_TAG} ${a.motivo}`,
        inicio_at: inicio.toISOString(),
        fim_at: fim.toISOString(),
        alvo_cargo: "coordenador",
        status: a.status,
      };
    });
    await admin.from("agendamentos").delete().like("motivo", `${SEED_AGENDAMENTO_TAG}%`);
    const { error, count } = await admin.from("agendamentos").insert(rows, { count: "exact" });
    if (error) throw error;
    return { created: count ?? rows.length };
  });

export const wipeAgendamentos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await getAdmin();
    await assertDeveloper(context.userId, admin);
    const { count } = await admin.from("agendamentos").delete({ count: "exact" }).like("motivo", `${SEED_AGENDAMENTO_TAG}%`);
    return { deleted: count ?? 0 };
  });

/* ------------------------ 11. Mensagens coordenação ---------------------- */

export const seedMensagensCoord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await getAdmin();
    await assertDeveloper(context.userId, admin);
    const ctx = await loadContext(admin);
    const familyUsers = ctx.users.filter((u) => (u.email ?? "").includes("seed.family."));
    const coordUser = ctx.users.find((u) => (u.email ?? "").includes("seed.coordenador."));
    if (familyUsers.length === 0 || !coordUser) throw new Error("Gere antes: Usuários demo.");

    // Wipe
    await admin.from("mensagens_coordenacao").delete().like("assunto", `${SEED_MSG_TAG}%`);

    let count = 0;
    for (let i = 0; i < SEED_MENSAGENS_COORD.length; i++) {
      const m = SEED_MENSAGENS_COORD[i];
      const remetente = familyUsers[i % familyUsers.length];
      const { data: msg, error } = await admin
        .from("mensagens_coordenacao")
        .insert({
          remetente_id: remetente.user_id,
          remetente_nome: remetente.display_name ?? "Responsável Demo",
          remetente_tipo: m.remetenteTipo,
          assunto: `${SEED_MSG_TAG} ${m.assunto}`,
          mensagem: m.mensagem,
        })
        .select("thread_id, id")
        .single();
      if (error) throw error;
      count++;
      if (m.respostaCoord) {
        await admin.from("mensagens_coordenacao").insert({
          thread_id: msg!.thread_id,
          remetente_id: coordUser.user_id,
          remetente_nome: coordUser.display_name ?? "Coordenação",
          remetente_tipo: "staff",
          assunto: `${SEED_MSG_TAG} RE: ${m.assunto.slice(0, 60)}`,
          mensagem: m.respostaCoord,
        });
        count++;
      }
    }
    return { created: count };
  });

export const wipeMensagensCoord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await getAdmin();
    await assertDeveloper(context.userId, admin);
    const { count } = await admin.from("mensagens_coordenacao").delete({ count: "exact" }).like("assunto", `${SEED_MSG_TAG}%`);
    return { deleted: count ?? 0 };
  });

/* -------------------------- 12. Alunos destaque -------------------------- */

export const seedAlunosDestaque = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await getAdmin();
    await assertDeveloper(context.userId, admin);
    const ctx = await loadContext(admin);
    if (ctx.alunos.length < SEED_DESTAQUES.length) throw new Error("Gere antes: Alunos.");

    await admin.from("alunos_destaque").delete().like("motivo", `${SEED_DESTAQUE_MOTIVO_TAG}%`);
    const mes = new Date();
    mes.setDate(1);
    const rows = SEED_DESTAQUES.map((d, i) => {
      const aluno = ctx.alunos[i];
      return {
        aluno_id: aluno.id,
        turma_id: aluno.turma_id!,
        mes: mes.toISOString().slice(0, 10),
        motivo: d.motivo,
        posicao: d.posicao,
        status: "aprovado" as const,
        indicado_por: context.userId,
        aprovado_por: context.userId,
        aprovado_em: new Date().toISOString(),
      };
    }).filter((r) => !!r.turma_id);
    const { error, count } = await admin.from("alunos_destaque").insert(rows, { count: "exact" });
    if (error) throw error;
    return { created: count ?? rows.length };
  });

export const wipeAlunosDestaque = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await getAdmin();
    await assertDeveloper(context.userId, admin);
    const { count } = await admin.from("alunos_destaque").delete({ count: "exact" }).like("motivo", `${SEED_DESTAQUE_MOTIVO_TAG}%`);
    return { deleted: count ?? 0 };
  });

/* -------------------------- 13. Depoimentos ------------------------------ */

export const seedDepoimentos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await getAdmin();
    await assertDeveloper(context.userId, admin);
    await admin.from("familias_depoimentos").delete().like("autor_nome", `${SEED_DEPOIMENTO_TAG}%`);
    const rows = SEED_DEPOIMENTOS.map((d) => ({
      autor_nome: d.autorNome,
      autor_idade: d.autorIdade,
      mensagem: d.mensagem,
      tipo: d.tipo,
      vinculo: d.vinculo,
      turma_ano: d.turmaAno,
      status: "aprovado" as const,
      moderado_por: context.userId,
      moderado_em: new Date().toISOString(),
      submitted_by: context.userId,
    }));
    const { error, count } = await admin.from("familias_depoimentos").insert(rows, { count: "exact" });
    if (error) throw error;
    return { created: count ?? rows.length };
  });

export const wipeDepoimentos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await getAdmin();
    await assertDeveloper(context.userId, admin);
    const { count } = await admin.from("familias_depoimentos").delete({ count: "exact" }).like("autor_nome", `${SEED_DEPOIMENTO_TAG}%`);
    return { deleted: count ?? 0 };
  });

/* ---------------------- 14. Comentários de posts ------------------------- */

export const seedComentariosPosts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await getAdmin();
    await assertDeveloper(context.userId, admin);
    const ctx = await loadContext(admin);
    if (ctx.posts.length === 0) throw new Error("Gere antes: Posts.");

    await admin.from("post_comentarios").delete().like("autor_nome", `${SEED_COMENTARIO_TAG}%`);
    const rows = SEED_COMENTARIOS.map((c, i) => ({
      post_id: ctx.posts[i % ctx.posts.length].id,
      autor_nome: c.autorNome,
      conteudo: c.conteudo,
      status: c.status,
      moderado_por: c.status === "pendente" ? null : context.userId,
      moderado_em: c.status === "pendente" ? null : new Date().toISOString(),
    }));
    const { error, count } = await admin.from("post_comentarios").insert(rows, { count: "exact" });
    if (error) throw error;
    return { created: count ?? rows.length };
  });

export const wipeComentariosPosts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await getAdmin();
    await assertDeveloper(context.userId, admin);
    const { count } = await admin.from("post_comentarios").delete({ count: "exact" }).like("autor_nome", `${SEED_COMENTARIO_TAG}%`);
    return { deleted: count ?? 0 };
  });

/* ------------------------------ 15. Reminders ---------------------------- */

export const seedReminders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await getAdmin();
    await assertDeveloper(context.userId, admin);
    const ctx = await loadContext(admin);
    const targetUsers = ctx.users.filter((u) =>
      /(seed\.(coordenador|diretor|professor)\.1)/.test((u.email ?? "").toLowerCase()),
    );
    if (targetUsers.length === 0) throw new Error("Gere antes: Usuários demo.");

    await admin.from("reminders").delete().like("texto", `${SEED_REMINDER_TAG}%`);
    const rows: Array<{ user_id: string; texto: string; data_hora: string; prioridade: string }> = [];
    for (const u of targetUsers) {
      for (const r of SEED_REMINDERS) {
        rows.push({
          user_id: u.user_id,
          texto: `${SEED_REMINDER_TAG} ${r.texto}`,
          data_hora: new Date(Date.now() + r.daysUntil * 86_400_000).toISOString(),
          prioridade: r.prioridade,
        });
      }
    }
    const { error, count } = await admin.from("reminders").insert(rows, { count: "exact" });
    if (error) throw error;
    return { created: count ?? rows.length };
  });

export const wipeReminders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await getAdmin();
    await assertDeveloper(context.userId, admin);
    const { count } = await admin.from("reminders").delete({ count: "exact" }).like("texto", `${SEED_REMINDER_TAG}%`);
    return { deleted: count ?? 0 };
  });

/* ------------------------ Wipe geral estendido --------------------------- */

export const wipeAllExtended = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await getAdmin();
    await assertDeveloper(context.userId, admin);

    // Ordem importa: filhos antes de pais
    const results: Record<string, number> = {};
    const drop = async (label: string, promise: PromiseLike<{ count: number | null }>) => {
      const { count } = await Promise.resolve(promise);
      results[label] = count ?? 0;
    };

    await drop("reminders", admin.from("reminders").delete({ count: "exact" }).like("texto", `${SEED_REMINDER_TAG}%`));
    await drop("comentarios", admin.from("post_comentarios").delete({ count: "exact" }).like("autor_nome", `${SEED_COMENTARIO_TAG}%`));
    await drop("depoimentos", admin.from("familias_depoimentos").delete({ count: "exact" }).like("autor_nome", `${SEED_DEPOIMENTO_TAG}%`));
    await drop("mensagens", admin.from("mensagens_coordenacao").delete({ count: "exact" }).like("assunto", `${SEED_MSG_TAG}%`));
    await drop("agendamentos", admin.from("agendamentos").delete({ count: "exact" }).like("motivo", `${SEED_AGENDAMENTO_TAG}%`));
    await drop("alertas", admin.from("alerts").delete({ count: "exact" }).like("message", `${SEED_ALERT_TAG}%`));

    // Enquetes: filhos primeiro
    const { data: enq } = await admin.from("enquetes").select("id").like("titulo", `${SEED_ENQUETE_TAG}%`);
    const enqIds = (enq ?? []).map((e) => e.id);
    if (enqIds.length) {
      await admin.from("enquete_respostas").delete().in("enquete_id", enqIds);
      await admin.from("enquete_opcoes").delete().in("enquete_id", enqIds);
      await admin.from("enquetes").delete().in("id", enqIds);
    }
    results.enquetes = enqIds.length;

    // Autorizações: filhos primeiro
    const { data: aut } = await admin.from("autorizacoes").select("id").like("titulo", `${SEED_AUTORIZACAO_TAG}%`);
    const autIds = (aut ?? []).map((e) => e.id);
    if (autIds.length) {
      await admin.from("autorizacao_respostas").delete().in("autorizacao_id", autIds);
      await admin.from("autorizacoes").delete().in("id", autIds);
    }
    results.autorizacoes = autIds.length;

    await drop("comunicados", admin.from("comunicados").delete({ count: "exact" }).like("titulo", `${SEED_COMUNICADO_TAG}%`));
    await drop("destaques", admin.from("alunos_destaque").delete({ count: "exact" }).like("motivo", `${SEED_DESTAQUE_MOTIVO_TAG}%`));
    await drop("justificativas", admin.from("justificativas_faltas").delete({ count: "exact" }).like("motivo", "[Seed]%"));

    // Notas/frequência dependem de alunos — deletar primeiro
    const { data: alns } = await admin.from("alunos").select("id").like("matricula", `${SEED_MATRICULA_PREFIX}%`);
    const alnIds = (alns ?? []).map((a) => a.id);
    if (alnIds.length) {
      await admin.from("notas").delete().in("aluno_id", alnIds);
      await admin.from("frequencia").delete().in("aluno_id", alnIds);
    }
    results.notas = alnIds.length ? alnIds.length : 0;

    // Responsáveis e vínculos (CASCADE cuida de aluno_responsavel)
    await drop("responsaveis", admin.from("responsaveis").delete({ count: "exact" }).or(`email.like.${SEED_RESP_EMAIL_PATTERN},email.like.${SEED_USER_EMAIL_PATTERN}`));

    // Alunos + turmas_escolares
    await drop("alunos", admin.from("alunos").delete({ count: "exact" }).like("matricula", `${SEED_MATRICULA_PREFIX}%`));
    await drop("turmas_escolares", admin.from("turmas_escolares").delete({ count: "exact" }).ilike("observacoes", `%${SEED_TURMA_ESCOLAR_TAG}%`));

    return results;
  });

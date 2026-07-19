import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeRoles, type AppRole } from "@/lib/roles";

const createUserSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(6).max(72),
  displayName: z.string().min(1).max(255),
  role: z.enum(["diretor", "coordenador", "professor", "secretario", "family"]),
  // Somente quando role = "family" (Pais/Responsável): vincula o usuário a um ou mais alunos
  alunoId: z.string().uuid().optional(),
  alunoIds: z.array(z.string().uuid()).max(20).optional(),
  parentesco: z.string().max(60).optional(),
  telefone: z.string().max(40).optional(),
});

/** Papéis administrativos, gerenciados na aba Administração */
const ADMIN_ROLES = ["diretor", "coordenador", "secretario"] as const;
/** Papéis acadêmicos, gerenciados na aba Acadêmica */
const ACADEMIC_ROLES = ["professor", "family"] as const;

/**
 * Retorna os papéis do usuário usando o cliente admin (ignora RLS).
 */
async function getAdminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function getRoles(userId: string): Promise<AppRole[]> {
  const supabaseAdmin = await getAdminClient();
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return normalizeRoles((data ?? []).map((r) => r.role as string));
}

/**
 * Papéis administrativos (Diretor, Coordenador, Secretário): apenas Desenvolvedor e Diretor.
 */
async function assertManager(userId: string) {
  const roles = await getRoles(userId);
  const allowed = roles.some((r) => r === "desenvolvedor" || r === "diretor");
  if (!allowed) {
    throw new Error("Apenas Desenvolvedor ou Diretor podem gerenciar contas administrativas.");
  }
  return roles;
}

/**
 * Papéis acadêmicos (Professor, Pais/Responsáveis): Desenvolvedor, Diretor, Coordenador ou Secretário.
 */
async function assertAcademicManager(userId: string) {
  const roles = await getRoles(userId);
  const allowed = roles.some(
    (r) => r === "desenvolvedor" || r === "diretor" || r === "coordenador" || r === "secretario",
  );
  if (!allowed) {
    throw new Error(
      "Apenas Desenvolvedor, Diretor, Coordenador ou Secretário podem cadastrar Professores ou Pais.",
    );
  }
  return roles;
}

export const createSchoolUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createUserSchema.parse(input))
  .handler(async ({ data, context }) => {
    // Aplica a autorização certa dependendo do tipo de conta que está sendo criada
    const isAdminRole = (ADMIN_ROLES as readonly string[]).includes(data.role);
    const isAcademicRole = (ACADEMIC_ROLES as readonly string[]).includes(data.role);
    if (isAdminRole) {
      await assertManager(context.userId);
    } else if (isAcademicRole) {
      await assertAcademicManager(context.userId);
    } else {
      return { error: "Cargo inválido." };
    }

    // Pais/Responsável exige pelo menos um aluno vinculado — o acesso é sempre restrito aos próprios filhos
    const familyAlunoIds =
      data.role === "family"
        ? Array.from(
            new Set(
              [...(data.alunoIds ?? []), ...(data.alunoId ? [data.alunoId] : [])].filter(Boolean),
            ),
          )
        : [];
    if (data.role === "family" && familyAlunoIds.length === 0) {
      return { error: "Selecione pelo menos um aluno para vincular ao responsável." };
    }

    const supabaseAdmin = await getAdminClient();

    // Cria o usuário de autenticação via admin (bypassa RLS e confirmação de e-mail)
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { display_name: data.displayName },
    });

    if (createError || !created.user) {
      return { error: createError?.message ?? "Falha ao criar usuário." };
    }

    const newUserId = created.user.id;

    // O trigger handle_new_user cria automaticamente o perfil a partir do user_metadata.
    // Faz poll curto (até ~2s) aguardando o perfil aparecer antes de manipular roles —
    // mais confiável que setTimeout fixo sob latência variável do banco.
    let profileReady = false;
    for (let attempt = 0; attempt < 10; attempt++) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("user_id")
        .eq("user_id", newUserId)
        .maybeSingle();
      if (profile) {
        profileReady = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    if (!profileReady) {
      // Fallback: cria o perfil manualmente se o trigger falhou/atrasou demais
      await supabaseAdmin.from("profiles").insert({
        id: newUserId,
        user_id: newUserId,
        display_name: data.displayName,
        email: data.email,
      });
    }

    // Remove o role padrão inserido pelo trigger e atribui o cargo correto
    await supabaseAdmin.from("user_roles").delete().eq("user_id", newUserId);
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newUserId, role: data.role });

    if (roleError) {
      return { error: `Usuário criado, mas falhou ao atribuir o cargo: ${roleError.message}` };
    }

    // Para Pais/Responsável: cria o registro em `responsaveis` e vincula a todos os alunos selecionados
    if (data.role === "family" && familyAlunoIds.length > 0) {
      const { data: respRow, error: respErr } = await supabaseAdmin
        .from("responsaveis")
        .insert({
          nome: data.displayName,
          email: data.email,
          telefone: data.telefone ?? null,
          user_id: newUserId,
        })
        .select("id")
        .single();

      if (respErr || !respRow) {
        return {
          error: `Conta criada, mas falhou ao registrar responsável: ${respErr?.message ?? "erro desconhecido"}`,
        };
      }

      const vinculosPayload = familyAlunoIds.map((alunoId, index) => ({
        aluno_id: alunoId,
        responsavel_id: respRow.id,
        parentesco: data.parentesco ?? null,
        principal: index === 0,
      }));

      const { error: vincErr } = await supabaseAdmin
        .from("aluno_responsavel")
        .insert(vinculosPayload);

      if (vincErr) {
        return {
          error: `Conta e responsável criados, mas falhou ao vincular aos alunos: ${vincErr.message}`,
        };
      }
    }

    return { error: null, userId: newUserId };
  });

export const listSchoolUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertManager(context.userId);
    const supabaseAdmin = await getAdminClient();

    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("user_id, display_name, email, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");

    const roleMap = new Map<string, string[]>();
    (roles ?? []).forEach((r) => {
      const arr = roleMap.get(r.user_id) ?? [];
      arr.push(...normalizeRoles([r.role as string]));
      roleMap.set(r.user_id, arr);
    });

    return (profiles ?? []).map((p) => ({
      userId: p.user_id,
      displayName: p.display_name,
      email: p.email,
      roles: roleMap.get(p.user_id) ?? [],
    }));
  });

const deleteUserSchema = z.object({ userId: z.string().uuid() });

export const deleteSchoolUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => deleteUserSchema.parse(input))
  .handler(async ({ data, context }) => {
    const callerRoles = await assertManager(context.userId);
    const isCallerDev = callerRoles.includes("desenvolvedor");
    const supabaseAdmin = await getAdminClient();

    if (data.userId === context.userId) {
      return { error: "Você não pode excluir sua própria conta." };
    }

    // Protege contas de Desenvolvedor: só outro Desenvolvedor pode excluí-las
    const targetRoles = await getRoles(data.userId);
    if (targetRoles.includes("desenvolvedor") && !isCallerDev) {
      return { error: "Apenas o Desenvolvedor pode excluir outro Desenvolvedor." };
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    // Se o usuário já não existe no auth (órfão), seguimos limpando as tabelas públicas
    const isNotFound = !!error && /not.?found|user.*not.*exist/i.test(error.message ?? "");
    if (error && !isNotFound) {
      return { error: error.message };
    }

    // Limpa registros relacionados (cascata pode não estar ativa em todas as tabelas)
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("profiles").delete().eq("user_id", data.userId);

    return { error: null };
  });

/**
 * Atribui (ou substitui) o papel de um usuário existente.
 * APENAS o Desenvolvedor pode executar esta ação — é a fonte única de
 * verdade para papéis no sistema. Vincula automaticamente ao perfil via
 * `user_roles.user_id` (o perfil já é criado pelo trigger handle_new_user).
 */
const assignRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum([
    "desenvolvedor",
    "admin",
    "diretor",
    "coordenador",
    "professor",
    "secretario",
    "family",
  ]),
});

export const assignUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => assignRoleSchema.parse(input))
  .handler(async ({ data, context }) => {
    const callerRoles = await getRoles(context.userId);
    if (!callerRoles.includes("desenvolvedor")) {
      return { error: "Apenas o Desenvolvedor pode atribuir papéis." };
    }

    const supabaseAdmin = await getAdminClient();

    // Verifica se o perfil existe (garantia — o trigger já deve ter criado)
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .eq("user_id", data.userId)
      .maybeSingle();
    if (!profile) {
      return { error: "Perfil não encontrado para este usuário." };
    }

    // Substitui o papel: remove os anteriores e insere o novo (papel único por usuário)
    const { error: delErr } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId);
    if (delErr) return { error: `Falha ao remover papel anterior: ${delErr.message}` };

    const { error: insErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.userId, role: data.role });
    if (insErr) return { error: `Falha ao atribuir papel: ${insErr.message}` };

    return { error: null };
  });

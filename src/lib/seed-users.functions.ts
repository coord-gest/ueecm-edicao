import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Seed de usuários demo. Cria contas com e-mail no domínio @escola.demo e
 * prefixo "seed." — assim a remoção é segura e nunca atinge usuários reais.
 */

export const SEED_USER_DOMAIN = "escola.demo";
export const SEED_USER_PREFIX = "seed.";

type RoleKey = "admin" | "diretor" | "coordenador" | "professor" | "secretario" | "family";

export const SEED_USER_PLAN: Array<{ role: RoleKey; count: number; label: string }> = [
  { role: "admin", count: 1, label: "Administrador" },
  { role: "diretor", count: 1, label: "Diretor" },
  { role: "coordenador", count: 2, label: "Coordenador" },
  { role: "professor", count: 4, label: "Professor" },
  { role: "secretario", count: 2, label: "Secretário" },
  { role: "family", count: 3, label: "Responsável" },
];

async function assertDeveloper(userId: string, admin: Awaited<ReturnType<typeof getAdmin>>) {
  const { data, error } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "desenvolvedor")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Apenas o Desenvolvedor pode executar este seed.");
}

async function getAdmin() {
  const mod = await import("@/integrations/supabase/client.server");
  return mod.supabaseAdmin;
}

function makeEmail(role: RoleKey, i: number) {
  return `${SEED_USER_PREFIX}${role}.${i}@${SEED_USER_DOMAIN}`;
}

function makeDisplayName(label: string, i: number) {
  return `[Demo] ${label} ${String(i).padStart(2, "0")}`;
}

export const seedSchoolUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await getAdmin();
    await assertDeveloper(context.userId, supabaseAdmin);

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const { role, count, label } of SEED_USER_PLAN) {
      for (let i = 1; i <= count; i++) {
        const email = makeEmail(role, i);
        const display_name = makeDisplayName(label, i);

        const { data: createRes, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: process.env.SEED_USER_PASSWORD || "Demo@2026!",
          email_confirm: true,
          user_metadata: { display_name },
        });

        let userId = createRes?.user?.id;

        if (createErr || !userId) {
          const msg = createErr?.message ?? "";
          if (/already|exist|registered/i.test(msg)) {
            // Já existe — recupera o id para garantir o role correto
            const { data: existing } = await supabaseAdmin
              .from("profiles")
              .select("user_id")
              .eq("email", email)
              .maybeSingle();
            if (existing?.user_id) {
              userId = existing.user_id;
              skipped++;
            } else {
              errors.push(`${email}: ${msg}`);
              continue;
            }
          } else {
            errors.push(`${email}: ${msg || "falha desconhecida"}`);
            continue;
          }
        } else {
          created++;
        }

        // Garante o role correto (idempotente). Apaga roles anteriores deste user e insere o desejado.
        await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
        const { error: roleErr } = await supabaseAdmin
          .from("user_roles")
          .insert({ user_id: userId, role });
        if (roleErr) errors.push(`${email} (role): ${roleErr.message}`);

        // Para responsáveis (family), cria/atualiza a linha em public.responsaveis
        if (role === "family") {
          const { data: existingResp } = await supabaseAdmin
            .from("responsaveis")
            .select("id")
            .eq("email", email)
            .maybeSingle();
          if (existingResp?.id) {
            await supabaseAdmin
              .from("responsaveis")
              .update({ user_id: userId, nome: display_name })
              .eq("id", existingResp.id);
          } else {
            const { error: rErr } = await supabaseAdmin
              .from("responsaveis")
              .insert({ user_id: userId, nome: display_name, email });
            if (rErr) errors.push(`${email} (responsavel): ${rErr.message}`);
          }
        }
      }
    }

    return { created, skipped, errors };
  });

export const wipeSchoolUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => z.object({ confirm: z.literal(true) }).parse(input))
  .handler(async ({ context }) => {
    const supabaseAdmin = await getAdmin();
    await assertDeveloper(context.userId, supabaseAdmin);

    // Lista todos os perfis com e-mail no domínio demo
    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("user_id, email")
      .like("email", `${SEED_USER_PREFIX}%@${SEED_USER_DOMAIN}`);
    if (error) throw new Error(error.message);

    let deleted = 0;
    const errors: string[] = [];
    for (const p of profiles ?? []) {
      const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(p.user_id);
      if (delErr && !/not.?found|no rows|user.+not exist/i.test(delErr.message)) {
        errors.push(`${p.email}: ${delErr.message}`);
      } else {
        deleted++;
      }
      // Limpa eventuais linhas órfãs (profile/role) que não cascatearam
      await supabaseAdmin.from("user_roles").delete().eq("user_id", p.user_id);
      await supabaseAdmin.from("profiles").delete().eq("user_id", p.user_id);
    }

    // Remove linhas em responsaveis com e-mails demo
    await supabaseAdmin
      .from("responsaveis")
      .delete()
      .like("email", `${SEED_USER_PREFIX}%@${SEED_USER_DOMAIN}`);

    // Varre profiles órfãos remanescentes com padrão demo (sem auth user)
    const { data: leftovers } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .like("email", `${SEED_USER_PREFIX}%@${SEED_USER_DOMAIN}`);
    for (const l of leftovers ?? []) {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", l.user_id);
      await supabaseAdmin.from("profiles").delete().eq("user_id", l.user_id);
    }
    return { deleted, errors };
  });

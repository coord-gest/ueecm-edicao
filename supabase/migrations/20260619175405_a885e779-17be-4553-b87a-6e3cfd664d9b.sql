
-- ============================================================
-- Endurecimento de segurança: profissionais, realtime e funções
-- ============================================================

-- 1) PROFISSIONAIS: anon não pode mais ler email/telefone
--    Re-base do GRANT por coluna em vez de REVOKE incremental
REVOKE SELECT ON public.profissionais FROM anon;
GRANT SELECT (
  id, user_id, nome, foto_url, cargo, cargo_descricao, disciplinas,
  bio, formacao, anos_experiencia, ano_ingresso,
  lattes_url, linkedin_url, site_url,
  ordem, ativo, destaque, created_by, created_at, updated_at
) ON public.profissionais TO anon;
-- authenticated mantém GRANT total (já existente)

-- 2) REALTIME: limitar canais que authenticated pode assinar
--    Antes: USING true (qualquer canal). Agora: apenas tópicos públicos.
DROP POLICY IF EXISTS "realtime_authenticated_read" ON realtime.messages;

CREATE POLICY "realtime_authenticated_scoped_read"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    realtime.topic() = ANY (ARRAY[
      'public:alerts',
      'public:eventos',
      'public:horarios',
      'public:turmas',
      'public:disciplinas',
      'public:posts_publicados'
    ])
  );

-- 3) SECURITY DEFINER: revogar EXECUTE de roles não-autorizados
--    Funções de trigger nunca devem ser chamadas pela API
REVOKE EXECUTE ON FUNCTION public.tg_alerts_enqueue_push() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_posts_enqueue_push()  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_audit_log()           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_set_updated_at()      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()        FROM PUBLIC, anon, authenticated;

-- Helpers de papel: anon não precisa chamar; authenticated sim (usado em policies/UI)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role)    FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_school_staff(uuid)       FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_content(uuid)    FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_staff(uuid)      FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_school_staff(uuid)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_content(uuid)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_staff(uuid)       TO authenticated;

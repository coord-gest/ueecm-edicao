-- =========================================================================
-- 1) PROFISSIONAIS: esconder email/telefone do público (anon)
-- =========================================================================
-- Revoga o SELECT amplo de anon e regrant apenas colunas seguras.
-- authenticated (staff) continua com acesso completo via policies existentes.

REVOKE SELECT ON public.profissionais FROM anon;

GRANT SELECT (
  id,
  nome,
  foto_url,
  cargo,
  cargo_descricao,
  disciplinas,
  bio,
  formacao,
  anos_experiencia,
  ano_ingresso,
  lattes_url,
  linkedin_url,
  site_url,
  ordem,
  ativo,
  destaque,
  created_at,
  updated_at
) ON public.profissionais TO anon;

-- =========================================================================
-- 2) AGENDAMENTOS: esconder observacoes_staff do solicitante
-- =========================================================================
-- Estratégia:
--  a) A view meus_agendamentos (SECURITY DEFINER-style, security_invoker=off)
--     retorna somente colunas seguras do próprio usuário logado.
--  b) A policy SELECT da tabela base passa a permitir leitura apenas para staff.
--  c) INSERT (via RPC criar_agendamento) e o painel de staff continuam iguais.

CREATE OR REPLACE VIEW public.meus_agendamentos
WITH (security_invoker = off) AS
SELECT
  a.id,
  a.protocolo,
  a.solicitante_user_id,
  a.solicitante_nome,
  a.solicitante_relacao,
  a.solicitante_contato,
  a.profissional_id,
  a.alvo_cargo,
  a.motivo,
  a.inicio_at,
  a.fim_at,
  a.status,
  a.created_at,
  a.updated_at,
  p.nome  AS profissional_nome,
  p.cargo AS profissional_cargo
FROM public.agendamentos a
LEFT JOIN public.profissionais p ON p.id = a.profissional_id
WHERE a.solicitante_user_id = auth.uid();

REVOKE ALL ON public.meus_agendamentos FROM PUBLIC, anon;
GRANT SELECT ON public.meus_agendamentos TO authenticated;
GRANT ALL   ON public.meus_agendamentos TO service_role;

-- Restringe SELECT direto da tabela base: só staff enxerga (inclui observacoes_staff).
DROP POLICY IF EXISTS "Usuario ve seus agendamentos" ON public.agendamentos;

CREATE POLICY "Staff ve todos os agendamentos"
  ON public.agendamentos
  FOR SELECT
  TO authenticated
  USING (is_school_admin(auth.uid()));

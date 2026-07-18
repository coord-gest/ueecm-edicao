-- ============================================================================
-- Sincronizar professores cadastrados (contas de login) para o diretório
-- público de profissionais exibido em /equipe.
--
-- Contexto:
--   • /escola/professores  → tabela `profiles` + `user_roles` (role='professor')
--                            São CONTAS DE LOGIN (Supabase Auth).
--   • /equipe              → tabela `profissionais` (vitrine pública com
--                            foto, biografia, disciplinas, cargo, etc.)
--
-- Este script:
--   1) Faz BACKFILL: cria uma linha em `profissionais` para cada professor
--      cadastrado que ainda não tenha registro (comparando por e-mail).
--   2) Instala um TRIGGER que cria automaticamente a linha em
--      `profissionais` quando um novo `user_roles.role='professor'`
--      for atribuído a um usuário.
--
-- Execute passo a passo no SQL Editor do Supabase.
-- ============================================================================


-- ─────────────────────────────────────────────────────────────
-- PASSO 1 — Backfill: cria linhas em profissionais para os
-- professores atuais que ainda não estão lá
-- ─────────────────────────────────────────────────────────────

INSERT INTO public.profissionais (nome, cargo, email, ativo, destaque)
SELECT
  COALESCE(NULLIF(TRIM(p.display_name), ''), split_part(p.email, '@', 1)) AS nome,
  'professor'::text  AS cargo,
  p.email,
  true               AS ativo,
  false              AS destaque
FROM public.profiles p
JOIN public.user_roles ur ON ur.user_id = p.id
WHERE ur.role IN ('professor', 'teacher')
  AND p.email IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.profissionais pr
    WHERE lower(pr.email) = lower(p.email)
  )
ON CONFLICT DO NOTHING;

-- Conferir quantos foram criados:
-- SELECT count(*) FROM public.profissionais WHERE cargo = 'professor';


-- ─────────────────────────────────────────────────────────────
-- PASSO 2 — Trigger: quando um usuário receber role 'professor',
-- criar automaticamente sua linha em profissionais
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.sync_professor_para_profissionais()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_nome  text;
BEGIN
  IF NEW.role NOT IN ('professor', 'teacher') THEN
    RETURN NEW;
  END IF;

  SELECT email, display_name
    INTO v_email, v_nome
  FROM public.profiles
  WHERE id = NEW.user_id;

  IF v_email IS NULL THEN
    RETURN NEW;
  END IF;

  -- Se já existe em profissionais (por e-mail), não duplica.
  IF EXISTS (
    SELECT 1 FROM public.profissionais
    WHERE lower(email) = lower(v_email)
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.profissionais (nome, cargo, email, ativo, destaque)
  VALUES (
    COALESCE(NULLIF(TRIM(v_nome), ''), split_part(v_email, '@', 1)),
    'professor',
    v_email,
    true,
    false
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_professor_para_profissionais ON public.user_roles;

CREATE TRIGGER trg_sync_professor_para_profissionais
AFTER INSERT ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.sync_professor_para_profissionais();


-- ─────────────────────────────────────────────────────────────
-- Verificação final
-- ─────────────────────────────────────────────────────────────
SELECT nome, cargo, email, ativo
FROM public.profissionais
WHERE cargo = 'professor'
ORDER BY nome;

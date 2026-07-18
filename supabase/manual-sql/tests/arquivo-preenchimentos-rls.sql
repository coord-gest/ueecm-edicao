-- Testes de RLS para arquivo_preenchimentos
-- Rode no SQL Editor (com service_role) e confira que TODOS os SELECTs finais retornam PASS.

BEGIN;

-- Cria 4 usuários fictícios em auth.users
INSERT INTO auth.users (id, email) VALUES
  ('11111111-1111-1111-1111-111111111111', 'prof_a@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'prof_b@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'diretor@test.local'),
  ('44444444-4444-4444-4444-444444444444', 'responsavel@test.local')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role) VALUES
  ('11111111-1111-1111-1111-111111111111', 'professor'),
  ('22222222-2222-2222-2222-222222222222', 'professor'),
  ('33333333-3333-3333-3333-333333333333', 'diretor')
ON CONFLICT DO NOTHING;

-- Teste 1: is_professor_or_staff
SELECT
  CASE WHEN public.is_professor_or_staff('11111111-1111-1111-1111-111111111111')
       AND public.is_professor_or_staff('22222222-2222-2222-2222-222222222222')
       AND public.is_professor_or_staff('33333333-3333-3333-3333-333333333333')
       AND NOT public.is_professor_or_staff('44444444-4444-4444-4444-444444444444')
       THEN 'PASS: is_professor_or_staff funciona'
       ELSE 'FAIL: is_professor_or_staff'
  END AS teste_1;

-- Teste 2: can_delete_arquivo_preenchimento
SELECT
  CASE WHEN NOT public.can_delete_arquivo_preenchimento('11111111-1111-1111-1111-111111111111')
       AND NOT public.can_delete_arquivo_preenchimento('22222222-2222-2222-2222-222222222222')
       AND public.can_delete_arquivo_preenchimento('33333333-3333-3333-3333-333333333333')
       AND NOT public.can_delete_arquivo_preenchimento('44444444-4444-4444-4444-444444444444')
       THEN 'PASS: can_delete permite só diretor/coordenador/desenvolvedor'
       ELSE 'FAIL: can_delete'
  END AS teste_2;

-- Teste 3: simulação de UPDATE colaborativo — prof_b atualiza registro criado por prof_a
-- (roda como authenticated, via set_config)
DO $$
DECLARE
  v_id uuid;
  v_turma_id uuid;
BEGIN
  SELECT id INTO v_turma_id FROM public.turmas_escolares LIMIT 1;
  IF v_turma_id IS NULL THEN
    RAISE NOTICE 'SKIP teste 3: nenhuma turma cadastrada';
    RETURN;
  END IF;

  -- prof_a cria
  PERFORM set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  PERFORM set_config('role', 'authenticated', true);
  INSERT INTO public.arquivo_preenchimentos (template_id, turma_id, bimestre, titulo, dados, criado_por, atualizado_por)
  VALUES ('avaliacao-bimestral', v_turma_id, 1, 'Teste RLS', '{"alunos":[],"notas":{}}'::jsonb,
          '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111')
  RETURNING id INTO v_id;

  -- prof_b atualiza (deve funcionar — edição colaborativa)
  PERFORM set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
  UPDATE public.arquivo_preenchimentos
     SET titulo = 'Editado por prof_b', atualizado_por = '22222222-2222-2222-2222-222222222222'
   WHERE id = v_id;

  IF NOT EXISTS (SELECT 1 FROM public.arquivo_preenchimentos WHERE id = v_id AND titulo = 'Editado por prof_b') THEN
    RAISE EXCEPTION 'FAIL teste 3: prof_b não conseguiu editar preenchimento de prof_a';
  END IF;

  -- prof_b tenta excluir (deve falhar)
  BEGIN
    DELETE FROM public.arquivo_preenchimentos WHERE id = v_id;
    IF EXISTS (SELECT 1 FROM public.arquivo_preenchimentos WHERE id = v_id) THEN
      RAISE NOTICE 'PASS teste 4a: DELETE do professor foi bloqueado (linha ainda existe)';
    ELSE
      RAISE EXCEPTION 'FAIL teste 4a: professor conseguiu excluir!';
    END IF;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS teste 4a: DELETE do professor bloqueado por RLS';
  END;

  -- diretor exclui (deve funcionar + registrar em audit_logs)
  PERFORM set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
  DELETE FROM public.arquivo_preenchimentos WHERE id = v_id;

  IF EXISTS (SELECT 1 FROM public.arquivo_preenchimentos WHERE id = v_id) THEN
    RAISE EXCEPTION 'FAIL teste 4b: diretor não conseguiu excluir';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.audit_logs
    WHERE table_name = 'arquivo_preenchimentos'
      AND action = 'DELETE'
      AND record_id = v_id
      AND actor_id = '33333333-3333-3333-3333-333333333333'
  ) THEN
    RAISE EXCEPTION 'FAIL teste 5: auditoria não registrou a exclusão';
  END IF;

  RAISE NOTICE 'PASS teste 3: edição colaborativa OK';
  RAISE NOTICE 'PASS teste 4b: diretor excluiu com sucesso';
  RAISE NOTICE 'PASS teste 5: auditoria registrou a exclusão';
END $$;

-- IMPORTANTE: rollback para não deixar dados de teste
ROLLBACK;

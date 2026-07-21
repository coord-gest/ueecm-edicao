
-- RPC: calcular radar do aluno (4 KPIs consolidados)
CREATE OR REPLACE FUNCTION public.calcular_radar_aluno(_aluno_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_autorizado boolean := false;
  v_aluno record;
  v_freq_total int;
  v_freq_presente int;
  v_freq_pct numeric;
  v_notas_media numeric;
  v_notas_ultimas numeric;
  v_notas_count int;
  v_ativ_total int;
  v_ativ_entregues int;
  v_ativ_pendentes_atrasadas int;
  v_ativ_pct numeric;
  v_diario_elogios int;
  v_diario_avancos int;
  v_diario_atencao int;
  v_diario_saldo int;
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;

  -- Autorização: responsável do aluno, professor da turma, ou admin escolar
  v_autorizado := public.is_responsavel_do_aluno(v_uid, _aluno_id)
               OR public.is_professor_do_aluno(v_uid, _aluno_id)
               OR public.is_school_admin(v_uid);

  IF NOT v_autorizado THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  SELECT a.id, a.nome_completo, a.turma_id, t.nome AS turma_nome
    INTO v_aluno
  FROM public.alunos a
  LEFT JOIN public.turmas_escolares t ON t.id = a.turma_id
  WHERE a.id = _aluno_id;

  IF v_aluno.id IS NULL THEN
    RAISE EXCEPTION 'Aluno não encontrado';
  END IF;

  -- Frequência (últimos 30 dias)
  SELECT count(*), count(*) FILTER (WHERE presente IS TRUE)
    INTO v_freq_total, v_freq_presente
  FROM public.frequencia
  WHERE aluno_id = _aluno_id AND data >= (CURRENT_DATE - INTERVAL '30 days');

  v_freq_pct := CASE WHEN v_freq_total > 0
    THEN round((v_freq_presente::numeric / v_freq_total) * 100, 1)
    ELSE NULL END;

  -- Notas: média geral e média das últimas (3 últimas por disciplina)
  SELECT round(avg(valor)::numeric, 1), count(*)
    INTO v_notas_media, v_notas_count
  FROM public.notas WHERE aluno_id = _aluno_id;

  SELECT round(avg(valor)::numeric, 1) INTO v_notas_ultimas FROM (
    SELECT valor
    FROM public.notas
    WHERE aluno_id = _aluno_id
    ORDER BY created_at DESC
    LIMIT 6
  ) x;

  -- Atividades
  SELECT count(*),
         count(*) FILTER (WHERE COALESCE(e.entregue, false) IS TRUE),
         count(*) FILTER (WHERE COALESCE(e.entregue, false) IS FALSE AND at.data_entrega < now())
    INTO v_ativ_total, v_ativ_entregues, v_ativ_pendentes_atrasadas
  FROM public.atividades at
  LEFT JOIN public.atividade_entregas e
    ON e.atividade_id = at.id AND e.aluno_id = _aluno_id
  WHERE at.ativo IS TRUE
    AND at.turma_id = v_aluno.turma_id;

  v_ativ_pct := CASE WHEN v_ativ_total > 0
    THEN round((v_ativ_entregues::numeric / v_ativ_total) * 100, 1)
    ELSE NULL END;

  -- Diário de Bordo (últimos 30 dias)
  SELECT
    count(*) FILTER (WHERE tipo::text = 'elogio'),
    count(*) FILTER (WHERE tipo::text = 'avanco'),
    count(*) FILTER (WHERE tipo::text = 'atencao')
    INTO v_diario_elogios, v_diario_avancos, v_diario_atencao
  FROM public.diario_bordo
  WHERE aluno_id = _aluno_id
    AND data_registro >= (CURRENT_DATE - INTERVAL '30 days');

  v_diario_saldo := (v_diario_elogios + v_diario_avancos) - v_diario_atencao;

  v_result := jsonb_build_object(
    'aluno', jsonb_build_object(
      'id', v_aluno.id,
      'nome', v_aluno.nome_completo,
      'turma_id', v_aluno.turma_id,
      'turma_nome', v_aluno.turma_nome
    ),
    'frequencia', jsonb_build_object(
      'total', v_freq_total,
      'presentes', v_freq_presente,
      'percentual', v_freq_pct
    ),
    'notas', jsonb_build_object(
      'media_geral', v_notas_media,
      'media_ultimas', v_notas_ultimas,
      'total_lancamentos', v_notas_count
    ),
    'atividades', jsonb_build_object(
      'total', v_ativ_total,
      'entregues', v_ativ_entregues,
      'atrasadas', v_ativ_pendentes_atrasadas,
      'percentual', v_ativ_pct
    ),
    'comportamento', jsonb_build_object(
      'elogios', v_diario_elogios,
      'avancos', v_diario_avancos,
      'atencao', v_diario_atencao,
      'saldo', v_diario_saldo
    ),
    'calculado_em', now()
  );

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.calcular_radar_aluno(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calcular_radar_aluno(uuid) TO authenticated;

-- RPC: listar filhos do responsável autenticado (nome + id + turma)
CREATE OR REPLACE FUNCTION public.listar_meus_filhos_radar()
RETURNS TABLE(aluno_id uuid, nome text, turma_nome text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id, a.nome_completo, COALESCE(t.nome, '')
  FROM public.aluno_responsavel ar
  JOIN public.responsaveis r ON r.id = ar.responsavel_id
  JOIN public.alunos a ON a.id = ar.aluno_id
  LEFT JOIN public.turmas_escolares t ON t.id = a.turma_id
  WHERE r.user_id = auth.uid()
    AND a.ativo IS TRUE
  ORDER BY a.nome_completo;
$$;

REVOKE EXECUTE ON FUNCTION public.listar_meus_filhos_radar() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listar_meus_filhos_radar() TO authenticated;

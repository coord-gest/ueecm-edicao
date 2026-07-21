
-- Função: calcular risco de evasão de um aluno (0-100)
CREATE OR REPLACE FUNCTION public.calcular_risco_evasao(_aluno_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_freq_pct numeric;
  v_freq_total int;
  v_freq_presentes int;
  v_media_notas numeric;
  v_total_notas int;
  v_ativ_total int;
  v_ativ_pendentes int;
  v_ativ_atrasadas int;
  v_meritos_atencao int;
  v_meritos_ocorrencia int;
  v_saldo_comportamento int;
  v_score int := 0;
  v_fatores jsonb := '[]'::jsonb;
  v_nivel text;
  v_nome text;
  v_turma_id uuid;
  v_turma_nome text;
BEGIN
  -- Autorização: admin escolar, professor do aluno, ou responsável
  IF NOT (
    public.is_school_admin(v_uid)
    OR public.is_professor_do_aluno(v_uid, _aluno_id)
    OR public.is_responsavel_do_aluno(v_uid, _aluno_id)
  ) THEN
    RAISE EXCEPTION 'Sem permissão para consultar risco deste aluno';
  END IF;

  SELECT a.nome, a.turma_id, t.nome
    INTO v_nome, v_turma_id, v_turma_nome
  FROM public.alunos a
  LEFT JOIN public.turmas t ON t.id = a.turma_id
  WHERE a.id = _aluno_id;

  -- Frequência últimos 30 dias
  SELECT COUNT(*), COUNT(*) FILTER (WHERE presente = true)
    INTO v_freq_total, v_freq_presentes
  FROM public.frequencia
  WHERE aluno_id = _aluno_id
    AND data >= (CURRENT_DATE - INTERVAL '30 days');

  v_freq_pct := CASE WHEN v_freq_total > 0 THEN ROUND((v_freq_presentes::numeric / v_freq_total) * 100, 1) ELSE NULL END;

  -- Média das últimas notas
  SELECT ROUND(AVG(valor)::numeric, 2), COUNT(*)
    INTO v_media_notas, v_total_notas
  FROM (
    SELECT valor FROM public.notas
    WHERE aluno_id = _aluno_id AND valor IS NOT NULL
    ORDER BY created_at DESC LIMIT 10
  ) ult;

  -- Atividades (últimos 60 dias)
  SELECT
    COUNT(DISTINCT at.id),
    COUNT(DISTINCT at.id) FILTER (
      WHERE NOT EXISTS (
        SELECT 1 FROM public.atividade_entregas e
        WHERE e.atividade_id = at.id AND e.aluno_id = _aluno_id AND e.status = 'entregue'
      )
    ),
    COUNT(DISTINCT at.id) FILTER (
      WHERE at.prazo IS NOT NULL AND at.prazo < NOW()
        AND NOT EXISTS (
          SELECT 1 FROM public.atividade_entregas e
          WHERE e.atividade_id = at.id AND e.aluno_id = _aluno_id AND e.status = 'entregue'
        )
    )
  INTO v_ativ_total, v_ativ_pendentes, v_ativ_atrasadas
  FROM public.atividades at
  WHERE at.turma_id = v_turma_id
    AND at.created_at >= (NOW() - INTERVAL '60 days');

  -- Comportamento (últimos 60 dias)
  SELECT
    COUNT(*) FILTER (WHERE merito_tipo = 'atencao'),
    COUNT(*) FILTER (WHERE merito_tipo = 'ocorrencia'),
    COUNT(*) FILTER (WHERE merito_tipo IN ('elogio','avanco'))
      - COUNT(*) FILTER (WHERE merito_tipo IN ('atencao','ocorrencia'))
  INTO v_meritos_atencao, v_meritos_ocorrencia, v_saldo_comportamento
  FROM public.meritos_ocorrencias
  WHERE aluno_id = _aluno_id
    AND created_at >= (NOW() - INTERVAL '60 days');

  -- Cálculo do score
  -- Frequência (peso 40)
  IF v_freq_pct IS NOT NULL THEN
    IF v_freq_pct < 60 THEN
      v_score := v_score + 40;
      v_fatores := v_fatores || jsonb_build_object('tipo','frequencia','peso',40,'descricao', format('Frequência crítica: %s%%', v_freq_pct));
    ELSIF v_freq_pct < 75 THEN
      v_score := v_score + 25;
      v_fatores := v_fatores || jsonb_build_object('tipo','frequencia','peso',25,'descricao', format('Frequência baixa: %s%%', v_freq_pct));
    ELSIF v_freq_pct < 85 THEN
      v_score := v_score + 10;
      v_fatores := v_fatores || jsonb_build_object('tipo','frequencia','peso',10,'descricao', format('Frequência em atenção: %s%%', v_freq_pct));
    END IF;
  END IF;

  -- Notas (peso 25)
  IF v_media_notas IS NOT NULL THEN
    IF v_media_notas < 4 THEN
      v_score := v_score + 25;
      v_fatores := v_fatores || jsonb_build_object('tipo','notas','peso',25,'descricao', format('Média crítica: %s', v_media_notas));
    ELSIF v_media_notas < 6 THEN
      v_score := v_score + 15;
      v_fatores := v_fatores || jsonb_build_object('tipo','notas','peso',15,'descricao', format('Média baixa: %s', v_media_notas));
    END IF;
  END IF;

  -- Atividades atrasadas (peso 20)
  IF v_ativ_atrasadas >= 5 THEN
    v_score := v_score + 20;
    v_fatores := v_fatores || jsonb_build_object('tipo','atividades','peso',20,'descricao', format('%s atividades atrasadas', v_ativ_atrasadas));
  ELSIF v_ativ_atrasadas >= 2 THEN
    v_score := v_score + 10;
    v_fatores := v_fatores || jsonb_build_object('tipo','atividades','peso',10,'descricao', format('%s atividades atrasadas', v_ativ_atrasadas));
  END IF;

  -- Comportamento (peso 15)
  IF v_meritos_ocorrencia >= 2 OR (v_meritos_atencao >= 3 AND v_saldo_comportamento < 0) THEN
    v_score := v_score + 15;
    v_fatores := v_fatores || jsonb_build_object('tipo','comportamento','peso',15,'descricao', format('%s ocorrência(s), %s atenção(ões)', v_meritos_ocorrencia, v_meritos_atencao));
  ELSIF v_meritos_atencao >= 2 THEN
    v_score := v_score + 8;
    v_fatores := v_fatores || jsonb_build_object('tipo','comportamento','peso',8,'descricao', format('%s registros de atenção', v_meritos_atencao));
  END IF;

  v_score := LEAST(v_score, 100);
  v_nivel := CASE
    WHEN v_score >= 60 THEN 'alto'
    WHEN v_score >= 30 THEN 'medio'
    WHEN v_score >= 10 THEN 'baixo'
    ELSE 'ok'
  END;

  RETURN jsonb_build_object(
    'aluno_id', _aluno_id,
    'nome', v_nome,
    'turma_id', v_turma_id,
    'turma_nome', v_turma_nome,
    'score', v_score,
    'nivel', v_nivel,
    'fatores', v_fatores,
    'frequencia_pct', v_freq_pct,
    'media_notas', v_media_notas,
    'ativ_atrasadas', v_ativ_atrasadas,
    'ativ_pendentes', v_ativ_pendentes,
    'meritos_atencao', v_meritos_atencao,
    'meritos_ocorrencia', v_meritos_ocorrencia,
    'calculado_em', NOW()
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.calcular_risco_evasao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calcular_risco_evasao(uuid) TO authenticated;

-- Função: listar alunos em risco para gestão escolar
CREATE OR REPLACE FUNCTION public.listar_alunos_em_risco(_nivel_min text DEFAULT 'medio')
RETURNS TABLE (
  aluno_id uuid,
  nome text,
  turma_id uuid,
  turma_nome text,
  score int,
  nivel text,
  frequencia_pct numeric,
  media_notas numeric,
  ativ_atrasadas int,
  meritos_atencao int
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_score_min int;
BEGIN
  IF NOT public.is_school_admin(v_uid) THEN
    RAISE EXCEPTION 'Somente gestão escolar pode listar alunos em risco';
  END IF;

  v_score_min := CASE _nivel_min
    WHEN 'alto' THEN 60
    WHEN 'medio' THEN 30
    WHEN 'baixo' THEN 10
    ELSE 30
  END;

  RETURN QUERY
  SELECT
    (r->>'aluno_id')::uuid,
    r->>'nome',
    NULLIF(r->>'turma_id','')::uuid,
    r->>'turma_nome',
    (r->>'score')::int,
    r->>'nivel',
    NULLIF(r->>'frequencia_pct','')::numeric,
    NULLIF(r->>'media_notas','')::numeric,
    (r->>'ativ_atrasadas')::int,
    (r->>'meritos_atencao')::int
  FROM public.alunos a
  CROSS JOIN LATERAL public.calcular_risco_evasao(a.id) r
  WHERE a.ativo = true
    AND (r->>'score')::int >= v_score_min
  ORDER BY (r->>'score')::int DESC
  LIMIT 200;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.listar_alunos_em_risco(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listar_alunos_em_risco(text) TO authenticated;

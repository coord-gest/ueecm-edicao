
-- Presence score for the current authenticated parent
CREATE OR REPLACE FUNCTION public.calcular_presenca_parental(_user_id uuid, _dias int DEFAULT 90)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inicio timestamptz := now() - make_interval(days => _dias);
  v_com_lidos int := 0;
  v_com_total int := 0;
  v_aut_resp int := 0;
  v_aut_rapidas int := 0;
  v_dias_ativos int := 0;
  v_pontos int := 0;
  v_taxa_leitura numeric := 0;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('erro', 'sem_usuario');
  END IF;

  -- Comunicados lidos pelo responsável no período
  SELECT COUNT(*) INTO v_com_lidos
  FROM public.comunicado_leituras
  WHERE usuario_id = _user_id AND lido_em >= v_inicio;

  -- Total de comunicados publicados no período (denominador aproximado)
  SELECT COUNT(*) INTO v_com_total
  FROM public.comunicados
  WHERE created_at >= v_inicio;

  -- Autorizações respondidas
  SELECT COUNT(*) INTO v_aut_resp
  FROM public.autorizacao_respostas
  WHERE respondido_por = _user_id AND assinado_em >= v_inicio;

  -- Autorizações respondidas em < 24h após a criação
  SELECT COUNT(*) INTO v_aut_rapidas
  FROM public.autorizacao_respostas r
  JOIN public.autorizacoes a ON a.id = r.autorizacao_id
  WHERE r.respondido_por = _user_id
    AND r.assinado_em >= v_inicio
    AND r.assinado_em <= a.created_at + interval '24 hours';

  -- Dias distintos com atividade (leitura ou resposta)
  SELECT COUNT(DISTINCT d) INTO v_dias_ativos FROM (
    SELECT date_trunc('day', lido_em) d
      FROM public.comunicado_leituras
      WHERE usuario_id = _user_id AND lido_em >= v_inicio
    UNION
    SELECT date_trunc('day', assinado_em) d
      FROM public.autorizacao_respostas
      WHERE respondido_por = _user_id AND assinado_em >= v_inicio
  ) t;

  v_pontos := (v_com_lidos * 2) + (v_aut_resp * 5) + (v_aut_rapidas * 10) + (v_dias_ativos * 3);
  IF v_com_total > 0 THEN
    v_taxa_leitura := ROUND((v_com_lidos::numeric / v_com_total) * 100, 1);
  END IF;

  RETURN jsonb_build_object(
    'periodo_dias', _dias,
    'pontos', v_pontos,
    'comunicados_lidos', v_com_lidos,
    'comunicados_total', v_com_total,
    'taxa_leitura', v_taxa_leitura,
    'autorizacoes_respondidas', v_aut_resp,
    'autorizacoes_rapidas', v_aut_rapidas,
    'dias_ativos', v_dias_ativos,
    'calculado_em', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.calcular_presenca_parental(uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calcular_presenca_parental(uuid, int) TO authenticated;

-- Ranking (apenas top N, expõe apenas iniciais do nome)
CREATE OR REPLACE FUNCTION public.ranking_presenca_parental(_limite int DEFAULT 10, _dias int DEFAULT 90)
RETURNS TABLE(posicao int, iniciais text, pontos int, is_you boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT r.user_id,
           r.nome,
           (public.calcular_presenca_parental(r.user_id, _dias)->>'pontos')::int AS pts
    FROM public.responsaveis r
    WHERE r.user_id IS NOT NULL
  ), ranked AS (
    SELECT ROW_NUMBER() OVER (ORDER BY pts DESC) AS pos,
           user_id, nome, pts
    FROM base
    WHERE pts > 0
    ORDER BY pts DESC
    LIMIT GREATEST(_limite, 1)
  )
  SELECT pos::int,
         -- Apenas primeiras letras (privacidade)
         COALESCE(
           regexp_replace(
             array_to_string(
               ARRAY(SELECT LEFT(w,1) FROM regexp_split_to_table(nome, '\s+') w WHERE LENGTH(w) > 0),
               '.'
             ) || '.', '\s+', '', 'g'
           ), 'Família'
         ) AS iniciais,
         pts,
         (user_id = v_uid) AS is_you
  FROM ranked;
END;
$$;

REVOKE ALL ON FUNCTION public.ranking_presenca_parental(int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ranking_presenca_parental(int, int) TO authenticated;

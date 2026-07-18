
CREATE OR REPLACE FUNCTION public.tv_aniversariantes_hoje()
RETURNS TABLE(primeiro_nome text, turma_nome text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT split_part(a.nome_completo, ' ', 1) AS primeiro_nome,
         COALESCE(t.nome, '') AS turma_nome
  FROM public.alunos a
  LEFT JOIN public.turmas_escolares t ON t.id = a.turma_id
  WHERE a.ativo IS TRUE
    AND a.data_nascimento IS NOT NULL
    AND extract(month FROM a.data_nascimento) = extract(month FROM (now() AT TIME ZONE 'America/Fortaleza'))
    AND extract(day   FROM a.data_nascimento) = extract(day   FROM (now() AT TIME ZONE 'America/Fortaleza'))
  ORDER BY primeiro_nome;
$$;

REVOKE ALL ON FUNCTION public.tv_aniversariantes_hoje() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tv_aniversariantes_hoje() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.tv_aniversariantes_mes()
RETURNS TABLE(primeiro_nome text, turma_nome text, dia int)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT split_part(a.nome_completo, ' ', 1) AS primeiro_nome,
         COALESCE(t.nome, '') AS turma_nome,
         extract(day FROM a.data_nascimento)::int AS dia
  FROM public.alunos a
  LEFT JOIN public.turmas_escolares t ON t.id = a.turma_id
  WHERE a.ativo IS TRUE
    AND a.data_nascimento IS NOT NULL
    AND extract(month FROM a.data_nascimento) = extract(month FROM (now() AT TIME ZONE 'America/Fortaleza'))
  ORDER BY dia, primeiro_nome;
$$;

REVOKE ALL ON FUNCTION public.tv_aniversariantes_mes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tv_aniversariantes_mes() TO anon, authenticated;

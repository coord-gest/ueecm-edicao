-- ============================================================
-- Arquivo Preenchimentos: Acesso colaborativo + Exclusão restrita
-- ============================================================
-- Regras:
--  • SELECT/INSERT/UPDATE → qualquer professor OU staff (edição simultânea)
--  • DELETE               → apenas Desenvolvedor, Diretor ou Coordenador
-- Executar no SQL Editor do Supabase.

-- 1) Helper: pode excluir preenchimentos
CREATE OR REPLACE FUNCTION public.can_delete_arquivo_preenchimento(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('desenvolvedor','developer','diretor','director','coordenador','coordinator')
  );
$$;

GRANT EXECUTE ON FUNCTION public.can_delete_arquivo_preenchimento(uuid) TO authenticated;

-- 2) Helper: qualquer professor ou staff pode ler/editar
CREATE OR REPLACE FUNCTION public.is_professor_or_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN (
        'professor','teacher',
        'admin','administrador',
        'diretor','director',
        'coordenador','coordinator',
        'secretario',
        'desenvolvedor','developer'
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_professor_or_staff(uuid) TO authenticated;

-- 3) Remover políticas antigas (restritas ao professor da turma)
DROP POLICY IF EXISTS "Prof da turma e admins podem ler"      ON public.arquivo_preenchimentos;
DROP POLICY IF EXISTS "Prof da turma e admins podem inserir"  ON public.arquivo_preenchimentos;
DROP POLICY IF EXISTS "Prof da turma e admins podem atualizar" ON public.arquivo_preenchimentos;
DROP POLICY IF EXISTS "Prof da turma e admins podem excluir"   ON public.arquivo_preenchimentos;

-- 4) Novas políticas colaborativas
CREATE POLICY "arquivo_preench_select"
ON public.arquivo_preenchimentos FOR SELECT
TO authenticated
USING (public.is_professor_or_staff(auth.uid()));

CREATE POLICY "arquivo_preench_insert"
ON public.arquivo_preenchimentos FOR INSERT
TO authenticated
WITH CHECK (
  public.is_professor_or_staff(auth.uid())
  AND criado_por = auth.uid()
);

-- Qualquer professor/staff pode editar QUALQUER preenchimento (colaborativo)
CREATE POLICY "arquivo_preench_update"
ON public.arquivo_preenchimentos FOR UPDATE
TO authenticated
USING (public.is_professor_or_staff(auth.uid()))
WITH CHECK (public.is_professor_or_staff(auth.uid()));

-- DELETE restrito: apenas Desenvolvedor / Diretor / Coordenador
CREATE POLICY "arquivo_preench_delete"
ON public.arquivo_preenchimentos FOR DELETE
TO authenticated
USING (public.can_delete_arquivo_preenchimento(auth.uid()));

-- 5) Grants (garantir acesso à Data API)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.arquivo_preenchimentos TO authenticated;
GRANT ALL ON public.arquivo_preenchimentos TO service_role;

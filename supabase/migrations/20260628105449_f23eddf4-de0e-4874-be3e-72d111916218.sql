
ALTER TABLE public.post_comentarios ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.post_comentarios ADD COLUMN IF NOT EXISTS autor_email text;
ALTER TABLE public.post_comentarios ADD COLUMN IF NOT EXISTS autor_idade integer;
ALTER TABLE public.post_comentarios ADD COLUMN IF NOT EXISTS autor_sexo text;

GRANT INSERT ON public.post_comentarios TO anon;

DROP POLICY IF EXISTS "Usuario autenticado cria comentario" ON public.post_comentarios;

CREATE POLICY "Qualquer um envia comentario"
ON public.post_comentarios
FOR INSERT
TO anon, authenticated
WITH CHECK (
  status = 'pendente'
  AND user_id IS NULL
  AND char_length(conteudo) BETWEEN 1 AND 2000
  AND char_length(autor_nome) BETWEEN 1 AND 100
  AND (autor_email IS NULL OR char_length(autor_email) <= 255)
  AND (autor_idade IS NULL OR (autor_idade BETWEEN 1 AND 120))
  AND (autor_sexo IS NULL OR autor_sexo IN ('feminino','masculino','outro','prefiro_nao_dizer'))
);

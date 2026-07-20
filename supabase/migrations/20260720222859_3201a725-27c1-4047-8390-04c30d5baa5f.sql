
DO $$ BEGIN
  CREATE TYPE public.planejamento_tipo AS ENUM ('semanal','quinzenal','mensal','semestral');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.planejamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professor_id uuid NOT NULL,
  professor_nome text NOT NULL,
  disciplina_id uuid,
  disciplina_nome text NOT NULL,
  tipo public.planejamento_tipo NOT NULL,
  titulo text NOT NULL,
  descricao text,
  conteudo_ia text,
  periodo_inicio date,
  periodo_fim date,
  arquivo_url text,
  arquivo_nome text,
  arquivo_tamanho bigint,
  ai_generated boolean NOT NULL DEFAULT false,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS planejamentos_professor_idx ON public.planejamentos(professor_id);
CREATE INDEX IF NOT EXISTS planejamentos_tipo_idx ON public.planejamentos(tipo);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.planejamentos TO authenticated;
GRANT ALL ON public.planejamentos TO service_role;

ALTER TABLE public.planejamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Professor vê seus planejamentos"
ON public.planejamentos FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profissionais p WHERE p.id = planejamentos.professor_id AND p.user_id = auth.uid())
  OR public.is_school_admin(auth.uid())
);

CREATE POLICY "Gestão gerencia planejamentos"
ON public.planejamentos FOR ALL TO authenticated
USING (public.is_school_admin(auth.uid()))
WITH CHECK (public.is_school_admin(auth.uid()));

CREATE TRIGGER planejamentos_set_updated_at
BEFORE UPDATE ON public.planejamentos
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE POLICY "planejamentos: gestao upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'planejamentos' AND public.is_school_admin(auth.uid()));

CREATE POLICY "planejamentos: gestao update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'planejamentos' AND public.is_school_admin(auth.uid()));

CREATE POLICY "planejamentos: gestao delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'planejamentos' AND public.is_school_admin(auth.uid()));

CREATE POLICY "planejamentos: professor le proprios"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'planejamentos' AND (
    public.is_school_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.planejamentos pl
      JOIN public.profissionais pr ON pr.id = pl.professor_id
      WHERE pr.user_id = auth.uid()
        AND pl.arquivo_url LIKE '%' || storage.objects.name || '%'
    )
  )
);

-- Apresentacoes: editor de slides para reuniões/comunicados
CREATE TABLE public.apresentacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL DEFAULT 'Nova apresentação',
  descricao text,
  slides jsonb NOT NULL DEFAULT '[]'::jsonb,
  tema text NOT NULL DEFAULT 'institucional',
  visibilidade text NOT NULL DEFAULT 'privada' CHECK (visibilidade IN ('privada','equipe','publica')),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX apresentacoes_owner_idx ON public.apresentacoes(owner_id);
CREATE INDEX apresentacoes_visibilidade_idx ON public.apresentacoes(visibilidade);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.apresentacoes TO authenticated;
GRANT SELECT ON public.apresentacoes TO anon;
GRANT ALL ON public.apresentacoes TO service_role;

ALTER TABLE public.apresentacoes ENABLE ROW LEVEL SECURITY;

-- Leitura pública apenas para apresentações marcadas como publicas
CREATE POLICY "apresentacoes public read"
  ON public.apresentacoes FOR SELECT TO anon
  USING (visibilidade = 'publica');

-- Autenticados: dono lê tudo seu; equipe lê as marcadas como equipe; admins escolares leem todas
CREATE POLICY "apresentacoes authenticated read"
  ON public.apresentacoes FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR visibilidade = 'publica'
    OR (visibilidade = 'equipe' AND public.is_professor_or_staff(auth.uid()))
    OR public.is_school_admin(auth.uid())
  );

-- Criar: qualquer professor/staff autenticado
CREATE POLICY "apresentacoes insert staff"
  ON public.apresentacoes FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND public.is_professor_or_staff(auth.uid())
  );

-- Editar: dono ou admins escolares
CREATE POLICY "apresentacoes update owner or admin"
  ON public.apresentacoes FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.is_school_admin(auth.uid()))
  WITH CHECK (owner_id = auth.uid() OR public.is_school_admin(auth.uid()));

-- Excluir: dono ou admins escolares
CREATE POLICY "apresentacoes delete owner or admin"
  ON public.apresentacoes FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.is_school_admin(auth.uid()));

CREATE TRIGGER tg_apresentacoes_updated_at
  BEFORE UPDATE ON public.apresentacoes
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
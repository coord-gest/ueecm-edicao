-- Helper: pode gerenciar profissionais (dev/diretor/coordenador)
CREATE OR REPLACE FUNCTION public.can_manage_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text IN ('desenvolvedor','diretor','coordenador')
  )
$$;

CREATE TABLE public.profissionais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  nome text NOT NULL,
  foto_url text,
  cargo text NOT NULL CHECK (cargo IN ('diretor','coordenador','professor','secretario','outro')),
  cargo_descricao text,
  disciplinas text[] NOT NULL DEFAULT '{}',
  bio text,
  formacao text,
  anos_experiencia integer CHECK (anos_experiencia >= 0 AND anos_experiencia <= 80),
  ano_ingresso integer CHECK (ano_ingresso >= 1900 AND ano_ingresso <= 2100),
  email text,
  telefone text,
  lattes_url text,
  linkedin_url text,
  site_url text,
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  destaque boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.profissionais TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profissionais TO authenticated;
GRANT ALL ON public.profissionais TO service_role;

ALTER TABLE public.profissionais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profissionais ativos são públicos"
  ON public.profissionais FOR SELECT
  USING (ativo = true OR public.can_manage_staff(auth.uid()));

CREATE POLICY "Gestores podem inserir profissionais"
  ON public.profissionais FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_staff(auth.uid()));

CREATE POLICY "Gestores podem atualizar profissionais"
  ON public.profissionais FOR UPDATE TO authenticated
  USING (public.can_manage_staff(auth.uid()))
  WITH CHECK (public.can_manage_staff(auth.uid()));

CREATE POLICY "Gestores podem remover profissionais"
  ON public.profissionais FOR DELETE TO authenticated
  USING (public.can_manage_staff(auth.uid()));

CREATE TRIGGER profissionais_set_updated_at
  BEFORE UPDATE ON public.profissionais
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TRIGGER profissionais_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.profissionais
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_log();

CREATE INDEX profissionais_cargo_idx ON public.profissionais (cargo);
CREATE INDEX profissionais_ativo_ordem_idx ON public.profissionais (ativo, ordem);

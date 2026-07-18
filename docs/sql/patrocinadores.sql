-- ============================================================
-- Nossos Patrocinadores — schema + RLS + grants
-- Rodar no SQL Editor do Supabase (uma vez).
-- ============================================================

-- 1) Helper de permissão: apenas Diretor / Desenvolvedor / Admin
CREATE OR REPLACE FUNCTION public.can_manage_patrocinadores(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('diretor','director','desenvolvedor','developer','admin')
  );
$$;
GRANT EXECUTE ON FUNCTION public.can_manage_patrocinadores(uuid) TO anon, authenticated;

-- 2) Eventos de patrocínio (Festa Junina, Aniversário da Escola, etc.)
CREATE TABLE IF NOT EXISTS public.eventos_patrocinio (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome         text NOT NULL,
  descricao    text,
  data_inicio  date,
  data_fim     date,
  ativo        boolean NOT NULL DEFAULT false,
  ordem        int NOT NULL DEFAULT 0,
  created_by   uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.eventos_patrocinio TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.eventos_patrocinio TO authenticated;
GRANT ALL ON public.eventos_patrocinio TO service_role;

ALTER TABLE public.eventos_patrocinio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "eventos_patrocinio_public_read"  ON public.eventos_patrocinio;
DROP POLICY IF EXISTS "eventos_patrocinio_admin_read"   ON public.eventos_patrocinio;
DROP POLICY IF EXISTS "eventos_patrocinio_admin_write"  ON public.eventos_patrocinio;

CREATE POLICY "eventos_patrocinio_public_read"
  ON public.eventos_patrocinio FOR SELECT
  TO anon, authenticated
  USING (ativo = true);

CREATE POLICY "eventos_patrocinio_admin_read"
  ON public.eventos_patrocinio FOR SELECT
  TO authenticated
  USING (public.can_manage_patrocinadores(auth.uid()));

CREATE POLICY "eventos_patrocinio_admin_write"
  ON public.eventos_patrocinio FOR ALL
  TO authenticated
  USING (public.can_manage_patrocinadores(auth.uid()))
  WITH CHECK (public.can_manage_patrocinadores(auth.uid()));

CREATE TRIGGER tg_eventos_patrocinio_updated_at
  BEFORE UPDATE ON public.eventos_patrocinio
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_eventos_patrocinio_ativo
  ON public.eventos_patrocinio(ativo, ordem);

-- 3) Patrocinadores (associados a cada evento)
CREATE TABLE IF NOT EXISTS public.patrocinadores (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id   uuid NOT NULL REFERENCES public.eventos_patrocinio(id) ON DELETE CASCADE,
  nome        text NOT NULL,
  logo_url    text,
  link_url    text,
  tipo_apoio  text,        -- ex.: "Ouro", "Prata", "Bronze", "Apoio"
  valor       numeric,     -- opcional
  descricao   text,
  ordem       int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.patrocinadores TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patrocinadores TO authenticated;
GRANT ALL ON public.patrocinadores TO service_role;

ALTER TABLE public.patrocinadores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "patrocinadores_public_read"  ON public.patrocinadores;
DROP POLICY IF EXISTS "patrocinadores_admin_read"   ON public.patrocinadores;
DROP POLICY IF EXISTS "patrocinadores_admin_write"  ON public.patrocinadores;

CREATE POLICY "patrocinadores_public_read"
  ON public.patrocinadores FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.eventos_patrocinio e
      WHERE e.id = patrocinadores.evento_id AND e.ativo = true
    )
  );

CREATE POLICY "patrocinadores_admin_read"
  ON public.patrocinadores FOR SELECT
  TO authenticated
  USING (public.can_manage_patrocinadores(auth.uid()));

CREATE POLICY "patrocinadores_admin_write"
  ON public.patrocinadores FOR ALL
  TO authenticated
  USING (public.can_manage_patrocinadores(auth.uid()))
  WITH CHECK (public.can_manage_patrocinadores(auth.uid()));

CREATE TRIGGER tg_patrocinadores_updated_at
  BEFORE UPDATE ON public.patrocinadores
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_patrocinadores_evento
  ON public.patrocinadores(evento_id, ordem);

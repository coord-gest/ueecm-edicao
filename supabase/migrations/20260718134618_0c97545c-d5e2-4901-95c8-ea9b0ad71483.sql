
-- Álbuns
CREATE TABLE public.galerias_eventos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT,
  evento_id UUID REFERENCES public.eventos(id) ON DELETE SET NULL,
  data_evento DATE,
  capa_url TEXT,
  publicado BOOLEAN NOT NULL DEFAULT true,
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.galerias_eventos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.galerias_eventos TO authenticated;
GRANT ALL ON public.galerias_eventos TO service_role;

ALTER TABLE public.galerias_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Álbuns publicados são públicos"
  ON public.galerias_eventos FOR SELECT
  USING (publicado = true OR public.is_professor_or_staff(auth.uid()));

CREATE POLICY "Equipe gerencia álbuns"
  ON public.galerias_eventos FOR ALL
  TO authenticated
  USING (public.is_professor_or_staff(auth.uid()))
  WITH CHECK (public.is_professor_or_staff(auth.uid()));

CREATE TRIGGER trg_galerias_updated_at
  BEFORE UPDATE ON public.galerias_eventos
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Fotos
CREATE TABLE public.galeria_fotos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  galeria_id UUID NOT NULL REFERENCES public.galerias_eventos(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  storage_path TEXT,
  legenda TEXT,
  largura INT,
  altura INT,
  tamanho_bytes BIGINT,
  ordem INT NOT NULL DEFAULT 0,
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_galeria_fotos_galeria ON public.galeria_fotos(galeria_id, ordem);

GRANT SELECT ON public.galeria_fotos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.galeria_fotos TO authenticated;
GRANT ALL ON public.galeria_fotos TO service_role;

ALTER TABLE public.galeria_fotos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Fotos de álbuns publicados são públicas"
  ON public.galeria_fotos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.galerias_eventos g
      WHERE g.id = galeria_id
        AND (g.publicado = true OR public.is_professor_or_staff(auth.uid()))
    )
  );

CREATE POLICY "Equipe gerencia fotos"
  ON public.galeria_fotos FOR ALL
  TO authenticated
  USING (public.is_professor_or_staff(auth.uid()))
  WITH CHECK (public.is_professor_or_staff(auth.uid()));

CREATE TRIGGER trg_galeria_fotos_updated_at
  BEFORE UPDATE ON public.galeria_fotos
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.galerias_eventos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.galeria_fotos;

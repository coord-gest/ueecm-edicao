ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS icone_url text,
  ADD COLUMN IF NOT EXISTS icone_tamanho integer NOT NULL DEFAULT 48
    CHECK (icone_tamanho BETWEEN 16 AND 256);
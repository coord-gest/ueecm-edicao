
-- Tabela singleton para o perfil do desenvolvedor (cargo, instituição, descrição)
CREATE TABLE public.developer_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  nome text NOT NULL DEFAULT 'Francisco Douglas',
  cargo text NOT NULL DEFAULT 'Coordenador Escolar',
  instituicao text NOT NULL DEFAULT 'U.E. Evaristo Campelo de Matos',
  descricao text NOT NULL DEFAULT 'Desenvolvedor Full Stack, educador e Coordenador Escolar. Une tecnologia e educação para criar soluções com impacto real.',
  localizacao text NOT NULL DEFAULT 'Piauí, Brasil',
  contato text NOT NULL DEFAULT 'Pelo formulário de contato do portfólio.',
  fallback_message text NOT NULL DEFAULT 'Não tenho essa informação específica. Você pode confirmar diretamente com Francisco Douglas pelo formulário de contato do portfólio.',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.developer_profile TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.developer_profile TO authenticated;
GRANT ALL ON public.developer_profile TO service_role;

ALTER TABLE public.developer_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Perfil do dev é público para leitura"
  ON public.developer_profile FOR SELECT
  USING (true);

CREATE POLICY "Usuários autenticados podem editar o perfil do dev"
  ON public.developer_profile FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem inserir o perfil do dev"
  ON public.developer_profile FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE TRIGGER trg_developer_profile_updated
  BEFORE UPDATE ON public.developer_profile
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

INSERT INTO public.developer_profile (singleton) VALUES (true)
  ON CONFLICT (singleton) DO NOTHING;

-- Tabela de FAQ do desenvolvedor
CREATE TABLE public.developer_faq (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  answer text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.developer_faq TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.developer_faq TO authenticated;
GRANT ALL ON public.developer_faq TO service_role;

ALTER TABLE public.developer_faq ENABLE ROW LEVEL SECURITY;

CREATE POLICY "FAQ do dev é público para leitura"
  ON public.developer_faq FOR SELECT USING (true);

CREATE POLICY "Usuários autenticados podem inserir FAQ"
  ON public.developer_faq FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar FAQ"
  ON public.developer_faq FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem deletar FAQ"
  ON public.developer_faq FOR DELETE TO authenticated USING (true);

CREATE TRIGGER trg_developer_faq_updated
  BEFORE UPDATE ON public.developer_faq
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Seed do FAQ inicial
INSERT INTO public.developer_faq (question, answer, sort_order) VALUES
  ('Quem é Francisco Douglas?', 'Desenvolvedor Full Stack, educador e Coordenador Escolar que atualmente trabalha na U.E. Evaristo Campelo de Matos.', 1),
  ('Quais tecnologias domina?', 'React, TypeScript, Node.js, Supabase, entre outras.', 2),
  ('Está disponível para projetos?', 'Sim, freelance e remoto.', 3),
  ('Qual o diferencial dele?', 'Une visão técnica com experiência real em educação e gestão de pessoas.', 4),
  ('Como entrar em contato?', 'Pelo formulário de contato do portfólio.', 5);

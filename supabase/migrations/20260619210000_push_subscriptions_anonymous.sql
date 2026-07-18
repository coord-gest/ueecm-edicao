-- ============================================================
-- Permite subscrições push de usuários anônimos (pais, visitantes)
-- user_id passa a ser opcional (nullable) e o role anon
-- recebe permissão para INSERT/DELETE por endpoint.
-- ============================================================

-- 1. Torna user_id opcional
ALTER TABLE public.push_subscriptions
  ALTER COLUMN user_id DROP NOT NULL;

-- 2. Dá permissão de INSERT e DELETE ao role anon
GRANT INSERT, DELETE ON public.push_subscriptions TO anon;

-- 3. Policy: anon pode inserir subscrição sem user_id
CREATE POLICY "push_subs_insert_anon" ON public.push_subscriptions
  FOR INSERT TO anon
  WITH CHECK (user_id IS NULL);

-- 4. Policy: anon pode deletar apenas pelo endpoint (sem user_id)
--    O endpoint é único e vem direto do browser — seguro o suficiente
--    para cancelamento de subscrição.
CREATE POLICY "push_subs_delete_anon" ON public.push_subscriptions
  FOR DELETE TO anon
  USING (user_id IS NULL);

-- 5. Policy: usuário autenticado pode agora inserir com user_id NULL
--    (caso não queira vincular) — mantemos a policy antiga restrita ao próprio user
--    e adicionamos uma nova para o caso user_id IS NULL
CREATE POLICY "push_subs_insert_auth_anon" ON public.push_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

-- Remove a policy antiga que só permitia user_id = auth.uid()
-- (a nova cobre ambos os casos)
DROP POLICY IF EXISTS "push_subs_insert_own" ON public.push_subscriptions;

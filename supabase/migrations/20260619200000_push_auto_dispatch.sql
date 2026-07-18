-- ============================================================
-- Push Auto-Dispatch via pg_net
-- Quando um item entra na push_notifications_queue, esta função
-- chama automaticamente o endpoint /api/public/dispatch-push
-- para processar a fila — sem depender de ação manual do usuário.
-- ============================================================

-- Habilita a extensão pg_net (disponível no Supabase por padrão)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Função que dispara o endpoint de dispatch via HTTP assíncrono
CREATE OR REPLACE FUNCTION public.tg_push_queue_dispatch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_site_url text;
  v_anon_key text;
BEGIN
  -- Lê configurações injetadas via ALTER DATABASE SET app.*
  -- (configure no Supabase SQL Editor com os valores reais do seu deploy)
  v_site_url := current_setting('app.site_url', true);
  v_anon_key := current_setting('app.anon_key', true);

  -- Se a URL não estiver configurada, registra aviso e sai sem errar
  IF v_site_url IS NULL OR trim(v_site_url) = '' THEN
    RAISE WARNING '[tg_push_queue_dispatch] app.site_url não configurado — configure com: ALTER DATABASE postgres SET app.site_url = ''https://seu-site.com'';';
    RETURN NEW;
  END IF;

  v_site_url := rtrim(trim(v_site_url), '/');

  -- net.http_post é a API do pg_net no Supabase
  -- Disparo assíncrono: não bloqueia a transação do INSERT
  PERFORM net.http_post(
    url     := v_site_url || '/api/public/dispatch-push',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'apikey',       COALESCE(v_anon_key, '')
               ),
    body    := '{}'::jsonb
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Nunca deixa falha de HTTP quebrar a transação principal
  RAISE WARNING '[tg_push_queue_dispatch] erro ao disparar HTTP: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Trigger: FOR EACH STATEMENT evita múltiplas chamadas HTTP quando
-- um único evento gera vários itens na fila
DROP TRIGGER IF EXISTS push_queue_auto_dispatch ON public.push_notifications_queue;
CREATE TRIGGER push_queue_auto_dispatch
  AFTER INSERT ON public.push_notifications_queue
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.tg_push_queue_dispatch();

-- ============================================================
-- CONFIGURAÇÃO OBRIGATÓRIA APÓS APLICAR ESTA MIGRAÇÃO:
--
-- Execute no Supabase SQL Editor (Settings → SQL Editor):
--
--   ALTER DATABASE postgres
--     SET "app.site_url" = 'https://SEU-DOMINIO.pages.dev';
--
--   ALTER DATABASE postgres
--     SET "app.anon_key" = 'eyJhbGciOi...sua_anon_key_completa...';
--
-- Substitua pelos valores reais:
--   - site_url: URL pública do seu deploy (Cloudflare Pages/Workers)
--   - anon_key: a mesma chave que está em SUPABASE_PUBLISHABLE_KEY
-- ============================================================

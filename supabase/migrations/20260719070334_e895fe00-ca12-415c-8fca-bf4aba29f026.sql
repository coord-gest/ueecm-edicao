-- Ajustar permissões de funções SECURITY DEFINER expostas a anon
-- 1) increment_post_views: legítimo para anon (contador público de views) — manter
-- 2) log_alert_action: função interna de auditoria, não deve ser chamável por anon nem authenticated
REVOKE EXECUTE ON FUNCTION public.log_alert_action(uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;
-- 3) process_alert_burst_tick: acionada apenas por pg_cron/service_role
REVOKE EXECUTE ON FUNCTION public.process_alert_burst_tick() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.tg_alerts_enqueue_push() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_posts_enqueue_push() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_audit_log() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_push_queue_dispatch() FROM PUBLIC, anon, authenticated;

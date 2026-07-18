-- Lock down maintenance/cleanup function: not meant to be called by clients.
REVOKE EXECUTE ON FUNCTION public.cleanup_fcm_diagnostics() FROM anon, authenticated, PUBLIC;
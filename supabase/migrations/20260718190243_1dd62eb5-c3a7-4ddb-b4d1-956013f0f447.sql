SELECT cron.schedule(
  'cleanup-rate-limits',
  '0 3 * * *',
  $$ SELECT public.cleanup_rate_limits(); $$
);
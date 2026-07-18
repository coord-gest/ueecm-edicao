SELECT cron.unschedule('reminders-dispatch-every-minute');

SELECT cron.schedule(
  'reminders-dispatch-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://conectaueecm.com/api/public/reminders-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT value FROM private.app_secrets WHERE key = 'dispatch_secret'),
      'x-dispatch-secret', (SELECT value FROM private.app_secrets WHERE key = 'dispatch_secret')
    ),
    body    := '{}'::jsonb
  );
  $$
);
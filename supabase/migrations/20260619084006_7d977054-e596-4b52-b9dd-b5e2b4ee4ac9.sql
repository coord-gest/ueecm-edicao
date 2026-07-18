
ALTER TABLE public.alerts
  ADD COLUMN IF NOT EXISTS starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS daily_start_time time,
  ADD COLUMN IF NOT EXISTS daily_end_time time;

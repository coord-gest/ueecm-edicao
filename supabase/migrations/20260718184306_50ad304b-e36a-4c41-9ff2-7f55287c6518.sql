
CREATE TABLE IF NOT EXISTS public.performance_metrics (
  id BIGSERIAL PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('server_fn','api_route','web_vital','client_nav','custom')),
  name TEXT NOT NULL,
  duration_ms DOUBLE PRECISION NOT NULL,
  status TEXT,
  route TEXT,
  user_id UUID,
  session_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_perf_metrics_kind_name_created ON public.performance_metrics (kind, name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_perf_metrics_created ON public.performance_metrics (created_at DESC);

GRANT SELECT ON public.performance_metrics TO authenticated;
GRANT INSERT ON public.performance_metrics TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.performance_metrics_id_seq TO anon, authenticated;
GRANT ALL ON public.performance_metrics TO service_role;

ALTER TABLE public.performance_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "perf_metrics_insert_public" ON public.performance_metrics
  FOR INSERT TO anon, authenticated WITH CHECK (
    duration_ms >= 0 AND duration_ms < 600000
    AND length(name) <= 200
    AND length(coalesce(route,'')) <= 500
  );

CREATE POLICY "perf_metrics_select_staff" ON public.performance_metrics
  FOR SELECT TO authenticated USING (public.is_school_admin(auth.uid()));

-- Rate limit por sessão: 120 métricas/minuto
CREATE OR REPLACE FUNCTION public.tg_perf_metrics_rate_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  IF NEW.session_id IS NULL THEN RETURN NEW; END IF;
  SELECT count(*) INTO v_count FROM public.performance_metrics
    WHERE session_id = NEW.session_id AND created_at > now() - interval '1 minute';
  IF v_count >= 120 THEN RETURN NULL; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_perf_metrics_rate_limit ON public.performance_metrics;
CREATE TRIGGER trg_perf_metrics_rate_limit BEFORE INSERT ON public.performance_metrics
  FOR EACH ROW EXECUTE FUNCTION public.tg_perf_metrics_rate_limit();

-- p50/p95/p99 por rota+tipo em janela recente
CREATE OR REPLACE FUNCTION public.metrics_percentiles(_hours int DEFAULT 24, _kind text DEFAULT NULL)
RETURNS TABLE(kind text, name text, samples bigint, p50 double precision, p95 double precision, p99 double precision, avg_ms double precision, max_ms double precision, error_rate double precision)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    m.kind, m.name,
    count(*)::bigint AS samples,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY m.duration_ms) AS p50,
    percentile_cont(0.95) WITHIN GROUP (ORDER BY m.duration_ms) AS p95,
    percentile_cont(0.99) WITHIN GROUP (ORDER BY m.duration_ms) AS p99,
    avg(m.duration_ms) AS avg_ms,
    max(m.duration_ms) AS max_ms,
    (count(*) FILTER (WHERE m.status = 'error'))::double precision / greatest(count(*),1)::double precision AS error_rate
  FROM public.performance_metrics m
  WHERE m.created_at > now() - make_interval(hours => greatest(_hours,1))
    AND (_kind IS NULL OR m.kind = _kind)
    AND public.is_school_admin(auth.uid())
  GROUP BY m.kind, m.name
  ORDER BY samples DESC
  LIMIT 200
$$;

REVOKE EXECUTE ON FUNCTION public.metrics_percentiles(int, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.metrics_percentiles(int, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.cleanup_performance_metrics()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.performance_metrics WHERE created_at < now() - interval '14 days';
$$;

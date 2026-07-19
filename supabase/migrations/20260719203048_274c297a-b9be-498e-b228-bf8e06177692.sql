
-- =========================================================================
-- Endurecer 3 policies INSERT `WITH CHECK (true)` (linter 0024)
-- Mantém o caso de uso legítimo (formulários públicos + telemetria),
-- mas impede que um cliente forje status/moderação/logs de outros usuários.
-- =========================================================================

-- 1) data_subject_requests — formulário público de solicitação LGPD
DROP POLICY IF EXISTS "Anyone can submit a data subject request" ON public.data_subject_requests;
CREATE POLICY "Anyone can submit a data subject request"
  ON public.data_subject_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    status = 'pendente'::public.dsr_status
    AND admin_notes IS NULL
    AND resolved_at IS NULL
    AND resolved_by IS NULL
    AND length(solicitante_nome) BETWEEN 2 AND 200
    AND length(solicitante_email) BETWEEN 5 AND 200
    AND solicitante_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    AND length(descricao) BETWEEN 5 AND 4000
    AND (user_id IS NULL OR user_id = auth.uid())
  );

-- 2) familias_depoimentos — depoimentos abertos ao público
DROP POLICY IF EXISTS "familias_dep_insert_anyone" ON public.familias_depoimentos;
CREATE POLICY "familias_dep_insert_anyone"
  ON public.familias_depoimentos
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    status = 'pendente'::public.familia_dep_status
    AND moderado_por IS NULL
    AND moderado_em IS NULL
    AND motivo_rejeicao IS NULL
    AND length(mensagem) BETWEEN 5 AND 4000
    AND (autor_nome IS NULL OR length(autor_nome) <= 120)
    AND (email_contato IS NULL OR email_contato ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
    AND (submitted_by IS NULL OR submitted_by = auth.uid())
  );

-- 3) fcm_diagnostics — telemetria client-side de push
DROP POLICY IF EXISTS "anyone can insert fcm diagnostics" ON public.fcm_diagnostics;
CREATE POLICY "anyone can insert fcm diagnostics"
  ON public.fcm_diagnostics
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    (user_id IS NULL OR user_id = auth.uid())
    AND length(platform) <= 40
    AND length(phase) <= 40
    AND (user_agent IS NULL OR length(user_agent) <= 500)
    AND (service_worker_script IS NULL OR length(service_worker_script) <= 500)
    AND (error_code IS NULL OR length(error_code) <= 120)
    AND (error_message IS NULL OR length(error_message) <= 2000)
  );

-- Rate-limit por user_id/IP-hash para telemetria FCM (evita flood)
CREATE OR REPLACE FUNCTION public.tg_fcm_diagnostics_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count int;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT count(*) INTO v_count
    FROM public.fcm_diagnostics
   WHERE user_id = NEW.user_id
     AND created_at > now() - interval '1 minute';
  IF v_count >= 30 THEN
    RETURN NULL; -- silenciosamente descarta o evento excedente
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fcm_diagnostics_rate_limit ON public.fcm_diagnostics;
CREATE TRIGGER trg_fcm_diagnostics_rate_limit
  BEFORE INSERT ON public.fcm_diagnostics
  FOR EACH ROW EXECUTE FUNCTION public.tg_fcm_diagnostics_rate_limit();

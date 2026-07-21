
-- 1) Segmentação da fila de push notifications
ALTER TABLE public.push_notifications_queue
  ADD COLUMN IF NOT EXISTS target_user_ids uuid[] NULL,
  ADD COLUMN IF NOT EXISTS target_roles text[] NULL;

CREATE INDEX IF NOT EXISTS idx_pnq_target_user_ids ON public.push_notifications_queue USING GIN (target_user_ids);
CREATE INDEX IF NOT EXISTS idx_pnq_target_roles ON public.push_notifications_queue USING GIN (target_roles);

-- 2) Trigger de agendamento passa a segmentar destinatários
CREATE OR REPLACE FUNCTION public.tg_agendamento_enqueue_push()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_target_users uuid[] := NULL;
  v_target_roles text[] := NULL;
  v_prof_user uuid;
BEGIN
  IF NEW.profissional_id IS NOT NULL THEN
    SELECT p.user_id INTO v_prof_user
    FROM public.profissionais p
    WHERE p.id = NEW.profissional_id;
    IF v_prof_user IS NOT NULL THEN
      v_target_users := ARRAY[v_prof_user];
    END IF;
  END IF;

  -- Coordenação sempre recebe; se for cargo específico, também o cargo alvo.
  IF NEW.alvo_cargo IS NOT NULL THEN
    v_target_roles := CASE NEW.alvo_cargo
      WHEN 'diretor'     THEN ARRAY['diretor','director','coordenador','coordinator']
      WHEN 'coordenador' THEN ARRAY['coordenador','coordinator','diretor','director']
      WHEN 'professor'   THEN ARRAY['coordenador','coordinator','diretor','director']
      ELSE ARRAY['coordenador','coordinator','diretor','director']
    END;
  ELSIF v_target_users IS NULL THEN
    -- Fallback: sem alvo definido, notifica coordenação/direção
    v_target_roles := ARRAY['coordenador','coordinator','diretor','director'];
  ELSE
    -- Se é profissional específico, adiciona também coordenação como cópia
    v_target_roles := ARRAY['coordenador','coordinator','diretor','director'];
  END IF;

  INSERT INTO public.push_notifications_queue (title, body, url, source, source_id, target_user_ids, target_roles)
  VALUES (
    'Novo agendamento',
    COALESCE(NEW.solicitante_nome, 'Solicitante') || ' — ' || LEFT(COALESCE(NEW.motivo, ''), 200),
    '/escola/agendamentos',
    'agendamento',
    NEW.id,
    v_target_users,
    v_target_roles
  );
  RETURN NEW;
END;
$function$;

-- 3) RPC pública para consulta de status por protocolo + contato (parcial)
CREATE OR REPLACE FUNCTION public.consultar_agendamento(_protocolo text, _contato text)
 RETURNS TABLE(
   protocolo text,
   status text,
   motivo text,
   inicio_at timestamptz,
   fim_at timestamptz,
   alvo_cargo text,
   profissional_nome text,
   observacoes_staff text,
   created_at timestamptz
 )
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_norm text;
  v_last4 text;
BEGIN
  IF _protocolo IS NULL OR length(trim(_protocolo)) < 6 THEN
    RETURN;
  END IF;
  IF _contato IS NULL OR length(trim(_contato)) < 4 THEN
    RETURN;
  END IF;

  -- Normaliza contato: lowercase e retira espaços; mantém dígitos e email
  v_norm := lower(regexp_replace(trim(_contato), '\s+', '', 'g'));
  v_last4 := right(regexp_replace(v_norm, '\D', '', 'g'), 4);

  -- Rate limit por protocolo (10 tentativas / 10 min)
  IF NOT public.check_rate_limit('consultar_agend:' || upper(trim(_protocolo)), 10, 600) THEN
    RAISE EXCEPTION 'Muitas tentativas. Aguarde alguns minutos.' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT
    a.protocolo,
    a.status,
    a.motivo,
    a.inicio_at,
    a.fim_at,
    a.alvo_cargo,
    p.nome AS profissional_nome,
    a.observacoes_staff,
    a.created_at
  FROM public.agendamentos a
  LEFT JOIN public.profissionais p ON p.id = a.profissional_id
  WHERE upper(a.protocolo) = upper(trim(_protocolo))
    AND (
      -- e-mail: match exato normalizado
      lower(regexp_replace(coalesce(a.solicitante_contato,''), '\s+', '', 'g')) = v_norm
      -- ou últimos 4 dígitos do telefone
      OR (v_last4 <> '' AND right(regexp_replace(coalesce(a.solicitante_contato,''), '\D', '', 'g'), 4) = v_last4)
    )
  LIMIT 1;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.consultar_agendamento(text, text) TO anon, authenticated;

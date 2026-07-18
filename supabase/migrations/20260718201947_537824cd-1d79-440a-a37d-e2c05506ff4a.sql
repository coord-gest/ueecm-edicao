
-- ============================================================
-- 1.1 Storage policy: publicar apenas fotos de galerias publicadas
-- ============================================================
DROP POLICY IF EXISTS "Fotos da galeria são públicas" ON storage.objects;

CREATE POLICY "Fotos de galerias publicadas"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'galeria-eventos'
  AND EXISTS (
    SELECT 1
    FROM public.galeria_fotos gf
    JOIN public.galerias_eventos g ON g.id = gf.galeria_id
    WHERE gf.storage_path = storage.objects.name
      AND g.publicado = true
  )
);

-- Equipe (professor/staff) continua vendo tudo (inclusive não publicadas)
CREATE POLICY "Equipe visualiza todas as fotos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'galeria-eventos'
  AND public.is_professor_or_staff(auth.uid())
);

-- ============================================================
-- 1.2 Revogar EXECUTE de anon em funções sensíveis
-- ============================================================

-- Vazamento de dados de menores
REVOKE EXECUTE ON FUNCTION public.tv_aniversariantes_hoje() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tv_aniversariantes_mes() FROM anon, PUBLIC;

-- Aceitam user_id como parâmetro (risco de escalonamento)
REVOKE EXECUTE ON FUNCTION public.can_delete_arquivo_preenchimento(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_manage_patrocinadores(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_professor_or_staff(uuid) FROM anon, PUBLIC;

-- Dispara HTTP com secret — nunca deve ser público
REVOKE EXECUTE ON FUNCTION public.trigger_dispatch_push() FROM anon, authenticated, PUBLIC;

-- Manutenção interna (cron-only)
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cleanup_admin_access_logs() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cleanup_performance_metrics() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cleanup_rate_limits() FROM anon, authenticated, PUBLIC;

-- Funções de trigger (não devem ser chamadas diretamente)
REVOKE EXECUTE ON FUNCTION public.fn_replicar_push_para_inapp() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_professor_para_profissionais() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_audit_arquivo_preench_delete() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_chat_alunos_msg_after_insert() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_chat_alunos_msg_rate_limit() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_dsr_enqueue_push() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_dsr_rate_limit() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_enquete_respostas_rate_limit() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_enquete_respostas_validate() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_familias_depoimentos_before_insert() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_mensagem_coord_push() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_mensagens_coord_rate_limit() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_perf_metrics_rate_limit() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_post_comentarios_rate_limit() FROM anon, authenticated, PUBLIC;

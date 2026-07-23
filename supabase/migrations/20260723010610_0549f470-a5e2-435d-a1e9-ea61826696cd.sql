-- P1: Remove hardcoded admin email seed pattern (SysPulse audit).
DO $$
DECLARE
  v_admin_email text := current_setting('app.bootstrap_admin_email', true);
  v_user_id uuid;
BEGIN
  IF v_admin_email IS NULL OR v_admin_email = '' THEN
    RAISE NOTICE 'No app.bootstrap_admin_email configured; skipping bootstrap role assignment.';
    RETURN;
  END IF;

  SELECT id INTO v_user_id FROM auth.users WHERE email = v_admin_email LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'Bootstrap admin email % not found; skipping.', v_admin_email;
    RETURN;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'admin'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
END $$;
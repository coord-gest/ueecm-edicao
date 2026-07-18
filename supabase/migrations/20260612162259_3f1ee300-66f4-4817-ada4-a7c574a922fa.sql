DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;

CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE
  USING ((auth.uid() = user_id) OR public.is_school_staff(auth.uid()))
  WITH CHECK ((auth.uid() = user_id) OR public.is_school_staff(auth.uid()));

CREATE POLICY profiles_insert_own ON public.profiles
  FOR INSERT
  WITH CHECK ((auth.uid() = user_id) OR public.is_school_staff(auth.uid()));
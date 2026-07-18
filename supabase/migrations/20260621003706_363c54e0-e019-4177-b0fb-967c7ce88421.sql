
GRANT EXECUTE ON FUNCTION public.can_manage_staff(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_school_staff(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_content(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated;

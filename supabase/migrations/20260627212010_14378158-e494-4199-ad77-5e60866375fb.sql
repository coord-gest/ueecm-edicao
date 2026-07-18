GRANT EXECUTE ON FUNCTION public.is_school_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_professor_da_turma(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_professor_do_aluno(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_responsavel_do_aluno(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_manage_content(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_manage_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_school_staff(uuid) TO authenticated;
ALTER TABLE public.turmas REPLICA IDENTITY FULL;
ALTER TABLE public.disciplinas REPLICA IDENTITY FULL;
ALTER TABLE public.horarios REPLICA IDENTITY FULL;
ALTER TABLE public.posts REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.turmas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.disciplinas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.horarios;
ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
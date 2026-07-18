
-- Remove o "Projeto da Leitura" do banco de dados

-- 1) Converte papéis em inglês (legado do Projeto da Leitura) para o equivalente em português
UPDATE public.user_roles SET role = 'aluno'::public.app_role        WHERE role::text = 'student';
UPDATE public.user_roles SET role = 'diretor'::public.app_role      WHERE role::text = 'director';
UPDATE public.user_roles SET role = 'professor'::public.app_role    WHERE role::text = 'teacher';
UPDATE public.user_roles SET role = 'coordenador'::public.app_role  WHERE role::text = 'coordinator';
UPDATE public.user_roles SET role = 'desenvolvedor'::public.app_role WHERE role::text = 'developer';
DELETE FROM public.user_roles WHERE role::text IN ('family');

-- Evita duplicatas após a conversão (unique(user_id, role))
DELETE FROM public.user_roles a
USING public.user_roles b
WHERE a.ctid < b.ctid AND a.user_id = b.user_id AND a.role = b.role;

-- 2) Remove tabelas do Projeto da Leitura
DROP TABLE IF EXISTS public.reading_checkpoints   CASCADE;
DROP TABLE IF EXISTS public.reading_highlights    CASCADE;
DROP TABLE IF EXISTS public.reading_summaries     CASCADE;
DROP TABLE IF EXISTS public.student_progress      CASCADE;
DROP TABLE IF EXISTS public.portfolio_feedback    CASCADE;
DROP TABLE IF EXISTS public.pedagogical_records   CASCADE;
DROP TABLE IF EXISTS public.activity_logs         CASCADE;
DROP TABLE IF EXISTS public.class_students        CASCADE;
DROP TABLE IF EXISTS public.classes               CASCADE;
DROP TABLE IF EXISTS public.family_links          CASCADE;
DROP TABLE IF EXISTS public.books                 CASCADE;
DROP TABLE IF EXISTS public.schools               CASCADE;

-- 3) Remove colunas usadas apenas pelo Projeto da Leitura em profiles
ALTER TABLE public.profiles DROP COLUMN IF EXISTS school_id;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS grade_level;

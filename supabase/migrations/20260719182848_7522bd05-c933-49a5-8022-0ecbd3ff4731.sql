-- Adiciona novo papel "social_media" ao enum de roles.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'social_media';
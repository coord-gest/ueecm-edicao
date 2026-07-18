-- Conceder acesso ao schema 'private' para os roles do PostgREST/Storage
-- de modo que as políticas RLS em storage.objects consigam chamar
-- private.can_manage_content() / private.can_manage_staff() / private.has_role() / private.is_school_staff()

GRANT USAGE ON SCHEMA private TO authenticator, authenticated, anon, service_role;

GRANT EXECUTE ON FUNCTION private.can_manage_content(uuid)  TO authenticator, authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION private.can_manage_staff(uuid)    TO authenticator, authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, app_role)  TO authenticator, authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION private.is_school_staff(uuid)     TO authenticator, authenticated, anon, service_role;
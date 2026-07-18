
revoke execute on function public.match_posts(vector, int, float) from anon;
revoke execute on function public.match_posts(vector, int, float) from authenticated;
revoke execute on function public.match_posts(vector, int, float) from public;
grant execute on function public.match_posts(vector, int, float) to service_role;

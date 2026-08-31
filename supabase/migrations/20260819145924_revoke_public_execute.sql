/*
# Revoke PUBLIC EXECUTE on admin functions

Postgres grants EXECUTE on functions to PUBLIC by default. The previous migration
revoked from anon/authenticated but not PUBLIC, so the advisor still flagged them.
*/

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_order_status(uuid, text, text) FROM PUBLIC;

-- place_order should be callable by anon + authenticated (checkout), but not via PUBLIC generic
REVOKE EXECUTE ON FUNCTION public.place_order(text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_order(text, text, text, jsonb) TO anon, authenticated;

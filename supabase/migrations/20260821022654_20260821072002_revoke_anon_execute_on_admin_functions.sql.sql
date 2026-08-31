-- Revoke EXECUTE on admin_delete_order from anon (was leaking to public)
REVOKE EXECUTE ON FUNCTION public.admin_delete_order(uuid, text) FROM anon;

-- Also revoke EXECUTE on update_order_status from anon if present
REVOKE EXECUTE ON FUNCTION public.update_order_status(uuid, text, text) FROM anon;

-- Also revoke EXECUTE on place_order from anon (should only be authenticated)
REVOKE EXECUTE ON FUNCTION public.place_order(text, text, text, jsonb) FROM anon;

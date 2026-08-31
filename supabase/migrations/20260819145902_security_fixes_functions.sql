/*
# Security fixes: function search_path and EXECUTE grants

1. Fixes
- set_updated_at(): add SET search_path = public (advisor: function_search_path_mutable)
- is_admin(): revoke EXECUTE from anon (already done but re-assert). Keep for authenticated.
- update_order_status(): revoke EXECUTE from anon. The function checks is_admin() internally,
  but tightening the grant reduces attack surface.
- place_order(): intentionally callable by anon + authenticated (storefront checkout). No change.
*/

-- Fix set_updated_at search_path
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Re-assert is_admin grants: only authenticated can call
REVOKE EXECUTE ON FUNCTION public.is_admin FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin TO authenticated;

-- update_order_status: only authenticated (admin) can call
REVOKE EXECUTE ON FUNCTION public.update_order_status(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_order_status(uuid, text, text) TO authenticated;

-- place_order: anon + authenticated can call (storefront checkout)
REVOKE EXECUTE ON FUNCTION public.place_order(text, text, text, jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.place_order(text, text, text, jsonb) TO anon, authenticated;

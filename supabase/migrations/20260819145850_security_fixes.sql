/*
# Security fixes: function search_path and EXECUTE grants

1. Fixes
- set_updated_at(): add SET search_path = public (advisor: function_search_path_mutable)
- is_admin(): revoke EXECUTE from anon (already done but re-assert), keep for authenticated only
- update_order_status(): revoke EXECUTE from anon — only authenticated admins should call it.
  The function internally checks is_admin() so anon would just get an error, but tightening
  the grant reduces the attack surface.
- place_order(): intentionally callable by anon + authenticated (storefront checkout).
  No change needed.
*/

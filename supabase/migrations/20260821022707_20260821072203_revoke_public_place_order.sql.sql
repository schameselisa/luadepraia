-- Revoke EXECUTE on place_order from PUBLIC and anon
-- (should only be callable by authenticated customers)
REVOKE EXECUTE ON FUNCTION public.place_order(text, text, text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.place_order(text, text, text, jsonb) FROM anon;

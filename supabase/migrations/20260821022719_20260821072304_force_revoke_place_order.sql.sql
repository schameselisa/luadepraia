-- Force revoke all and re-grant only to authenticated
REVOKE ALL ON FUNCTION public.place_order(text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_order(text, text, text, jsonb) TO authenticated;

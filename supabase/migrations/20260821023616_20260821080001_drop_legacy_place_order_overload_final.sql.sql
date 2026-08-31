-- Drop the legacy 5-argument overload of place_order that was supposed to be removed
-- It conflicts with the current 4-argument version and may cause RPC resolution issues
DROP FUNCTION IF EXISTS public.place_order(text, text, text, jsonb, uuid);

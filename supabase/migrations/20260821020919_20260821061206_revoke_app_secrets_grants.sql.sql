-- Revoke all grants on app_secrets from anon and authenticated
-- RLS with no policies already blocks access, but revoke grants for defense in depth
REVOKE ALL ON public.app_secrets FROM anon, authenticated;

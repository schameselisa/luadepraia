/*
# Auto-create customer profile on signup

## Purpose
When a new user signs up via Supabase Auth (client-side supabase.auth.signUp),
the customer_profiles row must be created server-side because:
- If email confirmation is enabled, there is no session after signup, so
  auth.uid() is null and the RLS insert policy (auth.uid() = id) rejects
  any client-side insert.
- A trigger running with SECURITY DEFINER bypasses RLS and can safely
  create the profile row using the new user's id and metadata.

## Changes
1. Create function `handle_new_customer_profile()` that:
   - Reads the new user's id, email, full_name, and phone from the
     NEW record (raw_user_meta_data contains full_name and phone set
     by the client signUp call).
   - Inserts a row into customer_profiles with those values.
   - Only inserts if is_admin is NOT true (admins don't need a profile).
2. Create trigger `on_auth_user_created_customer_profile` that fires
   AFTER INSERT on auth.users and calls the function.
3. SECURITY DEFINER with fixed search_path for safety.
4. Backfill: create profiles for any existing auth.users that don't have
   one yet (excluding admins).

## Security
- Function is SECURITY DEFINER, search_path = public — safe from injection.
- Trigger fires server-side, bypasses RLS legitimately.
- Only creates profiles for non-admin users (is_admin != true).
- Does NOT grant is_admin to anyone — admin status is set exclusively
  by the database migration that creates admin users.
*/

CREATE OR REPLACE FUNCTION public.handle_new_customer_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Skip admin users — they don't need a customer profile
  IF (NEW.raw_app_meta_data->>'is_admin')::boolean = true THEN
    RETURN NEW;
  END IF;

  -- Insert customer profile from auth metadata
  INSERT INTO public.customer_profiles (id, email, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', '')
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if any (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created_customer_profile ON auth.users;

-- Create trigger
CREATE TRIGGER on_auth_user_created_customer_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_customer_profile();

-- Backfill: create profiles for existing non-admin users that don't have one
INSERT INTO public.customer_profiles (id, email, full_name, phone)
SELECT
  u.id,
  COALESCE(u.email, ''),
  COALESCE(u.raw_user_meta_data->>'full_name', ''),
  COALESCE(u.raw_user_meta_data->>'phone', '')
FROM auth.users u
WHERE (u.raw_app_meta_data->>'is_admin')::boolean IS DISTINCT FROM true
  AND NOT EXISTS (SELECT 1 FROM public.customer_profiles cp WHERE cp.id = u.id)
ON CONFLICT (id) DO NOTHING;

/*
  # Restrict execution of internal helper functions

  1. Problem
     generate_internal_code() is a SECURITY DEFINER trigger function living in the
     public schema, so PostgreSQL's default grant to PUBLIC made it callable
     directly by the anon and authenticated roles through the Data API.

  2. Changes
     - Revoke EXECUTE from PUBLIC, anon and authenticated. The trigger itself
       still runs, because triggers execute as the table owner and do not
       consult EXECUTE privileges on the trigger function.
*/

REVOKE ALL ON FUNCTION public.generate_internal_code() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.generate_internal_code() FROM anon;
REVOKE ALL ON FUNCTION public.generate_internal_code() FROM authenticated;

/*
  # Remove the superseded 4-argument place_order overload

  1. Why
     The client no longer sends an owner id (ownership is taken from the session
     inside the function). With two overloads that both have defaults for every
     argument past the first, a 4-argument call is ambiguous. The 4-argument
     overload also predates the customer_id column and creates orders that are
     linked to no account at all.

  2. Changes
     - Drop `place_order(text, text, text, jsonb)`. The hardened 5-argument
       version remains and satisfies 4-argument calls via its default, so
       checkout (guest and signed-in) is unaffected.

  3. Notes
     - Removing a superseded function overload does not touch any row of data.
*/

DROP FUNCTION IF EXISTS public.place_order(text, text, text, jsonb);

/*
  # Restrict order reads to their owner and admins

  1. Changes
     - Drop `public_select_orders`, which allowed the `anon` and `authenticated`
       roles to read EVERY order row (including customer_name, customer_email
       and customer_phone) with an always-true predicate.
     - Add `admin_select_orders` so the admin panel keeps working.
     - `select_own_customer_orders` (customer_id = auth.uid()) is retained and
       becomes the only way a customer reads their own orders.

  2. Notes
     - Guest checkout is unaffected: `place_order` is SECURITY DEFINER and
       returns the new order id/number/total in its result, which is what the
       cart success screen renders.
*/

DROP POLICY IF EXISTS "public_select_orders" ON public.orders;

CREATE POLICY "admin_select_orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (is_admin());

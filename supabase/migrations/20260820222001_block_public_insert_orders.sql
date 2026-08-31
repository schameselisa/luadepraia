/*
  # Block direct public inserts into orders

  1. Changes
     - Drop `public_insert_orders`, an always-true INSERT check that let anyone
       POST an order with a total and status of their choosing, skipping the
       price computation and the stock check/decrement that only `place_order`
       performs.

  2. Notes
     - Checkout is unaffected: `place_order` is SECURITY DEFINER and is the only
       path the app uses to create an order.
*/

DROP POLICY IF EXISTS "public_insert_orders" ON public.orders;

/*
  # Block direct public inserts into order items

  1. Changes
     - Drop `public_insert_order_items`, an always-true INSERT check that let
       anyone POST line items with an arbitrary unit_price/subtotal onto any
       order id, bypassing the server-side price computation in `place_order`.

  2. Notes
     - Checkout is unaffected: `place_order` is SECURITY DEFINER, so it inserts
       order items irrespective of RLS. The app never inserts into this table
       directly.
*/

DROP POLICY IF EXISTS "public_insert_order_items" ON public.order_items;

/*
  # Restrict order item reads to the order owner and admins

  1. Changes
     - Drop `public_select_order_items`, an always-true SELECT policy that let
       anyone read every line item ever purchased.
     - Add `select_own_order_items`, scoped through the parent order to
       customer_id = auth.uid(), so a customer still sees the items of their own
       orders (the app reads these as an embedded `order_items(*)`).
     - Add `admin_select_order_items` for the admin panel.
*/

DROP POLICY IF EXISTS "public_select_order_items" ON public.order_items;

CREATE POLICY "select_own_order_items"
  ON public.order_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.customer_id = auth.uid()
    )
  );

CREATE POLICY "admin_select_order_items"
  ON public.order_items FOR SELECT
  TO authenticated
  USING (is_admin());

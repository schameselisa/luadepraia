/*
  # Restrict order status history reads to the order owner and admins

  1. Changes
     - Drop `public_select_order_status_history`, an always-true SELECT policy
       that exposed the internal status trail and operator-authored `note` text
       of every order to anyone.
     - Add `select_own_order_status_history`, scoped through the parent order.
     - Add `admin_select_order_status_history` so the admin order detail page
       keeps showing the trail.
*/

DROP POLICY IF EXISTS "public_select_order_status_history" ON public.order_status_history;

CREATE POLICY "select_own_order_status_history"
  ON public.order_status_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_status_history.order_id
        AND o.customer_id = auth.uid()
    )
  );

CREATE POLICY "admin_select_order_status_history"
  ON public.order_status_history FOR SELECT
  TO authenticated
  USING (is_admin());

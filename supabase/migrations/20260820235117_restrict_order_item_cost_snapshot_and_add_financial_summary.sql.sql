/*
# Restrict the order item cost snapshot and compute financials server-side

## Purpose
`order_items.unit_cost_snapshot` records what the store paid for an item at the
moment it was sold. The `select_own_order_items` policy correctly limits which
ROWS a shopper may read, but row level security never limits COLUMNS, so a
signed-in customer could read the store's own cost for everything they bought.
This migration removes that column from the readable surface and moves the
dashboard's cost and profit maths into an admin-guarded function, so raw costs
never travel to any browser.

## Changes

### order_items table privileges
- Table-level SELECT is revoked from `anon` and `authenticated`.
- SELECT is re-granted column by column on every column EXCEPT
  `unit_cost_snapshot`.
- INSERT, UPDATE and DELETE privileges are untouched. `place_order` writes the
  snapshot as SECURITY DEFINER and is unaffected.
- Row level security and every existing policy are unchanged, so customers
  still see their own order items and admins still see all of them.

### New function: admin_financial_summary()
- SECURITY DEFINER, returns a jsonb object with the realized figures:
  `revenue`, `cogs`, `profit`, `margin`, `avg_ticket`, `completed_orders` and
  `has_unknown_cost`.
- Only orders with status 'completed' are counted, so pending, confirmed,
  preparing, ready and cancelled orders never appear as realized revenue.
- Items whose `unit_cost_snapshot` is NULL are excluded from the cost total and
  raise the `has_unknown_cost` flag, so an unknown cost is never silently
  treated as zero.
- Raises 'Não autorizado' unless `is_admin()` is true for the caller.
- EXECUTE granted to `authenticated` only; explicitly revoked from `anon`
  and `public`.

## Security
1. A customer calling `/rest/v1/order_items?select=unit_cost_snapshot` now
   receives a permission error instead of the store's cost.
2. Cost and profit are only obtainable through `admin_financial_summary`,
   which checks `is_admin()` (backed by the server-issued `app_metadata`
   claim, which the user cannot edit).

## Important notes
1. Queries that asked for `order_items(*)` must now enumerate columns; the
   application code is updated in the same change.
2. No data is modified or dropped.
*/

REVOKE SELECT ON public.order_items FROM anon;
REVOKE SELECT ON public.order_items FROM authenticated;

GRANT SELECT (
  id, order_id, product_id, product_name, unit_price, quantity, subtotal,
  product_image_url, product_category_name, product_internal_code
) ON public.order_items TO anon;

GRANT SELECT (
  id, order_id, product_id, product_name, unit_price, quantity, subtotal,
  product_image_url, product_category_name, product_internal_code
) ON public.order_items TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_financial_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_revenue numeric(12,2) := 0;
  v_cogs numeric(12,2) := 0;
  v_completed_orders bigint := 0;
  v_has_unknown boolean := false;
  v_profit numeric(12,2) := 0;
  v_margin numeric(12,4) := 0;
  v_avg_ticket numeric(12,2) := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;

  SELECT COALESCE(sum(o.total), 0), count(*)
  INTO v_revenue, v_completed_orders
  FROM public.orders o
  WHERE o.status = 'completed';

  SELECT COALESCE(sum(oi.unit_cost_snapshot * oi.quantity), 0)
  INTO v_cogs
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  WHERE o.status = 'completed'
    AND oi.unit_cost_snapshot IS NOT NULL;

  SELECT EXISTS (
    SELECT 1
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE o.status = 'completed'
      AND oi.unit_cost_snapshot IS NULL
  ) INTO v_has_unknown;

  v_profit := v_revenue - v_cogs;

  IF v_revenue > 0 THEN
    v_margin := (v_profit / v_revenue) * 100;
    v_avg_ticket := v_revenue / GREATEST(v_completed_orders, 1);
  END IF;

  RETURN jsonb_build_object(
    'revenue', v_revenue,
    'cogs', v_cogs,
    'profit', v_profit,
    'margin', v_margin,
    'avg_ticket', v_avg_ticket,
    'completed_orders', v_completed_orders,
    'has_unknown_cost', v_has_unknown
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_financial_summary() FROM public;
REVOKE ALL ON FUNCTION public.admin_financial_summary() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_financial_summary() TO authenticated;

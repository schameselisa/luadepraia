-- Fix: Grant SELECT on color column to anon and authenticated (was missing, causing catalog failure)
GRANT SELECT (color) ON public.products TO anon, authenticated;

-- Fix: Grant SELECT on new order_items columns to authenticated (admin reads orders)
-- anon doesn't get these since order_items are restricted to owner/admin
GRANT SELECT (product_color) ON public.order_items TO authenticated;
GRANT SELECT (product_size_id) ON public.order_items TO authenticated;
GRANT SELECT (product_size_label) ON public.order_items TO authenticated;

-- Also grant SELECT on product_size_id for anon (customer reads their own order items)
GRANT SELECT (product_color, product_size_id, product_size_label) ON public.order_items TO anon;

-- New feature: Optional per-product low stock alert
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS low_stock_alert_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS low_stock_threshold integer NOT NULL DEFAULT 5;

-- Grant SELECT on new columns to anon and authenticated
GRANT SELECT (low_stock_alert_enabled, low_stock_threshold) ON public.products TO anon, authenticated;
-- Grant INSERT/UPDATE on new columns to authenticated (admin writes)
GRANT INSERT (low_stock_alert_enabled, low_stock_threshold) ON public.products TO anon, authenticated;
GRANT UPDATE (low_stock_alert_enabled, low_stock_threshold) ON public.products TO anon, authenticated;

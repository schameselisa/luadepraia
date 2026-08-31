-- Product sizes/variations table with per-size stock
CREATE TABLE IF NOT EXISTS public.product_sizes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  label text NOT NULL,
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Unique label per product (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS product_sizes_product_label_unique_idx
  ON public.product_sizes (product_id, lower(trim(label)));

-- FK from order_items.product_size_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_items_product_size_id_fkey'
  ) THEN
    ALTER TABLE public.order_items
      ADD CONSTRAINT order_items_product_size_id_fkey
      FOREIGN KEY (product_size_id) REFERENCES public.product_sizes(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE public.product_sizes ENABLE ROW LEVEL SECURITY;

-- Public can read sizes for active products
DROP POLICY IF EXISTS "select_product_sizes_public" ON public.product_sizes;
CREATE POLICY "select_product_sizes_public" ON public.product_sizes
  FOR SELECT TO anon, authenticated USING (true);

-- Only admins can insert/update/delete
-- (admin check via is_admin() in app; RLS uses service role for admin operations)
DROP POLICY IF EXISTS "insert_product_sizes_admin" ON public.product_sizes;
CREATE POLICY "insert_product_sizes_admin" ON public.product_sizes
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "update_product_sizes_admin" ON public.product_sizes;
CREATE POLICY "update_product_sizes_admin" ON public.product_sizes
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "delete_product_sizes_admin" ON public.product_sizes;
CREATE POLICY "delete_product_sizes_admin" ON public.product_sizes
  FOR DELETE TO authenticated USING (public.is_admin());

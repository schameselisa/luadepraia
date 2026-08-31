-- 1. Color/finish column on products (nullable for backward compat)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS color text;

-- 2. Unique constraint on (lower(trim(name)), color) to prevent identical name+finish
--    Using a unique index on expressions for case/space-insensitive matching
CREATE UNIQUE INDEX IF NOT EXISTS products_name_color_unique_idx
  ON public.products (lower(trim(name)), COALESCE(color, ''))
  WHERE deleted_at IS NULL;

-- 3. Unique SKU (internal_code) — but only non-null, non-deleted
CREATE UNIQUE INDEX IF NOT EXISTS products_internal_code_unique_idx
  ON public.products (internal_code)
  WHERE internal_code IS NOT NULL AND deleted_at IS NULL;

-- 4. Add color and size snapshots to order_items
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS product_color text,
  ADD COLUMN IF NOT EXISTS product_size_id uuid,
  ADD COLUMN IF NOT EXISTS product_size_label text;

-- FK for size_id → product_sizes (will be created in next migration, but we add it there)

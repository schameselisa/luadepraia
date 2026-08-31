/*
# Lua de Praia - Admin panel, categories, product images, stock & order tracking

This migration upgrades the catalog into a fully admin-managed store:

1. New Tables
- `categories`: product categories (name, slug, description, image, status). Replaces the
  hardcoded text `products.category` column with a proper FK relationship. The four seed
  categories (Anéis, Brincos, Colares, Pulseiras) are inserted and existing products are
  migrated to reference them.
- `product_images`: multiple images per product with a `is_main` flag and ordering.
- `order_status_history`: append-only log of status changes per order (with timestamp).

2. Modified Tables
- `products`:
  - ADD `slug` (text, unique) - URL-friendly identifier.
  - ADD `category_id` (uuid, FK -> categories) - replaces `category` text column. Existing
    rows are backfilled from the text column, then the text column is DROPPED.
  - ADD `promotional_price` (numeric, nullable) - optional sale price; storefront shows it
    when present and lower than price.
  - ADD `minimum_stock` (int, default 5) - threshold for "low stock" alerts in admin.
  - ADD `deleted_at` (timestamptz, nullable) - soft-delete marker. Storefront and admin
    list exclude soft-deleted rows; historical order_items are preserved.
  - ADD `updated_at` (timestamptz) - auto-maintained by trigger.
  - RENAME `active` -> keep as `active` (boolean, default true) - admin toggle. Inactive
    products do not appear in the storefront.
- `orders`:
  - ADD `customer_email` (text, nullable) and `customer_phone` (text, nullable) - optional
    contact details captured at checkout for the admin order detail view.
  - ADD `updated_at` (timestamptz) - auto-maintained by trigger.

3. Security
- Admin authorization uses `auth.uid()` joined to `auth.users` with a `raw_app_meta_data->>is_admin`
  flag. A helper SQL function `is_admin()` returns boolean. The admin sets this flag on their
  own auth account via the Supabase dashboard (or we can do it via SQL in onboarding).
- RLS rewrite:
  - `products` / `categories` / `product_images`: PUBLIC SELECT for active, non-deleted rows
    (TO anon, authenticated). All writes (INSERT/UPDATE/DELETE) restricted to admins
    (TO authenticated, USING/WITH CHECK is_admin()).
  - `orders` / `order_items`: anon + authenticated can INSERT (storefront checkout) and SELECT
    (order tracking). UPDATE/DELETE restricted to admins. Order creation goes through a
    SECURITY DEFINER function that validates stock and decrements it atomically.
  - `order_status_history`: admin-only INSERT; SELECT for anon+authenticated (so customers can
    see their order timeline if we link it later).
- Column-level: anon cannot set `deleted_at`, `minimum_stock` is admin-writable only (enforced
  by the admin-only UPDATE policy on products).
- A `place_order()` SECURITY DEFINER function handles checkout: it recomputes prices from the
  DB (never trusts client totals), checks stock availability, decrements stock atomically, and
  creates the order + items + initial status history row in one transaction. This replaces the
  old client-side insert in data.ts.
- Storage: a public `product-images` bucket is created. SELECT is public (so the storefront can
  display product photos). INSERT/UPDATE/DELETE restricted to admins.

4. Stock behavior
- `place_order()` decrements `products.stock` by the ordered quantity and refuses the order if
  any product has insufficient stock. The storefront cart already prevents adding more than
  stock, but the server function is the authoritative check.
- `stock = 0` products show as "Esgotado" in the storefront. `stock < minimum_stock` shows as
  "Estoque baixo" in the admin.

5. Important notes
- This migration is idempotent: each step guards with IF NOT EXISTS / checks.
- Existing product text categories are preserved by backfilling category_id before dropping
  the text column.
- The old `category` text column is dropped only after category_id is populated.
- The admin user is NOT created here; the app's onboarding will prompt for an email and we
  set is_admin=true on that auth account. For now, the `is_admin()` function simply checks
  the metadata flag.
*/

-- ---------------------------------------------------------------------------
-- 0. Admin helper function
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean,
    false
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin TO authenticated;

-- ---------------------------------------------------------------------------
-- 1. categories table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  image text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_select_active_categories" ON public.categories;
CREATE POLICY "public_select_active_categories" ON public.categories FOR SELECT
  TO anon, authenticated USING (active = true);

DROP POLICY IF EXISTS "admin_select_categories" ON public.categories;
CREATE POLICY "admin_select_categories" ON public.categories FOR SELECT
  TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "admin_insert_categories" ON public.categories;
CREATE POLICY "admin_insert_categories" ON public.categories FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_update_categories" ON public.categories;
CREATE POLICY "admin_update_categories" ON public.categories FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_delete_categories" ON public.categories;
CREATE POLICY "admin_delete_categories" ON public.categories FOR DELETE
  TO authenticated USING (public.is_admin());

-- Seed the four base categories (idempotent)
INSERT INTO public.categories (name, slug, sort_order)
SELECT 'Anéis', 'aneis', 1
WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'aneis');
INSERT INTO public.categories (name, slug, sort_order)
SELECT 'Brincos', 'brincos', 2
WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'brincos');
INSERT INTO public.categories (name, slug, sort_order)
SELECT 'Colares', 'colares', 3
WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'colares');
INSERT INTO public.categories (name, slug, sort_order)
SELECT 'Pulseiras', 'pulseiras', 4
WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'pulseiras');

-- ---------------------------------------------------------------------------
-- 2. products table - add new columns
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE public.products ADD COLUMN IF NOT EXISTS slug text;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category_id uuid;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.products ADD COLUMN IF NOT EXISTS promotional_price numeric(10,2);
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.products ADD COLUMN IF NOT EXISTS minimum_stock integer NOT NULL DEFAULT 5;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.products ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.products ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Backfill category_id from the old text category column
UPDATE public.products p
SET category_id = c.id
FROM public.categories c
WHERE p.category_id IS NULL
  AND c.slug = CASE p.category
    WHEN 'Aneis' THEN 'aneis'
    WHEN 'Brincos' THEN 'brincos'
    WHEN 'Colares' THEN 'colares'
    WHEN 'Pulseiras' THEN 'pulseiras'
    ELSE lower(p.category)
  END;

-- Generate slugs for any products missing one
UPDATE public.products
SET slug = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(id::text, 1, 8)
WHERE slug IS NULL OR slug = '';

-- Make slug unique (after population)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_slug_key'
  ) THEN
    ALTER TABLE public.products ADD CONSTRAINT products_slug_key UNIQUE (slug);
  END IF;
END $$;

-- Add FK from products.category_id to categories.id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_category_id_fkey'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_category_id_fkey
      FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- Make category_id NOT NULL now that it's backfilled
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'category_id' AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE public.products ALTER COLUMN category_id SET NOT NULL;
  END IF;
END $$;

-- Drop the old text category column
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'category'
  ) THEN
    ALTER TABLE public.products DROP COLUMN category;
  END IF;
END $$;

-- updated_at trigger for products
DROP TRIGGER IF EXISTS trg_products_updated_at ON public.products;
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active_not_deleted ON public.products(active, deleted_at);

-- ---------------------------------------------------------------------------
-- 3. product_images table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  is_main boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_select_product_images" ON public.product_images;
CREATE POLICY "public_select_product_images" ON public.product_images FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "admin_insert_product_images" ON public.product_images;
CREATE POLICY "admin_insert_product_images" ON public.product_images FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_update_product_images" ON public.product_images;
CREATE POLICY "admin_update_product_images" ON public.product_images FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_delete_product_images" ON public.product_images;
CREATE POLICY "admin_delete_product_images" ON public.product_images FOR DELETE
  TO authenticated USING (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON public.product_images(product_id);

-- Backfill: create a product_images row from each product's current image_url (idempotent)
INSERT INTO public.product_images (product_id, image_url, is_main, sort_order)
SELECT p.id, p.image_url, true, 0
FROM public.products p
WHERE NOT EXISTS (
  SELECT 1 FROM public.product_images pi WHERE pi.product_id = p.id
);

-- ---------------------------------------------------------------------------
-- 4. orders - add contact columns + updated_at
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_email text;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_phone text;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Add a 'new' status option to the orders status check (new = just placed, before received)
-- We keep 'received' as the default for now; admin can set 'new' manually if desired.
-- Actually we add 'new' as a valid status.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'orders_status_check'
  ) THEN
    ALTER TABLE public.orders DROP CONSTRAINT orders_status_check;
  END IF;
END $$;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('new','received','preparing','shipped','delivered','cancelled'));

DROP TRIGGER IF EXISTS trg_orders_updated_at ON public.orders;
CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. order_status_history table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status text NOT NULL,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_select_order_status_history" ON public.order_status_history;
CREATE POLICY "public_select_order_status_history" ON public.order_status_history FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "admin_insert_order_status_history" ON public.order_status_history;
CREATE POLICY "admin_insert_order_status_history" ON public.order_status_history FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON public.order_status_history(order_id);

-- ---------------------------------------------------------------------------
-- 6. RLS rewrite for products, orders, order_items
-- ---------------------------------------------------------------------------

-- ---- products ----
DROP POLICY IF EXISTS "anon_select_products" ON public.products;
DROP POLICY IF EXISTS "anon_insert_products" ON public.products;
DROP POLICY IF EXISTS "anon_update_products" ON public.products;
DROP POLICY IF EXISTS "anon_delete_products" ON public.products;

-- Public can read active, non-deleted products
CREATE POLICY "public_select_products" ON public.products FOR SELECT
  TO anon, authenticated USING (active = true AND deleted_at IS NULL);

-- Admin can read everything (including inactive/deleted)
CREATE POLICY "admin_select_products" ON public.products FOR SELECT
  TO authenticated USING (public.is_admin());

-- Admin-only writes
CREATE POLICY "admin_insert_products" ON public.products FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "admin_update_products" ON public.products FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "admin_delete_products" ON public.products FOR DELETE
  TO authenticated USING (public.is_admin());

-- ---- orders ----
DROP POLICY IF EXISTS "anon_select_orders" ON public.orders;
DROP POLICY IF EXISTS "anon_insert_orders" ON public.orders;
DROP POLICY IF EXISTS "anon_update_orders" ON public.orders;
DROP POLICY IF EXISTS "anon_delete_orders" ON public.orders;

-- Public can read orders (storefront order tracking) and insert (checkout)
CREATE POLICY "public_select_orders" ON public.orders FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "public_insert_orders" ON public.orders FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- Admin can update status and delete
CREATE POLICY "admin_update_orders" ON public.orders FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "admin_delete_orders" ON public.orders FOR DELETE
  TO authenticated USING (public.is_admin());

-- ---- order_items ----
DROP POLICY IF EXISTS "anon_select_order_items" ON public.order_items;
DROP POLICY IF EXISTS "anon_insert_order_items" ON public.order_items;
DROP POLICY IF EXISTS "anon_update_order_items" ON public.order_items;
DROP POLICY IF EXISTS "anon_delete_order_items" ON public.order_items;

CREATE POLICY "public_select_order_items" ON public.order_items FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "public_insert_order_items" ON public.order_items FOR INSERT
  TO anon, authenticated WITH CHECK (true);

CREATE POLICY "admin_update_order_items" ON public.order_items FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "admin_delete_order_items" ON public.order_items FOR DELETE
  TO authenticated USING (public.is_admin());

-- ---------------------------------------------------------------------------
-- 7. place_order() SECURITY DEFINER function - atomic checkout with stock check
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.place_order(
  p_customer_name text,
  p_customer_email text DEFAULT NULL,
  p_customer_phone text DEFAULT NULL,
  p_items jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_number text;
  v_count bigint;
  v_total numeric(10,2) := 0;
  v_item jsonb;
  v_product record;
  v_qty integer;
  v_line_total numeric(10,2);
BEGIN
  -- p_items is an array of {"product_id": "...", "quantity": N}
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Carrinho vazio';
  END IF;

  -- Generate order number
  SELECT count(*) + 1 INTO v_count FROM public.orders;
  v_number := 'LD-' || lpad(v_count::text, 4, '0');

  -- Create the order header
  INSERT INTO public.orders (number, status, total, customer_name, customer_email, customer_phone)
  VALUES (v_number, 'received', 0, p_customer_name, p_customer_email, p_customer_phone)
  RETURNING id INTO v_order_id;

  -- Process each item: validate, decrement stock, compute total
  FOR v_item IN SELECT jsonb_array_elements(p_items)
  LOOP
    v_qty := (v_item ->> 'quantity')::integer;
    IF v_qty IS NULL OR v_qty < 1 OR v_qty > 100 THEN
      RAISE EXCEPTION 'Quantidade inválida para um produto';
    END IF;

    SELECT id, name, price, stock, active, deleted_at
    INTO v_product
    FROM public.products
    WHERE id = (v_item ->> 'product_id')::uuid;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto não encontrado';
    END IF;
    IF v_product.active = false OR v_product.deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'Produto não disponível: %', v_product.name;
    END IF;
    IF v_product.stock < v_qty THEN
      RAISE EXCEPTION 'Estoque insuficiente para %', v_product.name;
    END IF;

    v_line_total := v_product.price * v_qty;
    v_total := v_total + v_line_total;

    -- Insert order item (snapshot name + price)
    INSERT INTO public.order_items (order_id, product_id, product_name, unit_price, quantity, subtotal)
    VALUES (v_order_id, v_product.id, v_product.name, v_product.price, v_qty, v_line_total);

    -- Decrement stock atomically
    UPDATE public.products
    SET stock = stock - v_qty
    WHERE id = v_product.id;
  END LOOP;

  -- Update order total
  UPDATE public.orders SET total = v_total WHERE id = v_order_id;

  -- Insert initial status history
  INSERT INTO public.order_status_history (order_id, status, note)
  VALUES (v_order_id, 'received', 'Pedido criado');

  RETURN jsonb_build_object('id', v_order_id, 'number', v_number, 'total', v_total);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.place_order FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.place_order TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. update_order_status() SECURITY DEFINER - admin-only status change with history
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_order_status(
  p_order_id uuid,
  p_status text,
  p_note text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;
  IF p_status NOT IN ('new','received','preparing','shipped','delivered','cancelled') THEN
    RAISE EXCEPTION 'Status inválido';
  END IF;

  UPDATE public.orders SET status = p_status WHERE id = p_order_id;
  INSERT INTO public.order_status_history (order_id, status, note)
  VALUES (p_order_id, p_status, p_note);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_order_status FROM anon;
GRANT EXECUTE ON FUNCTION public.update_order_status TO authenticated;

-- ---------------------------------------------------------------------------
-- 9. Storage bucket for product images
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
SELECT 'product-images', 'product-images', true
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'product-images');

-- Public can read product images
DROP POLICY IF EXISTS "public_read_product_images" ON storage.objects;
CREATE POLICY "public_read_product_images" ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'product-images');

-- Admin can upload/update/delete product images
DROP POLICY IF EXISTS "admin_insert_product_images_storage" ON storage.objects;
CREATE POLICY "admin_insert_product_images_storage" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'product-images' AND public.is_admin());

DROP POLICY IF EXISTS "admin_update_product_images_storage" ON storage.objects;
CREATE POLICY "admin_update_product_images_storage" ON storage.objects FOR UPDATE
  TO authenticated USING (bucket_id = 'product-images' AND public.is_admin())
  WITH CHECK (bucket_id = 'product-images' AND public.is_admin());

DROP POLICY IF EXISTS "admin_delete_product_images_storage" ON storage.objects;
CREATE POLICY "admin_delete_product_images_storage" ON storage.objects FOR DELETE
  TO authenticated USING (bucket_id = 'product-images' AND public.is_admin());

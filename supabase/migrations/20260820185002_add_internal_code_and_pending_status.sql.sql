/*
# Add internal product codes and "pending" order status

1. Products table changes
   - ADD `internal_code` (text, unique) — auto-generated internal identifier like AN-001, BR-001.
     Based on category prefix + sequential number. Set once at creation, never changes.
   - Backfill existing products with generated codes.

2. Orders table changes
   - Update status CHECK constraint to include 'pending' (Aguardando confirmação).
     This becomes the initial status for new orders placed via the storefront.
   - Existing orders keep their current status.

3. Order items table changes
   - ADD `product_image_url` (text) — snapshot of the product's main image at order time.
   - ADD `product_category_name` (text) — snapshot of the category name at order time.
   - ADD `product_internal_code` (text) — snapshot of the product's internal code at order time.
   These allow the admin order detail to show rich product info even if the product is
   later edited or deleted.

4. Function changes
   - `place_order()`: set initial status to 'pending' instead of 'received'.
     Also snapshot image_url, category name, and internal_code into order_items.
     Uses promotional_price when applicable for unit_price.
   - `update_order_status()`: accept 'pending' as a valid status.

5. Security
   - No policy changes. internal_code is admin-visible but not exposed publicly
     (the storefront select already returns all columns; internal_code is simply
     not displayed in the public UI).
*/

-- 1. Add internal_code column to products
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'internal_code'
  ) THEN
    ALTER TABLE public.products ADD COLUMN internal_code text;
  END IF;
END $$;

-- 2. Add unique index on internal_code (partial — only when not null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_internal_code_unique
  ON public.products(internal_code) WHERE internal_code IS NOT NULL;

-- 3. Backfill internal_code for existing products
--    Prefix from category name: Anel->AN, Brinco->BR, Colar->CO, Pulseira->PU
--    Sequential per prefix based on creation order
DO $$
DECLARE
  rec RECORD;
  v_prefix text;
  v_seq int;
BEGIN
  FOR rec IN
    SELECT p.id, p.name, c.name AS cat_name, p.created_at
    FROM public.products p
    LEFT JOIN public.categories c ON c.id = p.category_id
    WHERE p.internal_code IS NULL
    ORDER BY p.created_at ASC
  LOOP
    v_prefix := CASE
      WHEN rec.cat_name ILIKE 'anel%' THEN 'AN'
      WHEN rec.cat_name ILIKE 'brinco%' THEN 'BR'
      WHEN rec.cat_name ILIKE 'colar%' THEN 'CO'
      WHEN rec.cat_name ILIKE 'pulseira%' THEN 'PU'
      ELSE 'XX'
    END;
    SELECT count(*) + 1 INTO v_seq
    FROM public.products
    WHERE internal_code LIKE v_prefix || '-%';
    UPDATE public.products
    SET internal_code = v_prefix || '-' || lpad(v_seq::text, 3, '0')
    WHERE id = rec.id;
  END LOOP;
END $$;

-- 4. Add snapshot columns to order_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_items' AND column_name = 'product_image_url'
  ) THEN
    ALTER TABLE public.order_items ADD COLUMN product_image_url text;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_items' AND column_name = 'product_category_name'
  ) THEN
    ALTER TABLE public.order_items ADD COLUMN product_category_name text;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_items' AND column_name = 'product_internal_code'
  ) THEN
    ALTER TABLE public.order_items ADD COLUMN product_internal_code text;
  END IF;
END $$;

-- 5. Update orders status CHECK to include 'pending'
DO $$
BEGIN
  -- Drop old constraint if it exists and add new one
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_status_check'
  ) THEN
    ALTER TABLE public.orders DROP CONSTRAINT orders_status_check;
  END IF;
END $$;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending','new','received','preparing','shipped','delivered','cancelled'));

-- 6. Update place_order function: status 'pending', snapshot fields, promotional price
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
  v_unit_price numeric(10,2);
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Carrinho vazio';
  END IF;

  SELECT count(*) + 1 INTO v_count FROM public.orders;
  v_number := 'LD-' || lpad(v_count::text, 4, '0');

  INSERT INTO public.orders (number, status, total, customer_name, customer_email, customer_phone)
  VALUES (v_number, 'pending', 0, p_customer_name, p_customer_email, p_customer_phone)
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT jsonb_array_elements(p_items)
  LOOP
    v_qty := (v_item ->> 'quantity')::integer;
    IF v_qty IS NULL OR v_qty < 1 OR v_qty > 100 THEN
      RAISE EXCEPTION 'Quantidade inválida para um produto';
    END IF;

    SELECT p.id, p.name, p.price, p.promotional_price, p.stock, p.active, p.deleted_at,
           p.image_url, p.internal_code, c.name AS category_name
    INTO v_product
    FROM public.products p
    LEFT JOIN public.categories c ON c.id = p.category_id
    WHERE p.id = (v_item ->> 'product_id')::uuid;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto não encontrado';
    END IF;
    IF v_product.active = false OR v_product.deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'Produto não disponível: %', v_product.name;
    END IF;
    IF v_product.stock < v_qty THEN
      RAISE EXCEPTION 'Estoque insuficiente para %', v_product.name;
    END IF;

    -- Use promotional price if it exists and is lower
    v_unit_price := COALESCE(
      NULLIF(v_product.promotional_price, NULL),
      v_product.price
    );
    IF v_product.promotional_price IS NOT NULL AND v_product.promotional_price < v_product.price THEN
      v_unit_price := v_product.promotional_price;
    END IF;

    v_line_total := v_unit_price * v_qty;
    v_total := v_total + v_line_total;

    INSERT INTO public.order_items (
      order_id, product_id, product_name, unit_price, quantity, subtotal,
      product_image_url, product_category_name, product_internal_code
    )
    VALUES (
      v_order_id, v_product.id, v_product.name, v_unit_price, v_qty, v_line_total,
      v_product.image_url, v_product.category_name, v_product.internal_code
    );

    UPDATE public.products
    SET stock = stock - v_qty
    WHERE id = v_product.id;
  END LOOP;

  UPDATE public.orders SET total = v_total WHERE id = v_order_id;

  INSERT INTO public.order_status_history (order_id, status, note)
  VALUES (v_order_id, 'pending', 'Pedido criado pelo site');

  RETURN jsonb_build_object('id', v_order_id, 'number', v_number, 'total', v_total);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.place_order(text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_order(text, text, text, jsonb) TO anon, authenticated;

-- 7. Update update_order_status to accept 'pending'
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
  IF p_status NOT IN ('pending','new','received','preparing','shipped','delivered','cancelled') THEN
    RAISE EXCEPTION 'Status inválido';
  END IF;

  UPDATE public.orders SET status = p_status WHERE id = p_order_id;
  INSERT INTO public.order_status_history (order_id, status, note)
  VALUES (p_order_id, p_status, p_note);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_order_status(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_order_status(uuid, text, text) TO authenticated;

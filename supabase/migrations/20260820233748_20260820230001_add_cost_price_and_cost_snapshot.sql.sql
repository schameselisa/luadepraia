/*
# Add product cost price and order item cost snapshot

## Purpose
Enable financial tracking for the Lua de Praia store:
1. Add `cost_price` to `products` — the acquisition cost per unit (admin-only).
2. Add `unit_cost_snapshot` to `order_items` — captures the cost at the time
   of sale so historical orders always reflect the correct profit, even if the
   product's cost changes later.
3. Update `place_order` to read `cost_price` from the product and store it in
   `unit_cost_snapshot` on each order item.

## Changes

### products table
- New column: `cost_price` numeric(10,2), nullable (default NULL).
  Existing products have no cost → NULL. This is intentional: NULL means
  "cost unknown", not "cost is zero".

### order_items table
- New column: `unit_cost_snapshot` numeric(10,2), nullable (default NULL).
  Stores the product's cost_price at the moment the order was placed.
  For orders placed before this migration, the value is NULL (unknown).

### place_order function
- Updated to SELECT p.cost_price from the product.
- Inserts unit_cost_snapshot into order_items alongside the other snapshots.
- Existing behavior (stock check, price snapshot, etc.) is unchanged.

## Security
- No new RLS policies needed. cost_price is accessible to authenticated
  admins via the existing product SELECT policies. It is never exposed in
  public-facing queries (the public data layer selects specific columns,
  not `*`, and the storefront does not show cost).
- The place_order function is SECURITY DEFINER and already locked to the
  authenticated session for ownership. No security changes.

## Important notes
1. cost_price is NULL by default — existing products work normally.
2. unit_cost_snapshot is NULL for all existing order_items — old orders
   are treated as "cost unknown" in financial calculations.
3. The migration is idempotent: uses IF NOT EXISTS for column additions.
*/

-- 1. Add cost_price to products
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'cost_price'
  ) THEN
    ALTER TABLE public.products
      ADD COLUMN cost_price numeric(10,2);
  END IF;
END$$;

-- 2. Add unit_cost_snapshot to order_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_items' AND column_name = 'unit_cost_snapshot'
  ) THEN
    ALTER TABLE public.order_items
      ADD COLUMN unit_cost_snapshot numeric(10,2);
  END IF;
END$$;

-- 3. Update place_order to capture cost snapshot
CREATE OR REPLACE FUNCTION public.place_order(
  p_customer_name text,
  p_customer_email text DEFAULT NULL,
  p_customer_phone text DEFAULT NULL,
  p_items jsonb DEFAULT NULL,
  p_customer_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
  v_customer_id uuid;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Carrinho vazio';
  END IF;

  v_customer_id := auth.uid();

  PERFORM pg_advisory_xact_lock(hashtext('place_order_number'));

  SELECT count(*) + 1 INTO v_count FROM public.orders;
  v_number := 'LD-' || lpad(v_count::text, 4, '0');

  INSERT INTO public.orders (number, status, total, customer_name, customer_email, customer_phone, customer_id)
  VALUES (v_number, 'pending', 0, p_customer_name, p_customer_email, p_customer_phone, v_customer_id)
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT jsonb_array_elements(p_items)
  LOOP
    v_qty := (v_item ->> 'quantity')::integer;
    IF v_qty IS NULL OR v_qty < 1 OR v_qty > 100 THEN
      RAISE EXCEPTION 'Quantidade inválida para um produto';
    END IF;

    SELECT p.id, p.name, p.price, p.promotional_price, p.stock, p.active, p.deleted_at,
           p.image_url, p.internal_code, p.cost_price, c.name AS category_name
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

    v_unit_price := v_product.price;
    IF v_product.promotional_price IS NOT NULL AND v_product.promotional_price < v_product.price THEN
      v_unit_price := v_product.promotional_price;
    END IF;

    v_line_total := v_unit_price * v_qty;
    v_total := v_total + v_line_total;

    INSERT INTO public.order_items (
      order_id, product_id, product_name, unit_price, quantity, subtotal,
      product_image_url, product_category_name, product_internal_code,
      unit_cost_snapshot
    )
    VALUES (
      v_order_id, v_product.id, v_product.name, v_unit_price, v_qty, v_line_total,
      v_product.image_url, v_product.category_name, v_product.internal_code,
      v_product.cost_price
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

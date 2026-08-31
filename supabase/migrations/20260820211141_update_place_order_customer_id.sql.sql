/*
# Update place_order to accept customer_id

## Purpose
When a customer is signed in, link the order to their account via customer_id.

## Changes
1. Add p_customer_id parameter (nullable uuid, defaults to auth.uid())
2. Set customer_id on the inserted order row

## Backward compatibility
- p_customer_id defaults to NULL (guest checkout unchanged)
- Existing callers without the parameter continue to work
*/

CREATE OR REPLACE FUNCTION public.place_order(
  p_customer_name text,
  p_customer_email text DEFAULT NULL::text,
  p_customer_phone text DEFAULT NULL::text,
  p_items jsonb DEFAULT NULL::jsonb,
  p_customer_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  -- Use provided customer_id, or fall back to auth.uid() if authenticated
  v_customer_id := COALESCE(p_customer_id, auth.uid());

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
$function$;

-- Keep grants: allow both anon (guest) and authenticated (signed-in) to call
GRANT EXECUTE ON FUNCTION public.place_order(text, text, text, jsonb, uuid) TO anon, authenticated;

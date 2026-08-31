-- Rewrite place_order to support sizes, color, per-size stock deduction
CREATE OR REPLACE FUNCTION public.place_order(
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_items jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  v_size_id uuid;
  v_size_label text;
  v_size_stock integer;
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

    v_size_id := nullif(v_item ->> 'size_id', '')::uuid;

    SELECT p.id, p.name, p.price, p.promotional_price, p.stock, p.active, p.deleted_at,
           p.image_url, p.internal_code, p.cost_price, p.color, c.name AS category_name
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

    -- If product has sizes, size_id is required
    IF EXISTS (SELECT 1 FROM public.product_sizes ps WHERE ps.product_id = v_product.id) THEN
      IF v_size_id IS NULL THEN
        RAISE EXCEPTION 'Selecione um tamanho para continuar';
      END IF;

      SELECT ps.label, ps.stock INTO v_size_label, v_size_stock
      FROM public.product_sizes ps
      WHERE ps.id = v_size_id AND ps.product_id = v_product.id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Tamanho não disponível para %', v_product.name;
      END IF;

      IF v_size_stock < v_qty THEN
        RAISE EXCEPTION 'Estoque insuficiente para %', v_product.name;
      END IF;
    ELSE
      IF v_product.stock < v_qty THEN
        RAISE EXCEPTION 'Estoque insuficiente para %', v_product.name;
      END IF;
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
      unit_cost_snapshot, product_color, product_size_id, product_size_label
    ) VALUES (
      v_order_id, v_product.id, v_product.name, v_unit_price, v_qty, v_line_total,
      v_product.image_url, v_product.category_name, v_product.internal_code,
      v_product.cost_price, v_product.color, v_size_id, v_size_label
    );

    -- Deduct stock from variation or product
    IF v_size_id IS NOT NULL THEN
      UPDATE public.product_sizes
        SET stock = stock - v_qty
        WHERE id = v_size_id;
    ELSE
      UPDATE public.products
        SET stock = stock - v_qty
        WHERE id = v_product.id;
    END IF;
  END LOOP;

  UPDATE public.orders SET total = v_total WHERE id = v_order_id;

  INSERT INTO public.order_status_history (order_id, status, note)
    VALUES (v_order_id, 'pending', 'Pedido criado pelo site');

  RETURN jsonb_build_object('id', v_order_id, 'number', v_number, 'total', v_total);
END;
$$;

REVOKE ALL ON FUNCTION public.place_order(text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_order(text, text, text, jsonb) TO authenticated;

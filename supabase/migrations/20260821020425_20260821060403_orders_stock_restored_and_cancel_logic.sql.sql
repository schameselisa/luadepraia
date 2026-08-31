-- Add stock_restored flag to orders (cancel restores stock once)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS stock_restored boolean NOT NULL DEFAULT false;

-- Rewrite update_order_status to restore stock on cancellation (once)
CREATE OR REPLACE FUNCTION public.update_order_status(
  p_order_id uuid,
  p_status text,
  p_note text DEFAULT ''
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_status text;
  v_restored boolean;
  v_item record;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;
  IF p_status NOT IN ('pending','confirmed','preparing','ready','completed','cancelled') THEN
    RAISE EXCEPTION 'Status inválido';
  END IF;

  SELECT status, stock_restored INTO v_old_status, v_restored
  FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;

  -- Only restore stock when transitioning TO cancelled AND not already restored
  IF p_status = 'cancelled' AND v_old_status <> 'cancelled' AND NOT COALESCE(v_restored, false) THEN
    FOR v_item IN
      SELECT oi.product_id, oi.product_size_id, oi.quantity
      FROM public.order_items oi
      WHERE oi.order_id = p_order_id
    LOOP
      IF v_item.product_size_id IS NOT NULL THEN
        UPDATE public.product_sizes
          SET stock = stock + v_item.quantity
          WHERE id = v_item.product_size_id;
      ELSIF v_item.product_id IS NOT NULL THEN
        UPDATE public.products
          SET stock = stock + v_item.quantity
          WHERE id = v_item.product_id;
      END IF;
    END LOOP;
    
    UPDATE public.orders SET stock_restored = true WHERE id = p_order_id;
  END IF;

  UPDATE public.orders SET status = p_status WHERE id = p_order_id;
  INSERT INTO public.order_status_history (order_id, status, note)
    VALUES (p_order_id, p_status, p_note);
END;
$$;

-- Grant execute to authenticated (admins only — function checks is_admin internally)
REVOKE ALL ON FUNCTION public.update_order_status(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_order_status(uuid, text, text) TO authenticated;

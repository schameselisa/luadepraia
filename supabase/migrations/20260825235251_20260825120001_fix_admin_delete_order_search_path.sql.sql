-- Fix: admin_delete_order function can't find crypt() because search_path=public
-- but pgcrypto is in extensions schema. Use fully qualified name.
CREATE OR REPLACE FUNCTION public.admin_delete_order(
  p_order_id uuid,
  p_password text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_stored_hash text;
  v_order record;
  v_item record;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;

  SELECT value INTO v_stored_hash
  FROM public.app_secrets
  WHERE key = 'order_delete_password_hash';

  IF v_stored_hash IS NULL OR p_password IS NULL OR crypt(p_password, v_stored_hash) <> v_stored_hash THEN
    RAISE EXCEPTION 'Senha incorreta';
  END IF;

  SELECT id, status, stock_restored INTO v_order
  FROM public.orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;

  -- Restore stock if not already restored
  IF NOT COALESCE(v_order.stock_restored, false) THEN
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
  END IF;

  -- Delete dependents and order
  DELETE FROM public.order_status_history WHERE order_id = p_order_id;
  DELETE FROM public.order_items WHERE order_id = p_order_id;
  DELETE FROM public.orders WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_order(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_order(uuid, text) TO authenticated;

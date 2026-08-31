/*
# Fix order status constraint to match frontend values

## Problem
The orders.status CHECK constraint was missing 'confirmed', 'ready', 'completed'.
Attempts to set those statuses failed at the DB level.

## Fix
1. Drop old constraint first.
2. Migrate legacy status values to new equivalents.
3. Add new constraint with the exact frontend values.
4. Update update_order_status() validation.
*/

-- 1. Drop old constraint
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- 2. Migrate legacy status values
UPDATE public.orders SET status = 'pending' WHERE status = 'new';
UPDATE public.orders SET status = 'confirmed' WHERE status = 'received';
UPDATE public.orders SET status = 'ready' WHERE status = 'shipped';
UPDATE public.orders SET status = 'completed' WHERE status = 'delivered';

UPDATE public.order_status_history SET status = 'pending' WHERE status = 'new';
UPDATE public.order_status_history SET status = 'confirmed' WHERE status = 'received';
UPDATE public.order_status_history SET status = 'ready' WHERE status = 'shipped';
UPDATE public.order_status_history SET status = 'completed' WHERE status = 'delivered';

-- 3. Add new constraint with exact frontend values
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending','confirmed','preparing','ready','completed','cancelled'));

-- 4. Update update_order_status function
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
  IF p_status NOT IN ('pending','confirmed','preparing','ready','completed','cancelled') THEN
    RAISE EXCEPTION 'Status inválido';
  END IF;

  UPDATE public.orders SET status = p_status WHERE id = p_order_id;
  INSERT INTO public.order_status_history (order_id, status, note)
  VALUES (p_order_id, p_status, p_note);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_order_status(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_order_status(uuid, text, text) TO authenticated;

-- Batch fetch product costs for admin stock financial dashboard
-- Returns array of {product_id, cost_price} for all non-deleted products
CREATE OR REPLACE FUNCTION public.admin_get_all_product_costs()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'product_id', p.id,
    'cost_price', p.cost_price,
    'price', p.price,
    'stock', p.stock,
    'created_at', p.created_at
  )) INTO result
  FROM public.products p
  WHERE p.deleted_at IS NULL;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_all_product_costs() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_all_product_costs() TO authenticated;

/*
# Restrict product acquisition cost to admins only

## Purpose
The `products.cost_price` column records what the store paid for each unit.
Row level security decides which ROWS a caller may read, never which COLUMNS,
so the existing `public_select_products` policy (granted to `anon` and
`authenticated`) was serving `cost_price` to any visitor through the data API.
This migration removes that column from the readable surface and gives admins
a dedicated, guarded way to read it.

## Changes

### products table privileges
- Table-level SELECT is revoked from `anon` and `authenticated`.
- SELECT is re-granted column by column on every column EXCEPT `cost_price`.
- INSERT, UPDATE and DELETE privileges are untouched, so the admin product
  form can still write `cost_price`; only reading it back is restricted.
- Row level security and every existing policy are unchanged.

### New function: admin_get_product_cost(uuid)
- SECURITY DEFINER, returns the `cost_price` of one product as numeric.
- Raises 'Não autorizado' unless `is_admin()` is true for the caller.
- EXECUTE granted to `authenticated` only; explicitly revoked from `anon`
  and `public`.

## Security
1. After this migration a visitor calling
   `/rest/v1/products?select=cost_price` receives a permission error instead
   of the store's margins.
2. The cost is reachable only through `admin_get_product_cost`, which checks
   `is_admin()` (backed by the server-issued `app_metadata` claim, which the
   user cannot edit).

## Important notes
1. Queries that asked for `*` on `products` must now enumerate columns; the
   application code is updated in the same change.
2. No data is modified or dropped.
*/

REVOKE SELECT ON public.products FROM anon;
REVOKE SELECT ON public.products FROM authenticated;

GRANT SELECT (
  id, name, description, price, image_url, stock, active, created_at,
  slug, category_id, promotional_price, minimum_stock, deleted_at,
  updated_at, internal_code
) ON public.products TO anon;

GRANT SELECT (
  id, name, description, price, image_url, stock, active, created_at,
  slug, category_id, promotional_price, minimum_stock, deleted_at,
  updated_at, internal_code
) ON public.products TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_product_cost(p_product_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cost numeric(10,2);
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;

  SELECT cost_price INTO v_cost
  FROM public.products
  WHERE id = p_product_id;

  RETURN v_cost;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_product_cost(uuid) FROM public;
REVOKE ALL ON FUNCTION public.admin_get_product_cost(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_get_product_cost(uuid) TO authenticated;

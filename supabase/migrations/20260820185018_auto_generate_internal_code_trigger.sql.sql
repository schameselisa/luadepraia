/*
# Auto-generate internal_code for new products

Creates a trigger that fires BEFORE INSERT on products. If internal_code is NULL,
it generates one based on the category name prefix (AN, BR, CO, PU) + sequential number.

The code is generated once and never changes (no UPDATE trigger).
*/

CREATE OR REPLACE FUNCTION public.generate_internal_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_prefix text;
  v_seq int;
  v_cat_name text;
BEGIN
  IF NEW.internal_code IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT c.name INTO v_cat_name
  FROM public.categories c
  WHERE c.id = NEW.category_id;

  v_prefix := CASE
    WHEN v_cat_name ILIKE 'anel%' THEN 'AN'
    WHEN v_cat_name ILIKE 'brinco%' THEN 'BR'
    WHEN v_cat_name ILIKE 'colar%' THEN 'CO'
    WHEN v_cat_name ILIKE 'pulseira%' THEN 'PU'
    ELSE 'XX'
  END;

  SELECT count(*) + 1 INTO v_seq
  FROM public.products
  WHERE internal_code LIKE v_prefix || '-%';

  NEW.internal_code := v_prefix || '-' || lpad(v_seq::text, 3, '0');
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.generate_internal_code() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_internal_code() TO anon, authenticated;

DROP TRIGGER IF EXISTS trg_generate_internal_code ON public.products;
CREATE TRIGGER trg_generate_internal_code
  BEFORE INSERT ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_internal_code();

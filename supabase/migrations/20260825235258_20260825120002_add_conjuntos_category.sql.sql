-- Add 'Conjuntos' category if it doesn't exist
INSERT INTO public.categories (name, slug, description, image, active, sort_order)
SELECT 'Conjuntos', 'conjuntos', '', '', true, 5
WHERE NOT EXISTS (
  SELECT 1 FROM public.categories WHERE slug = 'conjuntos' OR lower(name) = 'conjuntos'
);

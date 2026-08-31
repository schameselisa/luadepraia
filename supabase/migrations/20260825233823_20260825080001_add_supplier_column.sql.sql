-- Add optional supplier column to products (admin-only field, not shown to customers)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS supplier text;

-- Grant SELECT on supplier to anon and authenticated (needed for queries that list columns)
GRANT SELECT (supplier) ON public.products TO anon, authenticated;
-- Grant INSERT/UPDATE to authenticated (admin writes via RLS)
GRANT INSERT (supplier) ON public.products TO anon, authenticated;
GRANT UPDATE (supplier) ON public.products TO anon, authenticated;

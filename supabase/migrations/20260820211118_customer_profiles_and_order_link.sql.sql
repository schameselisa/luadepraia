/*
# Customer profiles and order association

## Purpose
Support customer accounts (separate from admin auth). Customers can sign up,
sign in, edit their profile, and have their orders linked to their account.

## Changes
1. New table `customer_profiles`
   - `id` uuid PK, references auth.users (ON DELETE CASCADE)
   - `full_name` text (customer's display name)
   - `phone` text (WhatsApp number)
   - `email` text (denormalized from auth.users for convenience, read-only in UI)
   - `created_at` timestamp
2. `orders` table — add nullable `customer_id` column
   - Links orders to customer accounts when the customer is signed in
   - Nullable so guest checkout continues to work
   - No FK constraint to avoid breaking existing rows, but indexed for lookups
3. RLS on `customer_profiles` — owner-scoped CRUD
4. `orders` — add SELECT policy for authenticated customers to see their own orders

## Security
- customer_profiles: owner-scoped via auth.uid() = id
- orders: new SELECT policy for authenticated users matching customer_id
  (existing anon SELECT policy remains so guest orders still work)
*/

-- 1. Customer profiles table
CREATE TABLE IF NOT EXISTS public.customer_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON public.customer_profiles;
CREATE POLICY "select_own_profile"
  ON public.customer_profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON public.customer_profiles;
CREATE POLICY "insert_own_profile"
  ON public.customer_profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON public.customer_profiles;
CREATE POLICY "update_own_profile"
  ON public.customer_profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- 2. Add customer_id to orders (nullable, guest checkout compatible)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN customer_id uuid;
    CREATE INDEX idx_orders_customer_id ON public.orders (customer_id);
  END IF;
END $$;

-- 3. Allow authenticated customers to select their own orders
DROP POLICY IF EXISTS "select_own_customer_orders" ON public.orders;
CREATE POLICY "select_own_customer_orders"
  ON public.orders FOR SELECT
  TO authenticated USING (customer_id = auth.uid());

/*
# Create initial admin user

1. Purpose
- Creates the first admin account so the /admin panel can be accessed.
- Email: admin@luadepraia.com
- Password: luadepraiamoon (bcrypt-hashed)
- is_admin=true in raw_app_meta_data so the is_admin() SQL function returns true.

2. Security
- Regular signups via the client do NOT get is_admin.
- The password can be reset via the Supabase Auth dashboard if needed.
*/

INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  email_change_token_current,
  recovery_token
) SELECT
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin@luadepraia.com',
  crypt('luadepraiamoon', gen_salt('bf')),
  now(),
  '{"is_admin": true}'::jsonb,
  '{}'::jsonb,
  now(),
  now(),
  '',
  '',
  '',
  '',
  ''
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE email = 'admin@luadepraia.com'
);

-- If the user already exists, ensure they have is_admin
UPDATE auth.users
SET raw_app_meta_data = jsonb_set(
  COALESCE(raw_app_meta_data, '{}'::jsonb),
  '{is_admin}',
  'true'::jsonb
)
WHERE email = 'admin@luadepraia.com';

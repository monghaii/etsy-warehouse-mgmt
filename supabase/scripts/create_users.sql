-- Create Initial Users for Etsy Store Management SaaS
-- Run this in your Supabase SQL Editor

-- IMPORTANT: Change the passwords below before running!

-- 1. Create Admin User
DO $$
DECLARE
  user_id UUID;
BEGIN
  -- Insert into auth.users
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    role,
    aud,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'matt@twinleaf.studio',                    -- CHANGE THIS
    crypt('admin78781123', gen_salt('bf')),      -- CHANGE THIS PASSWORD
    NOW(),
    jsonb_build_object(
      'role', 'admin',
      'full_name', 'Admin User'             -- CHANGE THIS
    ),
    'authenticated',
    'authenticated',
    NOW(),
    NOW()
  )
  RETURNING id INTO user_id;

  -- The trigger will auto-create the profile in public.users
  RAISE NOTICE 'Admin user created with ID: %', user_id;
END $$;

-- 2. Create Designer User
DO $$
DECLARE
  user_id UUID;
BEGIN
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    role,
    aud,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'etsydesigner@twinleaf.studio',                 -- CHANGE THIS
    crypt('designer@123', gen_salt('bf')),   -- CHANGE THIS PASSWORD
    NOW(),
    jsonb_build_object(
      'role', 'designer',
      'full_name', 'Designer User'          -- CHANGE THIS
    ),
    'authenticated',
    'authenticated',
    NOW(),
    NOW()
  )
  RETURNING id INTO user_id;

  RAISE NOTICE 'Designer user created with ID: %', user_id;
END $$;

-- 3. Create Warehouse User
DO $$
DECLARE
  user_id UUID;
BEGIN
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    role,
    aud,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'etsywarehouse@twinleaf.studio',                -- CHANGE THIS
    crypt('warehouse123!', gen_salt('bf')),  -- CHANGE THIS PASSWORD
    NOW(),
    jsonb_build_object(
      'role', 'warehouse',
      'full_name', 'Warehouse User'         -- CHANGE THIS
    ),
    'authenticated',
    'authenticated',
    NOW(),
    NOW()
  )
  RETURNING id INTO user_id;

  RAISE NOTICE 'Warehouse user created with ID: %', user_id;
END $$;

-- Verify users were created
SELECT 
  u.email,
  p.role,
  p.full_name,
  p.is_active,
  u.created_at
FROM auth.users u
JOIN public.users p ON u.id = p.id
ORDER BY u.created_at DESC
LIMIT 3;


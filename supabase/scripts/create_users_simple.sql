-- Simple User Creation via Supabase Auth API
-- This approach is safer and avoids auth schema issues

-- First, let's check if users already exist and delete them if needed
DELETE FROM auth.users WHERE email IN (
  'matt@twinleaf.studio',
  'etsydesigner@twinleaf.studio', 
  'etsywarehouse@twinleaf.studio'
);

-- Now use Supabase's admin API to create users properly
-- You'll need to run this in parts or use the Supabase Dashboard

-- OPTION 1: Use Supabase Dashboard (RECOMMENDED)
-- Go to Authentication → Users → Add User
-- Then run this SQL to set their roles:

-- After creating users in Dashboard, set their roles:
UPDATE public.users 
SET role = 'admin', full_name = 'Matt (Admin)'
WHERE id = (SELECT id FROM auth.users WHERE email = 'matt@twinleaf.studio');

UPDATE public.users 
SET role = 'designer', full_name = 'Designer User'
WHERE id = (SELECT id FROM auth.users WHERE email = 'etsydesigner@twinleaf.studio');

UPDATE public.users 
SET role = 'warehouse', full_name = 'Warehouse User'
WHERE id = (SELECT id FROM auth.users WHERE email = 'etsywarehouse@twinleaf.studio');

-- Verify users
SELECT 
  u.email,
  p.role,
  p.full_name,
  u.email_confirmed_at,
  u.created_at
FROM auth.users u
LEFT JOIN public.users p ON u.id = p.id
WHERE u.email IN (
  'matt@twinleaf.studio',
  'etsydesigner@twinleaf.studio',
  'etsywarehouse@twinleaf.studio'
)
ORDER BY u.created_at DESC;


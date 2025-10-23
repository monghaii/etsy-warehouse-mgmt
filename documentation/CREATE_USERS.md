# Creating Users

Since this is an internal tool, users are created manually via Supabase SQL Editor.

## Quick Setup

### Step 1: Run the Migration

First, make sure you've run the database migration:

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** → **New Query**
3. Copy and paste the contents of `/supabase/migrations/001_initial_schema.sql`
4. Click **Run** (or Cmd/Ctrl + Enter)

### Step 2: Create the Storage Bucket

1. Go to **Storage** in your Supabase dashboard
2. Click **New Bucket**
3. Name: `customer-uploads`
4. Set as **Public bucket**
5. Click **Create Bucket**

### Step 3: Create Initial Users

1. Go to **SQL Editor** → **New Query**
2. Copy and paste the contents of `/supabase/scripts/create_users.sql`
3. **IMPORTANT:** Edit the script to change:
   - Email addresses (e.g., `admin@yourcompany.com`)
   - Passwords (replace `admin123`, `designer123`, `warehouse123`)
   - Full names
4. Click **Run**

You should see output like:

```
NOTICE: Admin user created with ID: 123e4567-e89b-12d3-a456-426614174000
NOTICE: Designer user created with ID: 223e4567-e89b-12d3-a456-426614174001
NOTICE: Warehouse user created with ID: 323e4567-e89b-12d3-a456-426614174002
```

### Step 4: Login

Now you can login at `http://localhost:3000/login` with:

- **Admin:** admin@example.com / your-password
- **Designer:** designer@example.com / your-password
- **Warehouse:** warehouse@example.com / your-password

---

## Adding More Users Later

### Via Supabase Dashboard

1. Go to **Authentication** → **Users**
2. Click **Add User**
3. Enter email and password
4. Click **Create User**
5. Go to **SQL Editor** and run:

```sql
-- Set the user's role and name
UPDATE public.users
SET
  role = 'warehouse',  -- or 'admin', 'designer'
  full_name = 'Jane Doe'
WHERE id = 'user-id-from-auth-users-table';
```

### Via SQL (Recommended)

```sql
-- Create a new user with specific role
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
    'newuser@example.com',              -- Change this
    crypt('securepassword', gen_salt('bf')),  -- Change this
    NOW(),
    jsonb_build_object(
      'role', 'warehouse',              -- admin, designer, or warehouse
      'full_name', 'New User'           -- Change this
    ),
    'authenticated',
    'authenticated',
    NOW(),
    NOW()
  )
  RETURNING id INTO user_id;

  RAISE NOTICE 'User created with ID: %', user_id;
END $$;
```

---

## User Roles

| Role          | Access                                                    |
| ------------- | --------------------------------------------------------- |
| **admin**     | Full system access - all pages, settings, user management |
| **designer**  | Dashboard, Orders, Design Queue                           |
| **warehouse** | Dashboard, Orders, Production, Shipping, Tracking         |

---

## Troubleshooting

### User created but can't login

Check that the user was created correctly:

```sql
-- Verify auth user exists
SELECT email, created_at FROM auth.users WHERE email = 'user@example.com';

-- Verify profile was created
SELECT * FROM public.users WHERE id = (
  SELECT id FROM auth.users WHERE email = 'user@example.com'
);
```

### Trigger didn't create profile

If the profile wasn't auto-created by the trigger, create it manually:

```sql
INSERT INTO public.users (id, role, full_name)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'user@example.com'),
  'warehouse',
  'User Name'
);
```

### Password not working

Reset the password:

```sql
UPDATE auth.users
SET encrypted_password = crypt('newpassword', gen_salt('bf'))
WHERE email = 'user@example.com';
```

---

## Future: Self-Service Signup (Optional)

For now, all users are created manually by admins. If you later want to add a signup page, you can create `/app/signup/page.js` and an API route at `/app/api/auth/signup/route.js`.

But for an internal tool with 3-10 users, manual creation is simpler and more secure.

# Phase 0 Setup Complete ✅

## What Was Implemented

Phase 0 establishes the foundation for the Etsy Store Management SaaS application.

### ✅ Completed Tasks

1. **Next.js App Setup** - App Router configured
2. **Supabase Integration** - Server-side only configuration (no client-side access)
3. **Database Schema** - Complete migration file with all tables
4. **Authentication System** - Server-side login/logout via API routes
5. **User Roles System** - Admin, designer, warehouse roles
6. **Protected Routes** - Middleware for authentication
7. **Basic UI Framework** - Tailwind CSS, navigation, dashboard
8. **Environment Configuration** - Backend-only .env structure

---

## Database Schema Summary

The following tables were created in the migration:

- `stores` - Etsy store configurations
- `public.users` - User profiles with roles (extends auth.users)
- `product_templates` - Product SKU definitions and defaults
- `product_design_groups` - Daily Canva file groupings
- `orders` - Main order tracking table (all lifecycle fields)
- `order_status_history` - Audit trail for status changes
- `sync_logs` - Order sync operation logs
- `system_config` - System-wide settings

**Security:** Row Level Security (RLS) enabled on all tables, no policies defined (service role key bypasses RLS for internal use).

---

## Next Steps: Running the Migration

You need to run the database migration to create all tables in your Supabase project.

### Option 1: Supabase Dashboard (Easiest)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New Query**
4. Open `/supabase/migrations/001_initial_schema.sql`
5. Copy the entire contents
6. Paste into the SQL Editor
7. Click **Run** (or press Cmd/Ctrl + Enter)
8. Verify success (should see "Success. No rows returned")

### Option 2: Supabase CLI

```bash
# Install Supabase CLI (if not already installed)
npm install -g supabase

# Login to Supabase
supabase login

# Link your project (you'll need your project reference ID)
supabase link --project-ref your-project-ref

# Run the migration
supabase db push
```

---

## Storage Bucket Setup

After running the migration, create the storage bucket for customer uploads:

1. Go to **Storage** in your Supabase dashboard
2. Click **New Bucket**
3. Name: `customer-uploads`
4. Set as **Public bucket** (for internal tool simplicity)
5. Click **Create Bucket**

---

## Creating Your First User

Since this is an internal tool, you'll need to create users manually in Supabase:

### Method 1: Supabase Dashboard

1. Go to **Authentication** → **Users**
2. Click **Add User**
3. Enter email and password
4. Click **Create User**
5. Go to **SQL Editor** and run:

```sql
-- Set user role (replace with actual user ID)
UPDATE public.users
SET role = 'admin', full_name = 'Your Name'
WHERE id = 'user-id-from-auth-users';
```

### Method 2: SQL Editor (Faster)

```sql
-- Create admin user directly
-- This will trigger the handle_new_user function automatically
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_user_meta_data,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'admin@example.com',
  crypt('your-password', gen_salt('bf')),
  NOW(),
  '{"role": "admin", "full_name": "Admin User"}',
  NOW(),
  NOW()
);
```

**Note:** For production, consider using Supabase's built-in signup function with proper password hashing.

---

## Environment Variables

Your `.env` file should have these keys (backend-only, no NEXT*PUBLIC* prefix):

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Important:** All Supabase access is server-side only. No client-side database access.

---

## Starting the Development Server

```bash
npm run dev
```

Visit: http://localhost:3000

You should be redirected to `/login`. Use the credentials you created above.

---

## Architecture: Server-Side Only

This application uses **backend-only** Supabase access for maximum security:

- ✅ **All authentication via API routes** (`/api/auth/login`, `/api/auth/logout`)
- ✅ **No client-side Supabase client** (no exposed keys in browser)
- ✅ **Server-side session management** via cookies
- ✅ **Middleware protection** for all routes
- ✅ **All database queries server-side** (Server Components, API Routes)

### Authentication Flow

```
1. User submits login form → POST /api/auth/login
2. API route validates credentials with Supabase (server-side)
3. Session stored in HTTP-only cookies
4. Middleware checks session on each page request
5. Server Components fetch user data directly from DB
```

No Supabase keys ever reach the client browser.

---

## Project Structure

```
/Users/momo/Developer/etsy-saas/
├── documentation/
│   ├── INITIAL_PLANNING_PRD.md
│   └── PHASE_0_SETUP.md (this file)
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── auth/
│   │   │       ├── login/route.js (server-side login)
│   │   │       └── logout/route.js (server-side logout)
│   │   ├── dashboard/page.js
│   │   ├── design-queue/page.js
│   │   ├── login/page.js
│   │   ├── orders/page.js
│   │   ├── production/page.js
│   │   ├── settings/page.js
│   │   ├── shipping/page.js
│   │   ├── tracking/page.js
│   │   ├── layout.js
│   │   ├── page.js (redirects to dashboard)
│   │   └── globals.css
│   ├── components/
│   │   └── Navigation.js
│   ├── lib/
│   │   ├── supabase-client.js (deprecated/not used)
│   │   └── supabase-server.js (server-side admin client)
│   └── middleware.js (route protection)
├── .env (your keys - not in git, backend only)
├── package.json
└── next.config.mjs
```

---

## User Roles & Access

| Role          | Access                                            |
| ------------- | ------------------------------------------------- |
| **admin**     | Full system access - all pages                    |
| **designer**  | Dashboard, Orders, Design Queue                   |
| **warehouse** | Dashboard, Orders, Production, Shipping, Tracking |

The navigation component automatically shows/hides menu items based on user role.

---

## Testing Your Setup

1. ✅ **Database Connection**: Visit dashboard - should see "Database: Connected"
2. ✅ **Authentication**: Login/logout should work smoothly
3. ✅ **Protected Routes**: Try accessing `/dashboard` without login - should redirect to `/login`
4. ✅ **Navigation**: Check that nav items match your user role

---

## What's Next: Phase 1

Once Phase 0 is verified working, move on to **Phase 1: Order Ingestion**

- Etsy API integration
- Store configuration page
- Order polling cron job
- Order list and detail pages
- Status management

See `INITIAL_PLANNING_PRD.md` for full roadmap.

---

## Troubleshooting

### "Missing Supabase environment variables"

- Make sure `.env` file exists in project root
- Verify all three keys are present: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **NO** `NEXT_PUBLIC_` prefix (backend only)
- Restart dev server after adding env vars

### Migration fails with "relation already exists"

- Tables may already exist from a previous run
- Either drop tables manually or use a new Supabase project

### Can't login after creating user

- Verify user exists: `SELECT * FROM auth.users;`
- Verify profile exists: `SELECT * FROM public.users;`
- Check that `handle_new_user` trigger fired correctly

### Navigation doesn't show expected items

- Check user role in database: `SELECT * FROM public.users;`
- Role should be 'admin', 'designer', or 'warehouse'

---

## Support & Documentation

- **PRD**: See `documentation/INITIAL_PLANNING_PRD.md`
- **Supabase Docs**: https://supabase.com/docs
- **Next.js Docs**: https://nextjs.org/docs

---

**Phase 0 Complete!** 🎉

Ready to proceed with Phase 1 when you are.

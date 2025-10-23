import { createClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client with service role key
 * This client has full access and bypasses Row Level Security
 * USE ONLY IN SERVER COMPONENTS, API ROUTES, AND SERVER ACTIONS
 */
export function createServerClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase server environment variables");
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Singleton instance for convenience (optional)
export const supabaseAdmin = createServerClient();

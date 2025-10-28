import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Navigation from "@/components/Navigation";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase-server";

async function getUser() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  // Use service role to fetch profile (bypasses RLS)
  const { data: profile } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    redirect("/dashboard");
  }

  return {
    ...user,
    ...profile,
  };
}

export default async function SystemPage() {
  const user = await getUser();

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation user={user} />

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link
            href="/settings"
            className="text-blue-600 hover:text-blue-700 text-sm mb-2 inline-block"
          >
            ← Back to Settings
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">
            System Configuration
          </h1>
          <p className="text-gray-600 mt-2">
            General system settings and preferences
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-300 p-12 text-center">
          <div className="text-6xl mb-4">⚙️</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Coming Soon
          </h3>
          <p className="text-gray-600">
            System configuration will be available in a future phase
          </p>
        </div>
      </main>
    </div>
  );
}

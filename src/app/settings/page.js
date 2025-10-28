import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Navigation from "@/components/Navigation";
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
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  // Use service role to fetch profile (bypasses RLS)
  const { data: profile } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("id", session.user.id)
    .single();

  // Check if user is admin
  if (profile?.role !== "admin") {
    redirect("/dashboard");
  }

  return {
    ...session.user,
    ...profile,
  };
}

export default async function SettingsPage() {
  const user = await getUser();

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation user={user} />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
            <p className="mt-2 text-gray-600">
              Manage system configuration and integrations
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Stores */}
            <a
              href="/settings/stores"
              className="bg-white shadow rounded-lg p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center">
                <div className="text-3xl mr-4">🏪</div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Stores</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Connect and manage Etsy stores
                  </p>
                </div>
              </div>
            </a>

            {/* Products */}
            <a
              href="/settings/products"
              className="bg-white shadow rounded-lg p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center">
                <div className="text-3xl mr-4">📦</div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900">
                    Products
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Configure product templates and SKUs
                  </p>
                </div>
              </div>
            </a>

            {/* Shipping */}
            <a
              href="/settings/shipping"
              className="bg-white shadow rounded-lg p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center">
                <div className="text-3xl mr-4">🚚</div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900">
                    Shipping
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Configure ship-from address for labels
                  </p>
                </div>
              </div>
            </a>

            {/* Users */}
            <a
              href="/settings/users"
              className="bg-white shadow rounded-lg p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center">
                <div className="text-3xl mr-4">👥</div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Users</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Manage user accounts and roles
                  </p>
                </div>
              </div>
            </a>

            {/* System */}
            <a
              href="/settings/system"
              className="bg-white shadow rounded-lg p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center">
                <div className="text-3xl mr-4">⚙️</div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900">System</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    General system configuration
                  </p>
                </div>
              </div>
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}

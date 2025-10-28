import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Navigation from "@/components/Navigation";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase-server";
import OrderStatusChart from "@/components/OrderStatusChart";

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

  // Use service role to fetch profile (bypasses RLS, as per PRD design)
  const { data: profile } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  return {
    ...user,
    ...profile,
  };
}

export default async function DashboardPage() {
  const user = await getUser();

  const quickActions = [
    {
      href: "/orders",
      icon: "📋",
      label: "View Orders",
      description: "Manage all orders",
    },
    ...(user.role === "admin" || user.role === "designer"
      ? [
          {
            href: "/design-queue",
            icon: "🎨",
            label: "Design Queue",
            description: "Work on designs",
          },
        ]
      : []),
    ...(user.role === "admin" || user.role === "warehouse"
      ? [
          {
            href: "/production",
            icon: "🏭",
            label: "Production",
            description: "Print & produce",
          },
          {
            href: "/shipping",
            icon: "📮",
            label: "Shipping",
            description: "Load for shipment",
          },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation user={user} />

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
          <p className="text-gray-600">
            Welcome back, {user.full_name || user.email}
          </p>
        </div>

        {/* Order Status Chart */}
        <OrderStatusChart />

        {/* Quick Actions */}
        <div className="p-6 rounded-lg mb-8 bg-white border border-gray-300">
          <h2 className="text-lg font-semibold mb-4 text-gray-900">
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {quickActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="flex items-center gap-3 p-4 rounded border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                <span className="text-2xl">{action.icon}</span>
                <div>
                  <div className="font-medium text-gray-900">
                    {action.label}
                  </div>
                  <div className="text-sm text-gray-600">
                    {action.description}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* System Status */}
        <div className="p-6 rounded-lg bg-white border border-gray-300">
          <h2 className="text-lg font-semibold mb-4 text-gray-900">
            System Status
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Database</span>
              <span className="text-sm font-medium text-green-600">
                ● Connected
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Authentication</span>
              <span className="text-sm font-medium text-green-600">
                ● Active
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Last Sync</span>
              <span className="text-sm text-gray-600">
                No stores configured
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

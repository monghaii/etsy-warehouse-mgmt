import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Navigation from "@/components/Navigation";
import OrdersClient from "./OrdersClient";
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

  return {
    ...session.user,
    ...profile,
  };
}

export default async function OrdersPage() {
  const user = await getUser();

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation user={user} />
      <OrdersClient user={user} />
    </div>
  );
}

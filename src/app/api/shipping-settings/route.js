import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

/**
 * GET /api/shipping-settings
 * Fetch user's shipping settings
 */
export async function GET(request) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: () => {},
        },
      }
    );

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: settings, error } = await supabaseAdmin
      .from("shipping_settings")
      .select("*")
      .eq("user_id", session.user.id)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 is "no rows returned"
      console.error("Failed to fetch shipping settings:", error);
      return NextResponse.json(
        { error: "Failed to fetch settings" },
        { status: 500 }
      );
    }

    return NextResponse.json({ settings: settings || null });
  } catch (error) {
    console.error("Get shipping settings error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/shipping-settings
 * Create or update shipping settings
 */
export async function POST(request) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: () => {},
        },
      }
    );

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      ship_from_name,
      ship_from_address_line1,
      ship_from_address_line2,
      ship_from_city,
      ship_from_state,
      ship_from_zip,
      ship_from_country,
      ship_from_phone,
    } = body;

    // Validate required fields
    if (
      !ship_from_address_line1 ||
      !ship_from_city ||
      !ship_from_state ||
      !ship_from_zip ||
      !ship_from_phone
    ) {
      return NextResponse.json(
        { error: "Address, city, state, ZIP, and phone number are required" },
        { status: 400 }
      );
    }

    // Upsert (insert or update)
    const { data, error } = await supabaseAdmin
      .from("shipping_settings")
      .upsert(
        {
          user_id: session.user.id,
          ship_from_name,
          ship_from_company: null, // Company name will come from store
          ship_from_address_line1,
          ship_from_address_line2,
          ship_from_city,
          ship_from_state,
          ship_from_zip,
          ship_from_country: ship_from_country || "US",
          ship_from_phone,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id",
        }
      )
      .select()
      .single();

    if (error) {
      console.error("Failed to save shipping settings:", error);
      return NextResponse.json(
        { error: "Failed to save settings" },
        { status: 500 }
      );
    }

    return NextResponse.json({ settings: data });
  } catch (error) {
    console.error("Save shipping settings error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

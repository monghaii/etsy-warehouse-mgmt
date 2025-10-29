import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * GET /api/tracking/in-transit
 * Fetch all orders with in_transit status
 */
export async function GET() {
  try {
    const { data: orders, error } = await supabaseAdmin
      .from("orders")
      .select("*, stores(store_name, shop_domain, platform)")
      .eq("status", "in_transit")
      .not("tracking_number", "is", null)
      .order("loaded_for_shipment_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ orders });
  } catch (error) {
    console.error("[Tracking] Error fetching in-transit orders:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch orders" },
      { status: 500 }
    );
  }
}

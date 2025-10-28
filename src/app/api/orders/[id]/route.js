import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

/**
 * GET /api/orders/[id]
 * Fetch a single order by ID
 */
export async function GET(request, { params }) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("*, stores(store_name)")
      .eq("id", id)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({ order });
  } catch (error) {
    console.error("Fetch order error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/orders/[id]
 * Update order fields
 */
export async function PATCH(request, { params }) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;
    const body = await request.json();

    const { error } = await supabaseAdmin
      .from("orders")
      .update(body)
      .eq("id", id);

    if (error) {
      console.error("Failed to update order:", error);
      return NextResponse.json(
        { error: "Failed to update order" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update order error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

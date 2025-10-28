import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

/**
 * POST /api/orders/load-for-shipment
 * Mark an order as loaded for shipment by tracking number
 */
export async function POST(request) {
  try {
    const { tracking_number } = await request.json();

    if (!tracking_number) {
      return NextResponse.json(
        { error: "Tracking number is required" },
        { status: 400 }
      );
    }

    console.log("[Load Shipment] Looking up tracking:", tracking_number);

    // Find order by tracking number
    const { data: order, error: lookupError } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("tracking_number", tracking_number)
      .single();

    if (lookupError || !order) {
      console.error("[Load Shipment] Order not found:", lookupError);
      return NextResponse.json(
        { error: "No order found with this tracking number" },
        { status: 404 }
      );
    }

    // Check if order has a label
    if (!order.label_url) {
      return NextResponse.json(
        { error: "This order does not have a shipping label yet" },
        { status: 400 }
      );
    }

    // Update order status with UTC timestamp
    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        status: "loaded_for_shipment",
        loaded_for_shipment_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    if (updateError) {
      console.error("[Load Shipment] Update error:", updateError);
      return NextResponse.json(
        { error: "Failed to update order" },
        { status: 500 }
      );
    }

    console.log("[Load Shipment] Success:", order.order_number);

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        order_number: order.order_number,
        customer_name: order.customer_name,
        tracking_number: order.tracking_number,
        shipping_address_line1: order.shipping_address_line1,
        shipping_city: order.shipping_city,
        shipping_state: order.shipping_state,
        shipping_zip: order.shipping_zip,
      },
    });
  } catch (error) {
    console.error("[Load Shipment] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

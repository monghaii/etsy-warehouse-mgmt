import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * GET /api/orders/debug
 * Check a sample order to see what data we have
 */
export async function GET(request) {
  try {
    // Get one order with raw data
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error) throw error;

    const addressStatus = {
      order_id: order.id,
      order_number: order.order_number,
      has_address_fields: {
        name: !!order.customer_name,
        email: !!order.customer_email,
        line1: !!order.shipping_address_line1,
        line2: !!order.shipping_address_line2,
        city: !!order.shipping_city,
        state: !!order.shipping_state,
        zip: !!order.shipping_zip,
        country: !!order.shipping_country,
      },
      raw_receipt_has: {
        name: !!order.raw_order_data?.receipt?.name,
        email: !!order.raw_order_data?.receipt?.buyer_email,
        first_line: !!order.raw_order_data?.receipt?.first_line,
        city: !!order.raw_order_data?.receipt?.city,
        state: !!order.raw_order_data?.receipt?.state,
        zip: !!order.raw_order_data?.receipt?.zip,
        country: !!order.raw_order_data?.receipt?.country_iso,
      },
      has_shipment_data: !!order.raw_order_data?.shipment,
      shipment_fields: order.raw_order_data?.shipment
        ? {
            to_name: !!order.raw_order_data.shipment.to_name,
            to_address_1: !!order.raw_order_data.shipment.to_address_1,
            to_city: !!order.raw_order_data.shipment.to_city,
            to_state: !!order.raw_order_data.shipment.to_state,
            to_zip: !!order.raw_order_data.shipment.to_zip,
            to_country: !!order.raw_order_data.shipment.to_country_iso,
          }
        : null,
      sample_values: {
        customer_name: order.customer_name || "MISSING",
        shipping_address_line1: order.shipping_address_line1 || "MISSING",
        receipt_name: order.raw_order_data?.receipt?.name || "MISSING",
        receipt_first_line:
          order.raw_order_data?.receipt?.first_line || "MISSING",
      },
    };

    return NextResponse.json({
      status: addressStatus,
      full_order: order,
    });
  } catch (error) {
    console.error("Debug error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

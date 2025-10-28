import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function POST(request) {
  try {
    const { orderNumber } = await request.json();

    if (!orderNumber) {
      return NextResponse.json(
        { error: "Order number is required" },
        { status: 400 }
      );
    }

    // Clean up order number (remove # if present, trim whitespace)
    const cleanOrderNumber = orderNumber.toString().replace(/^#/, "").trim();

    console.log("[Enrich Lookup] Searching for order:", cleanOrderNumber);

    // Look up order by order_number
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select(
        `
        id,
        order_number,
        customer_name,
        product_sku,
        status,
        enrichment_submitted_at,
        raw_order_data
      `
      )
      .eq("order_number", cleanOrderNumber)
      .single();

    if (orderError || !order) {
      console.log("[Enrich Lookup] Order not found:", orderError);
      return NextResponse.json(
        { error: "Order not found. Please check your order number." },
        { status: 404 }
      );
    }

    // Check if already enriched
    if (
      order.status !== "pending_enrichment" &&
      order.enrichment_submitted_at
    ) {
      return NextResponse.json(
        {
          error:
            "This order has already been submitted. If you need to make changes, please contact support.",
          alreadyEnriched: true,
        },
        { status: 400 }
      );
    }

    // Get all transactions (line items) from the order
    const transactions = order.raw_order_data?.transactions || [];

    if (transactions.length === 0) {
      return NextResponse.json(
        { error: "No items found in this order." },
        { status: 400 }
      );
    }

    console.log(`[Enrich Lookup] Order has ${transactions.length} item(s)`);

    // Look up product configuration for each item
    const items = [];
    let allNoEnrichment = true;

    for (const transaction of transactions) {
      // SKU is already enhanced when the order was synced, so use it directly
      const sku = transaction.sku || "";

      const { data: product, error: productError } = await supabaseAdmin
        .from("product_templates")
        .select(
          "sku, product_name, personalization_type, personalization_notes"
        )
        .eq("sku", sku)
        .single();

      const itemConfig = {
        transactionId: transaction.transaction_id,
        sku: sku,
        productName: transaction.title || "Unknown Product",
        quantity: transaction.quantity || 1,
        personalizationType: product?.personalization_type || "both",
        personalizationInstructions: product?.personalization_notes || null,
        existingPersonalization:
          transaction.variations
            ?.map((v) => `${v.formatted_name}: ${v.formatted_value}`)
            .join(" | ") || null,
      };

      // Check if this item needs enrichment
      if (itemConfig.personalizationType !== "none") {
        allNoEnrichment = false;
      }

      items.push(itemConfig);
    }

    // If all items have no enrichment needed, reject
    if (allNoEnrichment) {
      return NextResponse.json(
        {
          error:
            "None of the items in this order require personalization. Your order is ready to go!",
          noEnrichmentNeeded: true,
        },
        { status: 400 }
      );
    }

    // Return order and items info
    return NextResponse.json({
      orderId: order.id,
      orderNumber: order.order_number,
      customerName: order.customer_name,
      items: items,
    });
  } catch (error) {
    console.error("[Enrich Lookup] Error:", error);
    return NextResponse.json(
      { error: "Failed to look up order. Please try again." },
      { status: 500 }
    );
  }
}

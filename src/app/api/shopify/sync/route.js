import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * POST /api/shopify/sync
 * Sync orders from a Shopify store
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { storeId } = body;

    if (!storeId) {
      return NextResponse.json(
        { error: "Store ID is required" },
        { status: 400 }
      );
    }

    // Fetch store credentials
    const { data: store, error: storeError } = await supabaseAdmin
      .from("stores")
      .select("*")
      .eq("id", storeId)
      .eq("platform", "shopify")
      .single();

    if (storeError || !store) {
      return NextResponse.json(
        { error: "Shopify store not found" },
        { status: 404 }
      );
    }

    if (!store.access_token || !store.shop_domain) {
      return NextResponse.json(
        { error: "Store credentials incomplete" },
        { status: 400 }
      );
    }

    console.log(`[Shopify Sync] Starting sync for store: ${store.store_name}`);

    // Fetch orders from Shopify
    const ordersUrl = `https://${store.shop_domain}/admin/api/2024-01/orders.json?status=any&limit=50`;
    const response = await fetch(ordersUrl, {
      headers: {
        "X-Shopify-Access-Token": store.access_token,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Shopify Sync] API error:", errorText);
      return NextResponse.json(
        { error: `Shopify API error: ${response.statusText}` },
        { status: response.status }
      );
    }

    const { orders } = await response.json();
    console.log(`[Shopify Sync] Fetched ${orders.length} orders`);

    let newOrders = 0;
    let updatedOrders = 0;
    let errors = 0;

    // Process each order
    for (const shopifyOrder of orders) {
      try {
        // Check if order already exists
        const { data: existingOrder } = await supabaseAdmin
          .from("orders")
          .select("id")
          .eq("platform", "shopify")
          .eq("external_order_id", shopifyOrder.id.toString())
          .single();

        // Extract product info from line items (use first item for single-SKU orders)
        const lineItems = shopifyOrder.line_items || [];
        const firstItem = lineItems[0] || {};

        // Extract shipping address
        const shippingAddr = shopifyOrder.shipping_address || {};

        const orderData = {
          platform: "shopify",
          store_id: store.id,
          external_order_id: shopifyOrder.id.toString(),
          external_receipt_id: shopifyOrder.order_number.toString(),
          order_number: shopifyOrder.order_number.toString(),
          customer_name:
            `${shopifyOrder.customer?.first_name || ""} ${
              shopifyOrder.customer?.last_name || ""
            }`.trim() || "Unknown",
          customer_email: shopifyOrder.customer?.email || "",

          // Product information from line items
          product_sku: firstItem.sku || null,
          product_name: firstItem.name || null,
          quantity: firstItem.quantity || 1,

          // Shipping address
          shipping_address_line1: shippingAddr.address1 || null,
          shipping_address_line2: shippingAddr.address2 || null,
          shipping_city: shippingAddr.city || null,
          shipping_state: shippingAddr.province || null,
          shipping_zip: shippingAddr.zip || null,
          shipping_country: shippingAddr.country || null,

          status: "pending_enrichment",
          raw_order_data: shopifyOrder,
          order_date: shopifyOrder.created_at,
        };

        if (existingOrder) {
          // Update existing order
          await supabaseAdmin
            .from("orders")
            .update(orderData)
            .eq("id", existingOrder.id);
          updatedOrders++;
        } else {
          // Insert new order
          await supabaseAdmin.from("orders").insert(orderData);
          newOrders++;
        }
      } catch (error) {
        console.error(
          `[Shopify Sync] Error processing order ${shopifyOrder.id}:`,
          error
        );
        errors++;
      }
    }

    // Update store sync timestamp
    await supabaseAdmin
      .from("stores")
      .update({ last_sync_timestamp: new Date().toISOString() })
      .eq("id", storeId);

    console.log(
      `[Shopify Sync] Complete: ${newOrders} new, ${updatedOrders} updated, ${errors} errors`
    );

    return NextResponse.json({
      success: true,
      newOrders,
      updatedOrders,
      errors,
      totalProcessed: orders.length,
    });
  } catch (error) {
    console.error("[Shopify Sync] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to sync Shopify orders" },
      { status: 500 }
    );
  }
}

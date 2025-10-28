import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * POST /api/orders/update-statuses
 * Retroactively update order statuses based on product configuration
 * This applies the auto-advancement logic to existing orders
 */
export async function POST(request) {
  try {
    console.log("[Update Statuses] Starting retroactive status update...");

    // Get all orders with status "pending_enrichment"
    const { data: orders, error: ordersError } = await supabaseAdmin
      .from("orders")
      .select("id, product_sku, raw_order_data, status")
      .eq("status", "pending_enrichment");

    if (ordersError) throw ordersError;

    if (!orders || orders.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No orders to update",
        updated: 0,
        skipped: 0,
      });
    }

    console.log(`[Update Statuses] Found ${orders.length} orders to check`);

    let updated = 0;
    let skipped = 0;
    const updates = [];

    for (const order of orders) {
      const sku = order.product_sku;

      // If no SKU, skip
      if (!sku) {
        skipped++;
        continue;
      }

      // Look up product configuration
      const { data: product } = await supabaseAdmin
        .from("product_templates")
        .select("personalization_type")
        .eq("sku", sku)
        .single();

      // If no product configuration, skip
      if (!product) {
        skipped++;
        continue;
      }

      const personalizationType = product.personalization_type;
      let newStatus = null;

      // If product requires no personalization, promote to ready_for_design
      if (personalizationType === "none") {
        newStatus = "ready_for_design";
        console.log(
          `[Update Statuses] Order ${order.id}: ${sku} requires no personalization → ready_for_design`
        );
      }

      // Check if order has personalization data
      const variations =
        order.raw_order_data?.transactions?.[0]?.variations || [];
      const hasPersonalization = variations.some((v) => {
        if (v.formatted_name !== "Personalization") return false;
        const value = v.formatted_value?.trim() || "";
        // Exclude empty values and "Not requested on this item"
        return value !== "" && !value.toLowerCase().includes("not requested");
      });

      // If product only requires notes and order has personalization, promote to ready_for_design
      if (personalizationType === "notes" && hasPersonalization) {
        newStatus = "ready_for_design";
        console.log(
          `[Update Statuses] Order ${order.id}: ${sku} requires notes only and has data → ready_for_design`
        );
      }

      // Update order status if needed
      if (newStatus) {
        const { error: updateError } = await supabaseAdmin
          .from("orders")
          .update({ status: newStatus })
          .eq("id", order.id);

        if (updateError) {
          console.error(
            `[Update Statuses] Failed to update order ${order.id}:`,
            updateError
          );
          continue;
        }

        updated++;
        updates.push({
          order_id: order.id,
          sku: sku,
          old_status: "pending_enrichment",
          new_status: newStatus,
          reason:
            personalizationType === "none"
              ? "Product requires no personalization"
              : "Product requires notes only and order has personalization data",
        });
      } else {
        skipped++;
      }
    }

    console.log(
      `[Update Statuses] Complete: ${updated} updated, ${skipped} skipped`
    );

    return NextResponse.json({
      success: true,
      updated,
      skipped,
      total_checked: orders.length,
      updates,
    });
  } catch (error) {
    console.error("[Update Statuses] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update statuses" },
      { status: 500 }
    );
  }
}

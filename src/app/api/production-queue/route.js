import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * GET /api/production-queue
 * Fetch orders with design_complete or pending_fulfillment status
 * and enrich with product template data (dimensions, weight)
 */
export async function GET() {
  try {
    // Fetch orders that are design_complete or pending_fulfillment
    const { data: orders, error } = await supabaseAdmin
      .from("orders")
      .select("*, stores(store_name)")
      .in("status", ["design_complete", "pending_fulfillment"])
      .order("order_date", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Failed to fetch production queue:", error);
      return NextResponse.json(
        { error: "Failed to fetch orders" },
        { status: 500 }
      );
    }

    // Enrich each order with product template data for each transaction
    const enrichedOrders = await Promise.all(
      orders.map(async (order) => {
        const transactions = order.raw_order_data?.transactions || [];

        // Fetch product templates for all SKUs in this order
        const enrichedTransactions = await Promise.all(
          transactions.map(async (txn) => {
            const sku = txn.sku;
            if (!sku) return txn;

            // Look up product template by SKU
            const { data: product } = await supabaseAdmin
              .from("product_templates")
              .select(
                "default_length_inches, default_width_inches, default_height_inches, default_weight_oz"
              )
              .eq("sku", sku)
              .single();

            return {
              ...txn,
              product_dimensions: product
                ? {
                    length: product.default_length_inches,
                    width: product.default_width_inches,
                    height: product.default_height_inches,
                  }
                : null,
              product_weight: product?.default_weight_oz || null,
            };
          })
        );

        return {
          ...order,
          raw_order_data: {
            ...order.raw_order_data,
            transactions: enrichedTransactions,
          },
        };
      })
    );

    return NextResponse.json({ orders: enrichedOrders });
  } catch (error) {
    console.error("Production queue error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

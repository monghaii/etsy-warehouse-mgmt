import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * GET /api/products/unconfigured-skus
 * Get all SKUs from orders that don't have product templates configured
 */
export async function GET() {
  try {
    // Get all distinct SKUs from orders
    const { data: orders, error: ordersError } = await supabaseAdmin
      .from("orders")
      .select("product_sku, product_name")
      .not("product_sku", "is", null)
      .order("product_sku");

    if (ordersError) throw ordersError;

    // Get all configured SKUs from product_templates
    const { data: products, error: productsError } = await supabaseAdmin
      .from("product_templates")
      .select("sku");

    if (productsError) throw productsError;

    const configuredSkus = new Set(products.map((p) => p.sku));

    // Find unique unconfigured SKUs
    const unconfiguredSkusMap = new Map();

    orders.forEach((order) => {
      const sku = order.product_sku;
      if (sku && !configuredSkus.has(sku) && !unconfiguredSkusMap.has(sku)) {
        unconfiguredSkusMap.set(sku, {
          sku,
          product_name: order.product_name || "",
        });
      }
    });

    const unconfiguredSkus = Array.from(unconfiguredSkusMap.values());

    return NextResponse.json({
      unconfigured_skus: unconfiguredSkus,
      count: unconfiguredSkus.length,
    });
  } catch (error) {
    console.error("Error fetching unconfigured SKUs:", error);
    return NextResponse.json(
      { error: "Failed to fetch unconfigured SKUs" },
      { status: 500 }
    );
  }
}

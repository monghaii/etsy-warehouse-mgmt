import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * GET /api/design-queue
 * Fetch orders ready for design with their product configurations
 */
export async function GET() {
  try {
    // Fetch orders with ready_for_design OR design_complete status
    // (designers can edit design_complete orders until they go to production)
    const { data: orders, error } = await supabaseAdmin
      .from("orders")
      .select("*, stores(store_name, shop_domain, platform)")
      .in("status", ["ready_for_design", "design_complete"])
      .order("order_date", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Failed to fetch design queue:", error);
      return NextResponse.json(
        { error: "Failed to fetch orders" },
        { status: 500 }
      );
    }

    // Sort orders: revision orders first, then by date
    const sortedOrders = [...(orders || [])].sort((a, b) => {
      // Revision orders always come first
      if (a.needs_design_revision && !b.needs_design_revision) return -1;
      if (!a.needs_design_revision && b.needs_design_revision) return 1;
      // Otherwise sort by date (newest first)
      return new Date(b.order_date) - new Date(a.order_date);
    });

    // For each order, enrich transactions with product config (Canva template URL)
    const enrichedOrders = await Promise.all(
      sortedOrders.map(async (order) => {
        const transactions = order.raw_order_data?.transactions || [];

        // Fetch product configs for all SKUs in this order
        // SKUs are now stored enhanced with dimensions (e.g., BLKT-KPOP-001-30-40)
        const skus = transactions.map((txn) => txn.sku).filter((sku) => sku);

        if (skus.length === 0) {
          return order;
        }

        const { data: productConfigs } = await supabaseAdmin
          .from("product_templates")
          .select("sku, canva_template_url")
          .in("sku", skus);

        // Create a lookup map
        const configMap = new Map();
        (productConfigs || []).forEach((config) => {
          configMap.set(config.sku, config);
        });

        // Enrich each transaction with its Canva template URL
        const enrichedTransactions = transactions.map((txn) => {
          const config = configMap.get(txn.sku);
          return {
            ...txn,
            canva_template_url: config?.canva_template_url || null,
          };
        });

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
    console.error("Design queue error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

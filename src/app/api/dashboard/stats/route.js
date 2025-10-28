import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/stats
 * Get order count statistics by status
 */
export async function GET() {
  try {
    // Get all orders with their statuses
    const { data: orders, error } = await supabaseAdmin
      .from("orders")
      .select("status");

    if (error) {
      console.error("Failed to fetch order stats:", error);
      return NextResponse.json(
        { error: "Failed to fetch statistics" },
        { status: 500 }
      );
    }

    // Count orders by status
    const statusCounts = {};

    orders.forEach((order) => {
      const status = order.status || "unknown";
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    // Format for chart (human-readable labels)
    const statusLabels = {
      pending_enrichment: "Pending Enrichment",
      needs_review: "Needs Review",
      ready_for_design: "Ready for Design",
      design_complete: "Design Complete",
      in_production: "In Production",
      labels_generated: "Labels Generated",
      loaded_for_shipment: "Loaded for Shipment",
      pending_fulfillment: "Pending Fulfillment",
      in_transit: "In Transit",
      delivered: "Delivered",
    };

    const chartData = Object.entries(statusCounts).map(([status, count]) => ({
      status: statusLabels[status] || status,
      count,
      statusKey: status,
    }));

    // Sort by count descending
    chartData.sort((a, b) => b.count - a.count);

    return NextResponse.json({
      chartData,
      total: orders.length,
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

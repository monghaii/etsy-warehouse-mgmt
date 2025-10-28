import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * PATCH /api/orders/[id]/status
 * Manually update an order's status
 */
export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const { status, review_reason } = await request.json();

    if (!status) {
      return NextResponse.json(
        { error: "Status is required" },
        { status: 400 }
      );
    }

    // Valid statuses
    const validStatuses = [
      "pending_enrichment",
      "needs_review",
      "ready_for_design",
      "design_complete",
      "labels_generated",
      "loaded_for_shipment",
      "in_transit",
      "delivered",
    ];

    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    // Prepare update object
    const updateData = {
      status,
      updated_at: new Date().toISOString(),
    };

    // Add review_reason if status is needs_review
    if (status === "needs_review" && review_reason) {
      updateData.review_reason = review_reason;
    } else if (status !== "needs_review") {
      // Clear review_reason if moving away from needs_review
      updateData.review_reason = null;
    }

    // Update order status
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ order });
  } catch (error) {
    console.error("Error updating order status:", error);
    return NextResponse.json(
      { error: "Failed to update order status" },
      { status: 500 }
    );
  }
}

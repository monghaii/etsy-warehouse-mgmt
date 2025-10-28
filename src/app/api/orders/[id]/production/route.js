import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

/**
 * POST /api/orders/[id]/production
 * Start production for an order
 */
export async function POST(request, { params }) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;

    const { error } = await supabaseAdmin
      .from("orders")
      .update({
        status: "in_production",
        production_started_at: new Date().toISOString(),
        needs_design_revision: false,
        design_revision_notes: null,
      })
      .eq("id", id);

    if (error) {
      console.error("Failed to start production:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      return NextResponse.json(
        { error: `Failed to start production: ${error.message || error.code}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Start production error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/orders/[id]/production
 * Request design revision (sends back to design queue)
 */
export async function DELETE(request, { params }) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;
    const body = await request.json();
    const { revision_notes } = body;

    const { error } = await supabaseAdmin
      .from("orders")
      .update({
        status: "ready_for_design",
        needs_design_revision: true,
        design_revision_notes: revision_notes || null,
        production_started_at: null,
      })
      .eq("id", id);

    if (error) {
      console.error("Failed to request design revision:", error);
      return NextResponse.json(
        { error: "Failed to request design revision" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Request design revision error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

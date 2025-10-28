import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * DELETE /api/stores/[id]
 * Delete a store
 */
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;

    // First delete related sync_logs
    await supabaseAdmin.from("sync_logs").delete().eq("store_id", id);

    // Then delete the store
    const { error } = await supabaseAdmin.from("stores").delete().eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting store:", error);
    return NextResponse.json(
      { error: "Failed to delete store" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/stores/[id]
 * Update a store
 */
export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { is_active, store_name } = body;

    const updates = {};
    if (typeof is_active !== "undefined") updates.is_active = is_active;
    if (store_name) updates.store_name = store_name;

    const { data: store, error } = await supabaseAdmin
      .from("stores")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      store: {
        ...store,
        api_token_encrypted: undefined,
      },
    });
  } catch (error) {
    console.error("Error updating store:", error);
    return NextResponse.json(
      { error: "Failed to update store" },
      { status: 500 }
    );
  }
}

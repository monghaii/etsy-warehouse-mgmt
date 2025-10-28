import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * POST /api/orders/clear
 * Clear all orders (for testing/debugging)
 * WARNING: This deletes all order data!
 */
export async function POST(request) {
  try {
    const body = await request.json();

    // Safety check - require confirmation
    if (body.confirm !== "DELETE_ALL_ORDERS") {
      return NextResponse.json(
        { error: "Must provide confirm: 'DELETE_ALL_ORDERS'" },
        { status: 400 }
      );
    }

    // Clear all files from the design-files bucket
    let filesDeleted = 0;
    try {
      const { data: fileList } = await supabaseAdmin.storage
        .from("design-files")
        .list();

      if (fileList && fileList.length > 0) {
        for (const folder of fileList) {
          // List files in each order folder
          const { data: files } = await supabaseAdmin.storage
            .from("design-files")
            .list(folder.name);

          if (files && files.length > 0) {
            const filePaths = files.map((f) => `${folder.name}/${f.name}`);
            const { error: removeError } = await supabaseAdmin.storage
              .from("design-files")
              .remove(filePaths);

            if (!removeError) {
              filesDeleted += files.length;
            }
          }
        }
        console.log(
          `[Clear] Deleted ${filesDeleted} design file(s) from storage`
        );
      }
    } catch (storageError) {
      console.error("Error clearing storage:", storageError);
      // Continue even if storage cleanup fails
    }

    // Delete all orders
    const { error: deleteError, count } = await supabaseAdmin
      .from("orders")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all (this is a trick to delete everything)

    if (deleteError) throw deleteError;

    // Reset last_sync_timestamp on all stores so they re-sync everything
    const { error: resetError } = await supabaseAdmin
      .from("stores")
      .update({ last_sync_timestamp: null })
      .neq("id", "00000000-0000-0000-0000-000000000000");

    if (resetError) throw resetError;

    return NextResponse.json({
      success: true,
      message: `Deleted all orders and ${filesDeleted} design file(s). Stores reset. Ready for fresh sync.`,
      deleted_count: count,
      files_deleted: filesDeleted,
    });
  } catch (error) {
    console.error("Clear orders error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

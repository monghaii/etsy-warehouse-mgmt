import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function POST(request) {
  try {
    const { orderIds } = await request.json();

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json(
        { error: "Order IDs array is required" },
        { status: 400 }
      );
    }

    // Get the orders with their design files and store IDs
    const { data: ordersToDelete } = await supabaseAdmin
      .from("orders")
      .select("id, store_id, design_files")
      .in("id", orderIds);

    const storeIds = [...new Set(ordersToDelete?.map((o) => o.store_id) || [])];

    // Delete design files from storage for each order
    let filesDeleted = 0;
    for (const order of ordersToDelete || []) {
      if (order.design_files && Array.isArray(order.design_files)) {
        for (const designFile of order.design_files) {
          if (designFile.file_path) {
            try {
              const { error: storageError } = await supabaseAdmin.storage
                .from("design-files")
                .remove([designFile.file_path]);

              if (storageError) {
                console.error(
                  `Failed to delete file ${designFile.file_path}:`,
                  storageError
                );
              } else {
                filesDeleted++;
              }
            } catch (err) {
              console.error(
                `Error deleting file ${designFile.file_path}:`,
                err
              );
            }
          }
        }
      }
    }

    if (filesDeleted > 0) {
      console.log(
        `[Bulk Delete] Deleted ${filesDeleted} design file(s) from storage`
      );
    }

    // Delete the orders
    const { error, count } = await supabaseAdmin
      .from("orders")
      .delete()
      .in("id", orderIds);

    if (error) {
      console.error("Failed to delete orders:", error);
      return NextResponse.json(
        { error: "Failed to delete orders" },
        { status: 500 }
      );
    }

    // Reset last_sync_timestamp for affected stores so they can re-sync
    if (storeIds.length > 0) {
      await supabaseAdmin
        .from("stores")
        .update({ last_sync_timestamp: null })
        .in("id", storeIds);

      console.log(
        `[Bulk Delete] Reset sync timestamps for ${storeIds.length} store(s)`
      );
    }

    console.log(`[Bulk Delete] Successfully deleted ${count} order(s)`);

    return NextResponse.json({
      success: true,
      deleted: count || orderIds.length,
    });
  } catch (error) {
    console.error("Bulk delete error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

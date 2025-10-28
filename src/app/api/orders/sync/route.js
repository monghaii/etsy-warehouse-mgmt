import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { createEtsyClient, parseEtsyReceipt } from "@/lib/etsy-client";

/**
 * Determine the appropriate status for an order based on product configuration
 * and existing personalization data
 */
async function determineOrderStatus(orderData) {
  const sku = orderData.product_sku;

  // If no SKU, default to pending_enrichment
  if (!sku) {
    return { ...orderData, status: "pending_enrichment" };
  }

  // Look up product configuration
  const { data: product } = await supabaseAdmin
    .from("product_templates")
    .select("personalization_type")
    .eq("sku", sku)
    .single();

  // If no product configuration, default to pending_enrichment
  if (!product) {
    console.log(
      `[Sync] No product config for SKU ${sku}, status: pending_enrichment`
    );
    return { ...orderData, status: "pending_enrichment" };
  }

  const personalizationType = product.personalization_type;

  // If product requires no personalization, skip to ready_for_design
  if (personalizationType === "none") {
    return { ...orderData, status: "ready_for_design" };
  }

  // Check if order has personalization data
  const variations =
    orderData.raw_order_data?.transactions?.[0]?.variations || [];
  const hasPersonalization = variations.some((v) => {
    if (v.formatted_name !== "Personalization") return false;
    const value = v.formatted_value?.trim() || "";
    // Exclude empty values and "Not requested on this item"
    return value !== "" && !value.toLowerCase().includes("not requested");
  });

  // If product only requires notes and order has personalization, skip to ready_for_design
  if (personalizationType === "notes" && hasPersonalization) {
    return { ...orderData, status: "ready_for_design" };
  }

  // If product requires image or both, or if no personalization data exists, need enrichment
  return { ...orderData, status: "pending_enrichment" };
}

/**
 * POST /api/orders/sync
 * Manually trigger order sync for all active stores
 */
export async function POST(request) {
  try {
    const { store_id } = await request.json().catch(() => ({}));

    // Get active stores
    let storesQuery = supabaseAdmin
      .from("stores")
      .select("*")
      .eq("is_active", true);

    if (store_id) {
      storesQuery = storesQuery.eq("id", store_id);
    }

    const { data: stores, error: storesError } = await storesQuery;

    if (storesError) throw storesError;

    if (!stores || stores.length === 0) {
      return NextResponse.json(
        { error: "No active stores found" },
        { status: 404 }
      );
    }

    const results = [];
    let hasError = false;
    let errorStores = [];

    for (const store of stores) {
      const syncResult = await syncStoreOrders(store);

      results.push({
        store_id: store.id,
        store_name: store.store_name,
        ...syncResult,
      });

      // Check if this store had an error
      if (syncResult.success === false && syncResult.error) {
        console.error(
          `Error syncing store ${store.store_name}:`,
          syncResult.error
        );

        // Check if it's a token error
        if (
          syncResult.error?.includes("invalid_token") ||
          syncResult.error?.includes("Invalid OAuth") ||
          syncResult.error?.includes("Error: invalid_token")
        ) {
          hasError = true;
          errorStores.push(`${store.store_name} (OAuth expired)`);
        } else {
          hasError = true;
          errorStores.push(`${store.store_name} (${syncResult.error})`);
        }
      }
    }

    // If there were any errors, include that in the response
    if (hasError) {
      return NextResponse.json({
        success: false,
        error: `Failed to sync: ${errorStores.join(
          ", "
        )}. Check Settings > Stores.`,
        results,
        total_imported: results.reduce((sum, r) => sum + (r.imported || 0), 0),
        total_skipped: results.reduce((sum, r) => sum + (r.skipped || 0), 0),
      });
    }

    return NextResponse.json({
      success: true,
      results,
      total_imported: results.reduce((sum, r) => sum + r.imported, 0),
      total_skipped: results.reduce((sum, r) => sum + r.skipped, 0),
    });
  } catch (error) {
    console.error("Sync error:", error);

    // Check if it's a token error
    if (
      error.message?.includes("invalid_token") ||
      error.message?.includes("Invalid OAuth")
    ) {
      return NextResponse.json(
        {
          error:
            "OAuth token expired. Please reconnect your store(s) in Settings > Stores.",
          details: error.message,
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Sync failed" },
      { status: 500 }
    );
  }
}

/**
 * Sync orders for a single store
 */
async function syncStoreOrders(store) {
  const syncStarted = new Date().toISOString();
  let imported = 0;
  let skipped = 0;
  let errors = [];

  try {
    // Create Etsy client
    const etsyClient = createEtsyClient(store.api_token_encrypted);

    // Calculate time range (last 30 days or since last sync)
    const now = Math.floor(Date.now() / 1000);
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60;

    let minCreated = thirtyDaysAgo;
    if (store.last_sync_timestamp) {
      const lastSync = Math.floor(
        new Date(store.last_sync_timestamp).getTime() / 1000
      );
      minCreated = lastSync;
    }

    // Fetch receipts from Etsy
    console.log(
      `[Sync] Fetching receipts for store ${store.store_name} (ID: ${store.store_id})`
    );
    console.log(
      `[Sync] Date range: ${new Date(
        minCreated * 1000
      ).toISOString()} to ${new Date(now * 1000).toISOString()}`
    );

    const receiptsData = await etsyClient.getShopReceipts(store.store_id, {
      min_created: minCreated,
      limit: 100,
    });

    const receipts = receiptsData.results || [];
    console.log(`[Sync] Found ${receipts.length} receipts to process`);

    // Process each receipt
    for (const receipt of receipts) {
      try {
        // Check if order already exists
        const { data: existingOrder } = await supabaseAdmin
          .from("orders")
          .select("id")
          .eq("platform", "etsy")
          .eq("external_order_id", receipt.receipt_id.toString())
          .single();

        if (existingOrder) {
          skipped++;
          continue;
        }

        // Get transactions for this receipt
        const transactionsData = await etsyClient.getReceiptTransactions(
          store.store_id,
          receipt.receipt_id
        );

        const transactions = transactionsData.results || [];

        // Try to get shipments (may contain shipping address)
        let shipments = [];
        try {
          const shipmentsData = await etsyClient.getReceiptShipments(
            store.store_id,
            receipt.receipt_id
          );
          shipments = shipmentsData.results || [];
        } catch (error) {
          // Shipments may not exist yet (order not shipped), that's OK - silently continue
          // Don't log this as it's expected for unshipped orders
        }

        // Parse and insert order (prefer shipment address if available)
        const orderData = parseEtsyReceipt(
          receipt,
          transactions,
          store.id,
          shipments[0]
        );

        // Check if we can auto-advance the order status based on product configuration
        const finalOrderData = await determineOrderStatus(orderData);

        const { error: insertError } = await supabaseAdmin
          .from("orders")
          .insert(finalOrderData);

        if (insertError) {
          console.error("Failed to insert order:", insertError);
          errors.push({
            receipt_id: receipt.receipt_id,
            error: insertError.message,
          });
          continue;
        }

        imported++;
      } catch (error) {
        console.error(`Error processing receipt ${receipt.receipt_id}:`, error);
        errors.push({
          receipt_id: receipt.receipt_id,
          error: error.message,
        });
      }
    }

    // Update store's last_sync_timestamp
    await supabaseAdmin
      .from("stores")
      .update({ last_sync_timestamp: syncStarted })
      .eq("id", store.id);

    // Log sync result
    await supabaseAdmin.from("sync_logs").insert({
      store_id: store.id,
      sync_started_at: syncStarted,
      sync_completed_at: new Date().toISOString(),
      orders_fetched: receipts.length,
      orders_imported: imported,
      orders_skipped: skipped,
      status: errors.length === 0 ? "success" : "partial",
      error_message: errors.length > 0 ? JSON.stringify(errors) : null,
    });

    return {
      success: true,
      imported,
      skipped,
      errors,
    };
  } catch (error) {
    console.error(`Error syncing store ${store.store_name}:`, error);

    // Log failed sync
    await supabaseAdmin.from("sync_logs").insert({
      store_id: store.id,
      sync_started_at: syncStarted,
      sync_completed_at: new Date().toISOString(),
      orders_fetched: 0,
      orders_imported: 0,
      orders_skipped: 0,
      status: "failed",
      error_message: error.message,
    });

    return {
      success: false,
      imported: 0,
      skipped: 0,
      error: error.message,
    };
  }
}

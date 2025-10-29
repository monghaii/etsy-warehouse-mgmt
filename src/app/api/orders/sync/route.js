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
    return { status: "pending_enrichment" };
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
    return { status: "pending_enrichment" };
  }

  const personalizationType = product.personalization_type;

  // If product requires no personalization, skip to ready_for_design
  if (personalizationType === "none") {
    return { status: "ready_for_design" };
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
    return { status: "ready_for_design" };
  }

  // If product requires image or both, or if no personalization data exists, need enrichment
  return { status: "pending_enrichment" };
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
      console.log(
        `[Sync] Processing ${store.platform} store: ${store.store_name}`
      );
      const syncResult = await syncStoreOrders(store);

      results.push({
        store_id: store.id,
        store_name: store.store_name,
        platform: store.platform,
        ...syncResult,
      });

      // Check if this store had an error
      if (syncResult.success === false && syncResult.error) {
        console.error(
          `Error syncing store ${store.store_name}:`,
          syncResult.error
        );

        const platformLabel = store.platform === "shopify" ? "Shopify" : "Etsy";

        // Check if it's a token error
        if (
          syncResult.error?.includes("invalid_token") ||
          syncResult.error?.includes("Invalid OAuth") ||
          syncResult.error?.includes("Error: invalid_token")
        ) {
          hasError = true;
          errorStores.push(
            `${store.store_name} [${platformLabel}] (OAuth expired)`
          );
        } else if (
          syncResult.error?.includes("credentials incomplete") ||
          syncResult.error?.includes("Shopify API error")
        ) {
          hasError = true;
          errorStores.push(
            `${store.store_name} [${platformLabel}] (${syncResult.error})`
          );
        } else {
          hasError = true;
          errorStores.push(
            `${store.store_name} [${platformLabel}] (${syncResult.error})`
          );
        }
      } else {
        console.log(
          `[Sync] ✓ ${store.store_name} (${store.platform}): ${syncResult.imported} imported, ${syncResult.skipped} skipped`
        );
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
 * Sync orders for a single store (handles both Etsy and Shopify)
 */
async function syncStoreOrders(store) {
  if (store.platform === "shopify") {
    return syncShopifyStore(store);
  } else {
    return syncEtsyStore(store);
  }
}

/**
 * Sync orders for a Shopify store
 */
async function syncShopifyStore(store) {
  const syncStarted = new Date().toISOString();
  let imported = 0;
  let skipped = 0;
  let errors = [];

  try {
    if (!store.access_token || !store.shop_domain) {
      throw new Error("Store credentials incomplete");
    }

    // Fetch orders from Shopify
    // NOTE: Shopify API may return incomplete PII for archived/disabled customers.
    // Use the CSV import feature (Orders page > Upload Shopify CSVs) to fill in
    // missing customer names, emails, and addresses. See documentation/SHOPIFY_CSV_IMPORT.md
    const ordersUrl = `https://${store.shop_domain}/admin/api/2024-01/orders.json?status=any&limit=50`;
    const response = await fetch(ordersUrl, {
      headers: {
        "X-Shopify-Access-Token": store.access_token,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Shopify API error: ${response.statusText}`);
    }

    const { orders } = await response.json();

    // Process each order
    for (const shopifyOrder of orders) {
      try {
        // Check if order already exists
        const { data: existingOrder } = await supabaseAdmin
          .from("orders")
          .select("id, product_sku, status")
          .eq("platform", "shopify")
          .eq("external_order_id", shopifyOrder.id.toString())
          .single();

        // Extract product info from line items (use first item for single-SKU orders)
        const lineItems = shopifyOrder.line_items || [];
        const firstItem = lineItems[0] || {};

        // Extract shipping address
        const shippingAddr = shopifyOrder.shipping_address || {};

        // Get recipient name from shipping address (this is who receives the package)
        const recipientName =
          shippingAddr.name ||
          `${shippingAddr.first_name || ""} ${
            shippingAddr.last_name || ""
          }`.trim() ||
          null;

        // Get buyer name from customer object (this is who placed the order)
        const buyerName = shopifyOrder.customer
          ? `${shopifyOrder.customer.first_name || ""} ${
              shopifyOrder.customer.last_name || ""
            }`.trim()
          : null;

        const orderData = {
          platform: "shopify",
          store_id: store.id,
          external_order_id: shopifyOrder.id.toString(),
          external_receipt_id: shopifyOrder.order_number.toString(),
          order_number: shopifyOrder.order_number.toString(),

          // Use recipient name as customer_name (for display in "Ship To" section)
          // Fall back to buyer name if recipient name not available
          customer_name: recipientName || buyerName || "Unknown",
          customer_email:
            shopifyOrder.customer?.email || shopifyOrder.email || "",

          // Product information from line items
          product_sku: firstItem.sku || null,
          product_name: firstItem.name || null,
          quantity: firstItem.quantity || 1,

          // Shipping address (use all available fields from Shopify)
          shipping_address_line1: shippingAddr.address1 || null,
          shipping_address_line2: shippingAddr.address2 || null,
          shipping_city: shippingAddr.city || null,
          shipping_state:
            shippingAddr.province || shippingAddr.province_code || null,
          shipping_zip: shippingAddr.zip || null,
          shipping_country:
            shippingAddr.country || shippingAddr.country_code || null,
          shipping_phone: shippingAddr.phone || shopifyOrder.phone || null,

          status: "pending_enrichment",
          raw_order_data: shopifyOrder,
          order_date: shopifyOrder.created_at,
        };

        if (existingOrder) {
          let shouldUpdate = false;
          let updateData = {};

          // Only update customer info and shipping address if we actually have new data
          // NEVER overwrite existing data with empty/null values
          if (
            orderData.customer_name &&
            orderData.customer_name !== "Unknown"
          ) {
            updateData.customer_name = orderData.customer_name;
            shouldUpdate = true;
          }
          if (orderData.customer_email) {
            updateData.customer_email = orderData.customer_email;
            shouldUpdate = true;
          }
          if (orderData.shipping_address_line1) {
            updateData.shipping_address_line1 =
              orderData.shipping_address_line1;
            shouldUpdate = true;
          }
          if (orderData.shipping_address_line2) {
            updateData.shipping_address_line2 =
              orderData.shipping_address_line2;
            shouldUpdate = true;
          }
          if (orderData.shipping_city) {
            updateData.shipping_city = orderData.shipping_city;
            shouldUpdate = true;
          }
          if (orderData.shipping_state) {
            updateData.shipping_state = orderData.shipping_state;
            shouldUpdate = true;
          }
          if (orderData.shipping_zip) {
            updateData.shipping_zip = orderData.shipping_zip;
            shouldUpdate = true;
          }
          if (orderData.shipping_country) {
            updateData.shipping_country = orderData.shipping_country;
            shouldUpdate = true;
          }
          if (orderData.shipping_phone) {
            updateData.shipping_phone = orderData.shipping_phone;
            shouldUpdate = true;
          }

          // Check if order is missing SKU data and needs updating
          if (!existingOrder.product_sku && firstItem.product_id) {
            try {
              // Fetch current product data from Shopify to get latest SKU
              const productUrl = `https://${store.shop_domain}/admin/api/2024-01/products/${firstItem.product_id}.json`;
              const productResponse = await fetch(productUrl, {
                headers: {
                  "X-Shopify-Access-Token": store.access_token,
                  "Content-Type": "application/json",
                },
              });

              if (productResponse.ok) {
                const { product } = await productResponse.json();

                // Find the matching variant by ID
                const currentVariant = product.variants?.find(
                  (v) => v.id === firstItem.variant_id
                );

                if (currentVariant?.sku) {
                  // Update order data with current SKU
                  orderData.product_sku = currentVariant.sku;
                  orderData.product_name = firstItem.name;

                  // Check if we can auto-advance the order status based on new SKU
                  // Merge with existing updateData instead of replacing
                  const statusData = await determineOrderStatus(orderData);
                  updateData = { ...updateData, ...statusData };
                  shouldUpdate = true;
                }
              }
            } catch (productError) {
              // Silently handle product fetch errors
            }
          }

          // Check fulfillment status and extract tracking information
          // Try to fetch fulfillments if order is fulfilled OR missing tracking
          const shouldCheckFulfillments =
            shopifyOrder.fulfillment_status === "fulfilled" ||
            !existingOrder.tracking_number;

          if (shouldCheckFulfillments) {
            // Only advance status if actually fulfilled
            if (shopifyOrder.fulfillment_status === "fulfilled") {
              const currentStatus = existingOrder.status || orderData.status;
              const statusesBefore = [
                "pending_enrichment",
                "needs_review",
                "ready_for_design",
                "design_complete",
                "in_production",
              ];

              if (statusesBefore.includes(currentStatus)) {
                // Just set the status, don't replace updateData
                updateData.status = "labels_generated";
                shouldUpdate = true;
              }
            }

            // Extract tracking information from fulfillments
            try {
              const fulfillmentUrl = `https://${store.shop_domain}/admin/api/2024-01/orders/${shopifyOrder.id}/fulfillments.json`;
              const fulfillmentResponse = await fetch(fulfillmentUrl, {
                headers: {
                  "X-Shopify-Access-Token": store.access_token,
                  "Content-Type": "application/json",
                },
              });

              if (fulfillmentResponse.ok) {
                const { fulfillments } = await fulfillmentResponse.json();

                if (fulfillments && fulfillments.length > 0) {
                  // Find the first non-canceled fulfillment with a tracking number
                  let trackingNumber = null;
                  let labelUrl = null;

                  for (const fulfillment of fulfillments) {
                    // Skip canceled fulfillments
                    if (
                      fulfillment.status === "cancelled" ||
                      fulfillment.status === "canceled"
                    ) {
                      continue;
                    }

                    if (fulfillment.tracking_number) {
                      trackingNumber = fulfillment.tracking_number;
                      labelUrl = fulfillment.receipt?.label_url || null;
                      break; // Use the first non-canceled fulfillment with tracking
                    }
                  }

                  if (trackingNumber) {
                    // Merge with existing updateData instead of replacing it
                    updateData.tracking_number = trackingNumber;

                    if (labelUrl) {
                      updateData.label_url = labelUrl;
                    }

                    shouldUpdate = true;
                  }
                }
              }
            } catch (fulfillmentError) {
              // Silently handle fulfillment fetch errors
            }
          }

          // Apply updates if needed
          if (shouldUpdate) {
            const { error: updateError } = await supabaseAdmin
              .from("orders")
              .update(updateData)
              .eq("id", existingOrder.id);

            if (updateError) {
              errors.push({
                order_id: shopifyOrder.id,
                error: updateError.message,
              });
            } else {
              imported++; // Count as imported since we updated it
            }
          } else {
            skipped++;
          }
          continue;
        }

        // Check if we can auto-advance the order status
        const statusData = await determineOrderStatus(orderData);
        let finalOrderData = { ...orderData, ...statusData };

        // If order is fulfilled in Shopify, set to labels_generated and extract tracking
        if (shopifyOrder.fulfillment_status === "fulfilled") {
          finalOrderData.status = "labels_generated";

          // Extract tracking information from fulfillments
          try {
            const fulfillmentUrl = `https://${store.shop_domain}/admin/api/2024-01/orders/${shopifyOrder.id}/fulfillments.json`;
            const fulfillmentResponse = await fetch(fulfillmentUrl, {
              headers: {
                "X-Shopify-Access-Token": store.access_token,
                "Content-Type": "application/json",
              },
            });

            if (fulfillmentResponse.ok) {
              const { fulfillments } = await fulfillmentResponse.json();

              if (fulfillments && fulfillments.length > 0) {
                // Find the first non-canceled fulfillment with tracking
                let trackingNumber = null;
                let labelUrl = null;

                for (const fulfillment of fulfillments) {
                  // Skip canceled fulfillments
                  if (
                    fulfillment.status === "cancelled" ||
                    fulfillment.status === "canceled"
                  ) {
                    continue;
                  }

                  if (fulfillment.tracking_number) {
                    trackingNumber = fulfillment.tracking_number;
                    labelUrl = fulfillment.receipt?.label_url || null;
                    break;
                  }
                }

                if (trackingNumber) {
                  finalOrderData.tracking_number = trackingNumber;

                  if (labelUrl) {
                    finalOrderData.label_url = labelUrl;
                  }
                }
              }
            }
          } catch (fulfillmentError) {
            // Silently handle fulfillment fetch errors
          }
        }

        const { error: insertError } = await supabaseAdmin
          .from("orders")
          .insert(finalOrderData);

        if (insertError) {
          console.error("Failed to insert Shopify order:", insertError);
          errors.push({
            order_id: shopifyOrder.id,
            error: insertError.message,
          });
          continue;
        }

        imported++;
      } catch (error) {
        console.error(
          `Error processing Shopify order ${shopifyOrder.id}:`,
          error
        );
        errors.push({
          order_id: shopifyOrder.id,
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
      orders_fetched: orders.length,
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
    console.error(`Error syncing Shopify store ${store.store_name}:`, error);

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

/**
 * Sync orders for an Etsy store
 */
async function syncEtsyStore(store) {
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
        const statusData = await determineOrderStatus(orderData);
        const finalOrderData = { ...orderData, ...statusData };

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

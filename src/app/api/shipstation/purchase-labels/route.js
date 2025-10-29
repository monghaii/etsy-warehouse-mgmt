import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

/**
 * POST /api/shipstation/purchase-labels
 * Purchase shipping labels for multiple orders
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { orders, rates } = body; // orders: array of order objects, rates: { orderId: rateData }

    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      return NextResponse.json(
        { error: "Orders array is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.SHIPSTATION_API_KEY;
    console.log("[Label Purchase] API Key present:", !!apiKey);
    console.log("[Label Purchase] API Key length:", apiKey?.length || 0);
    if (!apiKey) {
      return NextResponse.json(
        { error: "ShipEngine API key not configured" },
        { status: 500 }
      );
    }

    // Get authenticated user
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: () => {},
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch shipping settings from database
    const { data: shippingSettings } = await supabaseAdmin
      .from("shipping_settings")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!shippingSettings) {
      console.error("[Label Purchase] No shipping settings found for user");
      return NextResponse.json(
        {
          error:
            "Ship-from address not configured. Please set up your shipping address in Settings → Shipping.",
        },
        { status: 400 }
      );
    }

    // Validate required shipping settings
    if (
      !shippingSettings.ship_from_address_line1 ||
      !shippingSettings.ship_from_city ||
      !shippingSettings.ship_from_state ||
      !shippingSettings.ship_from_zip ||
      !shippingSettings.ship_from_phone
    ) {
      console.error("[Label Purchase] Incomplete shipping settings:", {
        hasAddress: !!shippingSettings.ship_from_address_line1,
        hasCity: !!shippingSettings.ship_from_city,
        hasState: !!shippingSettings.ship_from_state,
        hasZip: !!shippingSettings.ship_from_zip,
        hasPhone: !!shippingSettings.ship_from_phone,
      });
      return NextResponse.json(
        {
          error:
            "Incomplete ship-from address. Please complete all required fields in Settings → Shipping (Address, City, State, ZIP, Phone).",
        },
        { status: 400 }
      );
    }

    console.log("[Label Purchase] Shipping settings validated successfully");

    const results = [];
    const errors = [];

    // Purchase label for each order
    for (const order of orders) {
      try {
        const rate = rates[order.id];
        if (!rate) {
          errors.push({
            orderId: order.id,
            orderNumber: order.order_number,
            error: "No rate data provided",
          });
          continue;
        }

        // Get store name for company field
        const storeName =
          order.stores?.store_name || order.store_name || "Store";
        console.log(
          `[Label Purchase] Order ${order.order_number} - Store: ${storeName}`
        );

        // Get package details
        const transactions = order.raw_order_data?.transactions || [];

        // Calculate total weight (sum of all items)
        let totalWeight = 0;
        for (const txn of transactions) {
          const weight = txn.product_weight || 0;
          const quantity = txn.quantity || 1;
          totalWeight += weight * quantity;
        }

        // Get max dimensions
        let maxLength = 0,
          maxWidth = 0,
          maxHeight = 0;
        for (const txn of transactions) {
          if (txn.product_dimensions) {
            maxLength = Math.max(maxLength, txn.product_dimensions.length || 0);
            maxWidth = Math.max(maxWidth, txn.product_dimensions.width || 0);
            maxHeight = Math.max(maxHeight, txn.product_dimensions.height || 0);
          }
        }

        // Use provided dimensions/weight or defaults
        const packageWeight = rate.weight || totalWeight || 16;
        const packageDims = rate.dimensions || {
          length: maxLength || 12,
          width: maxWidth || 9,
          height: maxHeight || 3,
        };

        // Build the shipment request
        const shipmentRequest = {
          label_format: "pdf",
          label_download_type: "url",
          shipment: {
            service_code: rate.serviceCode,
            ship_to: {
              name: order.customer_name || "Customer",
              address_line1: order.shipping_address_line1,
              address_line2: order.shipping_address_line2 || "",
              city_locality: order.shipping_city,
              state_province: order.shipping_state,
              postal_code: order.shipping_zip,
              country_code: order.shipping_country || "US",
            },
            ship_from: {
              name: shippingSettings.ship_from_name || storeName,
              company_name: storeName,
              phone: shippingSettings.ship_from_phone,
              address_line1: shippingSettings.ship_from_address_line1,
              address_line2:
                shippingSettings.ship_from_address_line2 || undefined,
              city_locality: shippingSettings.ship_from_city,
              state_province: shippingSettings.ship_from_state,
              postal_code: shippingSettings.ship_from_zip,
              country_code: shippingSettings.ship_from_country,
            },
            packages: [
              {
                weight: {
                  value: packageWeight,
                  unit: "ounce",
                },
                dimensions: {
                  unit: "inch",
                  length: packageDims.length,
                  width: packageDims.width,
                  height: packageDims.height,
                },
              },
            ],
          },
        };

        console.log(
          `[Label Purchase] Sending request to ShipEngine for order ${order.order_number}:`,
          JSON.stringify(shipmentRequest, null, 2)
        );

        // Purchase label via ShipEngine
        const purchaseResponse = await fetch(
          "https://api.shipengine.com/v1/labels",
          {
            method: "POST",
            headers: {
              "API-Key": apiKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(shipmentRequest),
          }
        );

        if (!purchaseResponse.ok) {
          const errorData = await purchaseResponse.json();
          console.error(
            `[Label Purchase] ShipEngine error for order ${order.order_number}:`,
            JSON.stringify(errorData, null, 2)
          );
          errors.push({
            orderId: order.id,
            orderNumber: order.order_number,
            error:
              errorData.message ||
              errorData.errors?.[0]?.message ||
              "Label purchase failed",
          });
          continue;
        }

        const labelData = await purchaseResponse.json();

        // Update order in database with tracking number, label URL, and status
        const { error: updateError } = await supabaseAdmin
          .from("orders")
          .update({
            status: "labels_generated",
            tracking_number: labelData.tracking_number,
            label_url: labelData.label_download.href,
          })
          .eq("id", order.id);

        if (updateError) {
          console.error(
            `Failed to update order ${order.id} with tracking:`,
            updateError
          );
          errors.push({
            orderId: order.id,
            orderNumber: order.order_number,
            error: "Failed to save tracking number",
          });
          continue;
        }

        // Send tracking number back to Etsy
        try {
          console.log(
            `[Label Purchase] Sending tracking to Etsy for order ${order.order_number}`
          );

          // Get store info with Etsy credentials
          const { data: store } = await supabaseAdmin
            .from("stores")
            .select("*")
            .eq("id", order.store_id)
            .single();

          if (store && store.access_token && order.external_order_id) {
            // Etsy API: Submit shipment tracking
            // https://developers.etsy.com/documentation/reference/#operation/createShopReceipt_shipment
            const etsyResponse = await fetch(
              `https://openapi.etsy.com/v3/application/shops/${store.shop_id}/receipts/${order.external_order_id}/tracking`,
              {
                method: "POST",
                headers: {
                  "x-api-key": process.env.ETSY_API_KEY,
                  Authorization: `Bearer ${store.access_token}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  tracking_code: labelData.tracking_number,
                  carrier_name: rate.carrierNickname || "USPS",
                  send_bcc: false, // Don't send blind copy to seller
                }),
              }
            );

            if (etsyResponse.ok) {
              console.log(
                `[Label Purchase] ✓ Tracking sent to Etsy for order ${order.order_number}`
              );
            } else {
              const etsyError = await etsyResponse.json();
              console.error(
                `[Label Purchase] Failed to send tracking to Etsy for order ${order.order_number}:`,
                etsyError
              );
              // Don't fail the whole operation if Etsy callback fails
            }
          } else {
            console.warn(
              `[Label Purchase] Skipping Etsy callback for order ${order.order_number} - missing store credentials or external order ID`
            );
          }
        } catch (etsyError) {
          console.error(
            `[Label Purchase] Etsy callback error for order ${order.order_number}:`,
            etsyError
          );
          // Don't fail the whole operation if Etsy callback fails
        }

        results.push({
          orderId: order.id,
          orderNumber: order.order_number,
          trackingNumber: labelData.tracking_number,
          labelUrl: labelData.label_download.href,
          cost: labelData.shipment_cost?.amount || rate.shipmentCost,
        });
      } catch (err) {
        console.error(`Error purchasing label for order ${order.id}:`, err);
        errors.push({
          orderId: order.id,
          orderNumber: order.order_number,
          error: err.message,
        });
      }
    }

    return NextResponse.json({
      success: results.length > 0,
      results,
      errors,
      totalPurchased: results.length,
      totalFailed: errors.length,
    });
  } catch (error) {
    console.error("Purchase labels error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

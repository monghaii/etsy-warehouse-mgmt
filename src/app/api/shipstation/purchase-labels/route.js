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

    const apiKey = process.env.SHIPENGINE_API_KEY;
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
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch shipping settings from database
    const { data: shippingSettings } = await supabaseAdmin
      .from("shipping_settings")
      .select("*")
      .eq("user_id", session.user.id)
      .single();

    if (!shippingSettings) {
      return NextResponse.json(
        {
          error:
            "Shipping settings not configured. Please set up your ship-from address in Settings > Shipping.",
        },
        { status: 400 }
      );
    }

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

        // Purchase label via ShipEngine
        const purchaseResponse = await fetch(
          "https://api.shipengine.com/v1/labels",
          {
            method: "POST",
            headers: {
              "API-Key": apiKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
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
                  name: shippingSettings.ship_from_name,
                  company_name: shippingSettings.ship_from_company || undefined,
                  phone: shippingSettings.ship_from_phone || undefined,
                  address_line1: shippingSettings.ship_from_address_line1,
                  address_line2: shippingSettings.ship_from_address_line2 || undefined,
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
            }),
          }
        );

        if (!purchaseResponse.ok) {
          const errorData = await purchaseResponse.json();
          errors.push({
            orderId: order.id,
            orderNumber: order.order_number,
            error: errorData.message || "Label purchase failed",
          });
          continue;
        }

        const labelData = await purchaseResponse.json();

        // Update order in database with tracking number and label URL
        const { error: updateError } = await supabaseAdmin
          .from("orders")
          .update({
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

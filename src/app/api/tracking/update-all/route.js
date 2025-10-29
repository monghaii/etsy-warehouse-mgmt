import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * POST /api/tracking/update-all
 * Update tracking status for all orders with tracking numbers
 */
export async function POST() {
  try {
    // Fetch all orders that have tracking numbers and are at least labels_generated
    const { data: orders, error } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, tracking_number, status")
      .not("tracking_number", "is", null)
      .in("status", ["labels_generated", "loaded_for_shipment", "in_transit"])
      .order("created_at", { ascending: false });

    if (error) throw error;

    console.log(
      `[Tracking Update] Found ${orders.length} orders with tracking numbers`
    );

    let updated = 0;
    let alreadyInTransit = 0;
    let errors = 0;

    for (const order of orders) {
      try {
        // Skip if already in transit
        if (order.status === "in_transit") {
          alreadyInTransit++;
          continue;
        }

        // Check tracking status using USPS Tracking API
        const trackingStatus = await checkTrackingStatus(order.tracking_number);

        console.log(
          `[Tracking Update] Order ${order.order_number}: ${trackingStatus}`
        );

        // Add delay between requests to avoid rate limiting (1 second)
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // If tracking shows package is moving (received, in transit, out for delivery, etc)
        const inTransitStatuses = [
          "in_transit",
          "out_for_delivery",
          "delivered",
          "available_for_pickup",
          "accepted",
          "picked_up",
        ];

        if (inTransitStatuses.includes(trackingStatus)) {
          // Update order status to in_transit
          const { error: updateError } = await supabaseAdmin
            .from("orders")
            .update({ status: "in_transit" })
            .eq("id", order.id);

          if (updateError) {
            console.error(
              `[Tracking Update] Error updating order ${order.order_number}:`,
              updateError
            );
            errors++;
          } else {
            console.log(
              `[Tracking Update] ✓ Updated order ${order.order_number} to in_transit`
            );
            updated++;
          }
        }
      } catch (error) {
        console.error(
          `[Tracking Update] Error processing order ${order.order_number}:`,
          error
        );
        errors++;
      }
    }

    return NextResponse.json({
      success: true,
      total: orders.length,
      updated,
      alreadyInTransit,
      errors,
    });
  } catch (error) {
    console.error("[Tracking Update] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update tracking" },
      { status: 500 }
    );
  }
}

/**
 * Get OAuth access token for USPS API
 */
async function getUSPSAccessToken() {
  if (!process.env.USPS_CLIENT_ID || !process.env.USPS_CLIENT_SECRET) {
    console.warn("[Tracking Update] USPS API credentials not configured");
    return null;
  }

  try {
    // Try the authentication endpoint - USPS uses different URL structure
    const authString = Buffer.from(
      `${process.env.USPS_CLIENT_ID}:${process.env.USPS_CLIENT_SECRET}`
    ).toString("base64");

    const response = await fetch("https://api.usps.com/oauth2/v3/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${authString}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Tracking Update] Failed to get USPS token:", errorText);
      return null;
    }

    const data = await response.json();
    console.log("[Tracking Update] Successfully obtained USPS access token");
    return data.access_token;
  } catch (error) {
    console.error("[Tracking Update] Error getting USPS token:", error);
    return null;
  }
}

/**
 * Check tracking status using official USPS Developer API
 * API Docs: https://developers.usps.com/trackingv3r2
 * Returns: "unknown", "pre_transit", "in_transit", "out_for_delivery", "delivered", etc.
 */
async function checkTrackingStatus(trackingNumber) {
  try {
    console.log(`[Tracking Update] Checking tracking for ${trackingNumber}...`);

    // Get OAuth token
    const accessToken = await getUSPSAccessToken();
    if (!accessToken) {
      console.error("[Tracking Update] No USPS access token available");
      return "unknown";
    }

    // Use USPS Tracking API v3
    const response = await fetch(
      `https://api.usps.com/tracking/v3/tracking/${trackingNumber}?expand=DETAIL`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[Tracking Update] USPS API error for ${trackingNumber}:`,
        response.status,
        errorText
      );
      return "unknown";
    }

    const data = await response.json();
    console.log(`[Tracking Update] USPS response for ${trackingNumber}:`, {
      status: data.status,
      statusCategory: data.statusCategory,
      eventCount: data.trackingEvents?.length || 0,
    });

    // Map USPS status to our simplified statuses
    const status = data.status?.toLowerCase() || "";
    const statusCategory = data.statusCategory?.toLowerCase() || "";

    // Check for delivered
    if (status.includes("delivered") || statusCategory === "delivered") {
      console.log(`[Tracking Update] ${trackingNumber}: delivered`);
      return "delivered";
    }

    // Check for out for delivery
    if (status.includes("out for delivery")) {
      console.log(`[Tracking Update] ${trackingNumber}: out_for_delivery`);
      return "out_for_delivery";
    }

    // Check for in transit
    if (
      status.includes("in transit") ||
      status.includes("arriving") ||
      statusCategory === "in_transit"
    ) {
      console.log(`[Tracking Update] ${trackingNumber}: in_transit`);
      return "in_transit";
    }

    // Check for accepted/picked up
    if (
      status.includes("accepted") ||
      status.includes("picked up") ||
      status.includes("usps in possession") ||
      statusCategory === "accepted"
    ) {
      console.log(`[Tracking Update] ${trackingNumber}: accepted`);
      return "accepted";
    }

    // Check for pre-transit
    if (
      status.includes("pre-shipment") ||
      status.includes("shipping label created") ||
      statusCategory === "pre_shipment"
    ) {
      console.log(`[Tracking Update] ${trackingNumber}: pre_transit`);
      return "pre_transit";
    }

    console.log(
      `[Tracking Update] ${trackingNumber}: unknown (status: ${status})`
    );
    return "unknown";
  } catch (error) {
    console.error(
      `[Tracking Update] Error checking tracking for ${trackingNumber}:`,
      error
    );
    return "unknown";
  }
}

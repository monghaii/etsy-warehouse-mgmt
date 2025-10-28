import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/shipstation/get-rates
 * Get shipping rate quotes using ShipEngine API directly
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      weight, // in ounces
      dimensions, // { length, width, height } in inches
      toAddress,
      fromAddress,
    } = body;

    const apiKey = process.env.SHIPSTATION_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "ShipStation API Key not configured. Add SHIPSTATION_API_KEY to your .env.local file.",
        },
        { status: 500 }
      );
    }

    // First, get available carriers to find USPS
    const carriersResponse = await fetch(
      "https://api.shipengine.com/v1/carriers",
      {
        headers: {
          "API-Key": apiKey,
        },
      }
    );

    if (!carriersResponse.ok) {
      return NextResponse.json(
        { error: "Failed to fetch carriers" },
        { status: 500 }
      );
    }

    const carriersData = await carriersResponse.json();
    const carriers = carriersData.carriers || [];

    // Find USPS carrier (Stamps.com provides USPS)
    const uspsCarrier = carriers.find(
      (c) =>
        c.friendly_name?.toLowerCase().includes("usps") ||
        c.friendly_name?.toLowerCase().includes("stamps")
    );

    if (!uspsCarrier) {
      return NextResponse.json(
        {
          error:
            "USPS carrier not found. Please connect a USPS carrier in your ShipEngine account.",
        },
        { status: 400 }
      );
    }

    // Create the payload for rate estimation (simplified structure)
    const shipmentPayload = {
      carrier_ids: [uspsCarrier.carrier_id],
      from_country_code: "US",
      from_postal_code: fromAddress.postalCode || "90001",
      to_country_code: toAddress.country || "US",
      to_postal_code: toAddress.postalCode,
      to_city_locality: toAddress.city,
      to_state_province: toAddress.state,
      weight: {
        value: weight,
        unit: "ounce",
      },
      dimensions: {
        length: dimensions.length,
        width: dimensions.width,
        height: dimensions.height,
        unit: "inch",
      },
      confirmation: "none",
      address_residential_indicator: "yes",
    };

    // Call ShipEngine API directly
    const response = await fetch(
      "https://api.shipengine.com/v1/rates/estimate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "API-Key": apiKey,
        },
        body: JSON.stringify(shipmentPayload),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ShipEngine API error:", errorText);
      return NextResponse.json(
        { error: "Failed to get shipping rates", details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();

    console.log("Raw API response:", JSON.stringify(data, null, 2));

    // Format rates for the frontend
    const formattedRates = (data || []).map((rate) => {
      const formatted = {
        serviceName: rate.service_type || rate.service_code,
        serviceCode: rate.service_code,
        carrierFriendlyName: rate.carrier_friendly_name || rate.carrier_id,
        carrierCode: rate.carrier_code || rate.carrier_id,
        shipmentCost: rate.shipping_amount?.amount || 0,
        otherCost: rate.other_amount?.amount || 0,
        insuranceCost: rate.insurance_amount?.amount || 0,
        confirmationAmount: rate.confirmation_amount?.amount || 0,
        deliveryDays: rate.delivery_days,
        guaranteedService: rate.guaranteed_service,
        estimatedDeliveryDate: rate.estimated_delivery_date,
        carrierDeliveryDays: rate.carrier_delivery_days,
        shipDate: rate.ship_date,
        packageType: rate.package_type,
      };
      console.log("Formatted rate:", formatted);
      return formatted;
    });

    return NextResponse.json({ rates: formattedRates });
  } catch (error) {
    console.error("Get rates error:", error);
    return NextResponse.json(
      { error: "Failed to get shipping rates", details: error.message },
      { status: 500 }
    );
  }
}

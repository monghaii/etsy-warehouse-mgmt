import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/shipstation/validate-address
 * Validate and normalize an address using ShipEngine
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { address } = body;

    const apiKey = process.env.SHIPSTATION_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "ShipStation API Key not configured" },
        { status: 500 }
      );
    }

    // Call ShipEngine address validation
    const response = await fetch(
      "https://api.shipengine.com/v1/addresses/validate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "API-Key": apiKey,
        },
        body: JSON.stringify([
          {
            name: address.name,
            address_line1: address.addressLine1,
            address_line2: address.addressLine2 || "",
            city_locality: address.city,
            state_province: address.state,
            postal_code: address.postalCode,
            country_code: address.country || "US",
          },
        ]),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Address validation error:", errorText);
      return NextResponse.json(
        { error: "Failed to validate address" },
        { status: response.status }
      );
    }

    const data = await response.json();
    const validationResult = data[0];

    // Return validation result
    return NextResponse.json({
      status: validationResult.status,
      originalAddress: validationResult.original_address,
      matchedAddress: validationResult.matched_address,
      messages: validationResult.messages || [],
    });
  } catch (error) {
    console.error("Address validation error:", error);
    return NextResponse.json(
      { error: "Failed to validate address", details: error.message },
      { status: 500 }
    );
  }
}

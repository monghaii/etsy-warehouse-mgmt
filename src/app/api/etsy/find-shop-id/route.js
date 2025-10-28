import { NextResponse } from "next/server";

/**
 * POST /api/etsy/find-shop-id
 * Find shop ID using API key
 */
export async function POST(request) {
  try {
    const { api_key } = await request.json();

    if (!api_key) {
      return NextResponse.json(
        { error: "API key is required" },
        { status: 400 }
      );
    }

    // First, try to get the user's shops
    const response = await fetch(
      "https://openapi.etsy.com/v3/application/users/me",
      {
        headers: {
          "x-api-key": api_key,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: `Etsy API error: ${error.error || response.statusText}` },
        { status: response.status }
      );
    }

    const userData = await response.json();
    const userId = userData.user_id;

    // Now get the user's shops
    const shopsResponse = await fetch(
      `https://openapi.etsy.com/v3/application/users/${userId}/shops`,
      {
        headers: {
          "x-api-key": api_key,
          "Content-Type": "application/json",
        },
      }
    );

    if (!shopsResponse.ok) {
      return NextResponse.json(
        { error: "Failed to fetch shops" },
        { status: shopsResponse.status }
      );
    }

    const shopsData = await shopsResponse.json();
    const shops = shopsData.results || [];

    return NextResponse.json({
      success: true,
      shops: shops.map((shop) => ({
        shop_id: shop.shop_id,
        shop_name: shop.shop_name,
        url: shop.url,
      })),
    });
  } catch (error) {
    console.error("Error finding shop ID:", error);
    return NextResponse.json(
      { error: error.message || "Failed to find shop ID" },
      { status: 500 }
    );
  }
}

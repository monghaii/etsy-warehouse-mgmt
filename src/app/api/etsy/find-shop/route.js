import { NextResponse } from "next/server";

/**
 * GET /api/etsy/find-shop?shop_name=YourShopName&api_key=xxx
 * Find shop ID from shop name using Etsy API
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const shopName = searchParams.get("shop_name");
  const apiKey = searchParams.get("api_key");

  if (!shopName || !apiKey) {
    return NextResponse.json(
      { error: "shop_name and api_key are required" },
      { status: 400 }
    );
  }

  try {
    // Use Etsy's findShops endpoint (public, no OAuth needed)
    const url = `https://openapi.etsy.com/v3/application/shops?shop_name=${encodeURIComponent(
      shopName
    )}`;

    const response = await fetch(url, {
      headers: {
        "x-api-key": apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Etsy API error: ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    if (data.results && data.results.length > 0) {
      const shop = data.results[0];
      return NextResponse.json({
        shop_id: shop.shop_id,
        shop_name: shop.shop_name,
        url: shop.url,
      });
    }

    return NextResponse.json(
      { error: "Shop not found with that name" },
      { status: 404 }
    );
  } catch (error) {
    console.error("Error finding shop:", error);
    return NextResponse.json(
      { error: error.message || "Failed to find shop" },
      { status: 500 }
    );
  }
}

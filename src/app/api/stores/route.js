import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { createEtsyClient } from "@/lib/etsy-client";

/**
 * GET /api/stores
 * List all configured stores
 */
export async function GET() {
  try {
    const { data: stores, error } = await supabaseAdmin
      .from("stores")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Don't send encrypted tokens to client
    const sanitizedStores = stores.map((store) => ({
      ...store,
      api_token_encrypted: undefined,
      access_token: undefined,
    }));

    return NextResponse.json({ stores: sanitizedStores });
  } catch (error) {
    console.error("Error fetching stores:", error);
    return NextResponse.json(
      { error: "Failed to fetch stores" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/stores
 * Add a new store (Etsy or Shopify)
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      store_name,
      store_id,
      api_key,
      platform = "etsy",
      shop_domain,
      access_token,
    } = body;

    // Validate required fields based on platform
    if (platform === "shopify") {
      if (!store_name || !shop_domain || !access_token) {
        return NextResponse.json(
          { error: "Missing required fields for Shopify store" },
          { status: 400 }
        );
      }

      // Test Shopify API connection
      try {
        const shopifyUrl = `https://${shop_domain}/admin/api/2024-01/shop.json`;
        const response = await fetch(shopifyUrl, {
          headers: {
            "X-Shopify-Access-Token": access_token,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          const error = await response.text();
          return NextResponse.json(
            { error: `Failed to connect to Shopify: ${response.statusText}` },
            { status: 400 }
          );
        }

        const shopData = await response.json();
        console.log(
          "[Shopify Store] Connection successful:",
          shopData.shop.name
        );

        // Store the Shopify credentials
        const { data: store, error: dbError } = await supabaseAdmin
          .from("stores")
          .insert({
            platform: "shopify",
            store_name: store_name || shopData.shop.name,
            store_id: null, // Shopify doesn't use store_id, it uses shop_domain
            shop_domain,
            access_token, // TODO: Encrypt in production
            api_token_encrypted: api_key || "", // Optional API key
            is_active: true,
          })
          .select()
          .single();

        if (dbError) throw dbError;

        return NextResponse.json({
          success: true,
          store: {
            ...store,
            api_token_encrypted: undefined,
            access_token: undefined,
          },
        });
      } catch (error) {
        console.error("[Shopify Store] Connection error:", error);
        return NextResponse.json(
          { error: `Failed to connect to Shopify: ${error.message}` },
          { status: 400 }
        );
      }
    } else {
      // Etsy store validation
      if (!store_name || !store_id || !api_key) {
        return NextResponse.json(
          { error: "Missing required fields for Etsy store" },
          { status: 400 }
        );
      }

      // Test the Etsy API connection
      const etsyClient = createEtsyClient(api_key);
      const testResult = await etsyClient.testConnection(store_id);

      if (!testResult.success) {
        return NextResponse.json(
          { error: `Failed to connect to Etsy: ${testResult.error}` },
          { status: 400 }
        );
      }

      // Store the Etsy API key
      const { data: store, error } = await supabaseAdmin
        .from("stores")
        .insert({
          platform: "etsy",
          store_name,
          store_id,
          shop_id: store_id,
          api_token_encrypted: api_key, // TODO: Encrypt in production
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({
        success: true,
        store: {
          ...store,
          api_token_encrypted: undefined,
        },
      });
    }
  } catch (error) {
    console.error("Error creating store:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create store" },
      { status: 500 }
    );
  }
}

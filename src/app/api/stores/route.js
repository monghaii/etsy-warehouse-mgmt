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
 * Add a new store
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { store_name, store_id, api_key, platform = "etsy" } = body;

    if (!store_name || !store_id || !api_key) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Test the API connection first
    const etsyClient = createEtsyClient(api_key);
    const testResult = await etsyClient.testConnection(store_id);

    if (!testResult.success) {
      return NextResponse.json(
        { error: `Failed to connect to Etsy: ${testResult.error}` },
        { status: 400 }
      );
    }

    // Store the API key (in production, you'd encrypt this)
    // For now, storing as-is since it's internal tool
    const { data: store, error } = await supabaseAdmin
      .from("stores")
      .insert({
        platform,
        store_name,
        store_id,
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
  } catch (error) {
    console.error("Error creating store:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create store" },
      { status: 500 }
    );
  }
}

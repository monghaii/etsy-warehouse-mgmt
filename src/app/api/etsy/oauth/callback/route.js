import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { cookies } from "next/headers";

/**
 * GET /api/etsy/oauth/callback
 * Handle OAuth callback from Etsy
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const cookieStore = await cookies();

    if (!code) {
      return NextResponse.redirect(
        `${
          process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
        }/settings/stores?error=no_code`
      );
    }

    // Get code_verifier and reconnect_store_id from cookies
    const codeVerifier = cookieStore.get("etsy_code_verifier")?.value;
    const reconnectStoreId = cookieStore.get("etsy_reconnect_store_id")?.value;

    if (!codeVerifier) {
      console.error("[OAuth] No code verifier found in cookies");
      return NextResponse.redirect(
        `${
          process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
        }/settings/stores?error=no_verifier`
      );
    }

    // Exchange code for access token with PKCE
    const apiKey = process.env.ETSY_API_KEY_PILLOWMOMMY;

    console.log("[OAuth] API Key exists:", !!apiKey);

    if (!apiKey) {
      console.error("[OAuth] Missing API key");
      return NextResponse.redirect(
        `${
          process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
        }/settings/stores?error=missing_credentials`
      );
    }

    console.log("[OAuth] Exchanging code for token with PKCE...");

    const tokenResponse = await fetch(
      "https://api.etsy.com/v3/public/oauth/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: apiKey,
          code: code,
          redirect_uri: `${
            process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
          }/api/etsy/oauth/callback`,
          code_verifier: codeVerifier,
        }).toString(),
      }
    );

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error("Token exchange failed:", error);
      return NextResponse.redirect(
        `${
          process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
        }/settings/stores?error=token_failed`
      );
    }

    const tokenData = await tokenResponse.json();
    console.log("[OAuth] Token received successfully");

    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;

    // Get user's shops with the access token
    console.log("[OAuth] Fetching user info...");
    const userResponse = await fetch(
      "https://openapi.etsy.com/v3/application/users/me",
      {
        headers: {
          "x-api-key": process.env.ETSY_API_KEY_PILLOWMOMMY,
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const userData = await userResponse.json();
    console.log("[OAuth] User data:", JSON.stringify(userData, null, 2));
    const userId = userData.user_id;

    console.log("[OAuth] Fetching shops for user ID:", userId);
    const shopsResponse = await fetch(
      `https://openapi.etsy.com/v3/application/users/${userId}/shops`,
      {
        headers: {
          "x-api-key": process.env.ETSY_API_KEY_PILLOWMOMMY,
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const shopsData = await shopsResponse.json();
    console.log("[OAuth] Shops data:", JSON.stringify(shopsData, null, 2));

    // Etsy returns shop data directly, not in a results array
    const shop = shopsData.shop_id ? shopsData : shopsData.results?.[0];

    if (!shop || !shop.shop_id) {
      return NextResponse.redirect(
        `${
          process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
        }/settings/stores?error=no_shop`
      );
    }

    console.log(`[OAuth] Shop found: ${shop.shop_name} (${shop.shop_id})`);

    // Either update existing store or insert new one
    if (reconnectStoreId) {
      console.log(`[OAuth] Reconnecting store ${reconnectStoreId}`);
      await supabaseAdmin
        .from("stores")
        .update({
          api_token_encrypted: accessToken, // Update with new access token
          store_name: shop.shop_name, // Update name in case it changed
          is_active: true, // Reactivate if it was deactivated
        })
        .eq("id", reconnectStoreId);

      console.log("[OAuth] Store reconnected successfully");
    } else {
      console.log("[OAuth] Creating new store");
      await supabaseAdmin.from("stores").insert({
        platform: "etsy",
        store_name: shop.shop_name,
        store_id: shop.shop_id.toString(),
        api_token_encrypted: accessToken, // Store access token
        is_active: true,
      });

      console.log("[OAuth] Store saved to database");
    }

    // Clear the cookies
    const response = NextResponse.redirect(
      `${
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
      }/settings/stores?success=true`
    );
    response.cookies.delete("etsy_code_verifier");
    response.cookies.delete("etsy_reconnect_store_id");

    return response;
  } catch (error) {
    console.error("OAuth callback error:", error);
    return NextResponse.redirect(
      `${
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
      }/settings/stores?error=unknown`
    );
  }
}

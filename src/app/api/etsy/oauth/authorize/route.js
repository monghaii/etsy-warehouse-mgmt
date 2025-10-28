import { NextResponse } from "next/server";
import crypto from "crypto";

/**
 * Generate PKCE code verifier and challenge
 */
function generatePKCE() {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto
    .createHash("sha256")
    .update(verifier)
    .digest("base64url");
  return { verifier, challenge };
}

/**
 * GET /api/etsy/oauth/authorize
 * Redirect user to Etsy OAuth authorization page with PKCE
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const shopId = searchParams.get("shop_id");
  const reconnectStoreId = searchParams.get("reconnect_store_id");

  // Generate PKCE values
  const { verifier, challenge } = generatePKCE();

  // Store verifier in a cookie (we'll need it in the callback)
  const response = NextResponse.redirect(
    `https://www.etsy.com/oauth/connect?${new URLSearchParams({
      response_type: "code",
      client_id: process.env.ETSY_API_KEY_PILLOWMOMMY,
      redirect_uri: `${
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
      }/api/etsy/oauth/callback`,
      scope: "shops_r transactions_r address_r", // Add more scopes as needed
      state: shopId || "no-shop",
      code_challenge: challenge,
      code_challenge_method: "S256",
    }).toString()}`
  );

  // Store verifier and reconnect_store_id in cookies for callback
  response.cookies.set("etsy_code_verifier", verifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
  });

  if (reconnectStoreId) {
    response.cookies.set("etsy_reconnect_store_id", reconnectStoreId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10 minutes
    });
  }

  return response;
}

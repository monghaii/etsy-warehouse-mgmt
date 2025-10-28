/**
 * Quick script to find your Etsy Shop ID
 * Usage: node scripts/find-shop-id.js
 */

const API_KEY = "5ssabvsoixrzv6q6ctxu12v5";

async function findShopId() {
  console.log("Finding your Etsy shop ID...\n");

  try {
    // Step 1: Get user ID
    console.log("Step 1: Getting user information...");
    const userResponse = await fetch(
      "https://openapi.etsy.com/v3/application/users/me",
      {
        headers: {
          "x-api-key": API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    if (!userResponse.ok) {
      const error = await userResponse.json();
      throw new Error(`API Error: ${JSON.stringify(error)}`);
    }

    const userData = await userResponse.json();
    console.log("✓ User ID:", userData.user_id);

    // Step 2: Get user's shops
    console.log("\nStep 2: Getting your shops...");
    const shopsResponse = await fetch(
      `https://openapi.etsy.com/v3/application/users/${userData.user_id}/shops`,
      {
        headers: {
          "x-api-key": API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    if (!shopsResponse.ok) {
      const error = await shopsResponse.json();
      throw new Error(`API Error: ${JSON.stringify(error)}`);
    }

    const shopsData = await shopsResponse.json();
    const shops = shopsData.results || [];

    console.log(`\n✓ Found ${shops.length} shop(s):\n`);

    shops.forEach((shop, index) => {
      console.log(`Shop ${index + 1}:`);
      console.log(`  Shop ID: ${shop.shop_id} ← USE THIS`);
      console.log(`  Shop Name: ${shop.shop_name}`);
      console.log(`  URL: ${shop.url}`);
      console.log();
    });

    if (shops.length === 0) {
      console.log("⚠️  No shops found for this API key");
    }
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  }
}

findShopId();

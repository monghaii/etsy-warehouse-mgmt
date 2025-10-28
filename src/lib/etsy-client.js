/**
 * Etsy API Client
 * Handles all interactions with the Etsy API
 * Documentation: https://developers.etsy.com/documentation/
 */

const ETSY_API_BASE = "https://openapi.etsy.com/v3";

/**
 * Create an Etsy API client for a specific store
 * @param {string} apiKey - Store's Etsy API key
 * @returns {Object} Etsy client with methods
 */
export function createEtsyClient(apiKeyOrToken) {
  if (!apiKeyOrToken) {
    throw new Error("Etsy API key or OAuth token is required");
  }

  // Determine if this is an OAuth token (longer length) or API key
  // OAuth tokens are typically 64+ chars, API keys are shorter
  const isOAuthToken = apiKeyOrToken.length > 40;

  const headers = {
    "x-api-key": isOAuthToken
      ? process.env.ETSY_API_KEY_PILLOWMOMMY
      : apiKeyOrToken, // Use provided key if not OAuth
    "Content-Type": "application/json",
  };

  // If OAuth token, add Authorization header
  if (isOAuthToken) {
    headers.Authorization = `Bearer ${apiKeyOrToken}`;
  }

  /**
   * Make a request to the Etsy API
   */
  async function request(endpoint, options = {}) {
    const url = `${ETSY_API_BASE}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...headers,
          ...options.headers,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
          error.error ||
            `Etsy API error: ${response.status} ${response.statusText}`
        );
      }

      return await response.json();
    } catch (error) {
      // Don't log errors here - let the caller decide if it's important
      // (e.g. missing shipments for unshipped orders are expected 404s)
      throw error;
    }
  }

  return {
    /**
     * Get shop information by shop ID
     */
    async getShop(shopId) {
      return request(`/application/shops/${shopId}`);
    },

    /**
     * Get shop receipts (orders)
     * @param {string} shopId - Shop ID
     * @param {Object} params - Query parameters
     * @param {number} params.limit - Number of results (max 100)
     * @param {number} params.offset - Pagination offset
     * @param {number} params.min_created - Unix timestamp for minimum creation date
     * @param {number} params.max_created - Unix timestamp for maximum creation date
     */
    async getShopReceipts(shopId, params = {}) {
      const queryParams = new URLSearchParams({
        limit: params.limit || 100,
        offset: params.offset || 0,
        was_paid: "true", // Only get paid orders
        // Don't filter by was_shipped - get all orders regardless of ship status
        ...params,
      });

      return request(`/application/shops/${shopId}/receipts?${queryParams}`);
    },

    /**
     * Get a single receipt by ID
     */
    async getReceipt(shopId, receiptId) {
      return request(`/application/shops/${shopId}/receipts/${receiptId}`);
    },

    /**
     * Get transactions for a receipt (line items)
     */
    async getReceiptTransactions(shopId, receiptId) {
      return request(
        `/application/shops/${shopId}/receipts/${receiptId}/transactions`
      );
    },

    /**
     * Get shipments for a receipt
     */
    async getReceiptShipments(shopId, receiptId) {
      return request(
        `/application/shops/${shopId}/receipts/${receiptId}/shipments`
      );
    },

    /**
     * Update receipt tracking info
     */
    async updateReceiptTracking(shopId, receiptId, trackingData) {
      return request(
        `/application/shops/${shopId}/receipts/${receiptId}/tracking`,
        {
          method: "POST",
          body: JSON.stringify(trackingData),
        }
      );
    },

    /**
     * Test the API connection and get shop info
     */
    async testConnection(shopId) {
      try {
        const shop = await this.getShop(shopId);
        return {
          success: true,
          shop_name: shop.shop_name,
          shop_id: shop.shop_id,
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  };
}

/**
 * Extract dimensions from variations and create enhanced SKU
 * @param {string} baseSku - Original SKU from Etsy
 * @param {Array} variations - Product variations containing size info
 * @returns {string} Enhanced SKU with dimensions (e.g., BLKT-KPOP-001-30-40)
 */
export function enhanceSKUWithDimensions(baseSku, variations = []) {
  if (!baseSku) {
    return "";
  }

  if (!variations || variations.length === 0) {
    return baseSku;
  }

  // Look for size-related variations
  const sizeVariation = variations.find((v) => {
    const name = v.formatted_name?.toLowerCase() || "";
    return name.includes("size") || name.includes("dimension");
  });

  if (!sizeVariation) {
    return baseSku;
  }

  const sizeValue = sizeVariation.formatted_value || "";

  // Extract all numerals from the size value
  // Handles formats like: "30x40", "30&quot;x40&quot;", "30 x 40", "30×40", etc.
  const numerals = sizeValue.match(/\d+/g);

  if (!numerals || numerals.length === 0) {
    return baseSku;
  }

  // Append dimensions to SKU with dashes
  // Example: BLKT-KPOP-001 + [30, 40] = BLKT-KPOP-001-30-40
  const enhancedSku = `${baseSku}-${numerals.join("-")}`;

  return enhancedSku;
}

/**
 * Parse Etsy receipt into our internal order format
 */
export function parseEtsyReceipt(
  receipt,
  transactions = [],
  shopId,
  shipment = null
) {
  // Get the first transaction for product details
  const firstTransaction = transactions[0] || {};

  // Enhance SKU with dimensions from variations
  const baseSku = firstTransaction.sku || "";
  const variations = firstTransaction.variations || [];
  const enhancedSku = enhanceSKUWithDimensions(baseSku, variations);

  // Prefer shipment address if available, otherwise use receipt address
  let shippingData = {
    name: receipt.name || "",
    address_line1: receipt.first_line || "",
    address_line2: receipt.second_line || "",
    city: receipt.city || "",
    state: receipt.state || "",
    zip: receipt.zip || "",
    country: receipt.country_iso || "",
  };

  // Override with shipment data if available
  if (shipment) {
    shippingData = {
      name: shipment.to_name || shippingData.name,
      address_line1: shipment.to_address_1 || shippingData.address_line1,
      address_line2: shipment.to_address_2 || shippingData.address_line2,
      city: shipment.to_city || shippingData.city,
      state: shipment.to_state || shippingData.state,
      zip: shipment.to_zip || shippingData.zip,
      country: shipment.to_country_iso || shippingData.country,
    };
  }

  return {
    // Source info
    platform: "etsy",
    store_id: shopId,
    external_order_id: receipt.receipt_id.toString(),
    external_receipt_id: receipt.receipt_id.toString(),

    // Order details
    order_number: receipt.receipt_id.toString(),
    order_date: new Date(receipt.created_timestamp * 1000).toISOString(),

    // Customer info
    customer_name: shippingData.name,
    customer_email: receipt.buyer_email || "",
    shipping_address_line1: shippingData.address_line1,
    shipping_address_line2: shippingData.address_line2,
    shipping_city: shippingData.city,
    shipping_state: shippingData.state,
    shipping_zip: shippingData.zip,
    shipping_country: shippingData.country,

    // Product info (from first transaction) - use enhanced SKU with dimensions
    product_sku: enhancedSku,
    product_name: firstTransaction.title || "",
    product_category: "",
    quantity: firstTransaction.quantity || 1,

    // Status
    status: "pending_enrichment",

    // Raw data for reference (include shipment data if available)
    // Enhance SKUs in transactions so they match our internal SKU format
    raw_order_data: {
      receipt,
      transactions: transactions.map((txn) => ({
        ...txn,
        sku: enhanceSKUWithDimensions(txn.sku || "", txn.variations || []),
      })),
      shipment,
    },
  };
}

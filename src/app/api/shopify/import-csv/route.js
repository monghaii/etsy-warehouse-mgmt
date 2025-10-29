import { supabaseAdmin } from "@/lib/supabase-server";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * Parse Shopify CSV export and extract order data
 */
function parseShopifyCSV(csvText) {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) {
    throw new Error("CSV file is empty or invalid");
  }

  // Parse header row
  const headers = parseCSVLine(lines[0]);

  // Parse data rows
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue; // Skip empty lines

    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || "";
    });
    rows.push(row);
  }

  // Group rows by order number (multi-item orders have multiple rows)
  const orderGroups = {};
  for (const row of rows) {
    // Extract order number from Name column (e.g., "#1038")
    const orderNumber = row.Name?.replace("#", "") || "";
    if (!orderNumber) continue;

    if (!orderGroups[orderNumber]) {
      orderGroups[orderNumber] = [];
    }
    orderGroups[orderNumber].push(row);
  }

  // Convert grouped rows into order objects
  const orders = [];
  for (const [orderNumber, orderRows] of Object.entries(orderGroups)) {
    const firstRow = orderRows[0];

    // Extract shipping address
    const shippingName = firstRow["Shipping Name"] || "";
    const shippingAddress1 = firstRow["Shipping Address1"] || "";
    const shippingAddress2 = firstRow["Shipping Address2"] || "";
    const shippingCity = firstRow["Shipping City"] || "";
    const shippingProvince = firstRow["Shipping Province"] || "";
    const shippingZip = firstRow["Shipping Zip"]?.replace("'", "") || ""; // Remove leading apostrophe
    const shippingCountry = firstRow["Shipping Country"] || "";
    const shippingPhone = firstRow["Shipping Phone"] || "";

    // Extract billing address
    const billingName = firstRow["Billing Name"] || "";
    const billingAddress1 = firstRow["Billing Address1"] || "";
    const billingCity = firstRow["Billing City"] || "";
    const billingProvince = firstRow["Billing Province"] || "";
    const billingZip = firstRow["Billing Zip"]?.replace("'", "") || "";
    const billingCountry = firstRow["Billing Country"] || "";
    const billingPhone = firstRow["Billing Phone"] || "";

    // Extract customer email
    const email = firstRow["Email"] || "";

    // Extract line items from all rows for this order
    const lineItems = orderRows
      .map((row) => {
        const name = row["Lineitem name"] || "";
        const sku = row["Lineitem sku"] || "";
        const quantity = parseInt(row["Lineitem quantity"]) || 1;

        if (!name) return null; // Skip empty line items

        return { name, sku, quantity };
      })
      .filter(Boolean);

    // For single-item orders, use the first line item
    const firstLineItem = lineItems[0] || {};

    // Determine recipient name (shipping name takes precedence)
    const recipientName = shippingName || billingName || "";

    // Extract other order details
    const fulfillmentStatus = firstRow["Fulfillment Status"] || "";
    const createdAt = firstRow["Created at"] || "";
    const notes = firstRow["Notes"] || "";

    orders.push({
      orderNumber,
      customerName: recipientName,
      customerEmail: email,
      shippingAddress: {
        line1: shippingAddress1,
        line2: shippingAddress2,
        city: shippingCity,
        state: shippingProvince,
        zip: shippingZip,
        country: shippingCountry,
        phone: shippingPhone,
      },
      billingAddress: {
        name: billingName,
        line1: billingAddress1,
        city: billingCity,
        state: billingProvince,
        zip: billingZip,
        country: billingCountry,
        phone: billingPhone,
      },
      lineItems,
      productName: firstLineItem.name || null,
      productSku: firstLineItem.sku || null,
      quantity: firstLineItem.quantity || 1,
      fulfillmentStatus,
      createdAt,
      notes,
    });
  }

  return orders;
}

/**
 * Parse a single CSV line, handling quoted values with commas
 */
function parseCSVLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      // End of field
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  // Add last field
  values.push(current);

  return values;
}

export async function POST(request) {
  try {
    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }

    // Read CSV content
    const csvText = await file.text();
    console.log("[Shopify CSV Import] Parsing CSV file...");

    // Parse CSV and extract orders
    const orders = parseShopifyCSV(csvText);
    console.log(`[Shopify CSV Import] Parsed ${orders.length} orders from CSV`);

    // Update orders in database
    let updatedCount = 0;
    let notFoundCount = 0;
    const errors = [];

    for (const orderData of orders) {
      try {
        // Find existing order by order number
        const { data: existingOrder, error: fetchError } = await supabaseAdmin
          .from("orders")
          .select("id, order_number, status")
          .eq("order_number", orderData.orderNumber)
          .single();

        if (fetchError || !existingOrder) {
          console.log(
            `[Shopify CSV Import] Order #${orderData.orderNumber} not found in database`
          );
          notFoundCount++;
          continue;
        }

        // Prepare update data
        const updateData = {
          customer_name: orderData.customerName || "Unknown",
          customer_email: orderData.customerEmail || "",
          shipping_address_line1: orderData.shippingAddress.line1 || null,
          shipping_address_line2: orderData.shippingAddress.line2 || null,
          shipping_city: orderData.shippingAddress.city || null,
          shipping_state: orderData.shippingAddress.state || null,
          shipping_zip: orderData.shippingAddress.zip || null,
          shipping_country: orderData.shippingAddress.country || null,
          shipping_phone: orderData.shippingAddress.phone || null,
        };

        // Only update product info if it's not already set
        if (!existingOrder.product_sku && orderData.productSku) {
          updateData.product_sku = orderData.productSku;
        }
        if (!existingOrder.product_name && orderData.productName) {
          updateData.product_name = orderData.productName;
        }
        if (!existingOrder.quantity && orderData.quantity) {
          updateData.quantity = orderData.quantity;
        }

        console.log(
          `[Shopify CSV Import] Updating order #${orderData.orderNumber}:`,
          {
            name: updateData.customer_name,
            email: updateData.customer_email,
            address: `${updateData.shipping_address_line1}, ${updateData.shipping_city}, ${updateData.shipping_state} ${updateData.shipping_zip}`,
            phone: updateData.shipping_phone,
          }
        );

        // Update order
        const { error: updateError } = await supabaseAdmin
          .from("orders")
          .update(updateData)
          .eq("id", existingOrder.id);

        if (updateError) {
          throw updateError;
        }

        updatedCount++;
      } catch (err) {
        console.error(
          `[Shopify CSV Import] Error updating order #${orderData.orderNumber}:`,
          err
        );
        errors.push({
          orderNumber: orderData.orderNumber,
          error: err.message,
        });
      }
    }

    console.log(
      `[Shopify CSV Import] Complete. Updated: ${updatedCount}, Not Found: ${notFoundCount}, Errors: ${errors.length}`
    );

    return Response.json({
      success: true,
      updated: updatedCount,
      notFound: notFoundCount,
      errors: errors.length > 0 ? errors : undefined,
      message: `Updated ${updatedCount} orders. ${notFoundCount} orders not found in database.`,
    });
  } catch (error) {
    console.error("[Shopify CSV Import] Error:", error);
    return Response.json(
      { error: error.message || "Failed to import CSV" },
      { status: 500 }
    );
  }
}

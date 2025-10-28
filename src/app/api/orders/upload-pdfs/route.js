import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import pdf from "pdf-parse/lib/pdf-parse.js";

/**
 * POST /api/orders/upload-pdfs
 * Upload Etsy order PDFs and extract missing information
 */
export async function POST(request) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("pdfs");

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: "No PDF files provided" },
        { status: 400 }
      );
    }

    console.log(`[PDF Parser] Processing ${files.length} PDF file(s)...`);

    let processed = 0;
    let updated = 0;
    let failed = 0;
    const errors = [];
    const results = [];

    for (const file of files) {
      try {
        processed++;
        console.log(`[PDF Parser] Processing file: ${file.name}`);

        // Convert file to buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Parse PDF
        const pdfData = await pdf(buffer);
        const text = pdfData.text;

        console.log(
          `[PDF Parser] Extracted ${text.length} characters from PDF`
        );

        // Parse multiple orders from PDF text (may contain multiple orders on different pages)
        const ordersData = parseMultipleEtsyOrders(text);

        if (!ordersData || ordersData.length === 0) {
          throw new Error("Could not find any orders in PDF");
        }

        console.log(
          `[PDF Parser] Found ${ordersData.length} order(s) in ${file.name}`
        );

        // Process each order found in the PDF
        for (const orderData of ordersData) {
          try {
            if (!orderData || !orderData.order_number) {
              console.log(`[PDF Parser] Skipping invalid order data`);
              continue;
            }

            console.log(
              `[PDF Parser] Processing order #${orderData.order_number}`
            );

            // Find the order in database
            const { data: existingOrder, error: findError } =
              await supabaseAdmin
                .from("orders")
                .select(
                  "id, order_number, customer_name, customer_email, shipping_address_line1"
                )
                .eq("order_number", orderData.order_number)
                .single();

            if (findError || !existingOrder) {
              console.log(
                `[PDF Parser] Order #${orderData.order_number} not found in database, skipping`
              );
              results.push({
                order_number: orderData.order_number,
                status: "skipped",
                reason: "Not found in database",
              });
              continue;
            }

            // Prepare updates (only update missing fields)
            const updates = {};

            if (!existingOrder.customer_name && orderData.shipping_name) {
              updates.customer_name = orderData.shipping_name;
            }

            if (!existingOrder.customer_email && orderData.buyer_email) {
              updates.customer_email = orderData.buyer_email;
            }

            if (
              !existingOrder.shipping_address_line1 &&
              orderData.shipping_address
            ) {
              updates.shipping_address_line1 = orderData.shipping_address.line1;
              updates.shipping_address_line2 = orderData.shipping_address.line2;
              updates.shipping_city = orderData.shipping_address.city;
              updates.shipping_state = orderData.shipping_address.state;
              updates.shipping_zip = orderData.shipping_address.zip;
              updates.shipping_country = orderData.shipping_address.country;
            }

            // Update if we have new data
            if (Object.keys(updates).length > 0) {
              const { error: updateError } = await supabaseAdmin
                .from("orders")
                .update(updates)
                .eq("id", existingOrder.id);

              if (updateError) {
                throw updateError;
              }

              updated++;
              results.push({
                order_number: orderData.order_number,
                status: "updated",
                fields_updated: Object.keys(updates),
              });

              console.log(
                `[PDF Parser] ✓ Updated order #${orderData.order_number} with ${
                  Object.keys(updates).length
                } fields`
              );
            } else {
              results.push({
                order_number: orderData.order_number,
                status: "skipped",
                reason: "No missing fields to update",
              });
            }
          } catch (orderError) {
            console.error(
              `[PDF Parser] Failed to process order #${orderData.order_number}:`,
              orderError
            );
            failed++;
            errors.push({
              order_number: orderData.order_number,
              error: orderError.message,
            });
          }
        }
      } catch (fileError) {
        console.error(
          `[PDF Parser] Failed to process ${file.name}:`,
          fileError
        );
        failed++;
        errors.push({
          file: file.name,
          error: fileError.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      processed,
      updated,
      failed,
      results,
      errors: errors.length > 0 ? errors : undefined,
      message: `Processed ${processed} PDF(s). Updated: ${updated}, Failed: ${failed}`,
    });
  } catch (error) {
    console.error("[PDF Parser] Fatal error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Parse multiple Etsy orders from a single PDF
 * Splits by "Order #" pattern to find all orders in the PDF
 */
function parseMultipleEtsyOrders(text) {
  // Split the text by "Order #" to find all order sections
  const orderSections = text.split(/(?=Order #\d+)/i);

  const orders = [];
  for (const section of orderSections) {
    if (section.trim().length < 50) continue; // Skip tiny sections

    const orderData = parseEtsyOrderPDF(section);
    if (orderData && orderData.order_number) {
      orders.push(orderData);
    }
  }

  return orders;
}

/**
 * Parse single Etsy order from PDF text
 * Format from the PDF:
 * Order #3833598326
 * Christopher mendoza (ninopower11@yahoo.com)
 * Ship to
 * Christopher mendoza
 * 17270 Manzanita Dr
 * FONTANA, CA 92335-5853
 * United States
 * Shop: PillowFortLA
 * Personalization: 7
 */
function parseEtsyOrderPDF(text) {
  try {
    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    // Extract order number
    const orderMatch = text.match(/Order #(\d+)/i);
    if (!orderMatch) {
      return null;
    }
    const orderNumber = orderMatch[1];

    // Extract buyer email
    const emailMatch = text.match(/\(([^@]+@[^)]+)\)/);
    const buyerEmail = emailMatch ? emailMatch[1] : null;

    // Extract shop name
    const shopMatch = text.match(/Shop\s+([^\n]+)/i);
    const shopName = shopMatch ? shopMatch[1].trim() : null;

    // Find "Ship to" section
    const shipToIndex = lines.findIndex((line) =>
      line.toLowerCase().includes("ship to")
    );

    let shippingName = null;
    let shippingAddress = null;

    if (shipToIndex !== -1) {
      // The next few lines after "Ship to" contain the address
      const addressLines = [];

      for (
        let i = shipToIndex + 1;
        i < Math.min(shipToIndex + 7, lines.length);
        i++
      ) {
        const line = lines[i];

        // Stop at certain keywords that indicate end of address section
        if (
          line.toLowerCase().includes("scheduled to ship") ||
          line.toLowerCase().includes("shop") ||
          line.toLowerCase().includes("order date") ||
          line.toLowerCase().includes("payment method") ||
          line.toLowerCase().includes("tracking") ||
          line.match(/^\d+\s+items?$/i)
        ) {
          break;
        }

        addressLines.push(line);
      }

      // Parse address lines
      if (addressLines.length >= 3) {
        shippingName = addressLines[0]; // First line is name

        // Find the city/state/zip line
        let cityStateZipIndex = -1;
        for (let i = 1; i < addressLines.length; i++) {
          if (/,\s*[A-Z]{2}\s+\d{5}/.test(addressLines[i])) {
            cityStateZipIndex = i;
            break;
          }
        }

        if (cityStateZipIndex !== -1) {
          const line1 = addressLines[1] || "";
          const line2 = cityStateZipIndex > 2 ? addressLines[2] : "";
          const cityStateZip = addressLines[cityStateZipIndex];
          const country =
            cityStateZipIndex + 1 < addressLines.length
              ? addressLines[cityStateZipIndex + 1]
              : "United States";

          // Parse city, state, zip
          const match = cityStateZip.match(
            /^(.+?),\s*([A-Z]{2})\s+(\d{5}(-\d{4})?)$/
          );
          if (match) {
            shippingAddress = {
              line1,
              line2: line2 || null,
              city: match[1].trim(),
              state: match[2],
              zip: match[3],
              country: country.toLowerCase().includes("united states")
                ? "US"
                : country,
            };
          }
        }
      }
    }

    // Extract personalization (multiple items may have different personalizations)
    const personalizations = [];
    const personalizationMatches = text.matchAll(/Personalization:\s*(.+)/gi);
    for (const match of personalizationMatches) {
      personalizations.push(match[1].trim());
    }

    return {
      order_number: orderNumber,
      buyer_email: buyerEmail,
      shop_name: shopName,
      shipping_name: shippingName,
      shipping_address: shippingAddress,
      personalizations: personalizations.length > 0 ? personalizations : null,
    };
  } catch (error) {
    console.error("[Parser] Error parsing PDF text:", error);
    return null;
  }
}

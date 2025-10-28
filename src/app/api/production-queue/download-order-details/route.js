import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import puppeteer from "puppeteer";
import bwipjs from "bwip-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // Increase timeout for PDF generation

/**
 * GET /api/production-queue/download-order-details?sku=SKU-CODE&orderIds=id1,id2
 * Generate a PDF with detailed order information for a specific SKU using HTML/CSS
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const sku = searchParams.get("sku");
    const orderIdsParam = searchParams.get("orderIds");
    const combined = searchParams.get("combined") === "true";
    const allSkus = searchParams.get("allSkus") === "true";

    if (!sku && !allSkus) {
      return NextResponse.json(
        { error: "SKU parameter is required" },
        { status: 400 }
      );
    }

    // Parse order IDs if provided (for filtering)
    const filterOrderIds = orderIdsParam
      ? orderIdsParam.split(",").filter(Boolean)
      : null;

    // Fetch orders in production queue
    let query = supabaseAdmin
      .from("orders")
      .select("*, stores(store_name)")
      .in("status", ["design_complete", "pending_fulfillment"])
      .order("order_date", { ascending: true });

    // Filter by specific order IDs if provided
    if (filterOrderIds && filterOrderIds.length > 0) {
      query = query.in("id", filterOrderIds);
    }

    const { data: orders, error } = await query;

    if (error) {
      console.error("Failed to fetch production queue:", error);
      return NextResponse.json(
        { error: "Failed to fetch orders" },
        { status: 500 }
      );
    }

    // Group orders and their matching transactions
    const ordersToProcess = [];

    for (const order of orders) {
      const transactions = order.raw_order_data?.transactions || [];
      const matchingTransactions = [];

      for (const transaction of transactions) {
        // Check if transaction SKU matches (exact match for enhanced SKUs)
        const transactionSku = transaction.sku;
        if (!transactionSku) continue;

        // If allSkus is true, include all transactions
        // Otherwise, exact match only (enhanced SKUs include size dimensions)
        if (allSkus || transactionSku === sku) {
          matchingTransactions.push(transaction);
        }
      }

      if (matchingTransactions.length > 0) {
        ordersToProcess.push({
          order,
          transactions: matchingTransactions,
        });
      }
    }

    if (ordersToProcess.length === 0) {
      return NextResponse.json(
        {
          error: allSkus
            ? `No orders found`
            : `No orders found for SKU: ${sku}`,
          message: "Make sure the SKU exists in the production queue",
        },
        { status: 404 }
      );
    }

    // Generate HTML for all orders
    let orderHtml = "";
    let orderNum = 1;

    for (const { order, transactions } of ordersToProcess) {
      // Generate barcode as base64
      let barcodeDataUrl = "";
      try {
        const barcodePng = await bwipjs.toBuffer({
          bcid: "code128",
          text: order.order_number.toString(),
          scale: 2,
          height: 10,
          includetext: true,
          textxalign: "center",
        });
        barcodeDataUrl = `data:image/png;base64,${barcodePng.toString(
          "base64"
        )}`;
      } catch (err) {
        console.error("Failed to generate barcode:", err);
      }

      // Generate product rows HTML
      let productRowsHtml = "";

      for (const transaction of transactions) {
        const transactionId = transaction.transaction_id?.toString();

        // Get personalization
        const personalization =
          transaction.variations?.find(
            (v) => v.formatted_name === "Personalization"
          )?.formatted_value || "";

        // Get enrichment
        const enrichment = order.raw_order_data?.customer_enrichment?.find(
          (e) => e.transaction_id === transactionId
        );

        // Get variations (excluding personalization)
        const variations =
          transaction.variations?.filter(
            (v) => v.formatted_name !== "Personalization"
          ) || [];
        const variationsText = variations
          .map((v) => `${v.formatted_name}: ${v.formatted_value}`)
          .join(", ");

        // Collect all notes
        let allNotes = [];
        if (
          personalization &&
          !personalization.toLowerCase().includes("not requested")
        ) {
          allNotes.push(`Etsy: ${personalization}`);
        }
        if (enrichment?.custom_text) {
          allNotes.push(`Customer: ${enrichment.custom_text}`);
        }
        if (order.notes) {
          allNotes.push(`Internal: ${order.notes}`);
        }

        const notesHtml = allNotes.length > 0 ? allNotes.join("<br>") : "-";

        // Get design file thumbnail
        const designFile = order.design_files?.find(
          (df) => df.transaction_id === transactionId
        );

        let designPreviewHtml = '<div class="no-design">No Design</div>';
        if (designFile?.file_path) {
          // Try to get the pre-generated thumbnail
          const thumbnailPath = designFile.file_path.replace(
            /\.pdf$/i,
            "_thumb.jpg"
          );

          try {
            const { data: thumbData } = await supabaseAdmin.storage
              .from("design-files")
              .download(thumbnailPath);

            if (thumbData) {
              const arrayBuffer = await thumbData.arrayBuffer();
              const thumbBuffer = Buffer.from(arrayBuffer);
              const thumbBase64 = thumbBuffer.toString("base64");
              designPreviewHtml = `<img src="data:image/jpeg;base64,${thumbBase64}" alt="Design" class="design-img" />`;
            }
          } catch (err) {
            // Thumbnail doesn't exist yet, show filename
            designPreviewHtml = `
              <div class="design-available">
                <div class="checkmark">✓</div>
                <div class="design-filename">${
                  designFile.file_name || "design.pdf"
                }</div>
              </div>
            `;
          }
        }

        productRowsHtml += `
          <tr>
            <td class="product-cell">
              <div class="product-title">${transaction.title || "Unknown"}</div>
              <div class="product-meta">SKU: ${transaction.sku || "-"}</div>
              <div class="product-meta">Qty: ${transaction.quantity || 1}</div>
            </td>
            <td class="variations-cell">${variationsText || "-"}</td>
            <td class="notes-cell">${notesHtml}</td>
            <td class="design-cell">${designPreviewHtml}</td>
          </tr>
        `;
      }

      orderHtml += `
        <div class="order-page">
          <div class="header">
            <div class="header-left">
              <div class="order-title">Order #${order.order_number}</div>
              <div class="order-date">Date: ${new Date(
                order.order_date
              ).toLocaleDateString()} | Store: ${
        order.stores?.store_name || "Unknown"
      }</div>
            </div>
            <div class="barcode">
              ${
                barcodeDataUrl
                  ? `<img src="${barcodeDataUrl}" alt="Barcode" />`
                  : ""
              }
            </div>
          </div>
          
          <div class="info-row">
            <div class="info-box">
              <div class="info-header">BUYER</div>
              <div class="info-content">
                <strong>${order.customer_name || "-"}</strong><br>
                ${order.customer_email || "-"}
              </div>
            </div>

            <div class="info-box">
              <div class="info-header">SHIP TO</div>
              <div class="info-content">
                ${
                  order.shipping_address_line1
                    ? `
                  <strong>${order.customer_name || "-"}</strong><br>
                  ${order.shipping_address_line1}<br>
                  ${
                    order.shipping_address_line2
                      ? `${order.shipping_address_line2}<br>`
                      : ""
                  }
                  ${order.shipping_city || ""}, ${order.shipping_state || ""} ${
                        order.shipping_zip || ""
                      }<br>
                  ${order.shipping_country || ""}
                `
                    : `<span class="no-address">! NO ADDRESS</span>`
                }
              </div>
            </div>
          </div>

          <table class="products-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Variations</th>
                <th>Notes & Personalization</th>
                <th>Design</th>
              </tr>
            </thead>
            <tbody>
              ${productRowsHtml}
            </tbody>
          </table>

          <div class="page-number">Order ${orderNum}</div>
        </div>
      `;

      orderNum++;
    }

    // Complete HTML document with CSS
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page {
      size: letter;
      margin: 1in;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 8pt;
      line-height: 1.2;
      color: #000;
    }
    
    .order-page {
      page-break-after: always;
      position: relative;
    }
    
    .order-page:last-child {
      page-break-after: auto;
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
      padding-bottom: 8px;
      border-bottom: 1pt solid #000;
    }
    
    .header-left {
      flex: 1;
    }
    
    .order-title {
      font-size: 14pt;
      font-weight: bold;
      margin-bottom: 3px;
    }
    
    .order-date {
      font-size: 8pt;
      color: #666;
    }
    
    .barcode img {
      height: 35px;
    }
    
    .info-row {
      display: flex;
      gap: 10px;
      margin-bottom: 12px;
    }
    
    .info-box {
      flex: 1;
      border: 0.5pt solid #999;
      padding: 6px;
    }
    
    .info-header {
      font-size: 7pt;
      font-weight: bold;
      margin-bottom: 4px;
      text-transform: uppercase;
    }
    
    .info-content {
      font-size: 8pt;
      line-height: 1.3;
    }
    
    .no-address {
      color: #cc0000;
      font-weight: bold;
    }
    
    .products-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8pt;
    }
    
    .products-table th {
      background: #f0f0f0;
      border: 0.5pt solid #999;
      padding: 4px;
      text-align: left;
      font-weight: bold;
      font-size: 7pt;
    }
    
    .products-table td {
      border: 0.5pt solid #999;
      padding: 4px;
      vertical-align: top;
      font-size: 7.5pt;
      line-height: 1.3;
    }
    
    .product-cell {
      width: 25%;
    }
    
    .variations-cell {
      width: 20%;
    }
    
    .notes-cell {
      width: 40%;
    }
    
    .design-cell {
      width: 15%;
      text-align: center;
    }
    
    .product-title {
      font-weight: bold;
      margin-bottom: 2px;
    }
    
    .product-meta {
      font-size: 7pt;
      color: #666;
    }
    
    .design-img {
      max-width: 140px;
      max-height: 170px;
      border: 0.5pt solid #ccc;
      display: block;
      margin: 0 auto;
    }
    
    .no-design {
      font-size: 7pt;
      color: #999;
      font-style: italic;
    }
    
    .design-available {
      text-align: center;
    }
    
    .checkmark {
      font-size: 16pt;
      color: #28a745;
      font-weight: bold;
      margin-bottom: 2px;
    }
    
    .design-filename {
      font-size: 6pt;
      color: #666;
      word-break: break-all;
    }
    
    .page-number {
      position: absolute;
      bottom: -30px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 8pt;
      font-style: italic;
      color: #999;
    }
  </style>
</head>
<body>
  ${orderHtml}
</body>
</html>
    `;

    // Launch Puppeteer and generate PDF
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "letter",
      printBackground: true,
      margin: {
        top: "1in",
        right: "1in",
        bottom: "1in",
        left: "1in",
      },
    });

    await browser.close();

    // Generate filename
    const filename = allSkus
      ? `all_orders_details_${Date.now()}.pdf`
      : `${sku}_order_details_${Date.now()}.pdf`;

    // Return the PDF as a downloadable file
    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Error generating order details PDF:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF", details: error.message },
      { status: 500 }
    );
  }
}

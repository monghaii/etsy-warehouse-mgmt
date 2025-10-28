import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { PDFDocument } from "pdf-lib";

/**
 * GET /api/production-queue/download-sku?sku=SKU-CODE
 * Download all design files for a specific SKU combined into one PDF
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const sku = searchParams.get("sku");
    const orderIdsParam = searchParams.get("orderIds");

    if (!sku) {
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
      .select("*")
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

    // Find all design files matching the SKU
    const designFilesToMerge = [];

    for (const order of orders) {
      const transactions = order.raw_order_data?.transactions || [];
      const designFiles = order.design_files || [];

      for (const transaction of transactions) {
        // Check if transaction SKU matches (exact match for enhanced SKUs)
        const transactionSku = transaction.sku;
        if (!transactionSku) continue;

        // Exact match only (enhanced SKUs include size dimensions)
        if (transactionSku === sku) {
          // Find design file for this transaction
          const transactionId = transaction.transaction_id?.toString();
          const designFile = designFiles.find(
            (df) => df.transaction_id === transactionId
          );

          if (designFile?.file_url) {
            designFilesToMerge.push({
              order_number: order.order_number,
              transaction_id: transactionId,
              file_url: designFile.file_url,
              product_title: transaction.title,
            });
          }
        }
      }
    }

    if (designFilesToMerge.length === 0) {
      return NextResponse.json(
        {
          error: `No design files found for SKU: ${sku}`,
          message:
            "Make sure the SKU exists in the production queue with uploaded designs",
        },
        { status: 404 }
      );
    }

    // Create a new PDF document to merge into
    const mergedPdf = await PDFDocument.create();

    // Fetch and merge each PDF
    for (const file of designFilesToMerge) {
      try {
        console.log(`Fetching PDF: ${file.file_url}`);

        // Fetch the PDF file
        const response = await fetch(file.file_url);
        if (!response.ok) {
          console.error(`Failed to fetch ${file.file_url}: ${response.status}`);
          continue;
        }

        const pdfBytes = await response.arrayBuffer();
        const pdf = await PDFDocument.load(pdfBytes);

        // Copy all pages from this PDF
        const copiedPages = await mergedPdf.copyPages(
          pdf,
          pdf.getPageIndices()
        );
        copiedPages.forEach((page) => {
          mergedPdf.addPage(page);
        });

        console.log(
          `Added ${copiedPages.length} pages from order #${file.order_number}`
        );
      } catch (err) {
        console.error(`Error processing PDF ${file.file_url}:`, err);
        // Continue with other files even if one fails
      }
    }

    // Save the merged PDF
    const mergedPdfBytes = await mergedPdf.save();

    // Return the PDF as a downloadable file
    return new NextResponse(mergedPdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${sku}_combined_${Date.now()}.pdf"`,
        "Content-Length": mergedPdfBytes.length.toString(),
      },
    });
  } catch (error) {
    console.error("Download SKU error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

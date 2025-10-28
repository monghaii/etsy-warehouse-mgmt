import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import puppeteer from "puppeteer";

// Configure route
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes

/**
 * Generate thumbnail from PDF buffer using Puppeteer + PDF.js
 */
async function generatePdfThumbnail(pdfBuffer) {
  let browser;

  try {
    console.log("Starting PDF thumbnail generation with Puppeteer + PDF.js...");

    // Convert PDF buffer to base64 data URL
    const base64Pdf = pdfBuffer.toString("base64");
    const pdfDataUrl = `data:application/pdf;base64,${base64Pdf}`;

    // Create HTML page with PDF.js to render PDF to canvas
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
        <style>
          body { margin: 0; padding: 0; background: white; }
          #canvas { display: block; }
        </style>
      </head>
      <body>
        <canvas id="canvas"></canvas>
        <script>
          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          
          async function renderPDF() {
            const pdfData = '${pdfDataUrl}';
            const pdf = await pdfjsLib.getDocument(pdfData).promise;
            const page = await pdf.getPage(1);
            
            const scale = 1.5;
            const viewport = page.getViewport({ scale });
            
            const canvas = document.getElementById('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            await page.render({
              canvasContext: context,
              viewport: viewport
            }).promise;
            
            window.pdfRendered = true;
          }
          
          renderPDF().catch(err => {
            console.error('PDF render error:', err);
            window.pdfError = err.message;
          });
        </script>
      </body>
      </html>
    `;

    // Launch Puppeteer
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 1000 });

    // Load HTML with embedded PDF
    await page.setContent(html, { waitUntil: "networkidle0" });

    // Wait for PDF to be rendered
    await page.waitForFunction(
      "window.pdfRendered === true || window.pdfError",
      {
        timeout: 30000,
      }
    );

    // Check for errors
    const error = await page.evaluate(() => window.pdfError);
    if (error) {
      throw new Error(`PDF.js error: ${error}`);
    }

    // Screenshot the canvas
    const canvas = await page.$("#canvas");
    const screenshot = await canvas.screenshot({
      type: "jpeg",
      quality: 85,
    });

    console.log(`Thumbnail generated: ${screenshot.length} bytes`);
    return screenshot;
  } catch (err) {
    console.error("Thumbnail generation failed:", err);
    console.error("Error stack:", err.stack);
    return null;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * POST /api/orders/[id]/design/process
 * Process an already-uploaded design file (generate thumbnail, update DB)
 */
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { transaction_id, file_path, file_name } = body;

    console.log("Processing design for order:", id);
    console.log("File path:", file_path);
    console.log("Transaction ID:", transaction_id);

    // Download the file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from("design-files")
      .download(file_path);

    if (downloadError) {
      throw new Error(`Failed to download file: ${downloadError.message}`);
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    console.log(`Downloaded file: ${buffer.length} bytes`);

    // Generate thumbnail
    console.log("Generating thumbnail for PDF...");
    const thumbnail = await generatePdfThumbnail(buffer);

    if (thumbnail) {
      const thumbnailFileName = file_path.replace(/\.pdf$/i, "_thumb.jpg");
      const { error: thumbError } = await supabaseAdmin.storage
        .from("design-files")
        .upload(thumbnailFileName, thumbnail, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (thumbError) {
        console.error("Thumbnail upload error:", thumbError);
      } else {
        console.log("Thumbnail generated and uploaded successfully");
      }
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from("design-files")
      .getPublicUrl(file_path);

    // Fetch the order
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("design_files, raw_order_data")
      .eq("id", id)
      .single();

    if (orderError) {
      throw new Error(`Order not found: ${orderError.message}`);
    }

    // Update design_files array
    const existingFiles = order.design_files || [];
    const updatedDesignFiles = [
      ...existingFiles.filter(
        (df) => df.transaction_id !== transaction_id.toString()
      ),
      {
        transaction_id: transaction_id.toString(),
        file_url: urlData.publicUrl,
        file_name: file_name,
        file_path: file_path,
        uploaded_at: new Date().toISOString(),
      },
    ];

    // Check if all items have designs
    const transactions = order.raw_order_data?.transactions || [];
    const allDesignsUploaded = transactions.every((txn) =>
      updatedDesignFiles.some(
        (df) => df.transaction_id === txn.transaction_id?.toString()
      )
    );

    // Update order
    const newStatus = allDesignsUploaded
      ? "design_complete"
      : "ready_for_design";

    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        design_files: updatedDesignFiles,
        status: newStatus,
      })
      .eq("id", id);

    if (updateError) {
      throw new Error(`Failed to update order: ${updateError.message}`);
    }

    return NextResponse.json({
      success: true,
      design_files: updatedDesignFiles,
      status: newStatus,
      all_complete: allDesignsUploaded,
    });
  } catch (error) {
    console.error("Design processing error:", error);
    console.error("Error stack:", error.stack);
    console.error("Error message:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import puppeteer from "puppeteer";
import Busboy from "busboy";
import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// Configure route to handle large file uploads
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
 * Parse form data using Busboy for large file support (>10MB)
 */
async function parseFormData(request) {
  return new Promise(async (resolve, reject) => {
    try {
      console.log("Parsing form data with Busboy...");

      const busboy = Busboy({
        headers: {
          "content-type": request.headers.get("content-type"),
        },
        limits: {
          fileSize: 50 * 1024 * 1024, // 50MB limit
        },
      });

      const fields = {};
      const files = [];
      let totalBytes = 0;

      busboy.on("field", (fieldname, value) => {
        fields[fieldname] = value;
        console.log(`Field: ${fieldname} = ${value}`);
      });

      busboy.on("file", (fieldname, file, info) => {
        const { filename, encoding, mimeType } = info;
        const chunks = [];

        file.on("data", (chunk) => {
          chunks.push(chunk);
          totalBytes += chunk.length;
        });

        file.on("end", () => {
          const buffer = Buffer.concat(chunks);
          files.push({
            fieldname,
            filename,
            encoding,
            mimeType,
            buffer,
          });
          console.log(
            `Processing file: ${filename}, size: ${buffer.length} bytes`
          );
        });
      });

      busboy.on("finish", () => {
        console.log(`Total bytes received: ${totalBytes}`);
        resolve({ fields, files });
      });

      busboy.on("error", (error) => {
        console.error("Busboy error:", error);
        reject(error);
      });

      // Read the request body as a stream and pipe to busboy
      const reader = request.body.getReader();

      async function pump() {
        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              busboy.end();
              break;
            }

            // Convert Uint8Array to Buffer for busboy
            const buffer = Buffer.from(
              value.buffer,
              value.byteOffset,
              value.byteLength
            );

            const canContinue = busboy.write(buffer);
            if (!canContinue) {
              // Wait for drain event if backpressure
              await new Promise((resolve) => busboy.once("drain", resolve));
            }
          }
        } catch (streamError) {
          console.error("Stream error:", streamError);
          busboy.destroy(streamError);
          reject(streamError);
        }
      }

      pump();
    } catch (error) {
      console.error("Parse setup error:", error);
      reject(error);
    }
  });
}

/**
 * POST /api/orders/[id]/design
 * Upload design file for an order item
 */
export async function POST(request, { params }) {
  try {
    const { id } = await params;

    console.log("Received design upload request for order:", id);

    // Parse form data using busboy
    const { fields, files } = await parseFormData(request);

    const transactionId = fields.transaction_id;
    const file = files[0];

    console.log(
      "File:",
      file ? `${file.filename} (${file.buffer.length} bytes)` : "null"
    );
    console.log("Transaction ID:", transactionId);

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!transactionId) {
      return NextResponse.json(
        { error: "Transaction ID is required" },
        { status: 400 }
      );
    }

    // Validate file size (50MB limit)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.buffer.length > maxSize) {
      return NextResponse.json(
        {
          error: `File is too large (${(
            file.buffer.length /
            1024 /
            1024
          ).toFixed(1)}MB). Maximum size is 50MB.`,
        },
        { status: 400 }
      );
    }

    // Validate file type
    if (file.mimeType !== "application/pdf") {
      return NextResponse.json(
        { error: "Only PDF files are allowed" },
        { status: 400 }
      );
    }

    // Get order to verify it exists
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", id)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // File buffer is already available from busboy
    const buffer = file.buffer;

    // Upload to Supabase Storage
    const fileName = `${id}/${transactionId}_${Date.now()}.pdf`;
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from("design-files")
      .upload(fileName, buffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload file" },
        { status: 500 }
      );
    }

    // Generate and upload thumbnail
    console.log("Generating thumbnail for PDF...");
    const thumbnail = await generatePdfThumbnail(buffer);
    if (thumbnail) {
      const thumbnailFileName = fileName.replace(/\.pdf$/i, "_thumb.jpg");
      const { error: thumbError } = await supabaseAdmin.storage
        .from("design-files")
        .upload(thumbnailFileName, thumbnail, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (thumbError) {
        console.error("Thumbnail upload error:", thumbError);
        // Don't fail the whole request if thumbnail upload fails
      } else {
        console.log("Thumbnail generated and uploaded successfully");
      }
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from("design-files")
      .getPublicUrl(fileName);

    // Update order's design_files array
    const existingDesignFiles = order.design_files || [];

    // Remove existing design for this transaction if any
    const filteredDesignFiles = existingDesignFiles.filter(
      (df) => df.transaction_id !== transactionId
    );

    // Add new design file
    const updatedDesignFiles = [
      ...filteredDesignFiles,
      {
        transaction_id: transactionId,
        file_path: fileName,
        file_url: urlData.publicUrl,
        uploaded_at: new Date().toISOString(),
      },
    ];

    // Check if all transactions now have designs
    const allTransactions = order.raw_order_data?.transactions || [];
    const allHaveDesigns = allTransactions.every((txn) =>
      updatedDesignFiles.some(
        (df) => df.transaction_id === txn.transaction_id?.toString()
      )
    );

    // Update order
    const updateData = {
      design_files: updatedDesignFiles,
      updated_at: new Date().toISOString(),
    };

    // Auto-advance to design_complete if all items have designs
    if (allHaveDesigns) {
      updateData.status = "design_complete";
    }

    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update(updateData)
      .eq("id", id);

    if (updateError) {
      console.error("Failed to update order:", updateError);
      return NextResponse.json(
        { error: "Failed to update order" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      file_url: urlData.publicUrl,
      all_complete: allHaveDesigns,
      design_files: updatedDesignFiles,
      status: allHaveDesigns ? "design_complete" : order.status,
    });
  } catch (error) {
    console.error("Design upload error:", error);
    console.error("Error stack:", error.stack);
    console.error("Error message:", error.message);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { createCanvas } from "canvas";
import bwipjs from "bwip-js";

export const runtime = "nodejs";

/**
 * GET /api/orders/[id]/metadata-image
 * Generate a metadata image with order info and barcode (horizontally flipped for printer)
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params;

    // Fetch order
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", id)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Get transactions for SKU info
    const transactions = order.raw_order_data?.transactions || [];
    const skus = transactions
      .map((txn) => txn.sku)
      .filter(Boolean)
      .join(", ");

    // Canvas dimensions (tight compact label - minimal padding)
    const width = 450;
    const height = 240;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // White background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // Generate barcode
    let barcodeBuffer;
    try {
      barcodeBuffer = await bwipjs.toBuffer({
        bcid: "code128", // Barcode type
        text: order.order_number, // Order number as barcode
        scale: 2, // Scaling factor (smaller)
        height: 8, // Bar height in mm (smaller)
        includetext: true, // Include human-readable text
        textxalign: "center",
      });
    } catch (barcodeError) {
      console.error("Barcode generation error:", barcodeError);
      return NextResponse.json(
        { error: "Failed to generate barcode" },
        { status: 500 }
      );
    }

    // Load barcode image
    const { loadImage } = await import("canvas");
    const barcodeImage = await loadImage(barcodeBuffer);

    // Draw barcode (centered, minimal top margin)
    const barcodeWidth = 350;
    const barcodeHeight = 80;
    const barcodeX = (width - barcodeWidth) / 2;
    const barcodeY = 5; // Minimal top padding
    ctx.drawImage(
      barcodeImage,
      barcodeX,
      barcodeY,
      barcodeWidth,
      barcodeHeight
    );

    // Draw order information (below barcode) - all uniform size
    ctx.fillStyle = "#000000";
    ctx.textAlign = "center";
    ctx.font = "18px Arial"; // Uniform font size for all text

    let yPos = 100; // Starting Y position (tighter)
    const lineHeight = 23; // Tighter line spacing

    // Order number
    ctx.fillText(`Order #${order.order_number}`, width / 2, yPos);
    yPos += lineHeight;

    // Customer name
    ctx.fillText(order.customer_name || "N/A", width / 2, yPos);
    yPos += lineHeight;

    // SKUs
    ctx.fillText(`SKU: ${skus || "N/A"}`, width / 2, yPos);
    yPos += lineHeight;

    // Quantity
    const totalQty = transactions.reduce(
      (sum, txn) => sum + (txn.quantity || 0),
      0
    );
    ctx.fillText(`Qty: ${totalQty}`, width / 2, yPos);
    yPos += lineHeight;

    // Ship to city/state (if available)
    if (order.shipping_city || order.shipping_state) {
      ctx.fillText(
        `Ship to: ${order.shipping_city || ""}${
          order.shipping_city && order.shipping_state ? ", " : ""
        }${order.shipping_state || ""}`,
        width / 2,
        yPos
      );
      yPos += lineHeight;
    }

    // Order date
    const orderDate = new Date(order.order_date).toLocaleDateString();
    ctx.fillText(`Date: ${orderDate}`, width / 2, yPos);

    // Flip the canvas horizontally (for reverse printing)
    const flippedCanvas = createCanvas(width, height);
    const flippedCtx = flippedCanvas.getContext("2d");

    // Flip horizontally: scale x by -1 and translate
    flippedCtx.translate(width, 0);
    flippedCtx.scale(-1, 1);
    flippedCtx.drawImage(canvas, 0, 0);

    // Convert to PNG buffer
    const buffer = flippedCanvas.toBuffer("image/png");

    // Return image
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("Metadata image generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate metadata image" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function POST(request) {
  try {
    const formData = await request.formData();

    const orderId = formData.get("orderId");
    const email = formData.get("email");
    const customerNotes = formData.get("customerNotes");

    // Parse items data (sent as JSON string)
    const itemsDataJson = formData.get("itemsData");
    const itemsData = itemsDataJson ? JSON.parse(itemsDataJson) : [];

    console.log("[Enrich Submit] Received submission:", {
      orderId,
      email,
      itemsCount: itemsData.length,
      customerNotes: customerNotes?.substring(0, 50),
    });

    // Validation
    if (!orderId) {
      return NextResponse.json(
        { error: "Order ID is required" },
        { status: 400 }
      );
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Valid email is required" },
        { status: 400 }
      );
    }

    // Look up order
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, product_sku, status, platform, raw_order_data")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Check if already enriched
    if (order.status !== "pending_enrichment") {
      return NextResponse.json(
        { error: "This order has already been processed" },
        { status: 400 }
      );
    }

    console.log("[Enrich Submit] Order platform:", order.platform);

    // Process enrichment data for each item
    const enrichedItems = [];

    for (const itemData of itemsData) {
      const enrichedItem = {
        transactionId: itemData.transactionId,
        sku: itemData.sku,
        customText: itemData.customText || null,
        uploadedFiles: [],
      };

      // Upload files for this item
      const itemFiles = formData.getAll(`files_${itemData.transactionId}`);

      for (const file of itemFiles) {
        if (!(file instanceof File)) continue;

        // Validate file
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
          return NextResponse.json(
            { error: `File ${file.name} exceeds 10MB limit` },
            { status: 400 }
          );
        }

        const allowedTypes = ["image/png", "image/jpeg", "image/jpg"];
        if (!allowedTypes.includes(file.type)) {
          return NextResponse.json(
            {
              error: `File ${file.name} must be PNG or JPEG format`,
            },
            { status: 400 }
          );
        }

        // Create file path: customer-uploads/{order_id}/{transaction_id}/{timestamp}_{filename}
        const timestamp = Date.now();
        const fileName = `${timestamp}_${file.name.replace(
          /[^a-zA-Z0-9.-]/g,
          "_"
        )}`;
        const filePath = `${orderId}/${itemData.transactionId}/${fileName}`;

        console.log("[Enrich Submit] Uploading file:", filePath);

        // Convert File to ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } =
          await supabaseAdmin.storage
            .from("customer-uploads")
            .upload(filePath, buffer, {
              contentType: file.type,
              upsert: false,
            });

        if (uploadError) {
          console.error("[Enrich Submit] Upload error:", uploadError);
          return NextResponse.json(
            { error: `Failed to upload ${file.name}: ${uploadError.message}` },
            { status: 500 }
          );
        }

        console.log("[Enrich Submit] File uploaded:", uploadData);

        enrichedItem.uploadedFiles.push({
          fileName: file.name,
          filePath: uploadData.path,
          fileSize: file.size,
          fileType: file.type,
          uploadedAt: new Date().toISOString(),
        });
      }

      enrichedItems.push(enrichedItem);
    }

    // Update order with enrichment data
    const rawOrderData = order.raw_order_data || {};
    const updateData = {
      enrichment_email: email,
      enrichment_submitted_at: new Date().toISOString(),
      status: "ready_for_design", // Move to ready_for_design after submission
      raw_order_data: {
        ...rawOrderData,
        customer_enrichment: enrichedItems,
      },
    };

    if (customerNotes?.trim()) {
      updateData.customer_notes = customerNotes.trim();
    }

    // Also store all files in custom_images for backward compatibility
    const allFiles = enrichedItems.flatMap((item) => item.uploadedFiles);
    if (allFiles.length > 0) {
      updateData.custom_images = allFiles;
    }

    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update(updateData)
      .eq("id", orderId);

    if (updateError) {
      console.error("[Enrich Submit] Update error:", updateError);
      return NextResponse.json(
        { error: "Failed to save enrichment data" },
        { status: 500 }
      );
    }

    console.log("[Enrich Submit] Success! Order updated:", orderId);

    return NextResponse.json({
      success: true,
      message:
        "Thank you! Your personalization has been submitted successfully.",
      orderNumber: order.order_number,
    });
  } catch (error) {
    console.error("[Enrich Submit] Error:", error);
    return NextResponse.json(
      { error: "Failed to submit enrichment. Please try again." },
      { status: 500 }
    );
  }
}

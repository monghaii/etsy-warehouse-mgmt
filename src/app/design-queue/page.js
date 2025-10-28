"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import Navigation from "@/components/Navigation";

export default function DesignQueuePage() {
  // Create Supabase client lazily to avoid SSR issues
  const getSupabaseClient = () => {
    if (typeof window === "undefined") return null;
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
  };
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadingDesign, setUploadingDesign] = useState(null); // { orderId, transactionId }
  const [uploadStatus, setUploadStatus] = useState(null);
  const [previewFile, setPreviewFile] = useState(null); // { orderId, transactionId, url }
  const [confirmingOrder, setConfirmingOrder] = useState(null); // orderId being confirmed
  const [generatingMetadata, setGeneratingMetadata] = useState(null); // orderId

  useEffect(() => {
    fetchUser();
    loadOrders();
  }, []);

  async function fetchUser() {
    try {
      const response = await fetch("/api/auth/user");
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      }
    } catch (error) {
      console.error("Failed to fetch user:", error);
    }
  }

  async function loadOrders() {
    try {
      setLoading(true);
      const response = await fetch("/api/design-queue");
      const data = await response.json();
      setOrders(data.orders || []);
    } catch (error) {
      console.error("Failed to load design queue:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleFileUpload(orderId, transactionId, file) {
    if (!file || file.type !== "application/pdf") {
      setUploadStatus({
        type: "error",
        message: "Please upload a PDF file",
      });
      return;
    }

    // Check file size (50MB limit)
    const maxSize = 50 * 1024 * 1024; // 50MB in bytes
    if (file.size > maxSize) {
      setUploadStatus({
        type: "error",
        message: `File is too large (${(file.size / 1024 / 1024).toFixed(
          1
        )}MB). Maximum size is 50MB.`,
      });
      return;
    }

    try {
      setUploadingDesign({ orderId, transactionId });
      setUploadStatus({
        type: "info",
        message: "Uploading design...",
      });

      const fileSizeMB = file.size / 1024 / 1024;
      const usesDirectUpload = fileSizeMB > 10;

      if (usesDirectUpload) {
        // For files >10MB, upload directly to Supabase Storage
        const supabase = getSupabaseClient();
        if (!supabase) {
          throw new Error("Supabase client not available");
        }

        const fileName = `${orderId}/${transactionId}/${file.name}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("design-files")
          .upload(fileName, file, {
            contentType: "application/pdf",
            upsert: true,
          });

        if (uploadError) {
          throw new Error(`Upload failed: ${uploadError.message}`);
        }

        // Now process the uploaded file (generate thumbnail, update DB)
        const response = await fetch(`/api/orders/${orderId}/design/process`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transaction_id: transactionId,
            file_path: uploadData.path,
            file_name: file.name,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to process design");
        }

        const data = await response.json();

        setUploadStatus({
          type: "success",
          message: `✓ Design uploaded successfully${
            data.all_complete ? " - Order marked complete!" : ""
          }`,
        });

        setOrders((prevOrders) =>
          prevOrders.map((o) => {
            if (o.id === orderId) {
              return {
                ...o,
                design_files: data.design_files,
                status: data.status,
              };
            }
            return o;
          })
        );
      } else {
        // For files <=10MB, use the existing API route
        const formData = new FormData();
        formData.append("file", file);
        formData.append("transaction_id", transactionId);

        const response = await fetch(`/api/orders/${orderId}/design`, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          let errorMessage = "Upload failed";
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.message || errorMessage;
          } catch (e) {
            errorMessage = `Upload failed: ${
              response.statusText || response.status
            }`;
          }
          throw new Error(errorMessage);
        }

        const data = await response.json();

        setUploadStatus({
          type: "success",
          message: `✓ Design uploaded successfully${
            data.all_complete ? " - Order marked complete!" : ""
          }`,
        });

        setOrders((prevOrders) =>
          prevOrders.map((o) => {
            if (o.id === orderId) {
              return {
                ...o,
                design_files: data.design_files,
                status: data.status,
              };
            }
            return o;
          })
        );
      }

      setTimeout(() => setUploadStatus(null), 5000);
    } catch (error) {
      console.error("Upload error:", error);
      setUploadStatus({
        type: "error",
        message: error.message || "Failed to upload design. Please try again.",
      });
    } finally {
      setUploadingDesign(null);
    }
  }

  async function confirmForProduction(orderId) {
    try {
      setConfirmingOrder(orderId);
      setUploadStatus({
        type: "info",
        message: "Sending to production...",
      });

      const response = await fetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "pending_fulfillment" }),
      });

      if (!response.ok) {
        throw new Error("Failed to confirm");
      }

      setUploadStatus({
        type: "success",
        message: "✓ Order sent to production!",
      });

      loadOrders();
      setTimeout(() => setUploadStatus(null), 3000);
    } catch (error) {
      console.error("Confirm error:", error);
      setUploadStatus({
        type: "error",
        message: "Failed to send to production. Please try again.",
      });
    } finally {
      setConfirmingOrder(null);
    }
  }

  async function generateMetadataImage(orderId) {
    try {
      setGeneratingMetadata(orderId);
      setUploadStatus({
        type: "info",
        message: "Generating metadata image...",
      });

      // Fetch the image from the API
      const response = await fetch(`/api/orders/${orderId}/metadata-image`);

      if (!response.ok) {
        throw new Error("Failed to generate metadata image");
      }

      // Get the image as a blob
      const blob = await response.blob();

      // Copy to clipboard using Clipboard API
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            [blob.type]: blob,
          }),
        ]);

        setUploadStatus({
          type: "success",
          message: "✓ Metadata image copied to clipboard!",
        });

        setTimeout(() => setUploadStatus(null), 3000);
      } catch (clipboardError) {
        console.error("Clipboard error:", clipboardError);
        throw new Error("Failed to copy to clipboard. Please try again.");
      }
    } catch (error) {
      console.error("Metadata generation error:", error);
      setUploadStatus({
        type: "error",
        message: error.message || "Failed to generate metadata image.",
      });
    } finally {
      setGeneratingMetadata(null);
    }
  }

  function getProductConfig(sku, order) {
    // Extract product config from order data if available
    // For now, return canva template from product_templates via the sku
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading design queue...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation user={user} />

      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Design Queue</h1>
            <p className="text-gray-600 text-sm mt-1">
              {orders.length} {orders.length === 1 ? "order" : "orders"} ready
              for design
            </p>
          </div>
        </div>

        {/* Toast Notification - Fixed Position */}
        {uploadStatus && (
          <div
            className={`fixed top-4 right-4 z-50 p-4 rounded-lg border shadow-lg max-w-md animate-slide-in ${
              uploadStatus.type === "success"
                ? "bg-green-50 border-green-200 text-green-800"
                : uploadStatus.type === "info"
                ? "bg-blue-50 border-blue-200 text-blue-800"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-medium">
                {uploadStatus.message}
              </span>
              <button
                onClick={() => setUploadStatus(null)}
                className="text-sm hover:opacity-70 flex-shrink-0"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {orders.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-300 p-12 text-center">
            <div className="text-6xl mb-4">🎨</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No orders ready for design
            </h3>
            <p className="text-gray-600 mb-6">
              Orders will appear here when they reach "Ready for Design" status
            </p>
            <Link
              href="/orders"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              View All Orders
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const transactions = order.raw_order_data?.transactions || [];
              const allDesignsUploaded = transactions.every((txn) =>
                order.design_files?.some(
                  (df) => df.transaction_id === txn.transaction_id?.toString()
                )
              );

              const isDesignComplete = order.status === "design_complete";
              const needsRevision = order.needs_design_revision;
              const isLocked = order.production_started_at;

              return (
                <div
                  key={order.id}
                  className={`rounded-lg border p-4 ${
                    needsRevision
                      ? "bg-red-50 border-red-300"
                      : isDesignComplete
                      ? "bg-green-50 border-green-200"
                      : "bg-white border-gray-300"
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold text-gray-900">
                          Order #{order.order_number}
                        </h3>
                        <a
                          href={`https://www.etsy.com/your/orders/sold?order_id=${order.order_number}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-500 text-white text-xs font-medium rounded hover:bg-orange-600 transition-colors"
                        >
                          Etsy ↗
                        </a>
                      </div>
                      <p className="text-xs text-gray-600 mt-0.5">
                        {order.customer_name} •{" "}
                        {new Date(order.order_date).toLocaleDateString()}
                      </p>
                      {needsRevision && order.design_revision_notes && (
                        <div className="mt-1.5 p-2 bg-red-100 border border-red-200 rounded">
                          <p className="text-xs font-medium text-red-900 mb-0.5">
                            🔄 Revision Requested:
                          </p>
                          <p className="text-xs text-red-800">
                            {order.design_revision_notes}
                          </p>
                        </div>
                      )}
                      {isLocked && (
                        <div className="mt-1.5 p-1.5 bg-yellow-100 border border-yellow-200 rounded">
                          <p className="text-xs text-yellow-900">
                            🔒 Production started - design is locked and cannot
                            be replaced
                          </p>
                        </div>
                      )}
                      <div className="mt-1.5 flex gap-1.5">
                        {needsRevision && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-300">
                            🔄 NEEDS REVISION
                          </span>
                        )}
                        {isDesignComplete && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            ✓ Design Complete
                          </span>
                        )}
                        {allDesignsUploaded && !isDesignComplete && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            ✓ All Designs Uploaded
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => generateMetadataImage(order.id)}
                        disabled={generatingMetadata === order.id}
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          generatingMetadata === order.id
                            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                            : "bg-green-600 text-white hover:bg-green-700"
                        }`}
                        title="Generate and copy metadata label to clipboard (flipped for printer)"
                      >
                        {generatingMetadata === order.id
                          ? "📋 Generating..."
                          : "📋 Copy ID Tag"}
                      </button>
                      {allDesignsUploaded && !isDesignComplete && (
                        <button
                          onClick={() => confirmForProduction(order.id)}
                          disabled={confirmingOrder === order.id}
                          className={`px-3 py-1 rounded text-xs font-medium ${
                            confirmingOrder === order.id
                              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                              : "bg-blue-600 text-white hover:bg-blue-700"
                          }`}
                        >
                          {confirmingOrder === order.id
                            ? "Confirming..."
                            : "✓ Send to Production"}
                        </button>
                      )}
                      {isDesignComplete && (
                        <span className="text-xs text-green-700 font-medium">
                          In Production
                        </span>
                      )}
                      <Link
                        href={`/orders/${order.id}`}
                        className="text-blue-600 hover:text-blue-700 text-xs font-medium"
                      >
                        View Details →
                      </Link>
                    </div>
                  </div>

                  {/* Internal Notes */}
                  {order.notes && (
                    <div className="mb-3 p-2 bg-gray-50 border border-gray-200 rounded">
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-medium text-gray-700">
                          📋 Internal Notes:
                        </span>
                        <div className="text-xs text-gray-600 flex-1 whitespace-pre-wrap">
                          {order.notes}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Customer General Notes */}
                  {order.customer_notes && (
                    <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded">
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-medium text-blue-900">
                          💬 Customer Notes:
                        </span>
                        <div className="text-xs text-blue-800 flex-1 whitespace-pre-wrap">
                          {order.customer_notes}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    {transactions.map((txn, idx) => {
                      const transactionId = txn.transaction_id?.toString();
                      const isUploading =
                        uploadingDesign?.orderId === order.id &&
                        uploadingDesign?.transactionId === transactionId;

                      // Check if design already uploaded
                      const designFile = order.design_files?.find(
                        (df) => df.transaction_id === transactionId
                      );
                      const hasDesign = !!designFile;

                      // Check if uploads are locked (production started but not needing revision)
                      const uploadsLocked = isLocked && !needsRevision;

                      // SKU is already enhanced in the database (e.g., BLKT-KPOP-001-30-40)
                      // Just display it with proper highlighting
                      const sku = txn.sku || "—";
                      const skuParts = sku.match(
                        /^([A-Z]+-[A-Z]+-\d+)(-\d+-\d+)?$/
                      );
                      const baseSku = skuParts ? skuParts[1] : sku;
                      const appendedPart = skuParts ? skuParts[2] || "" : "";

                      return (
                        <div
                          key={transactionId || idx}
                          className="border border-gray-200 rounded-lg p-3"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <h4 className="text-sm font-medium text-gray-900">
                                {txn.title || "Unknown Product"}
                              </h4>
                              <p className="text-xs text-gray-600 mt-0.5">
                                SKU: {baseSku}
                                {appendedPart && (
                                  <span className="text-blue-600 font-medium">
                                    {appendedPart}
                                  </span>
                                )}{" "}
                                • Qty: {txn.quantity || 1}
                              </p>

                              {/* Etsy Personalization */}
                              {(() => {
                                const personalization = txn.variations?.find(
                                  (v) => v.formatted_name === "Personalization"
                                )?.formatted_value;

                                return personalization &&
                                  personalization !==
                                    "Not requested on this item" ? (
                                  <div className="mt-1.5 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                                    <div className="font-medium text-yellow-900">
                                      📝 Etsy Personalization:
                                    </div>
                                    <div className="text-yellow-800 mt-0.5 whitespace-pre-wrap">
                                      {personalization}
                                    </div>
                                  </div>
                                ) : null;
                              })()}

                              {/* Customer Enrichment for this item */}
                              {(() => {
                                const enrichment =
                                  order.raw_order_data?.customer_enrichment?.find(
                                    (e) =>
                                      e.transactionId?.toString() ===
                                      transactionId
                                  );
                                return enrichment &&
                                  (enrichment.customText ||
                                    enrichment.uploadedFiles?.length > 0) ? (
                                  <div className="mt-1.5 p-2 bg-purple-50 border border-purple-200 rounded text-xs">
                                    <div className="font-medium text-purple-900">
                                      ✨ Customer Enrichment:
                                    </div>
                                    {enrichment.customText && (
                                      <div className="text-purple-800 mt-0.5 whitespace-pre-wrap">
                                        {enrichment.customText}
                                      </div>
                                    )}
                                    {enrichment.uploadedFiles &&
                                      enrichment.uploadedFiles.length > 0 && (
                                        <div className="mt-1 space-y-1">
                                          <div className="font-medium text-purple-900">
                                            Uploaded Files:
                                          </div>
                                          {enrichment.uploadedFiles.map(
                                            (file, idx) => {
                                              // Get public URL for the file
                                              const supabaseUrl =
                                                process.env
                                                  .NEXT_PUBLIC_SUPABASE_URL;
                                              const fileUrl = `${supabaseUrl}/storage/v1/object/public/customer-uploads/${file.filePath}`;
                                              return (
                                                <a
                                                  key={idx}
                                                  href={fileUrl}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="block text-purple-600 hover:text-purple-700 font-medium"
                                                >
                                                  📎 {file.fileName} ↗
                                                </a>
                                              );
                                            }
                                          )}
                                        </div>
                                      )}
                                  </div>
                                ) : null;
                              })()}

                              {/* Design Preview Link */}
                              {hasDesign && designFile.file_url && (
                                <div className="mt-1.5">
                                  <a
                                    href={designFile.file_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                                  >
                                    📄 Preview Design PDF ↗
                                  </a>
                                </div>
                              )}
                            </div>

                            <div className="flex flex-col gap-2 items-end">
                              {/* Canva Template Link - Above Upload Button */}
                              {txn.canva_template_url && (
                                <a
                                  href={txn.canva_template_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white text-xs font-medium rounded hover:bg-purple-700 transition-colors whitespace-nowrap"
                                >
                                  🎨 Open Canva Template ↗
                                </a>
                              )}

                              {/* Upload/Replace Button */}
                              {uploadsLocked ? (
                                <div className="flex items-center gap-2">
                                  {hasDesign && (
                                    <span className="text-green-600 text-xs font-medium">
                                      ✓ Design Uploaded
                                    </span>
                                  )}
                                  <span className="text-gray-500 text-xs">
                                    🔒 Locked
                                  </span>
                                </div>
                              ) : hasDesign ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-green-600 text-xs font-medium">
                                    ✓ Design Uploaded
                                  </span>
                                  <label className="cursor-pointer text-blue-600 hover:text-blue-700 text-xs">
                                    Replace
                                    <input
                                      type="file"
                                      accept=".pdf"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          handleFileUpload(
                                            order.id,
                                            transactionId,
                                            file
                                          );
                                        }
                                      }}
                                      className="hidden"
                                      disabled={isUploading}
                                    />
                                  </label>
                                </div>
                              ) : (
                                <label
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium cursor-pointer whitespace-nowrap ${
                                    isUploading
                                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                      : "bg-blue-600 text-white hover:bg-blue-700"
                                  }`}
                                >
                                  {isUploading ? (
                                    <>
                                      <svg
                                        className="animate-spin h-3 w-3"
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                      >
                                        <circle
                                          className="opacity-25"
                                          cx="12"
                                          cy="12"
                                          r="10"
                                          stroke="currentColor"
                                          strokeWidth="4"
                                        ></circle>
                                        <path
                                          className="opacity-75"
                                          fill="currentColor"
                                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                        ></path>
                                      </svg>
                                      Uploading...
                                    </>
                                  ) : (
                                    <>📄 Upload Design PDF</>
                                  )}
                                  <input
                                    type="file"
                                    accept=".pdf"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        handleFileUpload(
                                          order.id,
                                          transactionId,
                                          file
                                        );
                                      }
                                    }}
                                    className="hidden"
                                    disabled={isUploading}
                                  />
                                </label>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

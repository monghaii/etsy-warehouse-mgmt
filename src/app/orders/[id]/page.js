"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function OrderDetailPage() {
  const params = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState("");
  const [saveError, setSaveError] = useState(null);
  const [changingStatus, setChangingStatus] = useState(false);
  const [editingSku, setEditingSku] = useState(false);
  const [sku, setSku] = useState("");
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [flagReason, setFlagReason] = useState("");

  useEffect(() => {
    if (params.id) {
      loadOrder();
    }
  }, [params.id]);

  async function loadOrder() {
    try {
      const response = await fetch(`/api/orders/${params.id}`);
      const data = await response.json();
      setOrder(data.order);
      setNotes(data.order.internal_notes || "");
      setSku(data.order.product_sku || "");
    } catch (error) {
      console.error("Failed to load order:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveNotes() {
    try {
      setSaveError(null);
      await fetch(`/api/orders/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ internal_notes: notes }),
      });
      setEditing(false);
      loadOrder();
    } catch (error) {
      setSaveError("Failed to save notes. Please try again.");
    }
  }

  async function handleSaveSku() {
    try {
      setSaveError(null);
      await fetch(`/api/orders/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_sku: sku }),
      });
      setEditingSku(false);
      loadOrder();
    } catch (error) {
      setSaveError("Failed to save SKU. Please try again.");
    }
  }

  async function handleStatusChange(newStatus) {
    try {
      setChangingStatus(true);
      const response = await fetch(`/api/orders/${params.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error("Failed to update status");
      }

      loadOrder();
    } catch (error) {
      console.error("Failed to update status:", error);
      setSaveError("Failed to update status. Please try again.");
    } finally {
      setChangingStatus(false);
    }
  }

  async function handleFlagForReview() {
    try {
      setChangingStatus(true);
      setSaveError(null);

      const response = await fetch(`/api/orders/${params.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "needs_review",
          review_reason: flagReason || "Flagged for review",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to flag order");
      }

      setShowFlagModal(false);
      setFlagReason("");
      loadOrder();
    } catch (error) {
      console.error("Failed to flag order:", error);
      setSaveError("Failed to flag order. Please try again.");
    } finally {
      setChangingStatus(false);
    }
  }

  function enhanceSKUWithDimensions(baseSku, variations = []) {
    if (!baseSku) return "";
    if (!variations || variations.length === 0) return baseSku;

    // Look for size-related variations
    const sizeVariation = variations.find((v) => {
      const name = v.formatted_name?.toLowerCase() || "";
      return name.includes("size") || name.includes("dimension");
    });

    if (!sizeVariation) return baseSku;

    const sizeValue = sizeVariation.formatted_value || "";
    const numerals = sizeValue.match(/\d+/g);

    if (!numerals || numerals.length === 0) return baseSku;

    return `${baseSku}-${numerals.join("-")}`;
  }

  function renderSKU(enhancedSku, originalSku = null) {
    if (!enhancedSku) return "—";

    // If we have the original SKU and it's different from enhanced, highlight the difference
    if (
      originalSku &&
      enhancedSku !== originalSku &&
      enhancedSku.startsWith(originalSku)
    ) {
      const appendedPart = enhancedSku.substring(originalSku.length);
      return (
        <span>
          {originalSku}
          <span className="text-blue-600 font-medium">{appendedPart}</span>
        </span>
      );
    }

    return enhancedSku;
  }

  function getStatusColor(status) {
    const colors = {
      pending_enrichment: "bg-yellow-100 text-yellow-800 border-yellow-300",
      enriched: "bg-blue-100 text-blue-800 border-blue-300", // Keep for legacy orders
      needs_review: "bg-red-100 text-red-800 border-red-300",
      ready_for_design: "bg-purple-100 text-purple-800 border-purple-300",
      design_complete: "bg-green-100 text-green-800 border-green-300",
      labels_generated: "bg-indigo-100 text-indigo-800 border-indigo-300",
      loaded_for_shipment: "bg-cyan-100 text-cyan-800 border-cyan-300",
      in_transit: "bg-blue-100 text-blue-800 border-blue-300",
      delivered: "bg-green-100 text-green-800 border-green-300",
    };
    return colors[status] || "bg-gray-100 text-gray-800 border-gray-300";
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading order...</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Order not found
          </h2>
          <Link href="/orders" className="text-blue-600 hover:text-blue-700">
            ← Back to Orders
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/orders"
            className="text-blue-600 hover:text-blue-700 text-sm mb-2 inline-block"
          >
            ← Back to Orders
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Order #{order.order_number}
              </h1>
              <p className="text-gray-600 mt-1">
                Placed {new Date(order.order_date).toLocaleDateString()}
              </p>
              {order.tracking_number && (
                <div className="mt-2 flex items-center gap-3">
                  <span className="text-sm font-medium text-green-700">
                    📦 Tracking: {order.tracking_number}
                  </span>
                  {order.label_url && (
                    <a
                      href={order.label_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors"
                    >
                      📄 Download Label ↗
                    </a>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <select
                value={order.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                disabled={changingStatus}
                className={`px-4 py-2 rounded border font-medium cursor-pointer focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${getStatusColor(
                  order.status
                )}`}
              >
                <option value="pending_enrichment">Pending Enrichment</option>
                <option value="needs_review">Needs Review</option>
                <option value="ready_for_design">Ready for Design</option>
                <option value="design_complete">Design Complete</option>
                <option value="labels_generated">Labels Generated</option>
                <option value="loaded_for_shipment">Loaded for Shipment</option>
                <option value="in_transit">In Transit</option>
                <option value="delivered">Delivered</option>
              </select>
              {order.status !== "needs_review" && (
                <button
                  onClick={() => setShowFlagModal(true)}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-medium"
                  title="Flag for review"
                >
                  🚩 Flag for Review
                </button>
              )}
              {order.status === "needs_review" && order.review_reason && (
                <div className="text-sm text-red-700 bg-red-50 px-3 py-2 rounded border border-red-200">
                  <strong>Reason:</strong> {order.review_reason}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Buyer Information */}
            <div className="bg-white rounded-lg border border-gray-300 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                🛍️ Buyer Information
              </h2>
              <div className="space-y-3">
                <div>
                  <div className="text-sm text-gray-500">Buyer Name</div>
                  <div className="text-gray-900 font-medium">
                    {order.raw_order_data?.receipt?.buyer_user_id
                      ? `Etsy User ID: ${order.raw_order_data.receipt.buyer_user_id}`
                      : order.raw_order_data?.receipt?.name || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Buyer Email</div>
                  <div className="text-gray-900">
                    {order.customer_email ||
                      order.raw_order_data?.receipt?.buyer_email ||
                      "—"}
                  </div>
                </div>
              </div>
            </div>

            {/* Shipping Address */}
            <div className="bg-white rounded-lg border border-gray-300 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                📦 Ship To
              </h2>
              <div className="space-y-3">
                <div>
                  <div className="text-sm text-gray-500">Recipient Name</div>
                  <div className="font-medium text-gray-900">
                    {order.customer_name ||
                      order.raw_order_data?.receipt?.name ||
                      "—"}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Address</div>
                  <div className="text-gray-900">
                    {order.shipping_address_line1 ||
                    order.raw_order_data?.receipt?.first_line ? (
                      <>
                        {order.shipping_address_line1 ||
                          order.raw_order_data?.receipt?.first_line}
                        {(order.shipping_address_line2 ||
                          order.raw_order_data?.receipt?.second_line) && (
                          <>
                            <br />
                            {order.shipping_address_line2 ||
                              order.raw_order_data?.receipt?.second_line}
                          </>
                        )}
                        <br />
                        {order.shipping_city ||
                          order.raw_order_data?.receipt?.city ||
                          ""}
                        {(order.shipping_city ||
                          order.raw_order_data?.receipt?.city) &&
                        (order.shipping_state ||
                          order.raw_order_data?.receipt?.state)
                          ? ", "
                          : ""}
                        {order.shipping_state ||
                          order.raw_order_data?.receipt?.state ||
                          ""}{" "}
                        {order.shipping_zip ||
                          order.raw_order_data?.receipt?.zip ||
                          ""}
                        <br />
                        {order.shipping_country ||
                          order.raw_order_data?.receipt?.country_iso ||
                          ""}
                      </>
                    ) : (
                      <div className="text-red-600 text-sm">
                        ⚠️ No shipping address found in order data
                        {order.raw_order_data?.receipt?.is_gift && (
                          <div className="mt-1 text-xs">
                            This order is marked as a gift
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                {order.raw_order_data?.receipt?.gift_message && (
                  <div>
                    <div className="text-sm text-gray-500">Gift Message</div>
                    <div className="text-gray-900 text-sm bg-blue-50 p-2 rounded">
                      {order.raw_order_data.receipt.gift_message}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Product Information - All Items */}
            <div className="bg-white rounded-lg border border-gray-300 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                🎨 Order Items
              </h2>
              {order.raw_order_data?.transactions?.length > 0 ? (
                <div className="space-y-4">
                  {order.raw_order_data.transactions.map((transaction, idx) => (
                    <div
                      key={transaction.transaction_id || idx}
                      className="pb-4 border-b border-gray-200 last:border-b-0 last:pb-0"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="font-medium text-gray-900">
                            {transaction.title || "Unknown Product"}
                          </div>
                          <div className="text-sm text-gray-500">
                            SKU:{" "}
                            {renderSKU(
                              enhanceSKUWithDimensions(
                                transaction.sku,
                                transaction.variations
                              ),
                              transaction.sku
                            )}{" "}
                            • Qty: {transaction.quantity || 1}
                          </div>
                        </div>
                        {order.raw_order_data.transactions.length > 1 && (
                          <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
                            Item {idx + 1} of{" "}
                            {order.raw_order_data.transactions.length}
                          </span>
                        )}
                      </div>
                      {transaction.variations &&
                        transaction.variations.length > 0 && (
                          <div>
                            <div className="text-xs text-gray-500 mb-1">
                              Personalization from Etsy:
                            </div>
                            <div className="bg-gray-50 rounded p-2 text-sm text-gray-900">
                              {transaction.variations
                                .map((v) => {
                                  // Decode HTML entities like &quot;
                                  const value = v.formatted_value
                                    ?.replace(/&quot;/g, '"')
                                    .replace(/&amp;/g, "&")
                                    .replace(/&lt;/g, "<")
                                    .replace(/&gt;/g, ">")
                                    .replace(/&#39;/g, "'");
                                  return `${v.formatted_name}: ${value}`;
                                })
                                .join(" | ")}
                            </div>
                          </div>
                        )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <div className="text-sm text-gray-500">Product Name</div>
                    <div className="font-medium text-gray-900">
                      {order.product_name || "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 flex items-center justify-between">
                      SKU
                      {!editingSku && (
                        <button
                          onClick={() => setEditingSku(true)}
                          className="text-xs text-blue-600 hover:text-blue-700"
                        >
                          ✏️ Edit
                        </button>
                      )}
                    </div>
                    {editingSku ? (
                      <div className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={sku}
                          onChange={(e) => setSku(e.target.value)}
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                          placeholder="Enter SKU"
                        />
                        <button
                          onClick={handleSaveSku}
                          className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditingSku(false);
                            setSku(order.product_sku || "");
                          }}
                          className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="text-gray-900">
                        {renderSKU(
                          order.product_sku,
                          order.raw_order_data?.transactions?.[0]?.sku
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Quantity</div>
                    <div className="text-gray-900">{order.quantity}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Customer Enrichment Data */}
            {(order.enrichment_submitted_at ||
              order.customer_notes ||
              order.custom_images?.length > 0 ||
              order.raw_order_data?.customer_enrichment_text ||
              order.raw_order_data?.customer_enrichment?.length > 0) && (
              <div className="bg-white rounded-lg border border-gray-300 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  📝 Customer Enrichment
                </h2>
                <div className="space-y-4">
                  {/* Header info */}
                  {order.enrichment_submitted_at && (
                    <div>
                      <div className="text-sm text-gray-500">Submitted At</div>
                      <div className="text-gray-900">
                        {new Date(
                          order.enrichment_submitted_at
                        ).toLocaleString()}
                      </div>
                    </div>
                  )}
                  {order.enrichment_email && (
                    <div>
                      <div className="text-sm text-gray-500">Email</div>
                      <div className="text-gray-900">
                        <a
                          href={`mailto:${order.enrichment_email}`}
                          className="text-blue-600 hover:underline"
                        >
                          {order.enrichment_email}
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Per-item enrichment (new format) */}
                  {order.raw_order_data?.customer_enrichment?.length > 0 && (
                    <div>
                      <div className="text-sm text-gray-500 mb-3 font-medium">
                        Personalization by Item
                      </div>
                      <div className="space-y-4">
                        {order.raw_order_data.customer_enrichment.map(
                          (item, idx) => {
                            const transaction =
                              order.raw_order_data.transactions?.find(
                                (t) => t.transaction_id === item.transactionId
                              );
                            return (
                              <div
                                key={idx}
                                className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                              >
                                <div className="font-medium text-gray-900 mb-2">
                                  Item {idx + 1}:{" "}
                                  {transaction?.title || item.sku}
                                </div>
                                <div className="text-xs text-gray-500 mb-3">
                                  SKU: {item.sku} • Transaction ID:{" "}
                                  {item.transactionId}
                                </div>
                                {item.customText && (
                                  <div className="mb-3">
                                    <div className="text-xs text-gray-500 mb-1">
                                      Custom Text:
                                    </div>
                                    <div className="bg-white rounded p-2 text-sm text-gray-900 border border-gray-200">
                                      {item.customText}
                                    </div>
                                  </div>
                                )}
                                {item.uploadedFiles?.length > 0 && (
                                  <div>
                                    <div className="text-xs text-gray-500 mb-1">
                                      Uploaded Files (
                                      {item.uploadedFiles.length}
                                      ):
                                    </div>
                                    <div className="space-y-1">
                                      {item.uploadedFiles.map((file, fIdx) => (
                                        <div
                                          key={fIdx}
                                          className="flex items-center justify-between bg-white p-2 rounded text-xs border border-gray-200"
                                        >
                                          <div>
                                            <div className="font-medium text-gray-900">
                                              {file.fileName}
                                            </div>
                                            <div className="text-gray-500">
                                              {(
                                                file.fileSize /
                                                1024 /
                                                1024
                                              ).toFixed(2)}{" "}
                                              MB • {file.fileType}
                                            </div>
                                          </div>
                                          <div className="text-gray-400 text-xs">
                                            {file.filePath}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          }
                        )}
                      </div>
                    </div>
                  )}

                  {/* Legacy single-item format (backward compatibility) */}
                  {order.raw_order_data?.customer_enrichment_text && (
                    <div>
                      <div className="text-sm text-gray-500">Custom Text</div>
                      <div className="bg-blue-50 rounded p-3 text-gray-900 text-sm">
                        {order.raw_order_data.customer_enrichment_text}
                      </div>
                    </div>
                  )}

                  {/* General notes */}
                  {order.customer_notes && (
                    <div>
                      <div className="text-sm text-gray-500">
                        Additional Notes
                      </div>
                      <div className="bg-gray-50 rounded p-3 text-gray-900 text-sm">
                        {order.customer_notes}
                      </div>
                    </div>
                  )}

                  {/* Legacy images list (backward compatibility) */}
                  {order.custom_images?.length > 0 &&
                    !order.raw_order_data?.customer_enrichment && (
                      <div>
                        <div className="text-sm text-gray-500 mb-2">
                          Uploaded Images ({order.custom_images.length})
                        </div>
                        <div className="space-y-2">
                          {order.custom_images.map((img, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between bg-gray-50 p-3 rounded"
                            >
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {img.fileName}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {(img.fileSize / 1024 / 1024).toFixed(2)} MB •{" "}
                                  {img.fileType}
                                </div>
                              </div>
                              <div className="text-xs text-gray-400">
                                {img.filePath}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="bg-white rounded-lg border border-gray-300 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Internal Notes
                </h2>
                {!editing && (
                  <button
                    onClick={() => setEditing(true)}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Edit
                  </button>
                )}
              </div>
              {editing ? (
                <>
                  {saveError && (
                    <div className="mb-3 p-3 rounded bg-red-50 border border-red-200 text-red-800 text-sm">
                      {saveError}
                    </div>
                  )}
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Add internal notes..."
                  />
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={handleSaveNotes}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditing(false);
                        setNotes(order.internal_notes || "");
                        setSaveError(null);
                      }}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-gray-600">
                  {order.internal_notes || "No notes yet"}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Source Information */}
            <div className="bg-white rounded-lg border border-gray-300 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Order Source
              </h2>
              <div className="space-y-3">
                <div>
                  <div className="text-sm text-gray-500">Platform</div>
                  <div className="font-medium text-gray-900 capitalize">
                    {order.stores?.platform || order.platform}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Store</div>
                  <div className="text-gray-900">
                    {order.stores?.store_name || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">External Order ID</div>
                  <div className="text-gray-900 font-mono text-sm">
                    {order.external_order_id}
                  </div>
                </div>
                <div>
                  <a
                    href={`https://www.etsy.com/your/orders/sold?order_id=${order.external_order_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    View on Etsy →
                  </a>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="bg-white rounded-lg border border-gray-300 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Timeline
              </h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Created</span>
                  <span className="text-gray-900">
                    {new Date(order.created_at).toLocaleDateString()}
                  </span>
                </div>
                {order.enrichment_submitted_at && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Ready for Design</span>
                    <span className="text-gray-900">
                      {new Date(
                        order.enrichment_submitted_at
                      ).toLocaleDateString()}
                    </span>
                  </div>
                )}
                {order.design_completed_at && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Design Complete</span>
                    <span className="text-gray-900">
                      {new Date(order.design_completed_at).toLocaleDateString()}
                    </span>
                  </div>
                )}
                {order.shipped_at && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Shipped</span>
                    <span className="text-gray-900">
                      {new Date(order.shipped_at).toLocaleDateString()}
                    </span>
                  </div>
                )}
                {order.delivered_at && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Delivered</span>
                    <span className="text-gray-900">
                      {new Date(order.delivered_at).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Raw Receipt Data (for debugging missing info) */}
            {order.raw_order_data?.receipt && (
              <details className="bg-white rounded-lg border border-gray-300 p-6">
                <summary className="text-sm font-semibold text-gray-900 cursor-pointer hover:text-blue-600">
                  🔍 Debug: Raw Etsy Data
                </summary>
                <div className="mt-4 p-3 bg-gray-50 rounded overflow-auto max-h-96 text-xs font-mono">
                  <div className="mb-4">
                    <div className="font-semibold text-gray-700 mb-2">
                      Receipt Info:
                    </div>
                    <div>
                      Name: {order.raw_order_data.receipt.name || "MISSING"}
                    </div>
                    <div>
                      Email:{" "}
                      {order.raw_order_data.receipt.buyer_email || "MISSING"}
                    </div>
                    <div>
                      Address Line 1:{" "}
                      {order.raw_order_data.receipt.first_line || "MISSING"}
                    </div>
                    <div>
                      Address Line 2:{" "}
                      {order.raw_order_data.receipt.second_line || "(none)"}
                    </div>
                    <div>
                      City: {order.raw_order_data.receipt.city || "MISSING"}
                    </div>
                    <div>
                      State: {order.raw_order_data.receipt.state || "MISSING"}
                    </div>
                    <div>
                      ZIP: {order.raw_order_data.receipt.zip || "MISSING"}
                    </div>
                    <div>
                      Country:{" "}
                      {order.raw_order_data.receipt.country_iso || "MISSING"}
                    </div>
                  </div>
                  <pre className="whitespace-pre-wrap text-xs">
                    {JSON.stringify(order.raw_order_data, null, 2)}
                  </pre>
                </div>
              </details>
            )}
          </div>
        </div>
      </div>

      {/* Flag for Review Modal */}
      {showFlagModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              🚩 Flag Order for Review
            </h3>
            <p className="text-gray-700 mb-4">
              Flag order{" "}
              <span className="font-semibold">#{order.order_number}</span> for
              review?
            </p>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason (optional)
              </label>
              <textarea
                value={flagReason}
                onChange={(e) => setFlagReason(e.target.value)}
                placeholder="e.g., Missing information, quality concern, customer request..."
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-red-500 focus:border-transparent"
                rows="3"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowFlagModal(false);
                  setFlagReason("");
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleFlagForReview}
                disabled={changingStatus}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-medium disabled:opacity-50"
              >
                Flag for Review
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

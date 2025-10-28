"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function OrdersClient({ user }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [total, setTotal] = useState(0);
  const [syncStatus, setSyncStatus] = useState(null); // { type: 'success'|'error', message: string }
  const [uploading, setUploading] = useState(false);
  const [editingStatus, setEditingStatus] = useState(null); // { orderId: string, status: string }
  const [selectedOrders, setSelectedOrders] = useState(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [hoveredOrder, setHoveredOrder] = useState(null);
  const [flaggingOrder, setFlaggingOrder] = useState(null); // { orderId, orderNumber }
  const [flagReason, setFlagReason] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadOrders();
    loadLastSyncTime();
    setSelectedOrders(new Set()); // Clear selections when filters change
  }, [filter, search, page]);

  // Reset to page 1 when filter or search changes
  useEffect(() => {
    setPage(1);
  }, [filter, search]);

  async function loadOrders() {
    try {
      setLoading(true);
      const offset = (page - 1) * limit;
      const params = new URLSearchParams({
        status: filter,
        search: search,
        limit: limit.toString(),
        offset: offset.toString(),
      });

      const response = await fetch(`/api/orders?${params}`);
      const data = await response.json();

      setOrders(data.orders || []);
      setTotal(data.total || 0);
      setTotalPages(Math.ceil((data.total || 0) / limit));
    } catch (error) {
      console.error("Failed to load orders:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadLastSyncTime() {
    try {
      const response = await fetch("/api/stores");
      const data = await response.json();
      const stores = data.stores || [];

      // Find the most recent sync time across all stores
      const mostRecent = stores.reduce((latest, store) => {
        if (!store.last_sync_timestamp) return latest;
        const storeTime = new Date(store.last_sync_timestamp);
        return !latest || storeTime > new Date(latest)
          ? store.last_sync_timestamp
          : latest;
      }, null);

      setLastSyncTime(mostRecent);
    } catch (error) {
      console.error("Failed to load last sync time:", error);
    }
  }

  async function handleSync() {
    try {
      setSyncing(true);
      setSyncStatus(null);

      const response = await fetch("/api/orders/sync", {
        method: "POST",
      });

      const data = await response.json();
      console.log("Sync response:", data);

      if (data.success) {
        setSyncStatus({
          type: "success",
          message: `✓ Auto-import complete! Imported: ${data.total_imported}, Skipped: ${data.total_skipped}`,
        });
        loadOrders();
        loadLastSyncTime();
        // Auto-dismiss after 5 seconds
        setTimeout(() => setSyncStatus(null), 5000);
      } else {
        // Error - don't auto-dismiss
        setSyncStatus({
          type: "error",
          message: data.error || "Sync failed",
        });
      }
    } catch (error) {
      console.error("Sync error:", error);
      setSyncStatus({
        type: "error",
        message: `Sync failed: ${error.message}`,
      });
    } finally {
      setSyncing(false);
    }
  }

  async function handlePDFUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    try {
      setUploading(true);
      setSyncStatus({
        type: "info",
        message: `📄 Processing ${files.length} PDF file(s)...`,
      });

      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append("pdfs", files[i]);
      }

      const response = await fetch("/api/orders/upload-pdfs", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setSyncStatus({
          type: "success",
          message: `✓ PDF processing complete! Updated: ${
            data.updated
          }, Failed: ${data.failed || 0}`,
        });
        // Reload orders to show updated information
        loadOrders();
        setTimeout(() => setSyncStatus(null), 8000);
      } else {
        setSyncStatus({
          type: "error",
          message: `PDF processing failed: ${data.error}`,
        });
      }
    } catch (error) {
      setSyncStatus({
        type: "error",
        message: `PDF upload failed: ${error.message}`,
      });
    } finally {
      setUploading(false);
      // Reset file input
      event.target.value = "";
    }
  }

  async function handleStatusChange(orderId, newStatus) {
    try {
      const response = await fetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error("Failed to update status");
      }

      // Update local state immediately
      setOrders((prevOrders) =>
        prevOrders.map((order) =>
          order.id === orderId ? { ...order, status: newStatus } : order
        )
      );
      setEditingStatus(null);
    } catch (error) {
      console.error("Failed to update status:", error);
      setSyncStatus({
        type: "error",
        message: "Failed to update status. Please try again.",
      });
    }
  }

  function toggleSelectAll() {
    if (selectedOrders.size === orders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(orders.map((order) => order.id)));
    }
  }

  function toggleSelectOrder(orderId) {
    const newSelected = new Set(selectedOrders);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
    } else {
      newSelected.add(orderId);
    }
    setSelectedOrders(newSelected);
  }

  function getMissingDataWarning(order) {
    const missing = [];

    if (!order.customer_email) {
      missing.push("email");
    }

    if (
      !order.shipping_address_line1 ||
      !order.shipping_city ||
      !order.shipping_state ||
      !order.shipping_zip
    ) {
      missing.push("shipping address");
    }

    if (missing.length === 0) return null;

    return {
      hasWarning: true,
      message: `Missing ${missing.join(
        " and "
      )}. Upload PDFs to fill this data.`,
    };
  }

  async function handleBulkDelete() {
    try {
      setDeleting(true);
      setSyncStatus({
        type: "info",
        message: `Deleting ${selectedOrders.size} order(s)...`,
      });

      const response = await fetch("/api/orders/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: Array.from(selectedOrders) }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete orders");
      }

      const data = await response.json();

      setSyncStatus({
        type: "success",
        message: `✓ Successfully deleted ${data.deleted} order(s)`,
      });

      setSelectedOrders(new Set());
      setShowDeleteModal(false);
      loadOrders(); // Refresh the list

      setTimeout(() => setSyncStatus(null), 5000);
    } catch (error) {
      console.error("Failed to delete orders:", error);
      setSyncStatus({
        type: "error",
        message: "Failed to delete orders. Please try again.",
      });
    } finally {
      setDeleting(false);
    }
  }

  async function handleFlagForReview() {
    if (!flaggingOrder) return;

    try {
      const response = await fetch(
        `/api/orders/${flaggingOrder.orderId}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "needs_review",
            review_reason: flagReason || "Flagged for review",
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to flag order");
      }

      setSyncStatus({
        type: "success",
        message: `✓ Order #${flaggingOrder.orderNumber} flagged for review`,
      });

      setFlaggingOrder(null);
      setFlagReason("");
      loadOrders();

      setTimeout(() => setSyncStatus(null), 5000);
    } catch (error) {
      console.error("Failed to flag order:", error);
      setSyncStatus({
        type: "error",
        message: "Failed to flag order. Please try again.",
      });
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

  const statusOptions = [
    { value: "all", label: "All Orders", count: total },
    { value: "pending_enrichment", label: "Pending Enrichment" },
    { value: "needs_review", label: "Needs Review" },
    { value: "ready_for_design", label: "Ready for Design" },
    { value: "design_complete", label: "Design Complete" },
    { value: "labels_generated", label: "Labels Generated" },
    { value: "loaded_for_shipment", label: "Loaded" },
    { value: "in_transit", label: "In Transit" },
    { value: "delivered", label: "Delivered" },
  ];

  function getStatusColor(status) {
    const colors = {
      pending_enrichment: "bg-yellow-100 text-yellow-800",
      enriched: "bg-blue-100 text-blue-800", // Keep for legacy orders
      needs_review: "bg-red-100 text-red-800",
      ready_for_design: "bg-purple-100 text-purple-800",
      design_complete: "bg-green-100 text-green-800",
      labels_generated: "bg-indigo-100 text-indigo-800",
      loaded_for_shipment: "bg-cyan-100 text-cyan-800",
      in_transit: "bg-blue-100 text-blue-800",
      delivered: "bg-green-100 text-green-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Orders</h1>
          <p className="text-gray-600 mt-2">
            {total} {total === 1 ? "order" : "orders"} total
          </p>
        </div>
        <div className="flex gap-3 items-center">
          <div className="flex flex-col items-end gap-1">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {syncing ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4 text-white"
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
                  Importing...
                </>
              ) : (
                <>🔄 Auto-Import</>
              )}
            </button>
            {lastSyncTime && (
              <span className="text-xs text-gray-500">
                Last:{" "}
                {new Date(lastSyncTime).toLocaleString("en-US", {
                  timeZone: "America/Los_Angeles",
                  month: "numeric",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: true,
                })}{" "}
                PT
              </span>
            )}
          </div>
          <div className="flex flex-col items-center gap-1">
            <label
              className={`px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors flex items-center gap-2 cursor-pointer ${
                uploading ? "opacity-50 cursor-not-allowed" : ""
              }`}
              title="Upload PDFs to fill in detailed customer info including addresses. Export PDFs from your Etsy Orders page."
            >
              <input
                type="file"
                accept=".pdf"
                multiple
                onChange={handlePDFUpload}
                disabled={uploading}
                className="hidden"
              />
              {uploading ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4 text-white"
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
                  Processing...
                </>
              ) : (
                <>📄 Upload PDFs</>
              )}
            </label>
            <span className="text-xs text-gray-500">
              Fills addresses & emails
            </span>
          </div>

          {/* Bulk Delete Button */}
          {selectedOrders.size > 0 && (
            <button
              onClick={() => setShowDeleteModal(true)}
              disabled={deleting}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              title={`Delete ${selectedOrders.size} selected order(s)`}
            >
              🗑️ Delete {selectedOrders.size} Order
              {selectedOrders.size !== 1 ? "s" : ""}
            </button>
          )}
        </div>
      </div>

      {/* Sync Status Message */}
      {syncStatus && (
        <div
          className={`mb-6 p-4 rounded-lg border ${
            syncStatus.type === "success"
              ? "bg-green-50 border-green-200 text-green-800"
              : syncStatus.type === "info"
              ? "bg-blue-50 border-blue-200 text-blue-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{syncStatus.message}</span>
            <button
              onClick={() => setSyncStatus(null)}
              className="text-sm hover:opacity-70"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-300 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Status Filter */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Status
            </label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Search
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Order #, customer name, email..."
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-lg border border-gray-300 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-600">Loading...</div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-6xl mb-4">📦</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No orders found
            </h3>
            <p className="text-gray-600 mb-6">
              Sync your Etsy stores to import orders
            </p>
            <button
              onClick={handleSync}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Sync Orders Now
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase w-12">
                    <input
                      type="checkbox"
                      checked={
                        orders.length > 0 &&
                        selectedOrders.size === orders.length
                      }
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      title="Select all orders"
                    />
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Order #
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Store
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Customer
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Product
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Personalization
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Date
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200 text-xs">
                {orders.map((order) => {
                  // Extract personalization from raw_order_data
                  const personalization =
                    order.raw_order_data?.transactions?.[0]?.variations?.find(
                      (v) => v.formatted_name === "Personalization"
                    )?.formatted_value || "-";

                  // Check if order has multiple items
                  const transactions = order.raw_order_data?.transactions || [];
                  const hasMultipleItems = transactions.length > 1;

                  const isNeedsReview = order.status === "needs_review";

                  // Check for missing data
                  const missingData = getMissingDataWarning(order);

                  return (
                    <tr
                      key={order.id}
                      className={`cursor-pointer ${
                        isNeedsReview
                          ? "bg-red-50 hover:bg-red-100"
                          : "hover:bg-gray-50"
                      }`}
                      onDoubleClick={() => {
                        window.location.href = `/orders/${order.id}`;
                      }}
                    >
                      <td
                        className="px-3 py-2 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={selectedOrders.has(order.id)}
                          onChange={() => toggleSelectOrder(order.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          title="Select this order"
                        />
                      </td>
                      <td
                        className="px-3 py-2 whitespace-nowrap"
                        title={`Order #${order.order_number}`}
                      >
                        <div className="flex items-center gap-2">
                          {missingData && (
                            <span
                              className="text-yellow-500 text-base cursor-help"
                              title={missingData.message}
                            >
                              ⚠️
                            </span>
                          )}
                          <div className="text-xs font-medium text-gray-900">
                            #{order.order_number}
                          </div>
                        </div>
                      </td>
                      <td
                        className="px-3 py-2 whitespace-nowrap"
                        title={order.stores?.store_name || "—"}
                      >
                        <div className="text-xs text-gray-900">
                          {order.stores?.store_name || "—"}
                        </div>
                      </td>
                      <td
                        className="px-3 py-2 max-w-[150px]"
                        title={`${order.customer_name}\n${
                          order.customer_email || ""
                        }`}
                      >
                        <div className="text-xs text-gray-900 truncate">
                          {order.customer_name}
                        </div>
                      </td>
                      <td
                        className="px-3 py-2 max-w-[120px] relative"
                        onMouseEnter={() =>
                          hasMultipleItems && setHoveredOrder(order.id)
                        }
                        onMouseLeave={() => setHoveredOrder(null)}
                      >
                        {hasMultipleItems ? (
                          <>
                            <div className="text-xs text-gray-900 font-medium">
                              {transactions.length} Items
                            </div>
                            {hoveredOrder === order.id && (
                              <div className="absolute z-50 left-0 top-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-3 min-w-[300px]">
                                <div className="text-xs font-semibold text-gray-900 mb-2">
                                  Order Items:
                                </div>
                                <div className="space-y-2">
                                  {transactions.map((txn, idx) => {
                                    const enhancedSku =
                                      enhanceSKUWithDimensions(
                                        txn.sku,
                                        txn.variations
                                      );
                                    return (
                                      <div
                                        key={txn.transaction_id || idx}
                                        className="text-xs border-b border-gray-100 pb-2 last:border-b-0"
                                      >
                                        <div className="font-medium text-gray-900">
                                          {txn.title || "Unknown Product"}
                                        </div>
                                        <div className="text-gray-600">
                                          SKU: {renderSKU(enhancedSku, txn.sku)}{" "}
                                          • Qty: {txn.quantity || 1}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <div
                            className="text-xs text-gray-900 truncate"
                            title={`${order.product_sku}\n${
                              order.product_name || ""
                            }`}
                          >
                            {renderSKU(
                              order.product_sku,
                              order.raw_order_data?.transactions?.[0]?.sku
                            )}
                          </div>
                        )}
                      </td>
                      <td
                        className="px-3 py-2 max-w-[200px]"
                        title={personalization}
                      >
                        <div className="text-xs text-gray-900 truncate">
                          {personalization}
                        </div>
                      </td>
                      <td
                        className="px-3 py-2 whitespace-nowrap"
                        title={order.status.replace(/_/g, " ")}
                      >
                        {editingStatus?.orderId === order.id ? (
                          <select
                            value={editingStatus.status}
                            onChange={(e) => {
                              handleStatusChange(order.id, e.target.value);
                            }}
                            onBlur={() => setEditingStatus(null)}
                            autoFocus
                            className={`px-2 py-0.5 text-xs font-semibold rounded cursor-pointer focus:ring-2 focus:ring-blue-500 focus:outline-none ${getStatusColor(
                              editingStatus.status
                            )}`}
                          >
                            <option value="pending_enrichment">
                              Pending Enrichment
                            </option>
                            <option value="needs_review">Needs Review</option>
                            <option value="ready_for_design">
                              Ready for Design
                            </option>
                            <option value="design_complete">
                              Design Complete
                            </option>
                            <option value="labels_generated">
                              Labels Generated
                            </option>
                            <option value="loaded_for_shipment">
                              Loaded for Shipment
                            </option>
                            <option value="in_transit">In Transit</option>
                            <option value="delivered">Delivered</option>
                          </select>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 text-xs font-semibold rounded ${getStatusColor(
                                order.status
                              )}`}
                            >
                              {order.status.replace(/_/g, " ")}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingStatus({
                                  orderId: order.id,
                                  status: order.status,
                                });
                              }}
                              className="text-gray-400 hover:text-gray-600 transition-colors"
                              title="Edit status"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-4 w-4"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                              >
                                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </td>
                      <td
                        className="px-3 py-2 whitespace-nowrap text-xs text-gray-500"
                        title={new Date(order.order_date).toLocaleString()}
                      >
                        {new Date(order.order_date).toLocaleDateString(
                          "en-US",
                          {
                            month: "short",
                            day: "numeric",
                          }
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-right text-xs">
                        <div className="flex gap-2 justify-end items-center">
                          {!isNeedsReview && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFlaggingOrder({
                                    orderId: order.id,
                                    orderNumber: order.order_number,
                                  });
                                }}
                                className="text-red-600 hover:text-red-800 font-medium"
                                title="Flag for review"
                              >
                                🚩 Flag
                              </button>
                              <span className="text-gray-300">|</span>
                            </>
                          )}
                          <Link
                            href={`/orders/${order.id}`}
                            className="text-blue-600 hover:text-blue-900 font-medium"
                          >
                            View
                          </Link>
                          <span className="text-gray-300">|</span>
                          <a
                            href={`https://www.etsy.com/your/orders/sold?order_id=${order.external_order_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 bg-orange-100 text-orange-700 hover:bg-orange-200 rounded font-medium"
                            title="View on Etsy"
                          >
                            Etsy ↗
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {!loading && total > 0 && (
          <div className="mt-6 flex items-center justify-between px-4">
            <div className="text-sm text-gray-600">
              Showing {(page - 1) * limit + 1} to{" "}
              {Math.min(page * limit, total)} of {total} orders
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                ← Previous
              </button>
              <span className="text-sm text-gray-600">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Flag for Review Modal */}
      {flaggingOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              🚩 Flag Order for Review
            </h3>
            <p className="text-gray-700 mb-4">
              Flag order{" "}
              <span className="font-semibold">
                #{flaggingOrder.orderNumber}
              </span>{" "}
              for review?
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
                  setFlaggingOrder(null);
                  setFlagReason("");
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleFlagForReview}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-medium"
              >
                Flag for Review
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Confirm Deletion
            </h3>
            <p className="text-gray-700 mb-6">
              Are you sure you want to delete{" "}
              <span className="font-semibold">{selectedOrders.size}</span> order
              {selectedOrders.size !== 1 ? "s" : ""}? This action cannot be
              undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
              >
                {deleting ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4"
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
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

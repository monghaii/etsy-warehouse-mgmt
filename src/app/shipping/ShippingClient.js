"use client";

import { useState, useRef, useEffect } from "react";

export default function ShippingClient() {
  const [showScanModal, setShowScanModal] = useState(false);
  const [barcode, setBarcode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState(null); // { type: 'success' | 'error', message: '', order: {} }
  const [loadedOrders, setLoadedOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const barcodeInputRef = useRef(null);

  // Fetch loaded orders on mount
  useEffect(() => {
    fetchLoadedOrders();
  }, []);

  // Auto-focus input when modal opens
  useEffect(() => {
    if (showScanModal && barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, [showScanModal]);

  async function fetchLoadedOrders() {
    try {
      const response = await fetch("/api/shipping/loaded-orders");
      const data = await response.json();
      setLoadedOrders(data.orders || []);
    } catch (error) {
      console.error("Failed to fetch loaded orders:", error);
    } finally {
      setLoading(false);
    }
  }

  function openScanModal() {
    setShowScanModal(true);
    setBarcode("");
    setScanStatus(null);
  }

  function closeScanModal() {
    setShowScanModal(false);
    setBarcode("");
    setScanStatus(null);
  }

  async function handleScan(e) {
    e.preventDefault();
    if (!barcode.trim() || scanning) return;

    setScanning(true);
    setScanStatus(null);

    try {
      const response = await fetch("/api/orders/load-for-shipment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tracking_number: barcode.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        setScanStatus({
          type: "error",
          message: data.error || "Failed to load order",
        });
        return;
      }

      // Success - reload loaded orders from database
      setScanStatus({
        type: "success",
        message: `✓ Marked as Loaded for Shipment`,
        order: data.order,
      });

      // Refresh the loaded orders list
      await fetchLoadedOrders();

      // Clear input after 2 seconds
      setTimeout(() => {
        setBarcode("");
        setScanStatus(null);
        barcodeInputRef.current?.focus();
      }, 2000);
    } catch (error) {
      console.error("Scan error:", error);
      setScanStatus({
        type: "error",
        message: "Failed to process scan. Please try again.",
      });
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Shipping</h1>
            <p className="mt-2 text-gray-600">
              Scan tracking numbers to mark orders as loaded for shipment
            </p>
          </div>

          {/* Big Scan Button */}
          <div className="bg-white shadow rounded-lg p-12">
            <div className="text-center">
              <button
                onClick={openScanModal}
                className="inline-flex items-center gap-3 px-12 py-6 bg-blue-600 text-white text-2xl font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-lg"
              >
                📦 Start Scanning for Shipment
              </button>
            </div>
          </div>

          {/* Preparing for Shipment Queue */}
          {loading ? (
            <div className="mt-8 bg-white shadow rounded-lg p-6">
              <div className="text-center text-gray-500">Loading...</div>
            </div>
          ) : loadedOrders.length > 0 ? (
            <div className="mt-8 bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Loaded for shipment ({loadedOrders.length})
              </h2>
              <div className="space-y-3">
                {loadedOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg"
                  >
                    <div>
                      <div className="font-medium text-gray-900">
                        Order #{order.order_number}
                      </div>
                      <div className="text-sm text-gray-600">
                        {order.customer_name} • {order.tracking_number}
                      </div>
                      <div className="text-xs text-gray-500">
                        {order.shipping_address_line1}, {order.shipping_city},{" "}
                        {order.shipping_state} {order.shipping_zip}
                      </div>
                    </div>
                    <div className="text-sm text-green-600 font-medium">
                      ✓ Loaded{" "}
                      {(() => {
                        // Ensure UTC timestamp is parsed correctly
                        const timestamp = order.loaded_for_shipment_at;
                        const utcTimestamp = timestamp.endsWith("Z")
                          ? timestamp
                          : timestamp + "Z";
                        const date = new Date(utcTimestamp);

                        // Convert to LA timezone
                        return (
                          date.toLocaleString("en-US", {
                            timeZone: "America/Los_Angeles",
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                            hour12: true,
                          }) + " PT"
                        );
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </main>

      {/* Scanning Modal */}
      {showScanModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeScanModal();
          }}
        >
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-2xl w-full mx-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                Scan Tracking Numbers
              </h2>
              <button
                onClick={closeScanModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <form onSubmit={handleScan} className="space-y-6">
              <div>
                <label
                  htmlFor="barcode"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Scan or Enter Tracking Number
                </label>
                <input
                  ref={barcodeInputRef}
                  type="text"
                  id="barcode"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="Scan barcode or type tracking number..."
                  disabled={scanning}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                />
              </div>

              {/* Status Messages */}
              {scanStatus && (
                <div
                  className={`p-4 rounded-lg ${
                    scanStatus.type === "success"
                      ? "bg-green-50 border border-green-200"
                      : "bg-red-50 border border-red-200"
                  }`}
                >
                  {scanStatus.type === "success" ? (
                    <div>
                      <div className="text-lg font-semibold text-green-800 mb-2">
                        {scanStatus.message}
                      </div>
                      <div className="text-sm text-green-700">
                        <div className="font-medium">
                          Order #{scanStatus.order.order_number}
                        </div>
                        <div>{scanStatus.order.customer_name}</div>
                        <div className="text-xs mt-1">
                          {scanStatus.order.shipping_address_line1},{" "}
                          {scanStatus.order.shipping_city},{" "}
                          {scanStatus.order.shipping_state}{" "}
                          {scanStatus.order.shipping_zip}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm font-medium text-red-800">
                      {scanStatus.message}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closeScanModal}
                  className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                >
                  Done
                </button>
                <button
                  type="submit"
                  disabled={scanning || !barcode.trim()}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {scanning ? "Processing..." : "Scan"}
                </button>
              </div>
            </form>

            <div className="mt-6 text-center text-sm text-gray-500">
              Scanned {loadedOrders.length} order(s) this session
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

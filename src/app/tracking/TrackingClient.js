"use client";

import { useState, useEffect } from "react";

export default function TrackingClient() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [updateStatus, setUpdateStatus] = useState(null);

  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders() {
    try {
      const response = await fetch("/api/tracking/in-transit");
      const data = await response.json();
      setOrders(data.orders || []);
    } catch (error) {
      console.error("Failed to load orders:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateAll() {
    try {
      setUpdating(true);
      setUpdateStatus(null);

      const response = await fetch("/api/tracking/update-all", {
        method: "POST",
      });

      const data = await response.json();

      if (data.success) {
        setUpdateStatus({
          type: "success",
          message: `✓ Updated ${data.updated} order(s) to in-transit status. ${data.alreadyInTransit} already in transit. ${data.errors} errors.`,
        });
        loadOrders(); // Reload orders to show newly in-transit ones
        setTimeout(() => setUpdateStatus(null), 8000);
      } else {
        setUpdateStatus({
          type: "error",
          message: data.error || "Failed to update tracking",
        });
      }
    } catch (error) {
      console.error("Failed to update tracking:", error);
      setUpdateStatus({
        type: "error",
        message: `Failed to update tracking: ${error.message}`,
      });
    } finally {
      setUpdating(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="text-center py-12">
          <div className="text-gray-600">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Update Status Message */}
      {updateStatus && (
        <div
          className={`p-4 rounded-lg border ${
            updateStatus.type === "success"
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <pre className="text-sm font-medium whitespace-pre-wrap font-sans flex-1">
              {updateStatus.message}
            </pre>
            <button
              onClick={() => setUpdateStatus(null)}
              className="text-sm hover:opacity-70 flex-shrink-0"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Header with Update Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            In-Transit Orders
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Orders currently being shipped
          </p>
        </div>
        <button
          onClick={handleUpdateAll}
          disabled={updating}
          className={`px-4 py-2 rounded font-medium transition-colors ${
            updating
              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
              : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
        >
          {updating ? (
            <>
              <svg
                className="animate-spin inline-block h-4 w-4 mr-2"
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
              Updating...
            </>
          ) : (
            "🔄 Update Tracking for All Orders"
          )}
        </button>
      </div>

      {/* Orders List */}
      {orders.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-6">
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📦</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No In-Transit Orders
            </h3>
            <p className="text-gray-500">
              Orders will appear here once they're in transit. Click "Update
              Tracking for All Orders" to check tracking status.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Order #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Tracking Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Shipped Date
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      #{order.order_number}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {order.customer_name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {order.shipping_city}, {order.shipping_state}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <a
                      href={`https://tools.usps.com/go/TrackConfirmAction?tLabels=${order.tracking_number}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-800 font-mono"
                    >
                      {order.tracking_number}
                    </a>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {order.loaded_for_shipment_at
                        ? new Date(
                            order.loaded_for_shipment_at
                          ).toLocaleDateString()
                        : "-"}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <a
                      href={`/orders/${order.id}`}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      View Order
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary */}
      {orders.length > 0 && (
        <div className="text-sm text-gray-600 text-center">
          Showing {orders.length} order{orders.length !== 1 ? "s" : ""} in
          transit
        </div>
      )}
    </div>
  );
}

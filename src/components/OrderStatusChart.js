"use client";

import { useEffect, useState } from "react";

export default function OrderStatusChart() {
  const [chartData, setChartData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      const response = await fetch("/api/dashboard/stats");
      const data = await response.json();
      setChartData(data.chartData || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 rounded-lg bg-white border border-gray-300 mb-8">
        <h2 className="text-lg font-semibold mb-4 text-gray-900">
          Order Distribution
        </h2>
        <div className="h-64 flex items-center justify-center">
          <div className="text-gray-500">Loading...</div>
        </div>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="p-6 rounded-lg bg-white border border-gray-300 mb-8">
        <h2 className="text-lg font-semibold mb-4 text-gray-900">
          Order Distribution
        </h2>
        <div className="h-64 flex items-center justify-center">
          <div className="text-gray-500">No orders yet</div>
        </div>
      </div>
    );
  }

  // Workflow order (left to right)
  const statusOrder = [
    "pending_enrichment",
    "needs_review",
    "ready_for_design",
    "design_complete",
    "in_production",
    "labels_generated",
    "loaded_for_shipment",
    "pending_fulfillment",
    "in_transit",
    "delivered",
  ];

  // Color mapping matching order badges
  const statusColors = {
    pending_enrichment: "bg-yellow-500",
    needs_review: "bg-red-500",
    ready_for_design: "bg-purple-500",
    design_complete: "bg-green-500",
    in_production: "bg-blue-500",
    labels_generated: "bg-indigo-500",
    loaded_for_shipment: "bg-cyan-500",
    pending_fulfillment: "bg-orange-500",
    in_transit: "bg-blue-400",
    delivered: "bg-green-600",
  };

  // Sort data by workflow order
  const sortedData = [...chartData].sort((a, b) => {
    const aIndex = statusOrder.indexOf(a.statusKey);
    const bIndex = statusOrder.indexOf(b.statusKey);
    return aIndex - bIndex;
  });

  const maxCount = Math.max(...sortedData.map((d) => d.count));

  return (
    <div className="p-6 rounded-lg bg-white border border-gray-300 mb-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">
          Order Distribution by Status
        </h2>
        <div className="text-sm text-gray-600">
          Total Orders:{" "}
          <span className="font-semibold text-gray-900">{total}</span>
        </div>
      </div>

      {/* Vertical Bar Chart - Histogram */}
      <div className="relative">
        {/* Chart container */}
        <div className="flex items-end justify-between gap-3 h-80 px-4 mb-12">
          {sortedData.map((item) => {
            const heightPercentage =
              maxCount > 0 ? (item.count / maxCount) * 100 : 0;
            const color = statusColors[item.statusKey] || "bg-gray-500";

            return (
              <div
                key={item.statusKey}
                className="flex-1 flex flex-col items-center h-full"
              >
                {/* Count label at top */}
                <div className="text-sm font-semibold text-gray-700 mb-2">
                  {item.count}
                </div>

                {/* Bar container */}
                <div className="w-full flex-1 flex flex-col justify-end">
                  <div
                    className={`${color} w-full rounded-t transition-all duration-500 ease-out`}
                    style={{
                      height: `${heightPercentage}%`,
                      minHeight: item.count > 0 ? "8px" : "0px",
                    }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Status labels row */}
        <div className="flex items-start justify-between gap-3 px-4">
          {sortedData.map((item) => (
            <div
              key={`label-${item.statusKey}`}
              className="flex-1 flex justify-center"
            >
              <div className="text-xs text-gray-600 text-center leading-tight max-w-full break-words">
                {item.status}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

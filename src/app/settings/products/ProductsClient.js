"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function ProductsClient() {
  const [products, setProducts] = useState([]);
  const [unconfiguredSkus, setUnconfiguredSkus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState("create"); // 'create' or 'edit'
  const [currentProduct, setCurrentProduct] = useState(null);
  const [formData, setFormData] = useState({
    sku: "",
    product_name: "",
    category: "",
    personalization_type: "none",
    personalization_notes: "",
    default_length_inches: "",
    default_width_inches: "",
    default_height_inches: "",
    default_weight_oz: "",
    sla_business_days: "5",
    canva_template_url: "",
  });
  const [saveStatus, setSaveStatus] = useState(null);
  const [showUnconfiguredModal, setShowUnconfiguredModal] = useState(false);
  const [updatingStatuses, setUpdatingStatuses] = useState(false);

  useEffect(() => {
    loadProducts();
    loadUnconfiguredSkus();
  }, []);

  async function loadProducts() {
    try {
      const response = await fetch("/api/products");
      const data = await response.json();
      setProducts(data.products || []);
    } catch (error) {
      console.error("Failed to load products:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadUnconfiguredSkus() {
    try {
      const response = await fetch("/api/products/unconfigured-skus");
      const data = await response.json();
      setUnconfiguredSkus(data.unconfigured_skus || []);

      // Auto-show modal if there are unconfigured SKUs
      if (data.unconfigured_skus && data.unconfigured_skus.length > 0) {
        setShowUnconfiguredModal(true);
      }
    } catch (error) {
      console.error("Failed to load unconfigured SKUs:", error);
    }
  }

  function openCreateModal(skuData = null) {
    setModalMode("create");
    setCurrentProduct(null);
    if (skuData) {
      setFormData({
        sku: skuData.sku,
        product_name: skuData.product_name || "",
        category: "",
        personalization_type: "none",
        personalization_notes: "",
        default_length_inches: "",
        default_width_inches: "",
        default_height_inches: "",
        default_weight_oz: "",
        sla_business_days: "5",
        canva_template_url: "",
      });
    } else {
      setFormData({
        sku: "",
        product_name: "",
        category: "",
        personalization_type: "none",
        personalization_notes: "",
        default_length_inches: "",
        default_width_inches: "",
        default_height_inches: "",
        default_weight_oz: "",
        sla_business_days: "5",
        canva_template_url: "",
      });
    }
    setShowModal(true);
    setShowUnconfiguredModal(false);
  }

  function openEditModal(product) {
    setModalMode("edit");
    setCurrentProduct(product);
    setFormData({
      sku: product.sku,
      product_name: product.product_name,
      category: product.category || "",
      personalization_type: product.personalization_type || "none",
      personalization_notes: product.personalization_notes || "",
      default_length_inches: product.default_length_inches || "",
      default_width_inches: product.default_width_inches || "",
      default_height_inches: product.default_height_inches || "",
      default_weight_oz: product.default_weight_oz || "",
      sla_business_days: product.sla_business_days || "5",
      canva_template_url: product.canva_template_url || "",
    });
    setShowModal(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaveStatus({ type: "info", message: "Saving..." });

    try {
      const url =
        modalMode === "create"
          ? "/api/products"
          : `/api/products/${currentProduct.id}`;
      const method = modalMode === "create" ? "POST" : "PUT";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save product");
      }

      setSaveStatus({
        type: "success",
        message: `Product ${
          modalMode === "create" ? "created" : "updated"
        } successfully!`,
      });

      setTimeout(() => {
        setShowModal(false);
        setSaveStatus(null);
        loadProducts();
        loadUnconfiguredSkus();
      }, 1500);
    } catch (error) {
      setSaveStatus({ type: "error", message: error.message });
    }
  }

  async function handleDelete(productId) {
    if (!confirm("Are you sure you want to delete this product?")) return;

    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete product");
      }

      loadProducts();
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  }

  async function handleUpdateStatuses() {
    console.log("[ProductsClient] handleUpdateStatuses called");

    try {
      console.log("[ProductsClient] Starting status update...");
      setUpdatingStatuses(true);
      setSaveStatus({
        type: "info",
        message: "Updating order statuses...",
      });

      console.log("[ProductsClient] Fetching /api/orders/update-statuses");
      const response = await fetch("/api/orders/update-statuses", {
        method: "POST",
      });

      console.log("[ProductsClient] Response status:", response.status);
      const data = await response.json();
      console.log("[ProductsClient] Response data:", data);

      if (!response.ok) {
        throw new Error(data.error || "Failed to update statuses");
      }

      setSaveStatus({
        type: "success",
        message: `✓ Status update complete! ${data.updated} orders promoted to 'ready_for_design', ${data.skipped} skipped.`,
      });

      setTimeout(() => setSaveStatus(null), 8000);
    } catch (error) {
      console.error("[ProductsClient] Error:", error);
      setSaveStatus({
        type: "error",
        message: `Status update failed: ${error.message}`,
      });
    } finally {
      setUpdatingStatuses(false);
      console.log("[ProductsClient] Status update complete");
    }
  }

  function getPersonalizationBadge(type) {
    const badges = {
      none: { label: "No Personalization", color: "bg-gray-100 text-gray-700" },
      notes: { label: "Text/Notes", color: "bg-blue-100 text-blue-700" },
      image: { label: "Image Upload", color: "bg-purple-100 text-purple-700" },
      both: { label: "Text + Image", color: "bg-green-100 text-green-700" },
    };
    const badge = badges[type] || badges.none;
    return (
      <span className={`px-2 py-1 text-xs rounded ${badge.color}`}>
        {badge.label}
      </span>
    );
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="text-center py-12">Loading products...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/settings"
          className="text-blue-600 hover:text-blue-700 text-sm mb-2 inline-block"
        >
          ← Back to Settings
        </Link>
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Product Configuration
            </h1>
            <p className="text-gray-600 mt-2">
              Manage product templates and personalization settings
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleUpdateStatuses}
              disabled={updatingStatuses}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              title="Update existing order statuses based on product configurations"
            >
              {updatingStatuses ? (
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
                  Updating...
                </>
              ) : (
                <>🔄 Retroactively Update Order Statuses</>
              )}
            </button>
            <button
              onClick={() => openCreateModal()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              + Add Product
            </button>
          </div>
        </div>
      </div>

      {/* Status Messages */}
      {saveStatus && (
        <div
          className={`mb-6 p-4 rounded-lg border ${
            saveStatus.type === "success"
              ? "bg-green-50 border-green-200 text-green-800"
              : saveStatus.type === "info"
              ? "bg-blue-50 border-blue-200 text-blue-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{saveStatus.message}</span>
            <button
              onClick={() => setSaveStatus(null)}
              className="text-sm hover:opacity-70"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Unconfigured SKUs Alert */}
      {unconfiguredSkus.length > 0 && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-yellow-800">
                ⚠️ {unconfiguredSkus.length} Unconfigured Product
                {unconfiguredSkus.length > 1 ? "s" : ""}
              </h3>
              <p className="text-sm text-yellow-700 mt-1">
                Found {unconfiguredSkus.length} SKU(s) in your orders that don't
                have product configurations.
              </p>
            </div>
            <button
              onClick={() => setShowUnconfiguredModal(true)}
              className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
            >
              Configure Now
            </button>
          </div>
        </div>
      )}

      {/* Products List */}
      {products.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-300">
          <div className="text-6xl mb-4">📦</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No products configured yet
          </h3>
          <p className="text-gray-600 mb-6">
            Create product templates to define personalization and shipping
            settings.
          </p>
          <button
            onClick={() => openCreateModal()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Create Your First Product
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-300 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  SKU
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Product Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Personalization
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  SLA
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Dimensions
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {product.sku}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">
                      {product.product_name}
                    </div>
                    {product.category && (
                      <div className="text-xs text-gray-500">
                        {product.category}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getPersonalizationBadge(product.personalization_type)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {product.sla_business_days} days
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {product.default_length_inches &&
                    product.default_width_inches &&
                    product.default_height_inches
                      ? `${product.default_length_inches}×${product.default_width_inches}×${product.default_height_inches}"`
                      : "—"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <button
                      onClick={() => openEditModal(product)}
                      className="text-blue-600 hover:text-blue-900 font-medium mr-4"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(product.id)}
                      className="text-red-600 hover:text-red-900 font-medium"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Unconfigured SKUs Modal */}
      {showUnconfiguredModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">
                Unconfigured Products
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                These SKUs were found in your orders but don't have product
                configurations yet.
              </p>
            </div>

            <div className="p-6">
              <div className="space-y-3">
                {unconfiguredSkus.map((item) => (
                  <div
                    key={item.sku}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded hover:bg-gray-50"
                  >
                    <div>
                      <div className="font-medium text-gray-900">
                        {item.sku}
                      </div>
                      {item.product_name && (
                        <div className="text-sm text-gray-600">
                          {item.product_name}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => openCreateModal(item)}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
                    >
                      Configure
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setShowUnconfiguredModal(false)}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Product Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => {
            setShowModal(false);
            setSaveStatus(null);
          }}
        >
          <div
            className="bg-white rounded-lg max-w-2xl w-full h-full overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleSubmit}>
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  {modalMode === "create" ? "Create Product" : "Edit Product"}
                </h2>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setSaveStatus(null);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    {modalMode === "create" ? "Create Product" : "Save Changes"}
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                {saveStatus && (
                  <div
                    className={`p-3 rounded text-sm ${
                      saveStatus.type === "success"
                        ? "bg-green-50 text-green-700 border border-green-200"
                        : saveStatus.type === "error"
                        ? "bg-red-50 text-red-700 border border-red-200"
                        : "bg-blue-50 text-blue-700 border border-blue-200"
                    }`}
                  >
                    {saveStatus.message}
                  </div>
                )}

                {/* SKU */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    SKU *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.sku}
                    onChange={(e) =>
                      setFormData({ ...formData, sku: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., BLANKET-10X10"
                  />
                </div>

                {/* Product Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.product_name}
                    onChange={(e) =>
                      setFormData({ ...formData, product_name: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., 10x10 Fleece Blanket"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Blankets"
                  />
                </div>

                {/* Personalization Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Personalization Type *
                  </label>
                  <select
                    value={formData.personalization_type}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        personalization_type: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="none">No Personalization</option>
                    <option value="notes">Text/Notes Only</option>
                    <option value="image">Image Upload Only</option>
                    <option value="both">Text + Image</option>
                  </select>
                </div>

                {/* Personalization Instructions */}
                {formData.personalization_type !== "none" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Customer Instructions
                      <span className="text-gray-500 font-normal text-xs ml-2">
                        (shown in enrichment form)
                      </span>
                    </label>
                    <p className="text-xs text-gray-500 mb-2">
                      These instructions will be shown to customers when they
                      personalize their order.
                    </p>
                    <textarea
                      value={formData.personalization_notes}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          personalization_notes: e.target.value,
                        })
                      }
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder={
                        formData.personalization_type === "notes"
                          ? "e.g., Please enter your name exactly as you want it to appear on the product"
                          : formData.personalization_type === "image"
                          ? "e.g., Upload a high-resolution photo (minimum 300 DPI recommended)"
                          : "e.g., Enter custom text and upload your design file in PNG or JPG format"
                      }
                    />
                  </div>
                )}

                {/* Dimensions */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Default Dimensions (inches)
                    <span className="text-gray-500 font-normal text-xs ml-2">
                      (used for shipping calculations)
                    </span>
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    <input
                      type="number"
                      step="0.01"
                      value={formData.default_length_inches}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          default_length_inches: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Length"
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={formData.default_width_inches}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          default_width_inches: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Width"
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={formData.default_height_inches}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          default_height_inches: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Height"
                    />
                  </div>
                </div>

                {/* Weight */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Default Weight (oz)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.default_weight_oz}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        default_weight_oz: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., 16"
                  />
                </div>

                {/* SLA */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    SLA (Business Days) *
                  </label>
                  <input
                    type="number"
                    required
                    value={formData.sla_business_days}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        sla_business_days: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="5"
                  />
                </div>

                {/* Canva Template Link */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Canva Template Link
                  </label>
                  <input
                    type="url"
                    value={formData.canva_template_url}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        canva_template_url: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    placeholder="https://www.canva.com/design/..."
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Paste the full Canva design URL for this product's template
                  </p>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

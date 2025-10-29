"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function StoresPage() {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [platform, setPlatform] = useState("etsy"); // 'etsy' or 'shopify'
  const [formData, setFormData] = useState({
    store_name: "",
    store_id: "",
    api_key: "",
    shop_domain: "",
    access_token: "",
  });
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [shopFinderInput, setShopFinderInput] = useState("");
  const [shopFinderLoading, setShopFinderLoading] = useState(false);
  const [shopFinderResult, setShopFinderResult] = useState(null);
  const [shopFinderError, setShopFinderError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { storeId, storeName }

  useEffect(() => {
    loadStores();
  }, []);

  async function loadStores() {
    try {
      const response = await fetch("/api/stores");
      const data = await response.json();
      setStores(data.stores || []);
    } catch (error) {
      console.error("Failed to load stores:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddStore(e) {
    e.preventDefault();
    setFormError("");
    setFormLoading(true);

    try {
      const payload = {
        ...formData,
        platform,
      };

      const response = await fetch("/api/stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to add store");
      }

      // Reset form and reload stores
      setFormData({
        store_name: "",
        store_id: "",
        api_key: "",
        shop_domain: "",
        access_token: "",
      });
      setPlatform("etsy");
      setShowAddForm(false);
      loadStores();
    } catch (error) {
      setFormError(error.message);
    } finally {
      setFormLoading(false);
    }
  }

  async function confirmDelete(storeId, storeName) {
    setDeleteConfirm({ storeId, storeName });
  }

  async function handleDeleteStore() {
    if (!deleteConfirm) return;

    try {
      await fetch(`/api/stores/${deleteConfirm.storeId}`, { method: "DELETE" });
      setDeleteConfirm(null);
      loadStores();
    } catch (error) {
      console.error("Failed to delete store:", error);
    }
  }

  async function handleToggleActive(store) {
    try {
      await fetch(`/api/stores/${store.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !store.is_active }),
      });
      loadStores();
    } catch (error) {
      console.error("Failed to update store:", error);
    }
  }

  async function handleFindShopId() {
    setShopFinderError("");
    setShopFinderResult(null);
    setShopFinderLoading(true);

    try {
      // Extract shop name from URL if pasted
      let shopName = shopFinderInput.trim();

      // If it's a URL, extract the shop name
      if (shopName.includes("etsy.com/shop/")) {
        const match = shopName.match(/etsy\.com\/shop\/([^/?]+)/);
        if (match) {
          shopName = match[1];
        }
      }

      if (!shopName) {
        throw new Error("Please enter a shop name or URL");
      }

      if (!formData.api_key) {
        throw new Error("Please enter your API key first");
      }

      const response = await fetch(
        `/api/etsy/find-shop?shop_name=${encodeURIComponent(
          shopName
        )}&api_key=${encodeURIComponent(formData.api_key)}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to find shop");
      }

      setShopFinderResult(data);
      // Auto-fill the form
      setFormData({
        ...formData,
        store_name: data.shop_name,
        store_id: data.shop_id.toString(),
      });
    } catch (error) {
      setShopFinderError(error.message);
    } finally {
      setShopFinderLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link
              href="/settings"
              className="text-blue-600 hover:text-blue-700 text-sm mb-2 inline-block"
            >
              ← Back to Settings
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">
              Store Configuration
            </h1>
            <p className="text-gray-600 mt-2">
              Connect your Etsy and Shopify stores to sync orders automatically
            </p>
          </div>
          {!showAddForm && (
            <div className="flex gap-3">
              <a
                href="/api/etsy/oauth/authorize"
                className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors"
              >
                🛍️ Connect Etsy (OAuth)
              </a>
              <button
                onClick={() => {
                  setPlatform("etsy");
                  setShowAddForm(true);
                }}
                className="px-4 py-2 border border-orange-300 text-orange-700 rounded hover:bg-orange-50 transition-colors"
              >
                + Add Etsy Manually
              </button>
              <button
                onClick={() => {
                  setPlatform("shopify");
                  setShowAddForm(true);
                }}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
              >
                🛒 Add Shopify Store
              </button>
            </div>
          )}
        </div>

        {/* Add Store Form */}
        {showAddForm && (
          <div className="bg-white rounded-lg border border-gray-300 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Add New {platform === "etsy" ? "Etsy" : "Shopify"} Store
            </h2>

            {/* Etsy Shop ID Finder Utility */}
            {platform === "etsy" && (
              <div className="mb-6 p-4 rounded bg-blue-50 border border-blue-200">
                <h3 className="text-sm font-semibold text-blue-900 mb-3">
                  🔍 Find Your Shop ID
                </h3>
                <p className="text-xs text-blue-800 mb-3">
                  Paste your shop URL or enter your shop name to auto-fill the
                  form below
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-blue-900 mb-1">
                      API Key (enter this first)
                    </label>
                    <input
                      type="text"
                      value={formData.api_key}
                      onChange={(e) =>
                        setFormData({ ...formData, api_key: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm rounded border border-blue-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                      placeholder="Your Etsy API keystring"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-blue-900 mb-1">
                      Shop URL or Name
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={shopFinderInput}
                        onChange={(e) => setShopFinderInput(e.target.value)}
                        className="flex-1 px-3 py-2 text-sm rounded border border-blue-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="https://www.etsy.com/shop/YourShop or YourShop"
                      />
                      <button
                        type="button"
                        onClick={handleFindShopId}
                        disabled={shopFinderLoading || !formData.api_key}
                        className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:bg-gray-400 transition-colors whitespace-nowrap"
                      >
                        {shopFinderLoading ? "Finding..." : "Find Shop"}
                      </button>
                    </div>
                  </div>

                  {shopFinderError && (
                    <div className="p-2 rounded bg-red-50 border border-red-200 text-red-700 text-xs">
                      {shopFinderError}
                    </div>
                  )}

                  {shopFinderResult && (
                    <div className="p-3 rounded bg-green-50 border border-green-200">
                      <p className="text-xs font-semibold text-green-900 mb-1">
                        ✓ Found Shop!
                      </p>
                      <p className="text-xs text-green-800">
                        <strong>{shopFinderResult.shop_name}</strong> (ID:{" "}
                        {shopFinderResult.shop_id})
                      </p>
                      <p className="text-xs text-green-700 mt-1">
                        Form auto-filled below ↓
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <form onSubmit={handleAddStore} className="space-y-4">
              {formError && (
                <div className="p-3 rounded bg-red-50 border border-red-200 text-red-700 text-sm">
                  {formError}
                </div>
              )}

              {/* Shopify Form Fields */}
              {platform === "shopify" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Store Name
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.store_name}
                      onChange={(e) =>
                        setFormData({ ...formData, store_name: e.target.value })
                      }
                      className="w-full px-4 py-2 rounded border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="My Shopify Store"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Shop Domain
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.shop_domain}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          shop_domain: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 rounded border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-sm"
                      placeholder="yourstore.myshopify.com"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Your Shopify store URL (e.g., yourstore.myshopify.com)
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Admin API Access Token
                    </label>
                    <input
                      type="password"
                      required
                      value={formData.access_token}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          access_token: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 rounded border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-sm"
                      placeholder="shpat_..."
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      From your Shopify Admin API custom app
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      API Key (Optional)
                    </label>
                    <input
                      type="text"
                      value={formData.api_key}
                      onChange={(e) =>
                        setFormData({ ...formData, api_key: e.target.value })
                      }
                      className="w-full px-4 py-2 rounded border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-sm"
                      placeholder="API Key from your custom app (optional)"
                    />
                  </div>
                </>
              )}

              {/* Etsy Form Fields */}
              {platform === "etsy" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Store Name
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.store_name}
                      onChange={(e) =>
                        setFormData({ ...formData, store_name: e.target.value })
                      }
                      className="w-full px-4 py-2 rounded border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="My Etsy Shop"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Shop ID
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.store_id}
                      onChange={(e) =>
                        setFormData({ ...formData, store_id: e.target.value })
                      }
                      className="w-full px-4 py-2 rounded border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="12345678"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Find this in your Etsy shop settings or API console
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      API Key (Keystring)
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.api_key}
                      onChange={(e) =>
                        setFormData({ ...formData, api_key: e.target.value })
                      }
                      className="w-full px-4 py-2 rounded border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                      placeholder="abcd1234efgh5678..."
                      readOnly
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      (Already entered above in the Shop Finder)
                    </p>
                  </div>
                </>
              )}

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
                >
                  {formLoading ? "Testing Connection..." : "Add Store"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setFormError("");
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Stores List */}
        <div className="bg-white rounded-lg border border-gray-300">
          {stores.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-6xl mb-4">🏪</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No stores configured
              </h3>
              <p className="text-gray-600 mb-6">
                Add your first Etsy store to start syncing orders
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {stores.map((store) => (
                <div key={store.id} className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {store.store_name}
                        </h3>
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            store.is_active
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {store.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>
                          Platform:{" "}
                          <span className="font-medium">
                            {store.platform === "shopify"
                              ? "🛒 Shopify"
                              : "🛍️ Etsy"}
                          </span>
                        </p>
                        {store.platform === "shopify" ? (
                          <p>Shop Domain: {store.shop_domain || "N/A"}</p>
                        ) : (
                          <p>Shop ID: {store.shop_id || store.store_id}</p>
                        )}
                        {store.last_sync_timestamp && (
                          <p>
                            Last synced:{" "}
                            {new Date(
                              store.last_sync_timestamp
                            ).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {store.platform === "etsy" && (
                        <a
                          href={`/api/etsy/oauth/authorize?reconnect_store_id=${store.id}`}
                          className="px-3 py-1.5 border border-blue-300 text-blue-700 rounded hover:bg-blue-50 text-sm transition-colors"
                          title="Refresh OAuth token"
                        >
                          🔄 Reconnect
                        </a>
                      )}
                      <button
                        onClick={() => handleToggleActive(store)}
                        className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 text-sm transition-colors"
                      >
                        {store.is_active ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        onClick={() =>
                          confirmDelete(store.id, store.store_name)
                        }
                        className="px-3 py-1.5 border border-red-300 text-red-700 rounded hover:bg-red-50 text-sm transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Delete Store?
              </h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete{" "}
                <strong>{deleteConfirm.storeName}</strong>? This action cannot
                be undone.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteStore}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

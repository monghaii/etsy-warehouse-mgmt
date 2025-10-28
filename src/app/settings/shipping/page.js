"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function ShippingSettingsPage() {
  const [settings, setSettings] = useState({
    ship_from_name: "",
    ship_from_company: "",
    ship_from_address_line1: "",
    ship_from_address_line2: "",
    ship_from_city: "",
    ship_from_state: "",
    ship_from_zip: "",
    ship_from_country: "US",
    ship_from_phone: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const response = await fetch("/api/shipping-settings");
      const data = await response.json();
      if (data.settings) {
        setSettings(data.settings);
      }
    } catch (error) {
      console.error("Failed to load shipping settings:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/shipping-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        throw new Error("Failed to save settings");
      }

      const data = await response.json();
      setSettings(data.settings);
      setMessage({ type: "success", text: "✓ Shipping settings saved!" });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error("Failed to save shipping settings:", error);
      setMessage({ type: "error", text: "✗ Failed to save settings" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-3xl mx-auto">
          <div className="text-center py-12">
            <div className="text-gray-600">Loading...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/settings"
          className="text-blue-600 hover:text-blue-700 mb-4 inline-block"
        >
          ← Back to Settings
        </Link>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">
              📦 Shipping Settings
            </h1>
            <p className="text-gray-600 mt-2">
              Configure your ship-from address for purchasing shipping labels.
            </p>
          </div>

          {message && (
            <div
              className={`mb-6 p-4 rounded-lg ${
                message.type === "success"
                  ? "bg-green-50 border border-green-200 text-green-800"
                  : "bg-red-50 border border-red-200 text-red-800"
              }`}
            >
              {message.text}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-6">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Contact Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={settings.ship_from_name}
                onChange={(e) =>
                  setSettings({ ...settings, ship_from_name: e.target.value })
                }
                placeholder="John Doe"
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Company */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Company Name (optional)
              </label>
              <input
                type="text"
                value={settings.ship_from_company || ""}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    ship_from_company: e.target.value,
                  })
                }
                placeholder="My Store LLC"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Address Line 1 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Address Line 1 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={settings.ship_from_address_line1}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    ship_from_address_line1: e.target.value,
                  })
                }
                placeholder="123 Main Street"
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Address Line 2 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Address Line 2 (optional)
              </label>
              <input
                type="text"
                value={settings.ship_from_address_line2 || ""}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    ship_from_address_line2: e.target.value,
                  })
                }
                placeholder="Suite 100"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* City, State, Zip */}
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  City <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={settings.ship_from_city}
                  onChange={(e) =>
                    setSettings({ ...settings, ship_from_city: e.target.value })
                  }
                  placeholder="Los Angeles"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  State <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={settings.ship_from_state}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      ship_from_state: e.target.value.toUpperCase(),
                    })
                  }
                  placeholder="CA"
                  maxLength={2}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
                />
              </div>
              <div className="col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ZIP Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={settings.ship_from_zip}
                  onChange={(e) =>
                    setSettings({ ...settings, ship_from_zip: e.target.value })
                  }
                  placeholder="90001"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Country */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Country <span className="text-red-500">*</span>
              </label>
              <select
                value={settings.ship_from_country}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    ship_from_country: e.target.value,
                  })
                }
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="US">United States</option>
                <option value="CA">Canada</option>
                <option value="MX">Mexico</option>
              </select>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number (optional)
              </label>
              <input
                type="tel"
                value={settings.ship_from_phone || ""}
                onChange={(e) =>
                  setSettings({ ...settings, ship_from_phone: e.target.value })
                }
                placeholder="(555) 123-4567"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Submit Button */}
            <div className="flex gap-3 pt-4">
              <Link
                href="/settings"
                className="flex-1 px-6 py-3 text-center bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={saving}
                className={`flex-1 px-6 py-3 rounded-lg font-medium ${
                  saving
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                {saving ? "Saving..." : "Save Settings"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}


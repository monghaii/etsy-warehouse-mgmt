"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function OrderDetailsForm() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState(1); // 1: lookup, 2: form, 3: success
  const [orderNumber, setOrderNumber] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [orderInfo, setOrderInfo] = useState(null);
  const [error, setError] = useState(null);

  // Form fields
  const [email, setEmail] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Item-specific data: { transactionId: { customText: "", files: [] } }
  const [itemsData, setItemsData] = useState({});

  // Auto-fill order number from query params
  useEffect(() => {
    const orderParam = searchParams.get("order");
    if (orderParam) {
      setOrderNumber(orderParam);
    }
  }, [searchParams]);

  // Helper function to get last name initial
  function getCustomerDisplayName(fullName) {
    if (!fullName) return "";
    const parts = fullName.trim().split(" ");
    if (parts.length === 1) return parts[0];
    const firstName = parts[0];
    const lastInitial = parts[parts.length - 1][0];
    return `${firstName} ${lastInitial}.`;
  }

  // Helper function to decode HTML entities
  function decodeHtmlEntities(text) {
    if (!text) return "";
    const textarea = document.createElement("textarea");
    textarea.innerHTML = text;
    return textarea.value;
  }

  async function handleLookup(e) {
    e.preventDefault();
    setError(null);
    setLookupLoading(true);

    try {
      const response = await fetch("/api/enrich/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to find order");
        return;
      }

      setOrderInfo(data);

      // Initialize items data state
      const initialItemsData = {};
      data.items.forEach((item) => {
        initialItemsData[item.transactionId] = {
          customText: "",
          files: [],
        };
      });
      setItemsData(initialItemsData);

      setStep(2);
    } catch (err) {
      console.error("[Order Details] Lookup error:", err);
      setError("Failed to look up order. Please try again.");
    } finally {
      setLookupLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitLoading(true);

    try {
      const formData = new FormData();
      formData.append("orderId", orderInfo.orderId);
      formData.append("email", email);

      if (customerNotes.trim()) {
        formData.append("customerNotes", customerNotes);
      }

      // Prepare items data for submission
      const itemsDataForSubmit = orderInfo.items.map((item) => ({
        transactionId: item.transactionId,
        sku: item.sku,
        customText: itemsData[item.transactionId]?.customText || "",
      }));

      formData.append("itemsData", JSON.stringify(itemsDataForSubmit));

      // Append files for each item
      orderInfo.items.forEach((item) => {
        const files = itemsData[item.transactionId]?.files || [];
        files.forEach((file) => {
          formData.append(`files_${item.transactionId}`, file);
        });
      });

      const response = await fetch("/api/enrich/submit", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to submit");
        return;
      }

      setSuccessMessage(data.message);
      setStep(3);
    } catch (err) {
      console.error("[Order Details] Submit error:", err);
      setError("Failed to submit. Please try again.");
    } finally {
      setSubmitLoading(false);
    }
  }

  function handleFileChange(transactionId, files) {
    const selectedFiles = Array.from(files);
    setItemsData((prev) => ({
      ...prev,
      [transactionId]: {
        ...prev[transactionId],
        files: selectedFiles,
      },
    }));
  }

  function removeFile(transactionId, index) {
    setItemsData((prev) => ({
      ...prev,
      [transactionId]: {
        ...prev[transactionId],
        files: prev[transactionId].files.filter((_, i) => i !== index),
      },
    }));
  }

  function updateCustomText(transactionId, text) {
    setItemsData((prev) => ({
      ...prev,
      [transactionId]: {
        ...prev[transactionId],
        customText: text,
      },
    }));
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Complete Your Order
          </h1>
          <p className="text-gray-600">
            Enter your order details to customize your product
          </p>
        </div>

        {/* Step 1: Order Lookup */}
        {step === 1 && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <form onSubmit={handleLookup} className="space-y-6">
              <div>
                <label
                  htmlFor="orderNumber"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Order Number
                </label>
                <p className="text-sm text-gray-500 mb-3">
                  You can find this on your Etsy receipt or order confirmation
                  email
                </p>
                <input
                  type="text"
                  id="orderNumber"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  placeholder="e.g., 1234567890"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-800 text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={lookupLoading}
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {lookupLoading ? "Looking up..." : "Continue"}
              </button>
            </form>
          </div>
        )}

        {/* Step 2: Enrichment Form */}
        {step === 2 && orderInfo && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            {/* Order Info Header */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">
                Order #{orderInfo.orderNumber}
              </h2>
              <p className="text-sm text-gray-600">
                Customer: {getCustomerDisplayName(orderInfo.customerName)}
              </p>
              <p className="text-sm text-gray-600">
                {orderInfo.items.length} item(s) in this order
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Items Section */}
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
                  Items to Personalize
                </h3>

                {orderInfo.items.map((item, index) => {
                  const needsText =
                    item.personalizationType === "notes" ||
                    item.personalizationType === "both";
                  const needsImage =
                    item.personalizationType === "image" ||
                    item.personalizationType === "both";
                  const needsNothing = item.personalizationType === "none";

                  const itemData = itemsData[item.transactionId] || {
                    customText: "",
                    files: [],
                  };

                  return (
                    <div
                      key={item.transactionId}
                      className="border border-gray-200 rounded-lg p-6 bg-gray-50"
                    >
                      {/* Item Header */}
                      <div className="mb-4">
                        <h4 className="font-medium text-gray-900">
                          Item {index + 1}: {item.productName}
                        </h4>
                        <p className="text-sm text-gray-500">
                          SKU: {item.sku} • Quantity: {item.quantity}
                        </p>
                        {item.existingPersonalization && (
                          <p className="text-sm text-gray-600 mt-1 bg-white p-2 rounded border border-gray-200">
                            From Etsy:{" "}
                            {decodeHtmlEntities(item.existingPersonalization)}
                          </p>
                        )}
                      </div>

                      {/* No personalization needed */}
                      {needsNothing && (
                        <div className="bg-green-50 border border-green-200 rounded p-3">
                          <p className="text-green-800 text-sm">
                            ✓ This item doesn't require additional
                            personalization
                          </p>
                        </div>
                      )}

                      {/* Custom Text */}
                      {needsText && (
                        <div className="mb-4">
                          <label
                            htmlFor={`text_${item.transactionId}`}
                            className="block text-sm font-medium text-gray-700 mb-2"
                          >
                            Personalization Text{" "}
                            <span className="text-red-500">*</span>
                          </label>
                          {item.personalizationInstructions && (
                            <p className="text-sm text-gray-500 mb-3 bg-white p-3 rounded border border-gray-200">
                              <strong>Instructions:</strong>{" "}
                              {decodeHtmlEntities(
                                item.personalizationInstructions
                              )}
                            </p>
                          )}
                          <textarea
                            id={`text_${item.transactionId}`}
                            value={itemData.customText}
                            onChange={(e) =>
                              updateCustomText(
                                item.transactionId,
                                e.target.value
                              )
                            }
                            placeholder="Enter your custom text here..."
                            required={needsText}
                            rows={3}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      )}

                      {/* Image Upload */}
                      {needsImage && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Upload Images{" "}
                            <span className="text-red-500">*</span>
                          </label>
                          <p className="text-sm text-gray-500 mb-3">
                            PNG or JPEG only, max 10MB per file
                          </p>

                          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-500 transition-colors">
                            <input
                              type="file"
                              id={`file_${item.transactionId}`}
                              accept="image/png,image/jpeg,image/jpg"
                              multiple
                              onChange={(e) =>
                                handleFileChange(
                                  item.transactionId,
                                  e.target.files
                                )
                              }
                              className="hidden"
                            />
                            <label
                              htmlFor={`file_${item.transactionId}`}
                              className="cursor-pointer inline-flex flex-col items-center"
                            >
                              <svg
                                className="w-10 h-10 text-gray-400 mb-2"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                                />
                              </svg>
                              <span className="text-blue-600 font-medium text-sm">
                                Click to upload
                              </span>
                            </label>
                          </div>

                          {/* File List */}
                          {itemData.files.length > 0 && (
                            <div className="mt-3 space-y-2">
                              {itemData.files.map((file, fileIndex) => (
                                <div
                                  key={fileIndex}
                                  className="flex items-center justify-between bg-white p-2 rounded border border-gray-200"
                                >
                                  <div className="flex items-center space-x-2">
                                    <svg
                                      className="w-4 h-4 text-green-500"
                                      fill="currentColor"
                                      viewBox="0 0 20 20"
                                    >
                                      <path
                                        fillRule="evenodd"
                                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                        clipRule="evenodd"
                                      />
                                    </svg>
                                    <div>
                                      <p className="text-xs font-medium text-gray-900">
                                        {file.name}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        {(file.size / 1024 / 1024).toFixed(2)}{" "}
                                        MB
                                      </p>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      removeFile(item.transactionId, fileIndex)
                                    }
                                    className="text-red-600 hover:text-red-800"
                                  >
                                    <svg
                                      className="w-4 h-4"
                                      fill="currentColor"
                                      viewBox="0 0 20 20"
                                    >
                                      <path
                                        fillRule="evenodd"
                                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                        clipRule="evenodd"
                                      />
                                    </svg>
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Additional Notes */}
              <div>
                <label
                  htmlFor="customerNotes"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Additional Notes (Optional)
                </label>
                <textarea
                  id="customerNotes"
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  placeholder="Any special instructions or comments for all items..."
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-800 text-sm">{error}</p>
                </div>
              )}

              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setOrderInfo(null);
                    setError(null);
                    setItemsData({});
                  }}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 px-6 rounded-lg font-medium hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {submitLoading ? "Submitting..." : "Submit"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Step 3: Success */}
        {step === 3 && (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="mb-6">
              <svg
                className="w-20 h-20 text-green-500 mx-auto"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Thank You!
            </h2>
            <p className="text-gray-600 mb-2">{successMessage}</p>
            <p className="text-sm text-gray-500 mb-8">
              Order #{orderInfo.orderNumber}
            </p>
            <button
              onClick={() => {
                setStep(1);
                setOrderNumber("");
                setOrderInfo(null);
                setEmail("");
                setCustomerNotes("");
                setItemsData({});
                setError(null);
              }}
              className="bg-blue-600 text-white py-3 px-8 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              Submit Another Order
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function OrderDetailsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
          <div className="text-gray-600">Loading...</div>
        </div>
      }
    >
      <OrderDetailsForm />
    </Suspense>
  );
}

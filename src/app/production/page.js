"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Navigation from "@/components/Navigation";

export default function ProductionPage() {
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionStatus, setActionStatus] = useState(null);
  const [scanningMode, setScanningMode] = useState(false);
  const [scannedOrder, setScannedOrder] = useState(null);
  const [barcode, setBarcode] = useState("");
  const barcodeInputRef = useRef(null);
  const [skuFilter, setSkuFilter] = useState("");
  const [downloadingSku, setDownloadingSku] = useState(false);
  const [orderDetailsSkuFilter, setOrderDetailsSkuFilter] = useState("");
  const [downloadingOrderDetails, setDownloadingOrderDetails] = useState(false);
  const [combineOrderDetailsPDF, setCombineOrderDetailsPDF] = useState(true);
  const [labelSkuFilter, setLabelSkuFilter] = useState("");
  const [selectedOrders, setSelectedOrders] = useState(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState(null);
  const [shippingQuoteOrder, setShippingQuoteOrder] = useState(null);
  const [shippingRates, setShippingRates] = useState([]);
  const [loadingRates, setLoadingRates] = useState(false);
  const [packageDims, setPackageDims] = useState({
    length: 0,
    width: 0,
    height: 0,
  });
  const [packageWeight, setPackageWeight] = useState(0);
  const [validatedAddress, setValidatedAddress] = useState(null);
  const [showAddressUpdatePrompt, setShowAddressUpdatePrompt] = useState(false);
  const [validatingAddress, setValidatingAddress] = useState(false);
  const [showLabelPurchaseModal, setShowLabelPurchaseModal] = useState(false);
  const [labelPurchaseStep, setLabelPurchaseStep] = useState(1); // 1=validate, 2=rates, 3=confirm
  const [labelOrders, setLabelOrders] = useState([]);
  const [labelAddressValidations, setLabelAddressValidations] = useState({});
  const [labelRates, setLabelRates] = useState({});
  const [purchasingLabels, setPurchasingLabels] = useState(false);
  const [combineLabels, setCombineLabels] = useState(true);
  const [validatingAddresses, setValidatingAddresses] = useState(false);
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [revisionOrder, setRevisionOrder] = useState(null);
  const [revisionNotes, setRevisionNotes] = useState("");
  const [requestingRevision, setRequestingRevision] = useState(false);

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

  // Auto-validate addresses when modal opens at step 1
  useEffect(() => {
    if (
      showLabelPurchaseModal &&
      labelPurchaseStep === 1 &&
      labelOrders.length > 0
    ) {
      validateAllAddresses();
    }
  }, [showLabelPurchaseModal, labelPurchaseStep, labelOrders]);

  async function validateAllAddresses() {
    setValidatingAddresses(true);
    const validations = {};

    for (const order of labelOrders) {
      try {
        const response = await fetch("/api/shipstation/validate-address", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address: {
              name: order.customer_name,
              addressLine1: order.shipping_address_line1,
              addressLine2: order.shipping_address_line2,
              city: order.shipping_city,
              state: order.shipping_state,
              postalCode: order.shipping_zip,
              country: order.shipping_country || "US",
            },
          }),
        });

        if (response.ok) {
          const data = await response.json();
          validations[order.id] = {
            status: data.status,
            original: order,
            corrected: data.matchedAddress,
            applied: false, // Track if user applied the correction
          };
        } else {
          validations[order.id] = {
            status: "error",
            original: order,
            error: "Validation failed",
          };
        }
      } catch (error) {
        validations[order.id] = {
          status: "error",
          original: order,
          error: error.message,
        };
      }
    }

    setLabelAddressValidations(validations);
    setValidatingAddresses(false);
  }

  async function applyAddressCorrection(orderId) {
    const validation = labelAddressValidations[orderId];
    if (!validation?.corrected) return;

    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shipping_address_line1: validation.corrected.address_line1,
          shipping_address_line2: validation.corrected.address_line2 || "",
          shipping_city: validation.corrected.city_locality,
          shipping_state: validation.corrected.state_province,
          shipping_zip: validation.corrected.postal_code,
        }),
      });

      if (response.ok) {
        // Mark as applied
        setLabelAddressValidations((prev) => ({
          ...prev,
          [orderId]: { ...prev[orderId], applied: true },
        }));
        // Update the order in labelOrders
        setLabelOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  shipping_address_line1: validation.corrected.address_line1,
                  shipping_address_line2:
                    validation.corrected.address_line2 || "",
                  shipping_city: validation.corrected.city_locality,
                  shipping_state: validation.corrected.state_province,
                  shipping_zip: validation.corrected.postal_code,
                }
              : o
          )
        );
      }
    } catch (error) {
      console.error("Failed to update address:", error);
    }
  }

  async function loadOrders() {
    try {
      setLoading(true);
      const response = await fetch("/api/production-queue");
      const data = await response.json();
      setOrders(data.orders || []);
    } catch (error) {
      console.error("Failed to load production queue:", error);
    } finally {
      setLoading(false);
    }
  }

  async function startProduction(orderId) {
    try {
      const response = await fetch(`/api/orders/${orderId}/production`, {
        method: "POST",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || "Failed to start production";
        throw new Error(errorMessage);
      }

      await loadOrders();
      setActionStatus({
        type: "success",
        message: "✓ Production started!",
      });
      setTimeout(() => setActionStatus(null), 3000);
    } catch (error) {
      console.error("Failed to start production:", error);
      setActionStatus({
        type: "error",
        message: `✗ ${error.message}`,
      });
      setTimeout(() => setActionStatus(null), 5000);
    }
  }

  async function handleRequestRevision() {
    if (!revisionOrder) return;

    setRequestingRevision(true);
    try {
      const response = await fetch(
        `/api/orders/${revisionOrder.id}/production`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            revision_notes: revisionNotes,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to request design revision");
      }

      setShowRevisionModal(false);
      setRevisionOrder(null);
      setRevisionNotes("");
      await loadOrders();
      setActionStatus({
        type: "success",
        message:
          "✓ Design revision requested - order sent back to design queue",
      });
      setTimeout(() => setActionStatus(null), 5000);
    } catch (error) {
      console.error("Failed to request design revision:", error);
      setActionStatus({
        type: "error",
        message: "✗ Failed to request design revision",
      });
      setTimeout(() => setActionStatus(null), 3000);
    } finally {
      setRequestingRevision(false);
    }
  }

  async function validateAddress(order) {
    setValidatingAddress(true);
    try {
      const response = await fetch("/api/shipstation/validate-address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: {
            name: order.customer_name,
            addressLine1: order.shipping_address_line1,
            addressLine2: order.shipping_address_line2,
            city: order.shipping_city,
            state: order.shipping_state,
            postalCode: order.shipping_zip,
            country: order.shipping_country || "US",
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();

        // Check if address was verified and is different
        if (data.status === "verified" && data.matchedAddress) {
          const matched = data.matchedAddress;
          const isDifferent =
            matched.address_line1 !== order.shipping_address_line1 ||
            matched.city_locality !== order.shipping_city ||
            matched.state_province !== order.shipping_state ||
            matched.postal_code !== order.shipping_zip;

          if (isDifferent) {
            setValidatedAddress(matched);
            setShowAddressUpdatePrompt(true);
          }
        }
      }
    } catch (error) {
      console.error("Address validation failed:", error);
    } finally {
      setValidatingAddress(false);
    }
  }

  async function updateOrderAddress() {
    if (!shippingQuoteOrder || !validatedAddress) return;

    try {
      const response = await fetch(`/api/orders/${shippingQuoteOrder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shipping_address_line1: validatedAddress.address_line1,
          shipping_address_line2: validatedAddress.address_line2 || "",
          shipping_city: validatedAddress.city_locality,
          shipping_state: validatedAddress.state_province,
          shipping_zip: validatedAddress.postal_code,
        }),
      });

      if (response.ok) {
        // Update local state
        const updatedOrder = {
          ...shippingQuoteOrder,
          shipping_address_line1: validatedAddress.address_line1,
          shipping_address_line2: validatedAddress.address_line2 || "",
          shipping_city: validatedAddress.city_locality,
          shipping_state: validatedAddress.state_province,
          shipping_zip: validatedAddress.postal_code,
        };
        setShippingQuoteOrder(updatedOrder);
        setShowAddressUpdatePrompt(false);
        setValidatedAddress(null);

        setActionStatus({
          type: "success",
          message: "✓ Address updated!",
        });
        setTimeout(() => setActionStatus(null), 3000);
      }
    } catch (error) {
      console.error("Failed to update address:", error);
      setActionStatus({
        type: "error",
        message: "Failed to update address",
      });
    }
  }

  function openShippingQuoteModal(order) {
    const transactions = order.raw_order_data?.transactions || [];

    // Calculate total weight (sum of all items × quantity)
    let totalWeight = 0;
    let maxLength = 0;
    let maxWidth = 0;
    let maxHeight = 0;

    transactions.forEach((txn) => {
      const qty = txn.quantity || 1;
      const weight = txn.product_weight || 0;
      totalWeight += weight * qty;

      // For dimensions, use the largest dimensions from all products
      if (txn.product_dimensions) {
        maxLength = Math.max(maxLength, txn.product_dimensions.length || 0);
        maxWidth = Math.max(maxWidth, txn.product_dimensions.width || 0);
        maxHeight = Math.max(maxHeight, txn.product_dimensions.height || 0);
      }
    });

    setShippingQuoteOrder(order);
    setPackageWeight(totalWeight);
    setPackageDims({ length: maxLength, width: maxWidth, height: maxHeight });
    setShippingRates([]);
    setValidatedAddress(null);
    setShowAddressUpdatePrompt(false);

    // Automatically validate address
    validateAddress(order);
  }

  function closeShippingQuoteModal() {
    setShippingQuoteOrder(null);
    setShippingRates([]);
    setLoadingRates(false);
  }

  async function fetchShippingRates() {
    if (!shippingQuoteOrder) return;

    try {
      setLoadingRates(true);
      setShippingRates([]);

      const response = await fetch("/api/shipstation/get-rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weight: packageWeight,
          dimensions: packageDims,
          toAddress: {
            name: shippingQuoteOrder.customer_name,
            addressLine1: shippingQuoteOrder.shipping_address_line1,
            city: shippingQuoteOrder.shipping_city,
            state: shippingQuoteOrder.shipping_state,
            postalCode: shippingQuoteOrder.shipping_zip,
            country: shippingQuoteOrder.shipping_country || "US",
          },
          fromAddress: {
            postalCode: "90001", // TODO: Make this configurable
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to get shipping rates");
      }

      const data = await response.json();
      setShippingRates(data.rates || []);
    } catch (error) {
      console.error("Failed to get shipping rates:", error);
      setActionStatus({
        type: "error",
        message: `Failed to get shipping rates: ${error.message}`,
      });
    } finally {
      setLoadingRates(false);
    }
  }

  function enableScanningMode() {
    setScanningMode(true);
    setBarcode("");
    setTimeout(() => {
      barcodeInputRef.current?.focus();
    }, 100);
  }

  function disableScanningMode() {
    setScanningMode(false);
    setBarcode("");
  }

  async function handleBarcodeSubmit(e) {
    e.preventDefault();
    if (!barcode.trim()) return;

    const scannedValue = barcode.trim();

    try {
      let order = null;

      // Detect if it's a tracking number (20+ digits) or order number
      const isTrackingNumber =
        scannedValue.length >= 20 && /^\d+$/.test(scannedValue);

      if (isTrackingNumber) {
        // Search by tracking number
        order = orders.find((o) => o.tracking_number === scannedValue);

        if (!order) {
          setActionStatus({
            type: "error",
            message: `No order found with tracking number: ${scannedValue}`,
          });
          setBarcode("");
          return;
        }
      } else {
        // Search by order number
        order = orders.find((o) => o.order_number?.toString() === scannedValue);

        if (!order) {
          setActionStatus({
            type: "error",
            message: `No order found with order number: ${scannedValue}`,
          });
          setBarcode("");
          return;
        }
      }

      // Fetch full order details
      const response = await fetch(`/api/orders/${order.id}`);
      const data = await response.json();
      setScannedOrder(data.order);
      setScanningMode(false);
      setBarcode("");
      setActionStatus({
        type: "success",
        message: `✓ Found order #${order.order_number}${
          isTrackingNumber ? " by tracking number" : ""
        }`,
      });
      setTimeout(() => setActionStatus(null), 3000);
    } catch (error) {
      console.error("Failed to load order:", error);
      setActionStatus({
        type: "error",
        message: "Failed to load order details. Please try again.",
      });
      setTimeout(() => setActionStatus(null), 3000);
      setBarcode("");
      barcodeInputRef.current?.focus();
    }
  }

  function closeOrderModal() {
    setScannedOrder(null);
  }

  function toggleSelectOrder(orderId, index, shiftKey) {
    setSelectedOrders((prev) => {
      const newSelected = new Set(prev);

      if (shiftKey && lastSelectedIndex !== null) {
        // Shift-click: select range
        const start = Math.min(lastSelectedIndex, index);
        const end = Math.max(lastSelectedIndex, index);
        for (let i = start; i <= end; i++) {
          if (orders[i]) {
            newSelected.add(orders[i].id);
          }
        }
      } else {
        // Normal click: toggle single item
        if (newSelected.has(orderId)) {
          newSelected.delete(orderId);
        } else {
          newSelected.add(orderId);
        }
      }

      setLastSelectedIndex(index);
      return newSelected;
    });
  }

  function selectAllOrders() {
    setSelectedOrders(new Set(orders.map((o) => o.id)));
  }

  function deselectAllOrders() {
    setSelectedOrders(new Set());
    setLastSelectedIndex(null);
  }

  function renderSKU(enhancedSku, originalSku = null) {
    if (!enhancedSku) return "—";

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

  function enhanceSKUWithDimensions(baseSku, variations = []) {
    if (!baseSku) return "";
    if (!variations || variations.length === 0) return baseSku;

    const sizeVariation = variations.find((v) => {
      const name = v.formatted_name?.toLowerCase() || "";
      return name.includes("size") || name.includes("dimension");
    });

    if (!sizeVariation) return baseSku;

    const sizeValue = sizeVariation.formatted_value || "";
    const numerals = sizeValue.match(/\d+/g);

    if (!numerals || numerals.length === 0) return baseSku;

    // Check if dimensions are already in the SKU to avoid duplication
    const dimensionSuffix = numerals.join("-");
    if (baseSku.endsWith(`-${dimensionSuffix}`)) {
      return baseSku; // Already has dimensions, don't append again
    }

    return `${baseSku}-${dimensionSuffix}`;
  }

  function getStatusColor(status) {
    const colors = {
      pending_enrichment: "bg-yellow-100 text-yellow-800 border-yellow-300",
      enriched: "bg-blue-100 text-blue-800 border-blue-300",
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

  // Get unique SKUs (with sizes) from production queue
  // If filterSelected is true, only return SKUs from selected orders
  function getUniqueSKUs(filterSelected = false) {
    const skuSet = new Set();
    const ordersToCheck =
      filterSelected && selectedOrders.size > 0
        ? orders.filter((o) => selectedOrders.has(o.id))
        : orders;

    ordersToCheck.forEach((order) => {
      const transactions = order.raw_order_data?.transactions || [];
      transactions.forEach((txn) => {
        if (txn.sku) {
          // Use the full enhanced SKU (includes size dimensions)
          skuSet.add(txn.sku);
        }
      });
    });

    return Array.from(skuSet).sort();
  }

  async function downloadOrderDetailsPDFs() {
    if (!orderDetailsSkuFilter.trim() || orderDetailsSkuFilter === "") {
      setActionStatus({
        type: "error",
        message: "Please select a SKU",
      });
      setTimeout(() => setActionStatus(null), 3000);
      return;
    }

    try {
      setDownloadingOrderDetails(true);

      // Build URL params with selected order IDs if any
      const selectedIds = Array.from(selectedOrders);
      const orderIdsParam =
        selectedIds.length > 0 ? `&orderIds=${selectedIds.join(",")}` : "";

      // If combine mode is ON, download single combined PDF
      if (combineOrderDetailsPDF) {
        const filterMsg =
          selectedIds.length > 0
            ? ` (${selectedIds.length} orders selected)`
            : "";
        setActionStatus({
          type: "info",
          message: `Generating combined order details PDF${filterMsg}...`,
        });

        const skuParam =
          orderDetailsSkuFilter === "ALL"
            ? `&allSkus=true`
            : `&sku=${encodeURIComponent(orderDetailsSkuFilter)}`;

        const response = await fetch(
          `/api/production-queue/download-order-details?combined=true${skuParam}${orderIdsParam}`
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || data.message || "Failed to download");
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const filename =
          orderDetailsSkuFilter === "ALL"
            ? `all_orders_details_${Date.now()}.pdf`
            : `${orderDetailsSkuFilter}_orders_details_${Date.now()}.pdf`;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        setActionStatus({
          type: "success",
          message: `✓ Downloaded combined order details PDF`,
        });
        setTimeout(() => setActionStatus(null), 3000);

        setDownloadingOrderDetails(false);
        return;
      }

      // Original behavior: separate PDFs per SKU
      if (orderDetailsSkuFilter === "ALL") {
        // Download all SKUs separately (filtered by selection if applicable)
        const uniqueSkus =
          selectedIds.length > 0 ? getUniqueSKUs(true) : getUniqueSKUs();
        let successCount = 0;
        let failCount = 0;

        const filterMsg =
          selectedIds.length > 0
            ? ` (${selectedIds.length} orders selected)`
            : "";
        setActionStatus({
          type: "info",
          message: `Downloading order details for ${uniqueSkus.length} SKUs${filterMsg}...`,
        });

        for (const sku of uniqueSkus) {
          try {
            const response = await fetch(
              `/api/production-queue/download-order-details?sku=${encodeURIComponent(
                sku
              )}${orderIdsParam}`
            );

            if (!response.ok) {
              throw new Error(`Failed for ${sku}`);
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${sku}_order_details_${Date.now()}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            successCount++;

            // Small delay between downloads
            await new Promise((resolve) => setTimeout(resolve, 500));
          } catch (error) {
            console.error(
              `Failed to download order details for ${sku}:`,
              error
            );
            failCount++;
          }
        }

        setActionStatus({
          type: successCount > 0 ? "success" : "error",
          message: `✓ Downloaded ${successCount}/${uniqueSkus.length} SKUs${
            failCount > 0 ? ` (${failCount} failed)` : ""
          }`,
        });
        setTimeout(() => setActionStatus(null), 5000);
      } else {
        // Download single SKU
        const filterMsg =
          selectedIds.length > 0
            ? ` (${selectedIds.length} orders selected)`
            : "";
        setActionStatus({
          type: "info",
          message: `Downloading order details for ${orderDetailsSkuFilter}${filterMsg}...`,
        });

        const response = await fetch(
          `/api/production-queue/download-order-details?sku=${encodeURIComponent(
            orderDetailsSkuFilter
          )}${orderIdsParam}`
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || data.message || "Failed to download");
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${orderDetailsSkuFilter}_order_details_${Date.now()}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        setActionStatus({
          type: "success",
          message: `✓ Downloaded order details for ${orderDetailsSkuFilter}`,
        });
        setTimeout(() => setActionStatus(null), 3000);
      }
    } catch (error) {
      console.error("Download error:", error);
      setActionStatus({
        type: "error",
        message: error.message || "Failed to download order details",
      });
      setTimeout(() => setActionStatus(null), 5000);
    } finally {
      setDownloadingOrderDetails(false);
    }
  }

  async function downloadSkuDesigns() {
    if (!skuFilter.trim() || skuFilter === "") {
      setActionStatus({
        type: "error",
        message: "Please select a SKU",
      });
      setTimeout(() => setActionStatus(null), 3000);
      return;
    }

    try {
      setDownloadingSku(true);

      // Build URL params with selected order IDs if any
      const selectedIds = Array.from(selectedOrders);
      const orderIdsParam =
        selectedIds.length > 0 ? `&orderIds=${selectedIds.join(",")}` : "";

      if (skuFilter === "ALL") {
        // Download all SKUs separately (filtered by selection if applicable)
        const uniqueSkus =
          selectedIds.length > 0 ? getUniqueSKUs(true) : getUniqueSKUs();
        let successCount = 0;
        let failCount = 0;

        const filterMsg =
          selectedIds.length > 0
            ? ` (${selectedIds.length} orders selected)`
            : "";
        setActionStatus({
          type: "info",
          message: `Downloading designs for ${uniqueSkus.length} SKUs${filterMsg}...`,
        });

        for (const sku of uniqueSkus) {
          try {
            const response = await fetch(
              `/api/production-queue/download-sku?sku=${encodeURIComponent(
                sku
              )}${orderIdsParam}`
            );

            if (!response.ok) {
              throw new Error(`Failed for ${sku}`);
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${sku}_combined_${Date.now()}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            successCount++;

            // Small delay between downloads
            await new Promise((resolve) => setTimeout(resolve, 500));
          } catch (error) {
            console.error(`Failed to download ${sku}:`, error);
            failCount++;
          }
        }

        setActionStatus({
          type: successCount > 0 ? "success" : "error",
          message: `✓ Downloaded ${successCount}/${uniqueSkus.length} SKUs${
            failCount > 0 ? ` (${failCount} failed)` : ""
          }`,
        });
        setTimeout(() => setActionStatus(null), 5000);
      } else {
        // Download single SKU
        const filterMsg =
          selectedIds.length > 0
            ? ` (${selectedIds.length} orders selected)`
            : "";
        setActionStatus({
          type: "info",
          message: `Downloading designs for ${skuFilter}${filterMsg}...`,
        });

        const response = await fetch(
          `/api/production-queue/download-sku?sku=${encodeURIComponent(
            skuFilter
          )}${orderIdsParam}`
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || data.message || "Failed to download");
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${skuFilter}_combined_${Date.now()}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        setActionStatus({
          type: "success",
          message: `✓ Downloaded designs for ${skuFilter}`,
        });
        setTimeout(() => setActionStatus(null), 3000);
      }
    } catch (error) {
      console.error("Download error:", error);
      setActionStatus({
        type: "error",
        message: error.message || "Failed to download designs",
      });
      setTimeout(() => setActionStatus(null), 5000);
    } finally {
      setDownloadingSku(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading production queue...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation user={user} />

      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Production Queue
            </h1>
            <p className="text-gray-600 mt-2">
              {orders.length} {orders.length === 1 ? "order" : "orders"} ready
              for production
            </p>
          </div>
          <div>
            {!scanningMode ? (
              <button
                onClick={enableScanningMode}
                className="px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold text-xl shadow-lg transition-all"
              >
                📦 Find Order from Barcode
              </button>
            ) : (
              <form
                onSubmit={handleBarcodeSubmit}
                className="flex items-center gap-3"
              >
                <div className="px-8 py-4 bg-green-500 text-white rounded-lg font-bold text-xl shadow-lg">
                  🔍 Scan Barcode Now
                </div>
                <input
                  ref={barcodeInputRef}
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  className="border-2 border-green-500 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Scan..."
                  autoFocus
                />
                <button
                  type="button"
                  onClick={disableScanningMode}
                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  Cancel
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Action Status Message */}
        {actionStatus && (
          <div
            className={`mb-6 p-4 rounded-lg border ${
              actionStatus.type === "success"
                ? "bg-green-50 border-green-200 text-green-800"
                : actionStatus.type === "info"
                ? "bg-blue-50 border-blue-200 text-blue-800"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {actionStatus.message}
              </span>
              <button
                onClick={() => setActionStatus(null)}
                className="text-sm hover:opacity-70"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Tools Section */}
        <div className="mb-6 space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">
            🛠️ Production Tools
          </h2>

          {/* Download Designs Tool */}
          {orders.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-300 p-6">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label
                    htmlFor="sku-filter"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    📦 Bulk Download All Designs for SKU
                  </label>
                  <div className="flex gap-2">
                    <select
                      id="sku-filter"
                      value={skuFilter}
                      onChange={(e) => setSkuFilter(e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    >
                      <option value="">Select a SKU...</option>
                      <option value="ALL" className="font-bold bg-blue-50">
                        ALL SKUS (
                        {selectedOrders.size > 0
                          ? getUniqueSKUs(true).length
                          : getUniqueSKUs().length}{" "}
                        separate PDFs)
                      </option>
                      {getUniqueSKUs().map((sku) => (
                        <option key={sku} value={sku}>
                          {sku}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={downloadSkuDesigns}
                      disabled={downloadingSku || !skuFilter.trim()}
                      className={`px-6 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                        downloadingSku || !skuFilter.trim()
                          ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                          : "bg-green-600 text-white hover:bg-green-700"
                      }`}
                    >
                      {downloadingSku
                        ? "⏳ Downloading..."
                        : skuFilter === "ALL"
                        ? "📥 Download All"
                        : "📥 Download PDF"}
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    {skuFilter === "ALL"
                      ? `This will download ${
                          selectedOrders.size > 0
                            ? getUniqueSKUs(true).length
                            : getUniqueSKUs().length
                        } separate PDFs (one per SKU). Each PDF combines all designs for that SKU.`
                      : "This will combine all design files for the specified SKU into one PDF."}
                    {selectedOrders.size > 0 && (
                      <span className="block mt-1 text-blue-600 font-medium">
                        🔍 Filtering: Only designs from {selectedOrders.size}{" "}
                        selected orders will be included.
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Download Order Details Tool */}
          {orders.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-300 p-6">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label
                    htmlFor="order-details-sku-filter"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    📄 Bulk Download Order Details PDFs
                  </label>
                  <div className="flex gap-2">
                    <select
                      id="order-details-sku-filter"
                      value={orderDetailsSkuFilter}
                      onChange={(e) => setOrderDetailsSkuFilter(e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    >
                      <option value="">Select a SKU...</option>
                      <option value="ALL" className="font-bold bg-blue-50">
                        {combineOrderDetailsPDF
                          ? "ALL SKUS (1 combined PDF)"
                          : `ALL SKUS (${
                              selectedOrders.size > 0
                                ? getUniqueSKUs(true).length
                                : getUniqueSKUs().length
                            } separate PDFs)`}
                      </option>
                      {getUniqueSKUs().map((sku) => (
                        <option key={sku} value={sku}>
                          {sku}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={downloadOrderDetailsPDFs}
                      disabled={
                        downloadingOrderDetails || !orderDetailsSkuFilter.trim()
                      }
                      className={`px-6 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                        downloadingOrderDetails || !orderDetailsSkuFilter.trim()
                          ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                          : "bg-purple-600 text-white hover:bg-purple-700"
                      }`}
                    >
                      {downloadingOrderDetails
                        ? "⏳ Downloading..."
                        : combineOrderDetailsPDF
                        ? "📥 Download Combined PDF"
                        : orderDetailsSkuFilter === "ALL"
                        ? "📥 Download All"
                        : "📥 Download PDF"}
                    </button>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="combine-order-details"
                      checked={combineOrderDetailsPDF}
                      onChange={(e) =>
                        setCombineOrderDetailsPDF(e.target.checked)
                      }
                      className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                    <label
                      htmlFor="combine-order-details"
                      className="text-sm text-gray-700 cursor-pointer"
                    >
                      Combine all orders into a single PDF file
                    </label>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    {combineOrderDetailsPDF
                      ? "All matching orders will be combined into a single PDF file with detailed information (buyer, shipping, products, personalization, notes)."
                      : "Each SKU will generate a separate PDF with detailed order information (buyer, shipping, products, personalization, notes)."}
                    {selectedOrders.size > 0 && (
                      <span className="block mt-1 text-blue-600 font-medium">
                        🔍 Filtering: Only orders from {selectedOrders.size}{" "}
                        selected orders will be included.
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Purchase Shipping Labels Tool */}
          {orders.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-300 p-6">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label
                    htmlFor="label-sku-filter"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    🏷️ Purchase Shipping Labels
                  </label>
                  <div className="flex gap-2">
                    <select
                      id="label-sku-filter"
                      value={labelSkuFilter}
                      onChange={(e) => setLabelSkuFilter(e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white"
                    >
                      <option value="">Select a SKU...</option>
                      <option value="ALL" className="font-bold bg-orange-50">
                        ALL SKUS (
                        {selectedOrders.size > 0
                          ? `${selectedOrders.size} selected orders`
                          : `${orders.length} orders`}
                        )
                      </option>
                      {getUniqueSKUs().map((sku) => (
                        <option key={sku} value={sku}>
                          {sku}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        const ordersToLabel =
                          selectedOrders.size > 0
                            ? orders.filter((o) => selectedOrders.has(o.id))
                            : labelSkuFilter === "ALL"
                            ? orders
                            : orders.filter((o) => {
                                const transactions =
                                  o.raw_order_data?.transactions || [];
                                return transactions.some(
                                  (t) => t.sku === labelSkuFilter
                                );
                              });
                        setLabelOrders(ordersToLabel);
                        setShowLabelPurchaseModal(true);
                        setLabelPurchaseStep(1);
                      }}
                      disabled={!labelSkuFilter.trim() || orders.length === 0}
                      className={`px-6 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                        !labelSkuFilter.trim() || orders.length === 0
                          ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                          : "bg-orange-600 text-white hover:bg-orange-700"
                      }`}
                    >
                      📮 Purchase Labels
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    This will validate addresses, get cheapest USPS rates, and
                    purchase all labels in one flow.
                    {selectedOrders.size > 0 && (
                      <span className="block mt-1 text-blue-600 font-medium">
                        🔍 Filtering: Will process {selectedOrders.size}{" "}
                        selected orders.
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Download Shipping Labels Tool */}
          {orders.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-300 p-6">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label
                    htmlFor="download-label-sku-filter"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    📥 Download Shipping Labels
                  </label>
                  <div className="flex gap-2">
                    <select
                      id="download-label-sku-filter"
                      value={labelSkuFilter}
                      onChange={(e) => setLabelSkuFilter(e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    >
                      <option value="">Select a SKU...</option>
                      <option value="ALL" className="font-bold bg-blue-50">
                        ALL SKUS (
                        {selectedOrders.size > 0
                          ? `${selectedOrders.size} selected orders`
                          : `${orders.length} orders`}
                        )
                      </option>
                      {getUniqueSKUs().map((sku) => (
                        <option key={sku} value={sku}>
                          {sku}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        // TODO: Implement download labels logic
                        alert("Download labels functionality coming soon!");
                      }}
                      disabled={!labelSkuFilter.trim() || orders.length === 0}
                      className={`px-6 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                        !labelSkuFilter.trim() || orders.length === 0
                          ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                          : "bg-blue-600 text-white hover:bg-blue-700"
                      }`}
                    >
                      📥 Download Labels
                    </button>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="combine-labels-download"
                      checked={combineLabels}
                      onChange={(e) => setCombineLabels(e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label
                      htmlFor="combine-labels-download"
                      className="text-sm text-gray-700 cursor-pointer"
                    >
                      Combine all shipping labels into a single PDF file
                    </label>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    Download previously purchased shipping labels.
                    {selectedOrders.size > 0 && (
                      <span className="block mt-1 text-blue-600 font-medium">
                        🔍 Filtering: Will download {selectedOrders.size}{" "}
                        selected orders.
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Selection Controls */}
        {orders.length > 0 && (
          <div className="mb-4 flex items-center gap-4 bg-gray-50 border border-gray-300 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={
                  selectedOrders.size === orders.length && orders.length > 0
                }
                onChange={(e) => {
                  if (e.target.checked) {
                    selectAllOrders();
                  } else {
                    deselectAllOrders();
                  }
                }}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">
                {selectedOrders.size > 0 ? (
                  <>
                    {selectedOrders.size} of {orders.length} selected
                  </>
                ) : (
                  <>Select All ({orders.length})</>
                )}
              </span>
            </div>
            {selectedOrders.size > 0 && (
              <button
                onClick={deselectAllOrders}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Clear Selection
              </button>
            )}
            <div className="ml-auto text-xs text-gray-500">
              💡 Tip: Shift+click to select multiple orders
            </div>
          </div>
        )}

        {orders.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-300 p-12 text-center">
            <div className="text-6xl mb-4">🏭</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No orders ready for production
            </h3>
            <p className="text-gray-600 mb-6">
              Orders will appear here when designs are complete
            </p>
            <Link
              href="/design-queue"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              View Design Queue
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order, orderIndex) => {
              const transactions = order.raw_order_data?.transactions || [];
              const isSelected = selectedOrders.has(order.id);

              return (
                <div
                  key={order.id}
                  className={`bg-white rounded border p-3 transition-colors ${
                    isSelected
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-300"
                  }`}
                >
                  {/* Compact Header */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex flex-col gap-1 flex-1">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) =>
                            toggleSelectOrder(order.id, orderIndex, e.shiftKey)
                          }
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                          title="Select order (Shift+click for range)"
                        />
                        <h3 className="text-sm font-semibold text-gray-900">
                          Order #{order.order_number}
                        </h3>
                        {order.platform === "shopify" ? (
                          <a
                            href={`https://${order.stores?.shop_domain}/admin/orders/${order.external_order_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-500 text-white text-xs font-medium rounded hover:bg-green-600 transition-colors"
                          >
                            Shopify ↗
                          </a>
                        ) : (
                          <a
                            href={`https://www.etsy.com/your/orders/sold?order_id=${order.order_number}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-500 text-white text-xs font-medium rounded hover:bg-orange-600 transition-colors"
                          >
                            Etsy ↗
                          </a>
                        )}
                        <span className="text-xs text-gray-600">
                          {order.customer_name}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(order.order_date).toLocaleDateString()}
                        </span>
                      </div>
                      {(order.tracking_number || order.label_url) && (
                        <div className="flex items-center gap-2 ml-6">
                          {order.tracking_number && (
                            <span className="text-xs text-green-600 font-medium">
                              📦 {order.tracking_number}
                            </span>
                          )}
                          {order.label_url && (
                            <a
                              href={order.label_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500 text-white text-xs font-medium rounded hover:bg-blue-600 transition-colors"
                            >
                              📄 Label ↗
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Production Start/Revision Button */}
                      {order.production_started_at ? (
                        <button
                          onClick={() => {
                            setRevisionOrder(order);
                            setShowRevisionModal(true);
                          }}
                          className="px-3 py-1 rounded text-xs font-medium bg-red-600 text-white hover:bg-red-700"
                        >
                          🔄 Request Design Revision
                        </button>
                      ) : (
                        <button
                          onClick={() => startProduction(order.id)}
                          className="px-3 py-1 rounded text-xs font-medium bg-blue-600 text-white hover:bg-blue-700"
                        >
                          ▶️ Start Production
                        </button>
                      )}

                      {(() => {
                        const hasAddress =
                          order.shipping_address_line1 && order.shipping_zip;
                        const productionStarted = order.production_started_at;
                        const canGetQuote = hasAddress && productionStarted;

                        return (
                          <div className="relative group">
                            <button
                              onClick={() =>
                                canGetQuote && openShippingQuoteModal(order)
                              }
                              disabled={!canGetQuote}
                              className={`px-3 py-1 rounded text-xs font-medium ${
                                canGetQuote
                                  ? "bg-green-600 text-white hover:bg-green-700"
                                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
                              }`}
                            >
                              📦 Get Shipping Quote
                            </button>
                            {!canGetQuote && (
                              <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-10">
                                <div className="bg-gray-900 text-white text-xs rounded py-2 px-3 whitespace-nowrap">
                                  {!hasAddress
                                    ? "Missing shipping address"
                                    : "Start production first"}
                                  <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      <Link
                        href={`/orders/${order.id}`}
                        className="text-blue-600 hover:text-blue-700 text-xs"
                      >
                        Details →
                      </Link>
                    </div>
                  </div>

                  {/* Compact Notes */}
                  {(order.notes || order.customer_notes) && (
                    <div className="mb-2 space-y-1">
                      {order.notes && (
                        <div className="p-2 bg-gray-50 rounded text-xs">
                          <span className="font-medium text-gray-700">📋</span>{" "}
                          <span className="text-gray-600">{order.notes}</span>
                        </div>
                      )}
                      {order.customer_notes && (
                        <div className="p-2 bg-blue-50 rounded text-xs">
                          <span className="font-medium text-blue-900">💬</span>{" "}
                          <span className="text-blue-800">
                            {order.customer_notes}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Compact Items List */}
                  <div className="space-y-2">
                    {transactions.map((txn, idx) => {
                      const transactionId = txn.transaction_id?.toString();
                      const designFile = order.design_files?.find(
                        (df) => df.transaction_id === transactionId
                      );

                      const personalization = txn.variations?.find(
                        (v) => v.formatted_name === "Personalization"
                      )?.formatted_value;
                      const enrichment =
                        order.raw_order_data?.customer_enrichment?.find(
                          (e) => e.transaction_id === transactionId
                        );

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
                          className="border border-gray-200 rounded p-2 bg-gray-50"
                        >
                          {/* Item Header - single line */}
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex-1 min-w-0">
                              <span className="text-xs font-medium text-gray-900 truncate block">
                                {txn.title || "Unknown Product"}
                              </span>
                              <span className="text-xs text-gray-500">
                                {baseSku}
                                {appendedPart && (
                                  <span className="text-blue-600 font-medium">
                                    {appendedPart}
                                  </span>
                                )}{" "}
                                • Qty: {txn.quantity || 1}
                              </span>
                              {/* Dimensions and Weight */}
                              {(txn.product_dimensions ||
                                txn.product_weight) && (
                                <div className="text-xs text-gray-600 mt-0.5">
                                  {txn.product_dimensions && (
                                    <span>
                                      📏 {txn.product_dimensions.length || "?"}×
                                      {txn.product_dimensions.width || "?"}×
                                      {txn.product_dimensions.height || "?"}"
                                    </span>
                                  )}
                                  {txn.product_dimensions &&
                                    txn.product_weight &&
                                    " • "}
                                  {txn.product_weight && (
                                    <span>⚖️ {txn.product_weight} oz</span>
                                  )}
                                </div>
                              )}
                            </div>
                            {designFile?.file_url && (
                              <a
                                href={designFile.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ml-2 text-xs text-blue-600 hover:text-blue-700 font-medium whitespace-nowrap"
                              >
                                📄 Design
                              </a>
                            )}
                          </div>

                          {/* Canva Template Link */}
                          {txn.canva_template_url && (
                            <div className="mt-1">
                              <a
                                href={txn.canva_template_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-1 bg-purple-600 text-white text-xs font-medium rounded hover:bg-purple-700 transition-colors"
                              >
                                🎨 Canva ↗
                              </a>
                            </div>
                          )}

                          {/* Compact Personalization & Enrichment */}
                          {personalization &&
                            personalization !==
                              "Not requested on this item" && (
                              <div className="mt-1 p-1.5 bg-yellow-50 border border-yellow-200 rounded text-xs">
                                <span className="font-medium text-yellow-900">
                                  📝
                                </span>{" "}
                                <span className="text-yellow-800">
                                  {personalization}
                                </span>
                              </div>
                            )}
                          {enrichment && (
                            <div className="mt-1 p-1.5 bg-purple-50 border border-purple-200 rounded text-xs">
                              <span className="font-medium text-purple-900">
                                ✨
                              </span>{" "}
                              {enrichment.custom_text && (
                                <span className="text-purple-800">
                                  {enrichment.custom_text}
                                </span>
                              )}
                              {enrichment.file_url && (
                                <a
                                  href={enrichment.file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-purple-600 hover:text-purple-700 ml-1"
                                >
                                  View ↗
                                </a>
                              )}
                            </div>
                          )}
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

      {/* Scanned Order Modal */}
      {scannedOrder && (
        <div
          className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"
          onClick={closeOrderModal}
        >
          <div
            className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-300 px-6 py-4 flex items-center justify-between z-10">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold text-gray-900">
                    Order #{scannedOrder.order_number}
                  </h2>
                  <Link
                    href={`/orders/${scannedOrder.id}`}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    View Details →
                  </Link>
                </div>
                <p className="text-gray-600 text-sm mt-1">
                  {scannedOrder.customer_name} •{" "}
                  {new Date(scannedOrder.order_date).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={closeOrderModal}
                className="text-gray-500 hover:text-gray-700 text-3xl font-bold leading-none"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              <div className="space-y-6">
                {/* Buyer Information */}
                <div className="bg-gray-50 rounded-lg border border-gray-300 p-5">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    🛍️ Buyer Information
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <div className="text-sm text-gray-500">Buyer Name</div>
                      <div className="text-gray-900 font-medium">
                        {scannedOrder.raw_order_data?.receipt?.buyer_user_id
                          ? `Etsy User ID: ${scannedOrder.raw_order_data.receipt.buyer_user_id}`
                          : scannedOrder.raw_order_data?.receipt?.name || "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Buyer Email</div>
                      <div className="text-gray-900">
                        {scannedOrder.customer_email ||
                          scannedOrder.raw_order_data?.receipt?.buyer_email ||
                          "—"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Shipping Address */}
                <div className="bg-gray-50 rounded-lg border border-gray-300 p-5">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    📦 Ship To
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <div className="text-sm text-gray-500">
                        Recipient Name
                      </div>
                      <div className="font-medium text-gray-900">
                        {scannedOrder.customer_name ||
                          scannedOrder.raw_order_data?.receipt?.name ||
                          "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Address</div>
                      <div className="text-gray-900">
                        {scannedOrder.shipping_address_line1 ||
                        scannedOrder.raw_order_data?.receipt?.first_line ? (
                          <>
                            {scannedOrder.shipping_address_line1 ||
                              scannedOrder.raw_order_data?.receipt?.first_line}
                            {(scannedOrder.shipping_address_line2 ||
                              scannedOrder.raw_order_data?.receipt
                                ?.second_line) && (
                              <>
                                <br />
                                {scannedOrder.shipping_address_line2 ||
                                  scannedOrder.raw_order_data?.receipt
                                    ?.second_line}
                              </>
                            )}
                            <br />
                            {scannedOrder.shipping_city ||
                              scannedOrder.raw_order_data?.receipt?.city ||
                              ""}
                            {(scannedOrder.shipping_city ||
                              scannedOrder.raw_order_data?.receipt?.city) &&
                            (scannedOrder.shipping_state ||
                              scannedOrder.raw_order_data?.receipt?.state)
                              ? ", "
                              : ""}
                            {scannedOrder.shipping_state ||
                              scannedOrder.raw_order_data?.receipt?.state ||
                              ""}{" "}
                            {scannedOrder.shipping_zip ||
                              scannedOrder.raw_order_data?.receipt?.zip ||
                              ""}
                            <br />
                            {scannedOrder.shipping_country ||
                              scannedOrder.raw_order_data?.receipt
                                ?.country_iso ||
                              ""}
                          </>
                        ) : (
                          <div className="text-red-600 text-sm">
                            ⚠️ No shipping address found
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Product Information - All Items */}
                <div className="bg-gray-50 rounded-lg border border-gray-300 p-5">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    🎨 Order Items
                  </h3>
                  {scannedOrder.raw_order_data?.transactions?.length > 0 ? (
                    <div className="space-y-6">
                      {scannedOrder.raw_order_data.transactions.map(
                        (transaction, idx) => {
                          const transactionId =
                            transaction.transaction_id?.toString();
                          const designFile = scannedOrder.design_files?.find(
                            (df) => df.transaction_id === transactionId
                          );
                          const personalization = transaction.variations?.find(
                            (v) => v.formatted_name === "Personalization"
                          )?.formatted_value;
                          const enrichment =
                            scannedOrder.raw_order_data?.customer_enrichment?.find(
                              (e) => e.transaction_id === transactionId
                            );

                          return (
                            <div
                              key={transaction.transaction_id || idx}
                              className="pb-6 border-b border-gray-200 last:border-b-0 last:pb-0"
                            >
                              {/* Item Header */}
                              <div className="flex items-start justify-between mb-3">
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
                                {scannedOrder.raw_order_data.transactions
                                  .length > 1 && (
                                  <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                    Item {idx + 1} of{" "}
                                    {
                                      scannedOrder.raw_order_data.transactions
                                        .length
                                    }
                                  </span>
                                )}
                              </div>

                              {/* Two-column layout: Info on left, PDF on right */}
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {/* Left Column: Info */}
                                <div className="space-y-3">
                                  {/* Canva Template Link */}
                                  {transaction.canva_template_url && (
                                    <div>
                                      <a
                                        href={transaction.canva_template_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 px-3 py-1 bg-purple-600 text-white text-sm font-medium rounded hover:bg-purple-700 transition-colors"
                                      >
                                        🎨 Canva ↗
                                      </a>
                                    </div>
                                  )}

                                  {/* Variations from Etsy */}
                                  {transaction.variations &&
                                    transaction.variations.length > 0 && (
                                      <div>
                                        <div className="text-xs text-gray-500 mb-1">
                                          Personalization from Etsy:
                                        </div>
                                        <div className="bg-yellow-50 border border-yellow-200 rounded p-2 text-sm text-gray-900">
                                          {transaction.variations
                                            .map((v) => {
                                              const value = v.formatted_value
                                                ?.replace(/&quot;/g, '"')
                                                ?.replace(/&amp;/g, "&")
                                                ?.replace(/&lt;/g, "<")
                                                ?.replace(/&gt;/g, ">")
                                                ?.replace(/&#39;/g, "'");
                                              return `${v.formatted_name}: ${value}`;
                                            })
                                            .join(" | ")}
                                        </div>
                                      </div>
                                    )}

                                  {/* Enrichment Data */}
                                  {enrichment && (
                                    <div>
                                      <div className="text-xs text-gray-500 mb-1">
                                        Customer Enrichment:
                                      </div>
                                      {enrichment.custom_text && (
                                        <div className="bg-purple-50 border border-purple-200 rounded p-2 text-sm text-purple-900 mb-2">
                                          {enrichment.custom_text}
                                        </div>
                                      )}
                                      {enrichment.file_url && (
                                        <a
                                          href={enrichment.file_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1 px-3 py-1 bg-purple-600 text-white text-sm font-medium rounded hover:bg-purple-700"
                                        >
                                          📎 View File ↗
                                        </a>
                                      )}
                                    </div>
                                  )}

                                  {/* Design File Link */}
                                  {designFile?.file_url && (
                                    <div>
                                      <a
                                        href={designFile.file_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors"
                                      >
                                        📄 Design File ↗
                                      </a>
                                      <div className="text-xs text-gray-500 mt-1">
                                        {designFile.file_path
                                          ?.split("/")
                                          .pop() || "Design File"}
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* Right Column: PDF Preview */}
                                <div>
                                  {designFile?.file_url &&
                                    (designFile.file_url
                                      .toLowerCase()
                                      .endsWith(".pdf") ||
                                      designFile.file_path
                                        ?.toLowerCase()
                                        .endsWith(".pdf")) && (
                                      <div className="border-2 border-gray-300 rounded-lg overflow-hidden bg-gray-100">
                                        <iframe
                                          src={designFile.file_url}
                                          className="w-full h-[500px]"
                                          title={`Design preview for ${transaction.title}`}
                                        />
                                      </div>
                                    )}
                                </div>
                              </div>
                            </div>
                          );
                        }
                      )}
                    </div>
                  ) : (
                    <div className="text-gray-500">No items found</div>
                  )}
                </div>

                {/* Customer Notes */}
                {(scannedOrder.notes || scannedOrder.customer_notes) && (
                  <div className="bg-gray-50 rounded-lg border border-gray-300 p-5">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      📝 Notes
                    </h3>
                    <div className="space-y-3">
                      {scannedOrder.notes && (
                        <div>
                          <div className="text-sm text-gray-500 mb-1">
                            Internal Notes
                          </div>
                          <div className="bg-gray-100 rounded p-3 text-gray-900 text-sm">
                            {scannedOrder.notes}
                          </div>
                        </div>
                      )}
                      {scannedOrder.customer_notes && (
                        <div>
                          <div className="text-sm text-gray-500 mb-1">
                            Customer Notes
                          </div>
                          <div className="bg-blue-50 rounded p-3 text-gray-900 text-sm">
                            {scannedOrder.customer_notes}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Status */}
                <div className="bg-gray-50 rounded-lg border border-gray-300 p-5">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Status
                  </h3>
                  <div
                    className={`px-4 py-2 rounded border font-medium text-center ${getStatusColor(
                      scannedOrder.status
                    )}`}
                  >
                    {scannedOrder.status.replace(/_/g, " ").toUpperCase()}
                  </div>
                </div>

                {/* Order Source */}
                <div className="bg-gray-50 rounded-lg border border-gray-300 p-5">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Order Source
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <div className="text-sm text-gray-500">Platform</div>
                      <div className="font-medium text-gray-900 capitalize">
                        {scannedOrder.stores?.platform || scannedOrder.platform}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Store</div>
                      <div className="text-gray-900">
                        {scannedOrder.stores?.store_name || "—"}
                      </div>
                    </div>
                    <div>
                      {scannedOrder.platform === "shopify" ? (
                        <a
                          href={`https://${scannedOrder.stores?.shop_domain}/admin/orders/${scannedOrder.external_order_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-2 bg-green-500 text-white text-sm font-medium rounded hover:bg-green-600 transition-colors"
                        >
                          View on Shopify ↗
                        </a>
                      ) : (
                        <a
                          href={`https://www.etsy.com/your/orders/sold?order_id=${scannedOrder.external_order_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-2 bg-orange-500 text-white text-sm font-medium rounded hover:bg-orange-600 transition-colors"
                        >
                          View on Etsy ↗
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Shipping Quote Modal */}
      {shippingQuoteOrder && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={closeShippingQuoteModal}
        >
          <div
            className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                📦 Shipping Quote - Order #{shippingQuoteOrder.order_number}
              </h2>
              <button
                onClick={closeShippingQuoteModal}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Shipping Address */}
              <div className="bg-gray-50 p-4 rounded">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-900">Ship To:</h3>
                  {validatingAddress && (
                    <span className="text-xs text-blue-600">
                      🔍 Validating address...
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-700">
                  <div>{shippingQuoteOrder.customer_name}</div>
                  <div>{shippingQuoteOrder.shipping_address_line1}</div>
                  {shippingQuoteOrder.shipping_address_line2 && (
                    <div>{shippingQuoteOrder.shipping_address_line2}</div>
                  )}
                  <div>
                    {shippingQuoteOrder.shipping_city},{" "}
                    {shippingQuoteOrder.shipping_state}{" "}
                    {shippingQuoteOrder.shipping_zip}
                  </div>
                  {shippingQuoteOrder.shipping_country && (
                    <div>{shippingQuoteOrder.shipping_country}</div>
                  )}
                </div>
              </div>

              {/* Address Update Prompt */}
              {showAddressUpdatePrompt && validatedAddress && (
                <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
                  <div className="flex items-start gap-3">
                    <div className="text-yellow-600 text-xl">⚠️</div>
                    <div className="flex-1">
                      <h4 className="font-medium text-yellow-900 mb-2">
                        Corrected Address Found
                      </h4>
                      <p className="text-sm text-yellow-800 mb-3">
                        ShipEngine suggests using this verified address:
                      </p>
                      <div className="bg-white p-3 rounded text-sm text-gray-700 mb-3">
                        <div>{validatedAddress.address_line1}</div>
                        {validatedAddress.address_line2 && (
                          <div>{validatedAddress.address_line2}</div>
                        )}
                        <div>
                          {validatedAddress.city_locality},{" "}
                          {validatedAddress.state_province}{" "}
                          {validatedAddress.postal_code}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={updateOrderAddress}
                          className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                        >
                          Update Address
                        </button>
                        <button
                          onClick={() => {
                            setShowAddressUpdatePrompt(false);
                            setValidatedAddress(null);
                          }}
                          className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300"
                        >
                          Keep Current
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Package Dimensions & Weight Override */}
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900">Package Details:</h3>

                {/* Dimensions */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Dimensions (inches)
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">
                        Length
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={packageDims.length}
                        onChange={(e) =>
                          setPackageDims({
                            ...packageDims,
                            length: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">
                        Width
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={packageDims.width}
                        onChange={(e) =>
                          setPackageDims({
                            ...packageDims,
                            width: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">
                        Height
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={packageDims.height}
                        onChange={(e) =>
                          setPackageDims({
                            ...packageDims,
                            height: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Weight */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Total Weight (ounces)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={packageWeight}
                    onChange={(e) =>
                      setPackageWeight(parseFloat(e.target.value) || 0)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  />
                </div>

                {/* Get Rates Button */}
                <button
                  onClick={fetchShippingRates}
                  disabled={loadingRates}
                  className={`w-full px-4 py-2 rounded font-medium ${
                    loadingRates
                      ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  {loadingRates ? "⏳ Getting Rates..." : "Get Shipping Rates"}
                </button>
              </div>

              {/* Shipping Rates */}
              {shippingRates.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-medium text-gray-900">
                    Available Shipping Options:
                  </h3>
                  <div className="space-y-2">
                    {shippingRates.map((rate, idx) => (
                      <div
                        key={idx}
                        className="border border-gray-200 rounded p-4 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">
                              {rate.serviceName}
                            </div>
                            <div className="text-sm text-gray-600">
                              {rate.carrierFriendlyName || rate.carrierCode}
                            </div>
                            {/* Delivery Time */}
                            {(rate.deliveryDays ||
                              rate.estimatedDeliveryDate) && (
                              <div className="text-sm text-blue-600 mt-1">
                                {rate.deliveryDays && (
                                  <span>
                                    📅 {rate.deliveryDays} business days
                                  </span>
                                )}
                                {rate.estimatedDeliveryDate && (
                                  <span className="ml-2">
                                    • Est:{" "}
                                    {new Date(
                                      rate.estimatedDeliveryDate
                                    ).toLocaleDateString()}
                                  </span>
                                )}
                                {rate.guaranteedService && (
                                  <span className="ml-2 text-green-600">
                                    ✓ Guaranteed
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className="text-lg font-bold text-gray-900">
                                ${rate.shipmentCost?.toFixed(2) || "—"}
                              </div>
                              {rate.otherCost > 0 && (
                                <div className="text-xs text-gray-500">
                                  +${rate.otherCost.toFixed(2)} fees
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => {
                                // Purchase single label
                                setLabelOrders([shippingQuoteOrder]);
                                setLabelRates({
                                  [shippingQuoteOrder.id]: {
                                    ...rate,
                                    weight: packageWeight,
                                    dimensions: packageDims,
                                  },
                                });
                                setShowLabelPurchaseModal(true);
                                setLabelPurchaseStep(3); // Skip to confirmation
                                closeShippingQuoteModal();
                              }}
                              className="px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 whitespace-nowrap"
                            >
                              🏷️ Purchase Label
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No rates message */}
              {!loadingRates && shippingRates.length === 0 && (
                <div className="text-center text-gray-500 py-8">
                  Click "Get Shipping Rates" to see available options
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Label Purchase Modal */}
      {showLabelPurchaseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">
                🏷️ Purchase Shipping Labels - Step {labelPurchaseStep} of 3
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Processing {labelOrders.length} order(s)
              </p>
            </div>

            <div className="p-6">
              {/* Step indicator */}
              <div className="flex items-center justify-between mb-6">
                <div
                  className={`flex-1 text-center ${
                    labelPurchaseStep >= 1
                      ? "text-blue-600 font-medium"
                      : "text-gray-400"
                  }`}
                >
                  <div
                    className={`w-8 h-8 mx-auto rounded-full ${
                      labelPurchaseStep >= 1
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200"
                    } flex items-center justify-center mb-1`}
                  >
                    1
                  </div>
                  Validate
                </div>
                <div className="flex-1 h-0.5 bg-gray-200"></div>
                <div
                  className={`flex-1 text-center ${
                    labelPurchaseStep >= 2
                      ? "text-blue-600 font-medium"
                      : "text-gray-400"
                  }`}
                >
                  <div
                    className={`w-8 h-8 mx-auto rounded-full ${
                      labelPurchaseStep >= 2
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200"
                    } flex items-center justify-center mb-1`}
                  >
                    2
                  </div>
                  Get Rates
                </div>
                <div className="flex-1 h-0.5 bg-gray-200"></div>
                <div
                  className={`flex-1 text-center ${
                    labelPurchaseStep >= 3
                      ? "text-blue-600 font-medium"
                      : "text-gray-400"
                  }`}
                >
                  <div
                    className={`w-8 h-8 mx-auto rounded-full ${
                      labelPurchaseStep >= 3
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200"
                    } flex items-center justify-center mb-1`}
                  >
                    3
                  </div>
                  Purchase
                </div>
              </div>

              {/* Step 1: Address Validation */}
              {labelPurchaseStep === 1 && (
                <div className="space-y-4">
                  <h3 className="font-medium text-gray-900">
                    Address Validation
                  </h3>

                  {validatingAddresses ? (
                    <div className="text-center py-8">
                      <div className="text-gray-600">
                        ⏳ Validating {labelOrders.length} address(es)...
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {labelOrders.map((order) => {
                          const validation = labelAddressValidations[order.id];
                          const hasCorrection =
                            validation?.status === "verified" &&
                            validation?.corrected &&
                            (validation.corrected.address_line1 !==
                              order.shipping_address_line1 ||
                              validation.corrected.city_locality !==
                                order.shipping_city ||
                              validation.corrected.state_province !==
                                order.shipping_state ||
                              validation.corrected.postal_code !==
                                order.shipping_zip);

                          return (
                            <div
                              key={order.id}
                              className="border border-gray-200 rounded p-3"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="font-medium text-sm">
                                    Order #{order.order_number}
                                  </div>
                                  <div className="text-xs text-gray-600 mt-1">
                                    {order.shipping_address_line1}
                                    {order.shipping_address_line2 &&
                                      `, ${order.shipping_address_line2}`}
                                    <br />
                                    {order.shipping_city},{" "}
                                    {order.shipping_state} {order.shipping_zip}
                                  </div>
                                  {hasCorrection && !validation.applied && (
                                    <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                                      <div className="font-medium text-yellow-800 mb-1">
                                        ⚠️ Suggested Correction:
                                      </div>
                                      <div className="text-gray-700">
                                        {validation.corrected.address_line1}
                                        {validation.corrected.address_line2 &&
                                          `, ${validation.corrected.address_line2}`}
                                        <br />
                                        {
                                          validation.corrected.city_locality
                                        }, {validation.corrected.state_province}{" "}
                                        {validation.corrected.postal_code}
                                      </div>
                                      <button
                                        onClick={() =>
                                          applyAddressCorrection(order.id)
                                        }
                                        className="mt-2 px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                                      >
                                        Apply Correction
                                      </button>
                                    </div>
                                  )}
                                  {validation?.applied && (
                                    <div className="mt-2 text-xs text-green-600">
                                      ✓ Correction applied
                                    </div>
                                  )}
                                </div>
                                <div className="ml-3">
                                  {validation?.status === "verified" && (
                                    <span className="text-green-600 text-sm">
                                      ✓
                                    </span>
                                  )}
                                  {validation?.status === "error" && (
                                    <span className="text-red-600 text-sm">
                                      ✗
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex gap-3 pt-4">
                        <button
                          onClick={() => {
                            setShowLabelPurchaseModal(false);
                            setLabelPurchaseStep(1);
                            setLabelAddressValidations({});
                          }}
                          className="flex-1 px-6 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => setLabelPurchaseStep(2)}
                          disabled={validatingAddresses}
                          className={`flex-1 px-6 py-2 rounded font-medium ${
                            validatingAddresses
                              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                              : "bg-blue-600 text-white hover:bg-blue-700"
                          }`}
                        >
                          Continue to Rates →
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Step 2: Get Cheapest Rates */}
              {labelPurchaseStep === 2 && (
                <div className="space-y-4">
                  <h3 className="font-medium text-gray-900">
                    Getting Cheapest USPS Rates
                  </h3>
                  <p className="text-sm text-gray-600">
                    Finding the cheapest USPS rate (excluding Media Mail) for
                    each order...
                  </p>
                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={() => {
                        setShowLabelPurchaseModal(false);
                        setLabelPurchaseStep(1);
                        setLabelRates({});
                      }}
                      className="flex-1 px-6 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => setLabelPurchaseStep(3)}
                      className="flex-1 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Continue to Purchase →
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Confirm & Purchase */}
              {labelPurchaseStep === 3 && (
                <div className="space-y-4">
                  <h3 className="font-medium text-gray-900">
                    Confirm Purchase
                  </h3>
                  <div className="bg-gray-50 p-4 rounded">
                    <div className="text-sm space-y-2">
                      <div className="flex justify-between">
                        <span>Orders:</span>
                        <span className="font-medium">
                          {labelOrders.length}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Cost:</span>
                        <span className="font-medium text-lg">
                          $
                          {Object.values(labelRates)
                            .reduce((sum, r) => sum + (r.shipmentCost || 0), 0)
                            .toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowLabelPurchaseModal(false)}
                      className="flex-1 px-6 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        setPurchasingLabels(true);
                        try {
                          const response = await fetch(
                            "/api/shipstation/purchase-labels",
                            {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                orders: labelOrders,
                                rates: labelRates,
                              }),
                            }
                          );

                          if (!response.ok) {
                            const errorData = await response
                              .json()
                              .catch(() => ({}));
                            const errorMessage =
                              errorData.error || "Failed to purchase labels";
                            throw new Error(errorMessage);
                          }

                          const data = await response.json();

                          setShowLabelPurchaseModal(false);
                          setLabelPurchaseStep(1);
                          setLabelOrders([]);
                          setLabelRates({});

                          // Reload orders to show tracking numbers
                          await loadOrders();

                          setActionStatus({
                            type: "success",
                            message: `✓ ${
                              data.totalPurchased
                            } label(s) purchased! ${
                              data.totalFailed > 0
                                ? `(${data.totalFailed} failed)`
                                : ""
                            }`,
                          });

                          // Clear status after 5 seconds
                          setTimeout(() => setActionStatus(null), 5000);
                        } catch (error) {
                          console.error("Purchase labels error:", error);
                          setActionStatus({
                            type: "error",
                            message: `✗ Failed to purchase labels: ${error.message}`,
                          });
                          setTimeout(() => setActionStatus(null), 5000);
                        } finally {
                          setPurchasingLabels(false);
                        }
                      }}
                      disabled={purchasingLabels}
                      className={`flex-1 px-6 py-2 rounded font-medium ${
                        purchasingLabels
                          ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                          : "bg-green-600 text-white hover:bg-green-700"
                      }`}
                    >
                      {purchasingLabels
                        ? "⏳ Purchasing..."
                        : `🏷️ Buy ${labelOrders.length} Label${
                            labelOrders.length === 1 ? "" : "s"
                          }`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Design Revision Request Modal */}
      {showRevisionModal && revisionOrder && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => {
            if (!requestingRevision) {
              setShowRevisionModal(false);
              setRevisionOrder(null);
              setRevisionNotes("");
            }
          }}
        >
          <div
            className="bg-white rounded-lg max-w-2xl w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Request Design Revision
            </h2>

            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-sm text-yellow-900">
                ⚠️ This will send order{" "}
                <strong>#{revisionOrder.order_number}</strong> back to the
                design queue. Designers will be able to make changes and
                re-upload design files.
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Revision Notes (optional)
              </label>
              <textarea
                value={revisionNotes}
                onChange={(e) => setRevisionNotes(e.target.value)}
                placeholder="Describe what needs to be changed..."
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRevisionModal(false);
                  setRevisionOrder(null);
                  setRevisionNotes("");
                }}
                disabled={requestingRevision}
                className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRequestRevision}
                disabled={requestingRevision}
                className={`flex-1 px-6 py-3 rounded-lg font-medium ${
                  requestingRevision
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-red-600 text-white hover:bg-red-700"
                }`}
              >
                {requestingRevision
                  ? "Sending back to design..."
                  : "Confirm - Request Revision"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

# Shopify SKU Setup Guide

## How to Add SKUs to Your Shopify Products

### Step 1: Access Product Settings

1. Log in to your **Shopify Admin**
2. Navigate to **Products** in the left sidebar
3. Click on the product you want to configure

### Step 2: Add SKU to Variants

1. Scroll down to the **Variants** section
2. Each variant (size, color, etc.) has its own **SKU** field
3. Enter your internal SKU in the SKU field
   - Example: `BLKT-KPOP-001-30-40`
   - Use the same SKU format as your Etsy products
4. Click **Save**

### Step 3: Repeat for All Products

- Make sure every product variant has a SKU
- Use consistent SKU naming across all platforms (Etsy, Shopify, etc.)

## What Happens When Orders Sync

When you click **Auto Import** on the Orders page:

1. ✅ **SKU is extracted** from the Shopify order line items
   - For existing orders without SKUs, fetches current product data from Shopify
2. ✅ **Product name** is pulled from the line item
3. ✅ **Shipping address** is extracted from the order
4. ✅ **Fulfillment status** is checked
   - If order is marked as **Fulfilled** in Shopify → Auto-advances to `labels_generated`
   - Won't move order backward if already past `labels_generated`
5. ✅ **Product matching** happens automatically
   - If the SKU matches one in your `product_templates`, the system:
     - Uses that product's configuration
     - Auto-advances status if no personalization is needed
     - Shows the correct Canva template URL

## SKU Matching Logic

The system matches Shopify SKUs to your internal product templates:

```
Shopify Order → Line Item SKU → Match to product_templates → Apply configuration
```

### Example Flow:

1. **Shopify Product**: "K-Pop Star Blanket (30x40)" → SKU: `BLKT-KPOP-001-30-40`
2. **Order Syncs** → System extracts SKU: `BLKT-KPOP-001-30-40`
3. **Product Template Match** → Finds matching product in Settings > Products
4. **Configuration Applied**:
   - Personalization type: `both` (text + image)
   - Dimensions: `30" x 40"`
   - Canva template URL loaded
5. **Status Set**: `pending_enrichment` (customer needs to upload)

## Fulfillment Status Syncing

### How It Works:

When an order is marked as **Fulfilled** in Shopify:

- ✅ Automatically advances to `labels_generated` status
- ✅ Only advances orders that are before `labels_generated` in the workflow
- ✅ Won't move orders backward if they're already at `loaded_for_shipment`, `in_transit`, or `delivered`

### Status Workflow:

```
pending_enrichment → needs_review → ready_for_design → design_complete
→ in_production → labels_generated → loaded_for_shipment → in_transit → delivered
                   ↑
                   Fulfilled orders advance to here
```

### Use Case:

Perfect for orders you fulfill outside of the app but want to track in your system:

1. Mark order as fulfilled in Shopify (manually or via another app)
2. Add tracking number to the fulfillment in Shopify
3. Run **Auto Import** in our app
4. Order automatically moves to `labels_generated` status
5. Tracking number is imported and displayed on order page
6. Label URL is imported (if available) with download link
7. Continue with normal workflow (loading for shipment, etc.)

### Tracking Number Integration:

When you sync fulfilled Shopify orders:

- ✅ **Tracking number** is extracted from Shopify fulfillments
- ✅ **Label URL** is extracted (if Shopify has it)
- ✅ **Order page** shows tracking number and "Download Label" link
- ✅ **Production page** barcode scanner works with Shopify tracking numbers
- ✅ **Shipping page** scanner marks orders as loaded using Shopify tracking numbers
- ✅ Works exactly like labels purchased through our app!

## Multi-Item Orders

For orders with multiple line items:

- The first item's SKU is used as the primary SKU
- All line items are stored in `raw_order_data`
- You can view all items in the order details

## Troubleshooting

### "Product not found" or no auto-advancement

- ✅ Check that the SKU in Shopify **exactly matches** the SKU in Settings > Products
- ✅ SKUs are case-sensitive: `BLKT-001` ≠ `blkt-001`
- ✅ Make sure there are no extra spaces

### Orders show "Unknown" product

- ✅ Add the SKU to your Shopify product variant
- ✅ Re-sync the store to update existing orders

### No shipping address

- ✅ Make sure the Shopify order has a shipping address
- ✅ Digital products might not have shipping addresses

## Tips

1. **Standardize SKUs across platforms** - Use the same SKU format for Etsy and Shopify
2. **Use descriptive SKUs** - Include product type, variant, and size
3. **Document your SKU format** - Keep a reference guide for your team
4. **Bulk edit in Shopify** - Use Shopify's bulk editor to add SKUs to multiple products at once

## Bulk SKU Update in Shopify

1. Go to **Products** → Select multiple products
2. Click **More actions** → **Edit products**
3. Select **Add fields** → **SKU**
4. Update SKUs in bulk
5. Click **Save**

---

**Need help?** Check the Shopify documentation on [Product Variants](https://help.shopify.com/en/manual/products/variants)

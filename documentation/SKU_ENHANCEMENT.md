# SKU Enhancement with Dimensions

## Overview

The system automatically enhances Etsy SKUs with product dimensions to create unique SKUs per size variant. This allows different sizes of the same base product to have different product configurations (Canva templates, personalization requirements, SLA, etc.).

---

## Why SKU Enhancement?

**Problem:** Etsy SKUs don't include size information

- Etsy SKU: `BLKT-KPOP-001`
- This SKU is used for 30x40, 50x60, and all other sizes
- Can't configure different settings per size

**Solution:** Append dimensions from order variations

- Enhanced SKU: `BLKT-KPOP-001-30-40`
- Each size gets its own SKU
- Each size can have its own product configuration

---

## How It Works

### 1. **During Order Sync**

When orders are imported from Etsy:

```javascript
// Original Etsy data:
{
  sku: "BLKT-KPOP-001",
  variations: [
    { formatted_name: "Size", formatted_value: "30x40" },
    { formatted_name: "Personalization", formatted_value: "Elle" }
  ]
}

// Enhanced SKU created:
BLKT-KPOP-001-30-40
```

### 2. **Dimension Extraction Algorithm**

The `enhanceSKUWithDimensions()` function:

1. Looks for variations with "size" or "dimension" in the name
2. Extracts all numerals from the value
3. Joins them with dashes
4. Appends to base SKU

**Supported Formats:**

- `30x40` → `BLKT-KPOP-001-30-40`
- `30&quot;x40&quot;` → `BLKT-KPOP-001-30-40`
- `30 x 40` → `BLKT-KPOP-001-30-40`
- `30×40` → `BLKT-KPOP-001-30-40`
- `50x60 inches` → `BLKT-KPOP-001-50-60`

### 3. **Where It's Applied**

Enhanced SKUs are used:

- ✅ Order sync (manual and automatic cron)
- ✅ Enrichment form product lookup
- ✅ Product configuration matching
- ✅ Auto-status advancement logic
- ✅ Order display and filtering

---

## Product Configuration

### Creating Product Templates

When configuring products, use the **enhanced SKU format**:

**Example: 30x40 Blankets**

```
SKU: BLKT-KPOP-001-30-40
Product Name: Demon Hunters Blanket 30x40
Canva Template: [link to 30x40 template]
Personalization: Text/Notes
Dimensions: 30 x 40 x 0.5 inches
```

**Example: 50x60 Blankets**

```
SKU: BLKT-KPOP-001-50-60
Product Name: Demon Hunters Blanket 50x60
Canva Template: [link to 50x60 template]
Personalization: Text/Notes
Dimensions: 50 x 60 x 0.5 inches
```

### Unconfigured SKUs Modal

When new orders come in with dimensions not yet configured:

- Modal will show: `BLKT-KPOP-001-30-40` (enhanced SKU)
- Create product configuration using this enhanced SKU
- System will automatically match future orders with same dimensions

---

## Edge Cases

### No Size Information

If an order has no size variation:

- Original SKU is used: `BLKT-KPOP-001`
- No dimensions appended
- Can still be configured as a product

### Multiple Dimensions

For products with 3 dimensions:

- `Size: 30x40x2` → `BLKT-KPOP-001-30-40-2`
- All numerals are extracted and joined

### Non-Standard Formats

- `Size: Medium (30x40)` → `BLKT-KPOP-001-30-40`
- `Dimension: 30" by 40"` → `BLKT-KPOP-001-30-40`
- Algorithm extracts numbers regardless of surrounding text

---

## Testing

### Test Order Sync

1. Sync orders with different size variations
2. Check terminal logs for SKU enhancement messages:
   ```
   [SKU Enhancement] BLKT-KPOP-001 → BLKT-KPOP-001-30-40 (from: 30x40)
   ```
3. Verify enhanced SKUs in orders table

### Test Product Configuration

1. Go to `/settings/products`
2. Look for unconfigured SKUs in the modal
3. Should show enhanced SKUs with dimensions
4. Create product configs using enhanced SKUs

### Test Enrichment Form

1. Go to `/enrich`
2. Enter order number
3. System should look up product config using enhanced SKU
4. Should display correct settings per size

---

## Database Impact

### Orders Table

- `product_sku` field stores **enhanced SKU** (e.g., `BLKT-KPOP-001-30-40`)
- Original Etsy SKU is preserved in `raw_order_data.transactions[].sku`

### Product Templates Table

- Create entries with **enhanced SKUs** (e.g., `BLKT-KPOP-001-30-40`)
- Each size variant is a separate product configuration
- No changes to table schema needed

---

## Migration Notes

### Existing Orders

Orders synced before this feature will have original SKUs without dimensions. Options:

1. **Re-sync orders** - Delete and re-import (gets enhanced SKUs)
2. **Manual update** - Update `product_sku` in database for existing orders
3. **Dual config** - Create product configs for both old and new SKU formats

### Recommended Approach

- Re-sync recent orders (last 30 days)
- Keep old orders as-is (they're likely already processed)
- Going forward, all new orders will have enhanced SKUs

---

## Future Enhancements

Potential improvements:

- Admin tool to bulk-update SKUs for existing orders
- SKU format preview in product config
- Dimension validation (ensure extracted dimensions make sense)
- Custom SKU enhancement rules per store


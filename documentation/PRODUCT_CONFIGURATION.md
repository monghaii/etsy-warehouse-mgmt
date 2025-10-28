# Product Configuration System

## Overview

The product configuration system allows you to define product templates for each SKU in your store. These templates specify personalization requirements, dimensions, SLA, and Canva template IDs.

## Features

### 1. **Automatic SKU Detection**

- The system automatically scans your orders for SKUs
- Identifies any SKUs that don't have product configurations yet
- Shows a prominent alert with unconfigured SKUs

### 2. **Dynamic Product Creation Modal**

- When unconfigured SKUs are detected, a modal appears
- You can quickly configure each product with:
  - **SKU** (identifier from orders)
  - **Product Name** (descriptive name)
  - **Category** (optional grouping)
  - **Personalization Type**:
    - `none` - No personalization required
    - `notes` - Text/notes field only
    - `image` - Image upload only
    - `both` - Both text and image
  - **Personalization Instructions** (optional notes for the personalization field)
  - **Dimensions** (L×W×H in inches)
  - **Weight** (in ounces)
  - **SLA** (Service Level Agreement in business days)
  - **Canva Template ID** (optional)

### 3. **Product Management**

- View all configured products in a table
- Edit existing products
- Delete products (with confirmation)
- Filter by active/inactive status

## Database Schema

### Migration: `002_add_personalization_to_products.sql`

Added two new columns to `product_templates`:

```sql
ALTER TABLE product_templates
ADD COLUMN personalization_type VARCHAR(50) DEFAULT 'none',
ADD COLUMN personalization_notes TEXT;
```

**Personalization Types:**

- `none` - No personalization
- `notes` - Text/notes field
- `image` - Image upload
- `both` - Text + image

## API Endpoints

### `GET /api/products`

List all product templates.

**Query Parameters:**

- `includeInactive` (boolean) - Include inactive products

**Response:**

```json
{
  "products": [
    {
      "id": "uuid",
      "sku": "BLANKET-10X10",
      "product_name": "10x10 Fleece Blanket",
      "category": "Blankets",
      "personalization_type": "both",
      "personalization_notes": "Customer should provide name and number",
      "default_length_inches": 10,
      "default_width_inches": 10,
      "default_height_inches": 1,
      "default_weight_oz": 16,
      "sla_business_days": 5,
      "canva_template_id": "ABC123",
      "is_active": true,
      "created_at": "2025-01-01T00:00:00Z",
      "updated_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

### `POST /api/products`

Create a new product template.

**Request Body:**

```json
{
  "sku": "BLANKET-10X10",
  "product_name": "10x10 Fleece Blanket",
  "category": "Blankets",
  "personalization_type": "both",
  "personalization_notes": "Customer should provide name and number",
  "default_length_inches": 10,
  "default_width_inches": 10,
  "default_height_inches": 1,
  "default_weight_oz": 16,
  "sla_business_days": 5,
  "canva_template_id": "ABC123"
}
```

**Response:** `201 Created` with product object

### `PUT /api/products/[id]`

Update an existing product template.

**Request Body:** Same as POST

**Response:** `200 OK` with updated product object

### `DELETE /api/products/[id]`

Delete a product template.

**Response:** `200 OK` with `{ success: true }`

### `GET /api/products/unconfigured-skus`

Get all SKUs from orders that don't have product configurations yet.

**Response:**

```json
{
  "unconfigured_skus": [
    {
      "sku": "PILLOW-12X12",
      "product_name": "Custom Pillow"
    }
  ],
  "count": 1
}
```

## Usage Flow

### Initial Setup

1. **Import Orders** - Sync orders from Etsy
2. **Navigate to Products** - Go to Settings → Products
3. **Configure Unconfigured SKUs** - A yellow alert will appear if there are SKUs without configurations
4. **Click "Configure Now"** - Opens modal with all unconfigured SKUs
5. **Configure Each Product** - Click "Configure" next to each SKU to set up the product template

### Managing Products

1. **View All Products** - See all configured products in a table
2. **Edit Product** - Click "Edit" to modify a product's configuration
3. **Delete Product** - Click "Delete" to remove a product (with confirmation)
4. **Add New Product** - Click "+ Add Product" to manually create a product template

## Multi-Product Orders

The system supports orders with multiple products:

- Each order stores only the first product's SKU in `orders.product_sku`
- Full order data with all line items is stored in `orders.raw_order_data.transactions`
- Future phases will support proper multi-product handling with line items

## Next Steps (Phase 2: Enrichment)

Once products are configured, the enrichment form can use this information to:

1. Display personalization fields based on `personalization_type`
2. Show appropriate input fields (text area for notes, file upload for images)
3. Use `personalization_notes` to provide instructions to customers
4. Apply default dimensions and weights for shipping calculations
5. Calculate SLA dates for production planning

## Notes

- **Required Fields:** SKU and Product Name
- **SKU Uniqueness:** Each SKU must be unique across all products
- **Default SLA:** 5 business days if not specified
- **Active Status:** Products can be marked inactive without deletion
- **Canva Integration:** Template ID optional, used in Phase 3 for design workflow

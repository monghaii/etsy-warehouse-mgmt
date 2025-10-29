# Shopify CSV Import

This guide explains how to import customer data from Shopify orders using CSV exports.

## Why CSV Import?

The Shopify Admin API restricts access to customer PII (Personally Identifiable Information) for archived or disabled customers. When you sync orders via the API, some orders may be missing:

- Customer names
- Email addresses
- Shipping addresses
- Phone numbers

The CSV export method bypasses this limitation by extracting data directly from Shopify's admin interface.

## How to Export Orders from Shopify

1. **Go to your Shopify Admin** → **Orders**
2. **Select the orders** you want to export (or use filters to find specific orders)
3. Click **Export** in the top right
4. Choose **Export format**: `CSV for Excel, Numbers, or other spreadsheet programs`
5. Choose **Export**: `Selected orders` or `All orders`
6. Click **Export orders**
7. Save the downloaded CSV file

## How to Import the CSV

1. **Navigate to the Orders page** in your dashboard
2. Click the **📄 Upload Etsy PDFs/Shopify CSVs** button
3. Select one or more Shopify CSV files from your computer
4. The system will:
   - Parse each CSV file
   - Match orders by order number (e.g., `#1038`)
   - Update existing orders with customer data from the CSV
   - Display results showing how many orders were updated

## What Data is Extracted

The CSV import extracts the following information:

### Customer Information

- **Recipient Name** (from "Shipping Name" or "Billing Name")
- **Email Address** (from "Email" column)

### Shipping Address

- Address Line 1 (`Shipping Address1`)
- Address Line 2 (`Shipping Address2`)
- City (`Shipping City`)
- State/Province (`Shipping Province`)
- Zip/Postal Code (`Shipping Zip`)
- Country (`Shipping Country`)
- Phone Number (`Shipping Phone`)

### Product Information (if not already set)

- Product SKU (`Lineitem sku`)
- Product Name (`Lineitem name`)
- Quantity (`Lineitem quantity`)

### Order Metadata

- Fulfillment Status
- Created At (order date)
- Internal Notes

## Important Notes

### Order Matching

- Orders are matched by **order number** (the `#1038` format in the CSV)
- Orders **must already exist** in the database (usually imported via API sync first)
- If an order is not found, it will be skipped and reported in the results

### Multi-Item Orders

- For orders with multiple line items, the CSV will have multiple rows
- The system groups these rows by order number automatically
- For single-SKU product matching, the first line item is used

### Data Priority

- Product information (SKU, name, quantity) is only updated if not already set
- Shipping address and customer info is always updated from the CSV
- This allows you to run the import multiple times safely

## Workflow Recommendation

1. **First**, run the automatic API sync to import basic order data
2. **Then**, export and upload CSV files to fill in missing customer details
3. **Review** the Orders page to confirm all data is present

## Troubleshooting

### "Order not found in database"

- The order hasn't been synced via API yet
- Run "Auto Import" first, then upload the CSV

### "Updated 0 orders"

- Check that the CSV is from Shopify (not Etsy or another platform)
- Verify the CSV has the correct column headers
- Ensure the order numbers in the CSV match those in your database

### Missing Data After Import

- Verify the CSV export includes all necessary columns
- Check that Shopify had complete data at the time of export
- Some orders (like POS orders) may not have shipping addresses

## CSV Format Requirements

The CSV must include these columns:

- `Name` (contains order number like `#1038`)
- `Email`
- `Shipping Name`, `Shipping Address1`, `Shipping City`, `Shipping Province`, `Shipping Zip`, `Shipping Country`, `Shipping Phone`
- `Lineitem name`, `Lineitem sku`, `Lineitem quantity`

This is the standard format exported by Shopify's "Export orders" feature.

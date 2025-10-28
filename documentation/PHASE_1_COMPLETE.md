# Phase 1: Order Ingestion ✅ COMPLETE

## What Was Built

Phase 1 implements the complete order management system with Etsy API integration.

### ✅ Completed Features

1. **Etsy API Client Library** (`src/lib/etsy-client.js`)

   - Full Etsy API v3 integration
   - Shop receipts fetching
   - Transaction details
   - Order parsing into internal format
   - Connection testing

2. **Store Configuration** (`/settings/stores`)

   - Add/remove Etsy stores
   - API key management
   - Active/inactive toggle
   - Connection testing before save
   - Last sync timestamp tracking

3. **Order Syncing**

   - Manual sync button (immediate)
   - Automatic sync via Vercel Cron (every 15 minutes)
   - Deduplication (prevents duplicate imports)
   - Sync logging and error tracking
   - Rate limit handling

4. **Orders List Page** (`/orders`)

   - Filterable by status
   - Searchable by order #, customer name, email
   - Status badges with colors
   - Click to view details
   - Real-time order count

5. **Order Detail Page** (`/orders/[id]`)

   - Full customer information
   - Shipping address
   - Product details
   - Internal notes (editable)
   - Timeline view
   - Source information (store, platform)

6. **API Routes**
   - `POST /api/stores` - Add new store
   - `GET /api/stores` - List stores
   - `PATCH /api/stores/[id]` - Update store
   - `DELETE /api/stores/[id]` - Delete store
   - `POST /api/orders/sync` - Manual sync
   - `GET /api/orders` - List orders with filters
   - `GET /api/orders/[id]` - Get order details
   - `PATCH /api/orders/[id]` - Update order
   - `GET /api/cron/sync-orders` - Cron endpoint

---

## Environment Variables Required

Add these to your `.env` file (you already have them):

```bash
# Etsy API (already set)
ETSY_API_KEY_PILLOWMOMMY=your-api-key-here

# Vercel Cron Security (add this)
CRON_SECRET=your-random-secret-here
```

Generate a CRON_SECRET:

```bash
openssl rand -base64 32
```

Then add it to:

1. Your `.env` file locally
2. Vercel dashboard → Project Settings → Environment Variables

---

## How to Use

### 1. Configure Your Etsy Store

1. Go to `/settings/stores`
2. Click "Add Store"
3. Enter:
   - **Store Name**: (e.g., "Pillow Mommy")
   - **Shop ID**: Your Etsy shop ID
   - **API Key**: Your Etsy API keystring (the one in .env)
4. Click "Add Store" - it will test the connection first
5. Store is now active and will sync automatically

### 2. Manual Sync (First Time)

1. Go to `/orders`
2. Click "🔄 Sync Orders" button
3. Wait for sync to complete
4. Orders will appear in the list

### 3. Automatic Syncing

Orders automatically sync every 15 minutes via Vercel Cron:

- Runs at: 00, 15, 30, 45 minutes past each hour
- Only syncs active stores
- Only fetches new orders (since last sync)
- Logs all sync operations

### 4. View Orders

1. Go to `/orders`
2. Filter by status
3. Search by order #, customer, email
4. Click any order to see details

---

## Order Statuses

Orders flow through these statuses:

1. **pending_enrichment** - Just imported, waiting for customer assets
2. **enriched** - Customer submitted custom design requirements
3. **needs_review** - Flagged by VA for review
4. **ready_for_design** - Ready for Canva design generation
5. **design_complete** - Design finished by VA
6. **labels_generated** - Shipping label created
7. **loaded_for_shipment** - Scanned and loaded on truck
8. **in_transit** - With carrier
9. **delivered** - Delivered to customer

---

## API Endpoints

### Stores Management

```bash
# List all stores
GET /api/stores

# Add new store
POST /api/stores
{
  "store_name": "My Shop",
  "store_id": "12345678",
  "api_key": "abcd1234..."
}

# Update store
PATCH /api/stores/[id]
{
  "is_active": true
}

# Delete store
DELETE /api/stores/[id]
```

### Orders Management

```bash
# List orders
GET /api/orders?status=pending_enrichment&search=john&limit=50

# Get single order
GET /api/orders/[id]

# Update order
PATCH /api/orders/[id]
{
  "status": "enriched",
  "internal_notes": "Customer uploaded custom image"
}

# Manual sync
POST /api/orders/sync
{
  "store_id": "optional-specific-store-id"
}
```

---

## Vercel Cron Setup

The cron job is configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/sync-orders",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

**Schedule**: `*/15 * * * *` means every 15 minutes

To change frequency:

- Every 5 minutes: `*/5 * * * *`
- Every 30 minutes: `*/30 * * * *`
- Every hour: `0 * * * *`

---

## Testing

### Test Store Configuration

1. Add a store with valid credentials
2. Check that connection test passes
3. Verify store appears in list

### Test Manual Sync

1. Click "Sync Orders" button
2. Should see success message with import count
3. Orders should appear in list
4. Check Supabase `sync_logs` table for log entry

### Test Cron Job (Local)

```bash
# Add CRON_SECRET to your .env
echo "CRON_SECRET=$(openssl rand -base64 32)" >> .env

# Test the cron endpoint
curl -X GET http://localhost:3000/api/cron/sync-orders \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

---

## Database Tables Used

- `stores` - Etsy store configurations
- `orders` - All imported orders
- `sync_logs` - Sync operation history
- `order_status_history` - Status change audit trail (auto-populated by trigger)

---

## What's Next: Phase 2

Now that order ingestion is complete, Phase 2 will add:

- **Customer Enrichment Form** - Public form for customers to submit custom designs
- **Flag for Review** - VA can flag problematic orders
- **File Uploads** - Supabase Storage integration

---

## Troubleshooting

### Orders not syncing

1. Check store is active (`is_active = true`)
2. Verify API key is correct in Supabase `stores` table
3. Check `sync_logs` table for errors
4. Test API connection in store settings

### Cron not running

1. Verify `CRON_SECRET` is set in Vercel environment variables
2. Check Vercel logs for cron executions
3. Cron only works in production (not localhost)

### Duplicate orders

- System automatically prevents duplicates using `external_order_id`
- If duplicates appear, check the unique constraint in database

---

**Phase 1 Complete!** 🎉

You now have a fully functional order management system with Etsy integration and automatic syncing!

# USPS Tracking Integration

## Overview

The tracking page uses the **official USPS Developer API** to automatically check USPS tracking status for **all orders** (including Shopify fulfillments and any external labels) and update them to "in_transit" when the package starts moving.

## Setup Required

⚠️ **You need to set up USPS Developer API credentials**

See **[USPS_TRACKING_SETUP.md](./USPS_TRACKING_SETUP.md)** for detailed setup instructions.

**Quick Setup:**

1. Create account at [developers.usps.com](https://developers.usps.com/)
2. Register an app and select Tracking API
3. Get your Client ID and Client Secret
4. Add to `.env`:
   ```env
   USPS_CLIENT_ID=your_client_id
   USPS_CLIENT_SECRET=your_client_secret
   ```
5. Restart app

## How It Works

### Automatic Tracking Updates

1. Go to **Tracking** page
2. Click **🔄 Update Tracking for All Orders**
3. System checks all orders with status:
   - `labels_generated`
   - `loaded_for_shipment`
4. For each order with a tracking number:
   - Queries EasyPost tracking API
   - Checks if package status indicates movement
   - Updates order to `in_transit` if tracking shows:
     - **in_transit** - Package is moving
     - **out_for_delivery** - Out for delivery
     - **delivered** - Delivered
     - **available_for_pickup** - Ready for pickup
     - **accepted** - USPS accepted the package
     - **picked_up** - Package picked up by carrier

### Tracking Status Mappings

| USPS Status        | What It Means                  | Action         |
| ------------------ | ------------------------------ | -------------- |
| Pre-Shipment       | Label created, not yet scanned | No change      |
| Accepted/Picked Up | USPS received the item         | → `in_transit` |
| In Transit         | Package moving through network | → `in_transit` |
| Out for Delivery   | Out for delivery today         | → `in_transit` |
| Delivered          | Delivered to recipient         | → `in_transit` |
| Unknown            | No tracking info available     | No change      |

## Features

✅ **Works with ANY USPS Tracking Number** - Tracks Shopify fulfillments, external labels, and app-generated labels  
✅ **Official USPS API** - No web scraping, fully supported  
✅ **Bulk Updates** - Check all orders at once  
✅ **Smart Status Detection** - Only updates orders that need it  
✅ **OAuth Security** - Industry-standard authentication  
✅ **Error Handling** - Continues processing even if some orders fail  
✅ **Detailed Feedback** - Shows how many orders were updated  
✅ **Free to Use** - USPS API is free for commercial use

## Tracking Page Features

### In-Transit Orders Display

Shows all orders currently in transit with:

- Order number
- Customer name and shipping location
- Tracking number (clickable → USPS tracking page)
- Shipped date
- Link to view full order

### Update Button

- Click to check all trackable orders
- Shows progress spinner
- Displays summary: "✓ Updated 5 order(s) to in-transit status"
- Auto-refreshes the in-transit orders list

## API Endpoints

### `POST /api/tracking/update-all`

Updates tracking status for all orders

**Response:**

```json
{
  "success": true,
  "total": 50,
  "updated": 5,
  "alreadyInTransit": 42,
  "errors": 3
}
```

### `GET /api/tracking/in-transit`

Fetches all orders with `in_transit` status

**Response:**

```json
{
  "orders": [
    {
      "id": "...",
      "order_number": "1013",
      "tracking_number": "930011099021294856868",
      "customer_name": "John Doe",
      "shipping_city": "Los Angeles",
      "shipping_state": "CA",
      ...
    }
  ]
}
```

## Cost

✅ **Free!** USPS Developer API is free for commercial use. No additional costs.

## Troubleshooting

### "USPS API credentials not configured"

**Solution**: Set up your USPS Developer account and add `USPS_CLIENT_ID` and `USPS_CLIENT_SECRET` to your `.env`. See [USPS_TRACKING_SETUP.md](./USPS_TRACKING_SETUP.md).

### "Failed to get USPS token"

**Solution**: Check that your Client ID and Secret are correct in the USPS Developer Portal.

### "No orders updated"

**Possible causes**:

- All orders already in `in_transit` status
- No orders have tracking numbers yet
- Packages haven't been scanned by USPS yet (try again later)

### "Errors: X"

Check the server console logs for detailed error messages. Common issues:

- Invalid USPS API credentials
- Rate limiting (USPS has generous limits: 100 req/min in test, higher in prod)
- Tracking number format issues
- Tracking not yet available (package not scanned by USPS yet)

## Why USPS Official API?

**Previously**: ShipEngine tracking only worked for labels purchased through ShipEngine/ShipStation.

**Now**: Official USPS API can track **ANY USPS tracking number**, including:

- ✅ Labels purchased in the app
- ✅ Shopify fulfillment labels
- ✅ Labels from other platforms (Etsy, eBay, Amazon, etc.)
- ✅ Manually created USPS labels

This means your tracking page will show accurate real-time status for **all** your USPS shipments, regardless of where they came from!

---

**Setup Required**: Follow the [USPS_TRACKING_SETUP.md](./USPS_TRACKING_SETUP.md) guide to get your API credentials! 📦

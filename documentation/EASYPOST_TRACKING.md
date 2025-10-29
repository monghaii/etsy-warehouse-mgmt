# ShipEngine Tracking Integration

## Overview

The tracking page uses **ShipEngine** (your existing API key) to automatically check USPS tracking status for all orders and update them to "in_transit" when the package starts moving.

## Setup

✅ **Already configured!** You're already using ShipEngine for shipping labels, so no additional setup needed. The same `SHIPENGINE_API_KEY` is used for tracking.

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

### Tracking Status Meanings

| ShipEngine Status Code | What It Means                  | Action         |
| ---------------------- | ------------------------------ | -------------- |
| `NY`                   | Not yet in system              | No change      |
| `AC`, `PI`             | USPS accepted/received item    | → `in_transit` |
| `IT`, `TR`             | Package moving through network | → `in_transit` |
| `DE`, `DL`             | Delivered to recipient         | → `in_transit` |
| `EX`                   | Exception/issue with delivery  | No change      |
| `UN`                   | Unknown/no tracking info       | No change      |

## Features

✅ **Bulk Updates** - Check all orders at once  
✅ **Smart Status Detection** - Only updates orders that need it  
✅ **Automatic Tracking Creation** - Creates tracker if doesn't exist  
✅ **Error Handling** - Continues processing even if some orders fail  
✅ **Detailed Feedback** - Shows how many orders were updated

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

✅ **Free!** ShipEngine tracking is included with your existing ShipEngine account at no additional cost.

## Troubleshooting

### "ShipEngine API key not configured"

**Solution**: Ensure `SHIPENGINE_API_KEY` is in your `.env` or `.env.local` and restart the app.

### "No orders updated"

**Possible causes**:

- All orders already in `in_transit` status
- No orders have tracking numbers yet
- Packages haven't been scanned by USPS yet (try again later)

### "Errors: X"

Check the server console logs for detailed error messages. Common issues:

- Invalid API key
- Rate limiting (ShipEngine has generous limits)
- Tracking number format issues
- Tracking not yet available (package not scanned by USPS yet)

## Benefits

1. **No Additional Setup** - Uses your existing ShipEngine API key
2. **Automatic Status Updates** - No manual checking
3. **Customer Visibility** - See all in-transit orders at a glance
4. **Real Tracking Data** - Pull from USPS directly via ShipEngine
5. **Time Savings** - Bulk check dozens of orders in seconds
6. **Workflow Accuracy** - Orders advance to correct status automatically

---

**Ready to use?** Just click "Update Tracking for All Orders" and start tracking! 📦

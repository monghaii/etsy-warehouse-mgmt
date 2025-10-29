# USPS Tracking API Setup

## Overview

The tracking page uses the **official USPS Developer API** from [developers.usps.com](https://developers.usps.com/) to check tracking status for **any USPS tracking number** (including labels purchased outside the app, like Shopify fulfillments).

## Setup Instructions

### 1. Create USPS Developer Account

1. Go to **[https://developers.usps.com/](https://developers.usps.com/)**
2. Click **"Get Started"** or **"Sign Up"**
3. Complete the registration form
4. Verify your email address

### 2. Create an Application

1. Log in to the USPS Developer Portal
2. Go to **"Build" → "View Your Apps"**
3. Click **"Create App"** or **"Register Application"**
4. Fill in the application details:
   - **App Name**: `Your Store Name - Order Tracking`
   - **Description**: `Track USPS packages for order management`
5. Select the **Tracking API** from the available APIs
6. Choose your environment:
   - **Test/Sandbox** for development
   - **Production** for live orders

### 3. Get Your API Credentials

After creating your app, you'll receive:

- **Client ID** (looks like: `XXXXXXXXXXXXXXXXXXXX`)
- **Client Secret** (looks like: `XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`)

### 4. Add to Environment Variables

Add to your `.env` or `.env.local`:

```env
USPS_CLIENT_ID=your_client_id_here
USPS_CLIENT_SECRET=your_client_secret_here
```

### 5. Restart Your App

```bash
npm run dev
```

## How It Works

### OAuth Authentication

The API uses OAuth 2.0 Client Credentials flow:

1. App exchanges Client ID + Secret for an access token
2. Access token is used to authenticate API requests
3. Token is automatically refreshed as needed

### Tracking Status Updates

1. Go to **Tracking** page
2. Click **🔄 Update Tracking for All Orders**
3. System checks all orders with status:
   - `labels_generated`
   - `loaded_for_shipment`
4. For each order with a tracking number:
   - Calls USPS Tracking API v3
   - Gets current package status
   - Updates order to `in_transit` if package is moving

### Tracking Status Mappings

| USPS Status            | Action         |
| ---------------------- | -------------- |
| **Delivered**          | → `in_transit` |
| **In Transit**         | → `in_transit` |
| **Out for Delivery**   | → `in_transit` |
| **Accepted/Picked Up** | → `in_transit` |
| **Pre-Shipment**       | No change      |
| **Unknown**            | No change      |

## Benefits

✅ **Works with ANY USPS tracking number** - Not just labels purchased in-app  
✅ **Official API** - No web scraping, fully supported by USPS  
✅ **Accurate Data** - Real-time tracking information directly from USPS  
✅ **OAuth Security** - Secure authentication using industry standards  
✅ **Bulk Updates** - Check all orders at once  
✅ **Free to Use** - USPS Developer API is free for commercial use

## API Endpoints

### POST /api/tracking/update-all

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

### GET /api/tracking/in-transit

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
      ...
    }
  ]
}
```

## Troubleshooting

### "USPS API credentials not configured"

**Solution**: Ensure both `USPS_CLIENT_ID` and `USPS_CLIENT_SECRET` are in your `.env` or `.env.local` and restart the app.

### "Failed to get USPS token"

**Possible causes**:

- Invalid Client ID or Client Secret
- App not approved by USPS yet
- Network connectivity issues

**Solution**: Double-check your credentials in the USPS Developer Portal.

### "No orders updated"

**Possible causes**:

- All orders already in `in_transit` status
- No orders have tracking numbers yet
- Packages haven't been scanned by USPS yet (try again later)

### "USPS API error"

Check the server console logs for detailed error messages. Common issues:

- Rate limiting (USPS has generous limits, but can throttle if exceeded)
- Invalid tracking number format
- Tracking not yet available (package not in USPS system)

## Rate Limits

USPS Developer API has generous rate limits:

- **Test/Sandbox**: 100 requests per minute
- **Production**: Varies by account tier (contact USPS for details)

The app includes a 1-second delay between requests to stay well under limits.

## Cost

✅ **Free!** USPS Developer API is free for commercial use.

## Support

If you have issues with the USPS API:

- Check the [USPS Developer Portal FAQs](https://developers.usps.com/faqs)
- Contact **USPS API Support** through the developer portal

---

**Ready to use?** Add your USPS credentials and start tracking! 📦

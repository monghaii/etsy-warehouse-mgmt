# Shopify Integration Guide

## Overview

This app now supports syncing orders from Shopify stores using the Admin API. You can connect multiple Shopify stores and sync their orders alongside your Etsy stores.

## Setup Instructions

### 1. Create a Custom App in Shopify

1. Go to your Shopify Admin panel
2. Navigate to **Settings** → **Apps and sales channels**
3. Click **Develop apps**
4. Click **Create an app**
5. Give it a name (e.g., "Order Management System")
6. Click **Create app**

### 2. Configure API Access

1. Click **Configure Admin API scopes**
2. Enable the following scopes:
   - `read_orders` - Read orders
   - `write_orders` - Update orders (for status tracking)
   - `read_customers` - Read customer information
   - `read_products` - **REQUIRED** - Read product information (for fetching current SKUs)
   - `read_fulfillments` - **REQUIRED** - Read fulfillment data (for tracking numbers and labels)
3. Click **Save**

### 3. Install the App

1. Click **Install app** at the top right
2. Confirm the installation

### 4. Get Your Credentials

After installation, you'll see:

- **Admin API access token** - Copy this (starts with `shpat_...`)
- Your **Shop domain** - This is `yourstore.myshopify.com`

### 5. Add Store to the App

1. Go to **Settings** → **Stores** in your app
2. Click **🛒 Add Shopify Store**
3. Fill in:
   - **Store Name**: A friendly name for your store
   - **Shop Domain**: Your `yourstore.myshopify.com` domain
   - **Admin API Access Token**: The `shpat_...` token from step 4
   - **API Key** (Optional): If you need it for advanced features
4. Click **Add Store**

The app will test the connection and save your store if successful.

### 6. Sync Orders

Once your store is added:

1. Click the **🔄 Sync Orders** button next to your Shopify store
2. The app will fetch the latest 50 orders from Shopify
3. Orders will be imported with status `pending_enrichment`
4. You'll see a summary of new/updated orders

## Features

✅ **Multi-Store Support**: Connect multiple Shopify stores  
✅ **Automatic Connection Testing**: Validates credentials before saving  
✅ **Manual Sync**: Sync orders on-demand with one click  
✅ **Order Status Tracking**: Orders flow through the same workflow as Etsy orders  
✅ **Secure Storage**: API tokens are stored securely in the database

## API Credentials

Your Shopify credentials are stored per-store in the database (NOT in `.env`), which allows you to:

- Connect multiple Shopify stores
- Update credentials without restarting the app
- Manage store access independently

## Troubleshooting

### "Failed to connect to Shopify"

- Double-check your shop domain (must be `yourstore.myshopify.com`)
- Verify your access token is correct
- Make sure you installed the custom app
- Ensure you enabled the correct API scopes

### "Store credentials incomplete"

- Your store is missing the access token or shop domain
- Delete and re-add the store with complete credentials

### "Sync failed"

- Check that your custom app is still installed in Shopify
- Verify the access token hasn't been revoked
- Check the browser console for detailed error messages

## Notes

- Orders are synced with status `pending_enrichment` by default
- The sync fetches the 50 most recent orders (configurable in the API)
- You can sync as many times as needed - existing orders will be updated
- Shopify stores don't need OAuth reconnection (unlike Etsy) since they use long-lived access tokens

## Future Enhancements

Planned features:

- Automatic scheduled syncing (cron job)
- Webhook support for real-time order updates
- Bulk sync for historical orders
- Order fulfillment updates back to Shopify

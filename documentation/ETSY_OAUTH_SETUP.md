# Etsy OAuth Setup Guide

Etsy API v3 requires OAuth 2.0 authentication, not just an API key.

## The Problem

Your API key (`5ssabvsoixrzv6q6ctxu12v5`) alone is not enough. You need an **OAuth access token** to make API calls.

## Solution Options

### Option 1: Get Your Shop ID Manually (Easiest)

1. Go to https://www.etsy.com/your/shops/me
2. Look at the URL - you'll see: `https://www.etsy.com/your/shops/XXXXXXXX`
3. The `XXXXXXXX` is your numeric Shop ID
4. Use that Shop ID when adding your store

**This is the fastest way!** You don't need OAuth just to get your shop ID.

### Option 2: Use OAuth Flow (For Full API Access)

Etsy API v3 requires OAuth for most endpoints. Here's how to set it up:

#### Step 1: Configure Your Etsy App

1. Go to https://www.etsy.com/developers/your-apps
2. Click on your app
3. Under **OAuth Redirect URIs**, add:
   ```
   http://localhost:3000/api/etsy/oauth/callback
   https://your-domain.vercel.app/api/etsy/oauth/callback
   ```
4. Save changes

#### Step 2: Get Your Credentials

You need TWO things from your Etsy app:

- **Keystring** (API Key) - You have this: `5ssabvsoixrzv6q6ctxu12v5`
- **Shared Secret** - You have this in your .env

#### Step 3: Set Environment Variables

Make sure your `.env` has:

```bash
ETSY_API_KEY_PILLOWMOMMY=5ssabvsoixrzv6q6ctxu12v5
ETSY_API_SHARED_SECRET=your-shared-secret-here
NEXT_PUBLIC_APP_URL=http://localhost:3000  # or your production URL
```

#### Step 4: Add Store via OAuth

I've created an OAuth flow for you. To use it:

1. Go to `/settings/stores`
2. Click "Connect with OAuth" button (I'll add this)
3. You'll be redirected to Etsy to authorize
4. After authorization, your store will be added automatically with the OAuth token

### Option 3: Manual Token (Quick Test)

If you just want to test, you can get a token manually:

1. Use the Etsy OAuth Playground: https://www.etsy.com/developers/documentation/getting_started/oauth
2. Generate a token with scopes: `shops_r transactions_r`
3. Copy the access token
4. Use it in your store configuration

**Note:** Manual tokens expire! OAuth flow is better for production.

## What Scopes Do You Need?

For this app, you need these OAuth scopes:

- `shops_r` - Read shop information
- `transactions_r` - Read order/transaction data
- `transactions_w` - Update tracking information (for later phases)

## Current Status

- ✅ You have API Key
- ✅ You have Shared Secret
- ❓ You need OAuth access token (or just your Shop ID for now)

## Quick Start (Skip OAuth for Now)

**If you just want to test the app:**

1. Get your Shop ID manually (Option 1 above)
2. For now, skip the OAuth complexity
3. Use your API key as-is in the store config
4. Some endpoints might fail, but basic order syncing should work once we add OAuth

**Would you like me to:**

- A) Update the store form to use OAuth flow automatically?
- B) Just use the manual Shop ID for now and add OAuth later?

I recommend **B** for testing, then add OAuth once everything else works.

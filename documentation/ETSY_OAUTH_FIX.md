# Fix Etsy OAuth Redirect Error

## The Error You're Seeing

```
An error occurred
The requested redirect URL is not permitted.
```

This means you need to whitelist the redirect URL in your Etsy app settings.

## Step-by-Step Fix

### 1. Go to Etsy Developer Dashboard

Open: https://www.etsy.com/developers/your-apps

### 2. Click Your App

Click on the app that has API key: `5ssabvsoixrzv6q6ctxu12v5`

### 3. Find "OAuth Redirect URIs" Section

Scroll down to the section called **"OAuth Redirect URIs"**

### 4. Add These URLs

Click "Add" and enter these URLs **one at a time**:

**For Local Development:**

```
http://localhost:3000/api/etsy/oauth/callback
```

**For Production (after you deploy to Vercel):**

```
https://your-app-name.vercel.app/api/etsy/oauth/callback
```

Replace `your-app-name` with your actual Vercel domain.

### 5. Save

Click **Save** at the bottom of the page.

### 6. Try Again

Now go back to your app:

- Go to `/settings/stores`
- Click "🔐 Connect with OAuth"
- It should work now!

---

## Alternative: Get Shop ID Manually (Faster)

If OAuth is too complicated right now, just:

1. Go to: https://www.etsy.com/your/shops/me
2. Look at the URL - you'll see a number like: `https://www.etsy.com/your/shops/12345678`
3. That number (`12345678`) is your **Shop ID**
4. In the app, click "+ Add Manually" instead
5. Enter:
   - Store Name: "Pillow Mommy" (or whatever)
   - Shop ID: `12345678` (the number from step 2)
   - API Key: `5ssabvsoixrzv6q6ctxu12v5`

The manual method will work for basic testing. OAuth gives you full API access but requires the extra setup step.

---

## Where Are the Buttons?

I just updated the `/settings/stores` page to show:

- **🔐 Connect with OAuth** button (uses OAuth flow)
- **+ Add Manually** button (old manual form)

Both are now visible at the top of the page!

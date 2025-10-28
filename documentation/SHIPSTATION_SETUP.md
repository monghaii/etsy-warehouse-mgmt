# ShipStation/ShipEngine Setup Guide

## Getting API Credentials

1. **Log into ShipStation API Portal**: Go to https://www.shipstation.com or your ShipStation API dashboard
2. **Navigate to Configuration → API Keys** in the left sidebar
3. **Copy Your Sandbox Key**:
   - You'll see your **Sandbox Key** displayed (starts with `TEST_`)
   - Just copy this single key - that's all you need!

## Environment Variables

Add this to your `.env.local` file:

```bash
SHIPSTATION_API_KEY=TEST_OIn9wmFdIlQNZE6tcZ+vHSF5MzEuskZfeoyo76gj/gQ
```

Replace the example key with your actual Sandbox Key from the dashboard.

**Note**: We use the ShipEngine SDK which handles authentication automatically. You only need the one API key.

## Production vs Sandbox

- **Sandbox Mode**: Use the `TEST_` key for testing (no real shipments)
- **Production Mode**: Switch the environment dropdown to "Production" to get a live API key

## Testing the Integration

1. Add your `SHIPSTATION_API_KEY` to `.env.local`
2. Restart your dev server: `npm run dev`
3. Go to the **Production Queue** page in your app
4. Click "📦 Get Shipping Quote" on any order (must have a shipping address)
5. Adjust package dimensions and weight if needed
6. Click "Get Shipping Rates"
7. You should see a list of shipping options with prices

## Troubleshooting

- **"ShipStation API Key not configured"**: Check that your `.env.local` file has `SHIPSTATION_API_KEY`
- **Button is greyed out**: The order is missing a shipping address. Upload the order PDF to fill in missing addresses.
- **No rates returned**: Verify the shipping address is valid and dimensions/weight are entered correctly
- **401 Unauthorized**: Your API key is invalid or you're using a production key in sandbox mode (or vice versa)

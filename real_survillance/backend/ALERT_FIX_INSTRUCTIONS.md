# Alert Configuration Fix Instructions

## Problem Identified

Your alerts are not working because:
1. ✅ Environment variables ARE being loaded correctly from `.env` file
2. ✅ SMS (Twilio) is configured correctly
3. ✅ Email is configured correctly
4. ❌ **Pushover is NOT configured** - still using placeholder values

## The Issue

In your `backend/.env` file, the Pushover credentials are still set to placeholder values:
```
PUSHOVER_APP_TOKEN=your_pushover_app_token
PUSHOVER_USER_KEY=your_pushover_user_key
```

These need to be replaced with your actual Pushover credentials.

## Solution

### Step 1: Get Your Pushover Credentials

1. **User Key:**
   - Go to https://pushover.net/
   - Log in to your account
   - Your **User Key** is displayed on the main dashboard

2. **Application Token:**
   - Go to https://pushover.net/apps/build
   - Create a new application (e.g., "Apna Criminal")
   - Copy the **Application Token** that is generated

### Step 2: Update Your .env File

Open `backend/.env` in a text editor and replace the placeholder values:

**Change this:**
```
PUSHOVER_APP_TOKEN=your_pushover_app_token
PUSHOVER_USER_KEY=your_pushover_user_key
```

**To this (with your actual values):**
```
PUSHOVER_APP_TOKEN=your_actual_app_token_here
PUSHOVER_USER_KEY=your_actual_user_key_here
```

**Important:**
- Do NOT include quotes around the values
- Do NOT include any extra spaces
- Make sure there are no spaces before or after the `=` sign

### Step 3: Restart the Backend Server

After updating the `.env` file, you **MUST restart** the backend server for the changes to take effect:

1. Stop the current backend server (Ctrl+C)
2. Start it again:
   ```bash
   cd backend
   python backend_adapter.py
   ```

### Step 4: Verify Configuration

When you start the backend server, you should see:
- `[config] Loaded environment variables from ...`
- `[config] ✓ All alert services are configured` (if everything is set up correctly)
- OR warnings if something is still missing

## Testing

After restarting, test the alerts by:
1. Detecting a criminal match in the system
2. You should receive Pushover notifications on your mobile device

## What Was Fixed

I've made the following improvements to help diagnose and fix alert issues:

1. ✅ Added `override=True` to `load_dotenv()` to ensure .env values override system variables
2. ✅ Added startup configuration check that warns about missing or placeholder values
3. ✅ Improved `_pushover_configured()` to reject placeholder values
4. ✅ Created `test_env.py` script to help diagnose configuration issues

## Quick Test

You can test your environment variable loading anytime by running:
```bash
cd backend
python test_env.py
```

This will show you which services are configured and which are missing.

## Still Having Issues?

If alerts still don't work after following these steps:

1. **Check the backend console logs** - Look for error messages when alerts are triggered
2. **Verify your Pushover credentials** - Make sure you copied them correctly
3. **Check Pushover app installation** - Make sure you have the Pushover app installed on your phone and are logged in
4. **Verify Twilio phone number** - For SMS, make sure the recipient phone number is verified in your Twilio account (if using trial account)

## Summary

The main issue is that your Pushover credentials in the `.env` file are still placeholders. Replace them with real values and restart the backend server.


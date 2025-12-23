# Environment Variables Setup Guide

This guide explains how to configure environment variables for the Apna Criminal system.

## Quick Setup

1. **Copy the example file:**
   ```bash
   cd backend
   cp .env.example .env
   ```

2. **Edit the `.env` file** with your actual credentials (see sections below)

3. **Install required packages:**
   ```bash
   pip install -r requirements.txt
   ```

## Configuration Details

### Twilio SMS Setup (Optional but Recommended)

Twilio is used to send SMS alerts when criminals are detected.

1. **Sign up for Twilio:**
   - Go to https://www.twilio.com/try-twilio
   - Create a free account (includes trial credits)

2. **Get your credentials:**
   - Log in to https://www.twilio.com/console
   - Find your **Account SID** and **Auth Token** on the dashboard
   - Get a phone number from https://www.twilio.com/console/phone-numbers/getting-started

3. **Add to `.env` file:**
   ```env
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=your_auth_token_here
   TWILIO_PHONE_NUMBER=+16363428131  # Twilio number (the number Twilio gives you - used to SEND FROM)
   ```

4. **Add default recipient (optional but recommended):**
   ```env
   # Your actual mobile number where you want to RECEIVE alerts
   # This is different from TWILIO_PHONE_NUMBER!
   DEFAULT_SMS_RECIPIENT=+919876543210  # Your mobile number (where alerts will be sent TO)
   ```

**Important:** 
- `TWILIO_PHONE_NUMBER` = The number Twilio provides (used as "from" when sending)
- `DEFAULT_SMS_RECIPIENT` = **Your actual mobile number** (where you want to receive alerts)

**Note:** Twilio trial accounts can only send SMS to verified phone numbers. Upgrade to a paid account for production use.

### Pushover Setup (Recommended)

Pushover sends push notifications to your mobile device with images.

1. **Create a Pushover account:**
   - Go to https://pushover.net/
   - Sign up for a free account

2. **Get your User Key:**
   - Log in to https://pushover.net/
   - Your **User Key** is displayed on the main page

3. **Create an Application:**
   - Go to https://pushover.net/apps/build
   - Create a new application (e.g., "Apna Criminal")
   - Copy the **Application Token**

4. **Add to `.env` file:**
   ```env
   PUSHOVER_APP_TOKEN=your_app_token_here
   PUSHOVER_USER_KEY=your_user_key_here
   ```

5. **Install Pushover app:**
   - Download Pushover app on your phone from App Store or Google Play
   - Log in with your account

### Alert Cooldown

Set the minimum time (in seconds) between alerts to prevent spam:

```env
ALERT_COOLDOWN=30
```

Default is 30 seconds. Increase this value if you receive too many alerts.

## File Structure

```
backend/
├── .env              # Your actual credentials (DO NOT COMMIT)
├── .env.example      # Template file (safe to commit)
├── ENV_SETUP.md      # This file
└── backend_adapter.py
```

## Security Notes

⚠️ **IMPORTANT:**
- Never commit the `.env` file to version control
- The `.env` file contains sensitive credentials
- The `.env.example` file is safe to commit (no real values)

## Testing Your Configuration

After setting up your `.env` file, test the configuration:

1. **Start the backend:**
   ```bash
   cd backend
   python backend_adapter.py
   ```

2. **Check the console output:**
   - You should see: `[config] Loaded environment variables from ...`
   - If SMS/Pushover are configured, you'll see confirmation messages

3. **Test alerts:**
   - Register a criminal
   - Detect a match
   - You should receive SMS and/or Pushover notifications

## Troubleshooting

### "python-dotenv not installed"
```bash
pip install python-dotenv
```

### "Twilio library not installed"
```bash
pip install twilio
```

### Alerts not working
1. Check that your `.env` file is in the `backend/` directory
2. Verify all credentials are correct (no extra spaces)
3. Check the console logs for error messages
4. For Twilio: Ensure your phone number is verified (trial accounts)
5. For Pushover: Verify your User Key and App Token are correct

### Environment variables not loading
- Make sure `.env` file is in the same directory as `backend_adapter.py`
- Check that file is named exactly `.env` (not `.env.txt`)
- Restart the backend server after making changes

## Alternative: System Environment Variables

If you prefer not to use a `.env` file, you can set environment variables directly:

**Windows (PowerShell):**
```powershell
$env:TWILIO_ACCOUNT_SID="your_sid"
$env:TWILIO_AUTH_TOKEN="your_token"
$env:TWILIO_PHONE_NUMBER="+1234567890"
$env:PUSHOVER_APP_TOKEN="your_token"
$env:PUSHOVER_USER_KEY="your_key"
```

**Windows (CMD):**
```cmd
set TWILIO_ACCOUNT_SID=your_sid
set TWILIO_AUTH_TOKEN=your_token
set TWILIO_PHONE_NUMBER=+1234567890
set PUSHOVER_APP_TOKEN=your_token
set PUSHOVER_USER_KEY=your_key
```

**Linux/Mac:**
```bash
export TWILIO_ACCOUNT_SID="your_sid"
export TWILIO_AUTH_TOKEN="your_token"
export TWILIO_PHONE_NUMBER="+1234567890"
export PUSHOVER_APP_TOKEN="your_token"
export PUSHOVER_USER_KEY="your_key"
```

## Support

For issues with:
- **Twilio:** https://support.twilio.com/
- **Pushover:** https://pushover.net/faq

## to check backend
 http://localhost:8000/docs

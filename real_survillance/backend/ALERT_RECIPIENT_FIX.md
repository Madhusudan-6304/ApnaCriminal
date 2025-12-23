# Alert Recipient Fix - SMS and Email Alerts

## Problem

SMS and Email alerts were failing because:
1. The user object might not have valid phone/email information
2. If a user logs in without providing phone/email, the system defaults to using the username (which isn't a valid phone/email)
3. The alert endpoints required a recipient but couldn't find one

## Solution

I've added **fallback recipient support** so alerts can work even when users don't have phone/email configured.

### What Changed

1. ✅ **Added default recipient support from .env file**
   - `DEFAULT_SMS_RECIPIENT` - Default phone number for SMS alerts
   - `DEFAULT_EMAIL_RECIPIENT` - Default email address for email alerts

2. ✅ **Improved recipient detection**
   - Tries multiple sources: payload → user phone/email → default from .env
   - Validates phone numbers (must have at least 10 digits)
   - Validates email addresses (must contain @ and domain)

3. ✅ **Better error messages**
   - Clear messages explaining what's missing
   - Instructions on how to fix the issue

4. ✅ **Automatic fallback in `_notify_alert`**
   - Uses default recipients if user doesn't have phone/email
   - Validates formats before sending

## Configuration

### Option 1: Set Default Recipients in .env (Recommended)

Add these to your `backend/.env` file:

```env
# Default recipients for alerts (used when user doesn't have phone/email)
# IMPORTANT: DEFAULT_SMS_RECIPIENT should be YOUR actual mobile number where you want to RECEIVE alerts
# This is NOT the Twilio phone number - that goes in TWILIO_PHONE_NUMBER
DEFAULT_SMS_RECIPIENT=+1234567890  # Your mobile number (where alerts will be sent TO)
DEFAULT_EMAIL_RECIPIENT=alerts@example.com  # Your email address (where alerts will be sent TO)
```

**Important Notes:**
- `TWILIO_PHONE_NUMBER` = The phone number Twilio gives you (used to SEND FROM)
- `DEFAULT_SMS_RECIPIENT` = **YOUR actual mobile number** (where you want to RECEIVE alerts)
- These are different! Twilio number is for sending, your number is for receiving.

**Benefits:**
- Alerts work even if users don't provide phone/email during login
- All alerts go to a central monitoring address
- Easy to change without code changes

### Option 2: Provide Recipient in API Call

When calling `/api/alerts/sms` or `/api/alerts/email`, include recipient in payload:

```json
{
  "matches": [...],
  "recipient": "+1234567890"  // or "email@example.com"
}
```

### Option 3: Set User Phone/Email During Login

When logging in via `/api/auth/login`, provide phone and email:

```
POST /api/auth/login
username=admin
password=admin123
phone=+1234567890
email=user@example.com
```

## How It Works

### SMS Alert Flow:
1. Check if `recipient` is in the request payload
2. If not, check if user has a valid phone number
3. If not, check if `DEFAULT_SMS_RECIPIENT` is set in .env
4. Validate phone number format (must have 10+ digits)
5. Send SMS if valid recipient found

### Email Alert Flow:
1. Check if `recipient` is in the request payload
2. If not, check if user has a valid email
3. If not, check if username is an email address
4. If not, check if `DEFAULT_EMAIL_RECIPIENT` is set in .env
5. Validate email format (must contain @ and domain)
6. Send email if valid recipient found

## Testing

After configuring default recipients:

1. **Restart the backend server**
2. **Test SMS alert:**
   ```bash
   curl -X POST http://localhost:8000/api/alerts/sms \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"matches": [{"name": "Test", "score": 0.95}]}'
   ```

3. **Test Email alert:**
   ```bash
   curl -X POST http://localhost:8000/api/alerts/email \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"matches": [{"name": "Test", "score": 0.95}]}'
   ```

4. **Check server logs** for:
   - `[sms-alert] Attempting to send to ...`
   - `[email-alert] Attempting to send to ...`
   - Success or error messages

## Error Messages

### If SMS fails:
- "Recipient phone number missing" - No recipient found anywhere
- "Invalid phone number format" - Phone number doesn't have enough digits
- "SMS service not configured" - Twilio credentials missing
- "Unable to send SMS alert" - Twilio API error (check logs)

### If Email fails:
- "Recipient email address missing" - No recipient found anywhere
- "Invalid email address format" - Email doesn't have valid format
- "Email not configured" - SMTP credentials missing
- "Unable to send email alert" - SMTP error (check logs)

## Example .env Configuration

```env
# Twilio SMS Configuration
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+16363428131  # Twilio number (used to SEND FROM - this is the number Twilio gives you)

# Default SMS Recipient (fallback if user doesn't have phone)
# This should be YOUR actual mobile number where you want to RECEIVE alerts
DEFAULT_SMS_RECIPIENT=+919876543210  # Your mobile number (where alerts will be sent TO)

# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=465
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password
EMAIL_FROM="Apna Criminal <alerts@example.com>"

# Default Email Recipient (fallback if user doesn't have email)
DEFAULT_EMAIL_RECIPIENT=alerts@example.com
```

## Troubleshooting

### Alerts still not working?

1. **Check server logs** - Look for error messages when alerts are triggered
2. **Verify .env file** - Make sure default recipients are set correctly
3. **Restart server** - Changes to .env require server restart
4. **Test configuration** - Run `python backend/test_env.py` to check environment variables
5. **Check Twilio/Email credentials** - Make sure they're valid and not placeholders

### Common Issues

**"Recipient phone number missing"**
- Solution: Set `DEFAULT_SMS_RECIPIENT` in .env with **your actual mobile number** (not the Twilio number) or provide phone during login

**"Invalid phone number format"**
- Solution: Phone numbers must have at least 10 digits and start with + (e.g., +919876543210 for India, +1234567890 for US)

**"Which number should I use for DEFAULT_SMS_RECIPIENT?"**
- ✅ **Use YOUR personal mobile number** (where you want to receive alerts)
- ❌ **Do NOT use the Twilio phone number** (that goes in TWILIO_PHONE_NUMBER)
- See `SMS_NUMBER_CLARIFICATION.md` for detailed explanation

**"Recipient email address missing"**
- Solution: Set `DEFAULT_EMAIL_RECIPIENT` in .env or provide email during login

**"Invalid email address format"**
- Solution: Email must contain @ and a valid domain (e.g., user@example.com)

## Summary

The fix allows alerts to work in three ways:
1. **User provides phone/email** during login → Uses that
2. **Default recipients in .env** → Uses those as fallback
3. **Recipient in API call** → Uses that (highest priority)

This makes the alert system much more flexible and reliable!


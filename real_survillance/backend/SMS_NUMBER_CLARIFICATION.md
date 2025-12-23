# SMS Number Configuration - Important Clarification

## Two Different Phone Numbers

When setting up SMS alerts, you need to understand there are **TWO different phone numbers**:

### 1. TWILIO_PHONE_NUMBER (The "From" Number)
- **What it is:** The phone number Twilio gives you when you create an account
- **Purpose:** This is the number that will **SEND** SMS messages (the "from" number)
- **Example:** `+16363428131` (a number like this from Twilio)
- **Where to find it:** Twilio Console → Phone Numbers → Manage → Active Numbers
- **In .env:** `TWILIO_PHONE_NUMBER=+16363428131`

### 2. DEFAULT_SMS_RECIPIENT (The "To" Number)
- **What it is:** **YOUR actual mobile phone number**
- **Purpose:** This is where you want to **RECEIVE** alert notifications
- **Example:** `+919876543210` (your personal mobile number)
- **In .env:** `DEFAULT_SMS_RECIPIENT=+919876543210`

## Complete Example

```env
# Twilio Configuration (for SENDING SMS)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+16363428131  # Twilio's number (SEND FROM)

# Your Recipient (for RECEIVING SMS)
DEFAULT_SMS_RECIPIENT=+919876543210  # Your mobile number (RECEIVE TO)
```

## How It Works

When an alert is triggered:
1. System uses `TWILIO_PHONE_NUMBER` as the "from" number
2. System uses `DEFAULT_SMS_RECIPIENT` as the "to" number
3. Twilio sends SMS from their number to your number

## Common Mistakes

❌ **Wrong:**
```env
TWILIO_PHONE_NUMBER=+16363428131
DEFAULT_SMS_RECIPIENT=+16363428131  # Using Twilio number as recipient
```
This won't work because you can't send SMS to the Twilio number itself!

✅ **Correct:**
```env
TWILIO_PHONE_NUMBER=+16363428131  # Twilio's number
DEFAULT_SMS_RECIPIENT=+919876543210  # Your personal mobile number
```

## For Different Countries

### India
```env
TWILIO_PHONE_NUMBER=+16363428131  # Twilio number (US format)
DEFAULT_SMS_RECIPIENT=+919876543210  # Your Indian mobile number
```

### United States
```env
TWILIO_PHONE_NUMBER=+16363428131  # Twilio number
DEFAULT_SMS_RECIPIENT=+1234567890  # Your US mobile number
```

### United Kingdom
```env
TWILIO_PHONE_NUMBER=+16363428131  # Twilio number
DEFAULT_SMS_RECIPIENT=+447911123456  # Your UK mobile number
```

## Testing

After setting up both numbers:
1. Restart the backend server
2. Trigger an alert (detect a criminal)
3. You should receive SMS on your `DEFAULT_SMS_RECIPIENT` number
4. The SMS will appear to come from `TWILIO_PHONE_NUMBER`

## Troubleshooting

**"I'm not receiving SMS"**
- Check that `DEFAULT_SMS_RECIPIENT` is YOUR mobile number, not the Twilio number
- Make sure the number includes country code with + (e.g., +91 for India)
- For Twilio trial accounts, you can only send to verified numbers

**"I'm confused which number is which"**
- Twilio number = The one Twilio gave you (for sending)
- Your number = Your personal mobile (for receiving)
- Think of it like email: Twilio number is like "from@twilio.com", your number is like "you@gmail.com"

## Summary

- **TWILIO_PHONE_NUMBER** = Twilio's number (SEND FROM) ✅
- **DEFAULT_SMS_RECIPIENT** = Your number (RECEIVE TO) ✅
- These are **different numbers** with **different purposes**!


# Quick Environment Setup

## Step 1: Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

## Step 2: Create .env File

**Option A: Use the setup script (Recommended)**
```bash
python setup_env.py
```

**Option B: Manual copy**
```bash
cp .env.example .env
```

## Step 3: Edit .env File

Open `backend/.env` in a text editor and fill in your credentials:

### For SMS Alerts (Twilio):
1. Sign up at https://www.twilio.com/try-twilio
2. Get credentials from https://www.twilio.com/console
3. Add to `.env`:
   ```
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=your_auth_token_here
   TWILIO_PHONE_NUMBER=+1234567890
   ```

### For Push Notifications (Pushover):
1. Sign up at https://pushover.net/
2. Get User Key from https://pushover.net/
3. Create app at https://pushover.net/apps/build
4. Add to `.env`:
   ```
   PUSHOVER_APP_TOKEN=your_app_token_here
   PUSHOVER_USER_KEY=your_user_key_here
   ```

## Step 4: Test

Start the backend server:
```bash
python backend_adapter.py
```

You should see: `[config] Loaded environment variables from ...`

## Need Help?

See `ENV_SETUP.md` for detailed instructions and troubleshooting.


#!/usr/bin/env python3
"""Test script to verify environment variable loading"""
from pathlib import Path
from dotenv import load_dotenv
import os

# Load .env file
env_path = Path(__file__).parent / ".env"
print(f"Loading .env from: {env_path.absolute()}")
print(f"File exists: {env_path.exists()}")

if env_path.exists():
    load_dotenv(dotenv_path=env_path, override=True)
    print("\n✓ Environment variables loaded\n")
else:
    print("\n✗ .env file not found!\n")

# Check all alert-related environment variables
print("=== Environment Variable Status ===")
print(f"TWILIO_ACCOUNT_SID: {'✓ SET' if os.getenv('TWILIO_ACCOUNT_SID') else '✗ NOT SET'}")
print(f"TWILIO_AUTH_TOKEN: {'✓ SET' if os.getenv('TWILIO_AUTH_TOKEN') else '✗ NOT SET'}")
print(f"TWILIO_PHONE_NUMBER: {'✓ SET' if os.getenv('TWILIO_PHONE_NUMBER') else '✗ NOT SET'}")
print()
print(f"PUSHOVER_APP_TOKEN: {'✓ SET' if os.getenv('PUSHOVER_APP_TOKEN') else '✗ NOT SET'}")
if os.getenv('PUSHOVER_APP_TOKEN'):
    token = os.getenv('PUSHOVER_APP_TOKEN')
    if token == 'your_pushover_app_token':
        print("  ⚠ WARNING: Still using placeholder value!")
    else:
        print(f"  Value: {token[:10]}...")
print(f"PUSHOVER_USER_KEY: {'✓ SET' if os.getenv('PUSHOVER_USER_KEY') else '✗ NOT SET'}")
if os.getenv('PUSHOVER_USER_KEY'):
    key = os.getenv('PUSHOVER_USER_KEY')
    if key == 'your_pushover_user_key':
        print("  ⚠ WARNING: Still using placeholder value!")
    else:
        print(f"  Value: {key[:10]}...")
print()
print(f"EMAIL_HOST: {'✓ SET' if os.getenv('EMAIL_HOST') else '✗ NOT SET'}")
print(f"EMAIL_USER: {'✓ SET' if os.getenv('EMAIL_USER') else '✗ NOT SET'}")
print(f"EMAIL_PASSWORD: {'✓ SET' if os.getenv('EMAIL_PASSWORD') else '✗ NOT SET'}")

# Test configuration functions
print("\n=== Configuration Check ===")
twilio_sid = os.getenv("TWILIO_ACCOUNT_SID")
twilio_token = os.getenv("TWILIO_AUTH_TOKEN")
twilio_phone = os.getenv("TWILIO_PHONE_NUMBER")
sms_configured = all([twilio_sid, twilio_token, twilio_phone])
print(f"SMS (Twilio): {'✓ CONFIGURED' if sms_configured else '✗ NOT CONFIGURED'}")

pushover_token = os.getenv("PUSHOVER_APP_TOKEN")
pushover_key = os.getenv("PUSHOVER_USER_KEY")
pushover_configured = all([pushover_token, pushover_key]) and \
                     pushover_token != 'your_pushover_app_token' and \
                     pushover_key != 'your_pushover_user_key'
print(f"Pushover: {'✓ CONFIGURED' if pushover_configured else '✗ NOT CONFIGURED'}")

email_host = os.getenv("EMAIL_HOST")
email_user = os.getenv("EMAIL_USER")
email_pass = os.getenv("EMAIL_PASSWORD")
email_configured = all([email_host, email_user, email_pass])
print(f"Email: {'✓ CONFIGURED' if email_configured else '✗ NOT CONFIGURED'}")


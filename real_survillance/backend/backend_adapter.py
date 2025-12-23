# backend_adapter.py
# FastAPI adapter that imports your existing Python code (no changes to your files)
# Exposes REST endpoints consumed by the React frontend.

import base64
import io
import json
import os
import secrets
import smtplib
import ssl
import tempfile
import time
import requests
from email.message import EmailMessage
from pathlib import Path
from typing import Any, Dict, List, Tuple

import cv2
import numpy as np
from fastapi import Body, Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

# Load environment variables from .env file
try:
    from dotenv import load_dotenv
    # Load .env file from the backend directory
    env_path = Path(__file__).parent / ".env"
    load_dotenv(dotenv_path=env_path, override=True)
    print(f"[config] Loaded environment variables from {env_path}")
except ImportError:
    print("[config] python-dotenv not installed. Install with: pip install python-dotenv")
    print("[config] Using system environment variables only.")
except Exception as e:
    print(f"[config] Warning: Could not load .env file: {e}")
    print("[config] Using system environment variables only.")

# Import your existing modules (they must be in the same folder or pythonpath)
# Do NOT modify those files — adapter just imports and calls their functions.
print("[startup] Loading modules...")
try:
    import faces  # your faces.py (Tk app) with add_criminal_from_pil, load_all_criminals, delete_criminal, preprocess_sketch
    print("[startup] ✓ faces module loaded")
except Exception as e:
    raise RuntimeError("Failed to import faces.py. Ensure backend files are in Python path and names match.") from e

try:
    import detector  # your detector.py (optional) - models will load lazily
    print("[startup] ✓ detector module loaded (models will load on first use)")
except Exception as e:
    print(f"[startup] ⚠ detector module not available: {e}")
    detector = None

# Simple token auth (in-memory) — frontend will use this
TOKENS: Dict[str, Dict[str, Any]] = {}


# SMS alert configuration (Twilio)
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER")

# Pushover alert configuration
PUSHOVER_APP_TOKEN = os.getenv("PUSHOVER_APP_TOKEN")
PUSHOVER_USER_KEY = os.getenv("PUSHOVER_USER_KEY")

# Email alert configuration
EMAIL_HOST = os.getenv("EMAIL_HOST")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", "465"))
EMAIL_USER = os.getenv("EMAIL_USER")
EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD")
EMAIL_FROM = os.getenv("EMAIL_FROM")
EMAIL_USE_SSL = os.getenv("EMAIL_USE_SSL", "true").lower() == "true"
EMAIL_MAX_RETRIES = int(os.getenv("EMAIL_MAX_RETRIES", "3"))
EMAIL_TIMEOUT = int(os.getenv("EMAIL_TIMEOUT", "10"))
# Default recipients (fallback if user doesn't have phone/email)
DEFAULT_SMS_RECIPIENT = os.getenv("DEFAULT_SMS_RECIPIENT")  # Phone number for SMS alerts
DEFAULT_EMAIL_RECIPIENT = os.getenv("DEFAULT_EMAIL_RECIPIENT")  # Email for email alerts

# Alert cooldown (seconds) to prevent spam
ALERT_COOLDOWN = int(os.getenv("ALERT_COOLDOWN", "30"))
_last_alert_time = 0
# Track recently alerted criminals to prevent duplicate alerts for same person
_recently_alerted_criminals: Dict[str, float] = {}  # {criminal_name: timestamp}

# Startup configuration check and warnings
def _check_configuration():
    """Check configuration and print warnings for missing or placeholder values."""
    warnings = []
    
    # Check SMS (Twilio)
    if not all([TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER]):
        warnings.append("SMS (Twilio) alerts are not configured - missing credentials")
    
    # Check Pushover
    if not PUSHOVER_APP_TOKEN or not PUSHOVER_USER_KEY:
        warnings.append("Pushover alerts are not configured - missing credentials")
    elif PUSHOVER_APP_TOKEN == "your_pushover_app_token" or PUSHOVER_USER_KEY == "your_pushover_user_key":
        warnings.append("Pushover alerts are not configured - still using placeholder values in .env file")
    
    # Check Email
    if not all([EMAIL_HOST, EMAIL_USER, EMAIL_PASSWORD]):
        warnings.append("Email alerts are not configured - missing credentials")
    
    if warnings:
        print("\n[config] ⚠ Alert Configuration Warnings:")
        for warning in warnings:
            print(f"  - {warning}")
        print("[config] See backend/ENV_SETUP.md for setup instructions")
    
    # Check default recipients
    if not DEFAULT_SMS_RECIPIENT:
        print("[config] ⚠ DEFAULT_SMS_RECIPIENT not set - SMS alerts will only work if user provides phone number")
    else:
        print(f"[config] ✓ Default SMS recipient: {DEFAULT_SMS_RECIPIENT}")
    
    if not DEFAULT_EMAIL_RECIPIENT:
        print("[config] ⚠ DEFAULT_EMAIL_RECIPIENT not set - Email alerts will only work if user provides email")
    else:
        print(f"[config] ✓ Default email recipient: {DEFAULT_EMAIL_RECIPIENT}")
    
    if warnings or not DEFAULT_SMS_RECIPIENT or not DEFAULT_EMAIL_RECIPIENT:
        print()
    else:
        print("[config] ✓ All alert services are configured\n")

# Run configuration check on startup
_check_configuration()


def _make_session_payload(username: str, phone: str = None, name: str = None, email: str = None) -> Dict[str, Any]:
    return {
        "username": username, 
        "phone": phone or username, 
        "name": name,
        "email": email or username if "@" in username else None
    }


def fake_auth_header(authorization: str = Header(None)):
    """
    Dependency to verify Authorization: Bearer <token>
    Uses Header(...) so FastAPI will inject HTTP Authorization.
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid Authorization header")
    token = authorization.split(" ", 1)[1]
    if token not in TOKENS:
        raise HTTPException(status_code=401, detail="Invalid token")
    payload = TOKENS[token] or {}
    if not isinstance(payload, dict):
        payload = _make_session_payload(str(payload))
        TOKENS[token] = payload
    return {**payload, "token": token}


app = FastAPI(title="Adapter for existing Python backend (no file changes)")

# allow front-end dev origins (add more if you use different ports)
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

# Expose X-Matches header so the browser can read it (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,            # change to ["*"] for quick dev (less secure)
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["X-Matches", "X-Eval-ID"],
)

# Mount images dir used by your app. Try common folders from uploaded files
IMAGES_DIRS = ["criminal_images", "criminal_db", "static/images"]

# Find first existing directory used for images
_images_dir = None
for d in IMAGES_DIRS:
    if os.path.isdir(d):
        _images_dir = d
        break

# If no folder exists yet, create the default used in your files
if _images_dir is None:
    _images_dir = "criminal_images"
    os.makedirs(_images_dir, exist_ok=True)

app.mount("/api/images", StaticFiles(directory=_images_dir), name="images")


# ----------------- Helpers -----------------
def make_serializable_entry(entry: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert a single criminal entry to JSON-serializable form for frontend.
    - convert image path to basename (so frontend can GET /api/images/{basename})
    - remove heavy/non-serializable fields like 'embedding'
    - ensure basic fields are primitive types
    """
    e: Dict[str, Any] = {}

    # Prefer explicit safe keys
    for k in ("name", "age", "gender", "crime"):
        if k in entry and entry[k] is not None:
            # convert to primitive types
            v = entry[k]
            if isinstance(v, (str, int, float, bool)) or v is None:
                e[k] = v
            else:
                try:
                    e[k] = str(v)
                except Exception:
                    e[k] = None

    # handle image/image_path -> return basename only
    path_val = entry.get("image_path") or entry.get("image") or entry.get("image_path")
    if path_val:
        try:
            e["image_path"] = os.path.basename(str(path_val))
        except Exception:
            e["image_path"] = None

    # ensure name exists as string if possible
    if "name" not in e and "name" in entry:
        try:
            e["name"] = str(entry["name"])
        except Exception:
            e["name"] = "unknown"

    return e


# Cache for database bundle to avoid reloading on every request
_db_bundle_cache: Tuple[List[Dict[str, Any]], List[Any]] | None = None
_db_cache_timestamp: float = 0

def _invalidate_db_cache():
    """Invalidate the database cache (call when criminals are added/deleted)."""
    global _db_bundle_cache, _db_cache_timestamp
    _db_bundle_cache = None
    _db_cache_timestamp = 0

def _load_db_bundle(force_reload: bool = False) -> Tuple[List[Dict[str, Any]], List[Any]]:
    """
    Returns (entries, embeddings) ready for the detector pipeline.
    Uses caching to avoid reloading on every request for better performance.
    """
    global _db_bundle_cache, _db_cache_timestamp
    import time
    
    # Return cached version if available and not forcing reload
    if not force_reload and _db_bundle_cache is not None:
        return _db_bundle_cache
    
    # Load from disk
    load_start = time.time()
    try:
        entries = faces.load_all_criminals() or []
    except Exception:
        entries = []
    
    embeddings = []
    for item in entries:
        emb = item.get("embedding")
        if emb is not None:
            embeddings.append(emb)
    
    load_time = time.time() - load_start
    if load_time > 0.05:  # Only log if it takes significant time
        print(f"[cache] Loaded {len(entries)} criminals from disk in {load_time:.3f}s")
    
    # Update cache
    _db_bundle_cache = (entries, embeddings)
    _db_cache_timestamp = time.time()
    
    return _db_bundle_cache


def _serialize_matches(matches: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Deduplicate and serialize matches for headers/payloads.
    """
    safe: List[Dict[str, Any]] = []
    seen = set()
    for item in matches or []:
        if not isinstance(item, dict):
            continue
        name = item.get("name", "Unknown")
        score = item.get("score")
        key = (name, None if score is None else round(float(score), 4))
        if key in seen:
            continue
        seen.add(key)
        safe.append(
            {
                "name": name,
                "score": float(score) if isinstance(score, (int, float)) else None,
            }
        )
    return safe


def _serialize_detections(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    safe: List[Dict[str, Any]] = []
    for item in items or []:
        if not isinstance(item, dict):
            continue
        box = item.get("box")
        safe.append(
            {
                "box": [int(v) for v in box] if isinstance(box, (list, tuple)) else None,
                "label": str(item.get("label") or ""),
                "name": str(item.get("name") or ""),
                "score": item.get("score") if isinstance(item.get("score"), (int, float)) else None,
                "has_mask": bool(item.get("has_mask")),
            }
        )
    return safe


def _run_detection_pipeline(pil_image, db_bundle: Tuple[List[Dict[str, Any]], List[Any]] | None = None):
    """
    Detect faces, annotate image, and return (annotated PIL image, matches list).
    """
    from PIL import ImageDraw, ImageFont

    if detector is None:
        return pil_image, []

    entries, embeddings = db_bundle or _load_db_bundle()
    try:
        boxes, face_crops, mask_flags = detector.detect_faces_and_crops(pil_image)
    except Exception:
        boxes, face_crops, mask_flags = ([], [], [])

    if boxes is None or face_crops is None:
        return pil_image, []

    try:
        box_count = len(boxes)
    except Exception:
        box_count = 0
    try:
        crop_count = len(face_crops)
    except Exception:
        crop_count = 0
    if box_count == 0 or crop_count == 0:
        return pil_image, []

    annotated = pil_image.copy()
    draw = ImageDraw.Draw(annotated)
    try:
        font = ImageFont.truetype("arial.ttf", 18)
    except Exception:
        font = None

    matches: List[Dict[str, Any]] = []
    detection_meta: List[Dict[str, Any]] = []

    for idx, (box, face_crop, has_mask) in enumerate(zip(boxes, face_crops, mask_flags)):
        emb = None
        try:
            emb = detector.face_to_embedding(face_crop)
        except Exception:
            emb = None

        x1, y1, x2, y2 = [int(max(0, b)) for b in box]
        draw.rectangle([x1, y1, x2, y2], outline="green", width=3)

        label = "Unknown"
        fill = "red"
        score = None
        match_idx = None
        mask_block = bool(has_mask)

        if mask_block:
            label = "Mask detected - remove mask"
            fill = "orange"
        elif emb is not None and embeddings:
            try:
                match_idx, score = detector.match_embedding(emb, embeddings, threshold=0.55)
            except Exception:
                match_idx, score = (None, None)

        meta_name = "Unknown"
        if (match_idx is not None) and (match_idx < len(entries)) and not mask_block:
            name = entries[match_idx].get("name") or "Unknown"
            label = f"{name} ({score:.2f})" if isinstance(score, (int, float)) else name
            fill = "yellow"
            matches.append({"name": name, "score": float(score) if isinstance(score, (int, float)) else None})
            meta_name = name
        elif isinstance(score, (int, float)) and not mask_block:
            label = f"Unknown ({score:.2f})"

        if has_mask and "Mask detected" not in label:
            label += " [Mask detected]"

        draw.text((x1, max(0, y1 - 20)), label, fill=fill, font=font)
        detection_meta.append(
            {
                "box": [x1, y1, x2, y2],
                "label": label,
                "name": "Masked" if mask_block else meta_name,
                "score": float(score) if isinstance(score, (int, float)) else None,
                "has_mask": bool(has_mask),
            }
        )

    return annotated, matches, detection_meta


def _preprocess_sketch_image(pil_image):
    """
    Try available preprocessing hooks for sketches and always return a PIL RGB image.
    """
    from PIL import Image

    processed = pil_image
    try:
        if detector and hasattr(detector, "preprocess_sketch_bytes"):
            processed = detector.preprocess_sketch_bytes(pil_image)
        elif hasattr(faces, "preprocess_sketch"):
            try:
                processed = faces.preprocess_sketch(pil_image)
            except Exception:
                tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".jpg")
                try:
                    pil_image.save(tmp.name)
                    processed = faces.preprocess_sketch(tmp.name)
                finally:
                    tmp.close()
                    try:
                        os.remove(tmp.name)
                    except Exception:
                        pass
    except Exception:
        processed = pil_image

    if isinstance(processed, Image.Image):
        return processed.convert("RGB")
    if isinstance(processed, (bytes, bytearray)):
        try:
            return Image.open(io.BytesIO(processed)).convert("RGB")
        except Exception:
            return pil_image
    if isinstance(processed, str) and os.path.exists(processed):
        try:
            return Image.open(processed).convert("RGB")
        except Exception:
            return pil_image
    return pil_image


def _sms_configured() -> bool:
    return all([TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER])


def _pushover_configured() -> bool:
    """Check if Pushover is configured with real (non-placeholder) values."""
    if not PUSHOVER_APP_TOKEN or not PUSHOVER_USER_KEY:
        return False
    # Reject placeholder values
    if PUSHOVER_APP_TOKEN == "your_pushover_app_token" or PUSHOVER_USER_KEY == "your_pushover_user_key":
        return False
    return True


def _email_configured() -> bool:
    return all([EMAIL_HOST, EMAIL_USER, EMAIL_PASSWORD])


def _get_random_mysore_location() -> str:
    """Generate a random location in Mysore (hotels, malls, etc.)"""
    import random
    locations = [
        "Hotel Metropole, Mysore",
        "Radisson Blu Plaza Hotel, Mysore",
        "Royal Orchid Metropole Hotel, Mysore",
        "The Quorum Hotel, Mysore",
        "Hotel Sandesh The Prince, Mysore",
        "Fortune JP Palace, Mysore",
        "The Windflower Resort & Spa, Mysore",
        "Hotel Roopa, Mysore",
        "Mysore Mall, Kuvempunagar",
        "Forum Centre City Mall, Mysore",
        "Mall of Mysore, Nazarbad",
        "Sapna Book House Mall, Mysore",
        "Mysore Central Mall, Mysore",
        "City Centre Mall, Mysore",
        "Hotel Dasaprakash Paradise, Mysore",
        "Hotel Pai Vista, Mysore",
        "Hotel Southern Star, Mysore",
        "The Green Hotel, Mysore",
        "Hotel Siddhartha, Mysore",
        "Hotel Regaalis, Mysore",
    ]
    return random.choice(locations)


def _send_sms_alert(phone_number: str, message: str):
    """Send SMS alert using Twilio."""
    if not _sms_configured():
        print("[sms-alert] SMS not configured - missing Twilio env vars")
        return False
    
    try:
        from twilio.rest import Client
        client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        
        # Format phone number (ensure it starts with +)
        if not phone_number.startswith("+"):
            phone_number = "+" + phone_number.lstrip("+")
        
        message_obj = client.messages.create(
            body=message,
            from_=TWILIO_PHONE_NUMBER,
            to=phone_number
        )
        print(f"[sms-alert] Successfully sent SMS to {phone_number}: {message_obj.sid}")
        return True
    except ImportError:
        print("[sms-alert] Twilio library not installed. Install with: pip install twilio")
        return False
    except Exception as e:
        print(f"[sms-alert] Error sending SMS: {str(e)}")
        return False


def _send_pushover_alert(title: str, message: str, pil_image=None):
    """Send Pushover notification with optional image."""
    if not _pushover_configured():
        print("[pushover-alert] Pushover not configured - missing env vars")
        return False
    
    # Cooldown is now handled in _notify_alert, so we don't need to check here
    try:
        data = {
            "token": PUSHOVER_APP_TOKEN,
            "user": PUSHOVER_USER_KEY,
            "title": title,
            "message": message,
            "priority": 1,  # High priority
            "sound": "siren",  # Alert sound
        }
        
        files = None
        if pil_image:
            img_path = tempfile.NamedTemporaryFile(delete=False, suffix=".jpg")
            pil_image.save(img_path.name, "JPEG")
            img_path.close()
            try:
                with open(img_path.name, "rb") as f:
                    files = {"attachment": ("image.jpg", f, "image/jpeg")}
                    response = requests.post(
                        "https://api.pushover.net/1/messages.json",
                        data=data,
                        files=files
                    )
                    response.raise_for_status()
                    print(f"[pushover-alert] Successfully sent Pushover notification")
                    return True
            finally:
                if os.path.exists(img_path.name):
                    os.remove(img_path.name)
        else:
            response = requests.post(
                "https://api.pushover.net/1/messages.json",
                data=data
            )
            response.raise_for_status()
            print(f"[pushover-alert] Successfully sent Pushover notification")
            return True
    except Exception as e:
        print(f"[pushover-alert] Error sending Pushover notification: {str(e)}")
        return False


def _send_email_alert(to_address: str, subject: str, body: str, pil_image=None):
    """
    Send email alert with retry logic and timeout handling.
    Returns True if successful, False otherwise.

    NOTE:
    - Sends FROM EMAIL_FROM (if configured) or EMAIL_USER otherwise.
    - Authenticates with EMAIL_USER / EMAIL_PASSWORD regardless of the From header.
    - Uses SMTP_SSL when EMAIL_USE_SSL is True; otherwise uses SMTP + STARTTLS.
    """
    if not to_address or not _email_configured():
        print("[email-alert] Email not configured or no recipient address")
        return False

    msg = EmailMessage()
    msg["Subject"] = subject
    # Use configured EMAIL_FROM for the From header if present; otherwise fall back to EMAIL_USER
    msg["From"] = EMAIL_FROM or EMAIL_USER
    msg["To"] = to_address
    msg.set_content(body)

    if pil_image is not None:
        img_buf = io.BytesIO()
        try:
            pil_image.save(img_buf, format="JPEG")
            img_buf.seek(0)
            msg.add_attachment(
                img_buf.getvalue(),
                maintype="image",
                subtype="jpeg",
                filename="alert.jpg",
            )
        except Exception as e:
            print(f"[email-alert] Failed to attach image: {e}")

    # Retry logic with exponential backoff
    last_exception = None
    for attempt in range(EMAIL_MAX_RETRIES + 1):
        try:
            if attempt > 0:
                wait_time = min(2 ** attempt, 10)  # Exponential backoff, max 10s
                print(f"[email-alert] Retry attempt {attempt}/{EMAIL_MAX_RETRIES} after {wait_time}s...")
                time.sleep(wait_time)

            print(f"[email-alert] Connecting to {EMAIL_HOST}:{EMAIL_PORT} (timeout={EMAIL_TIMEOUT}s), use_ssl={EMAIL_USE_SSL}...")

            if EMAIL_USE_SSL:
                # Use implicit SSL
                server = smtplib.SMTP_SSL(
                    EMAIL_HOST,
                    EMAIL_PORT,
                    context=ssl.create_default_context(),
                    timeout=EMAIL_TIMEOUT,
                )
                try:
                    if EMAIL_USER and EMAIL_PASSWORD:
                        server.login(EMAIL_USER, EMAIL_PASSWORD)
                    server.send_message(msg)
                    print(f"[email-alert] Successfully sent email to {to_address} via SMTP_SSL")
                    return True
                finally:
                    try:
                        server.quit()
                    except Exception:
                        pass
            else:
                # Use STARTTLS
                server = smtplib.SMTP(
                    EMAIL_HOST,
                    EMAIL_PORT,
                    timeout=EMAIL_TIMEOUT,
                )
                try:
                    # Upgrade to TLS
                    server.starttls(context=ssl.create_default_context())
                    if EMAIL_USER and EMAIL_PASSWORD:
                        server.login(EMAIL_USER, EMAIL_PASSWORD)
                    server.send_message(msg)
                    print(f"[email-alert] Successfully sent email to {to_address} via STARTTLS")
                    return True
                finally:
                    try:
                        server.quit()
                    except Exception:
                        pass

        except smtplib.SMTPAuthenticationError as e:
            # Authentication errors are not retried
            last_exception = e
            print(f"[email-alert] SMTP authentication failed: {e}")
            break
        except (smtplib.SMTPConnectError, smtplib.SMTPException, OSError, TimeoutError) as e:
            last_exception = e
            print(f"[email-alert] SMTP/network error: {e}")
            if attempt < EMAIL_MAX_RETRIES:
                continue
        except Exception as e:
            last_exception = e
            print(f"[email-alert] Unexpected error: {e}")
            if attempt < EMAIL_MAX_RETRIES:
                continue

    # All retries failed
    if last_exception:
        print(f"[email-alert] Failed to send email after {EMAIL_MAX_RETRIES + 1} attempts. Last error: {last_exception}")
    return False


def _notify_alert(title: str, matches: List[Dict[str, Any]], pil_image, user=None, is_live_surveillance: bool = False):
    if not matches:
        return
    
    global _recently_alerted_criminals, _last_alert_time
    import time
    now = time.time()
    
    # Deduplicate matches by name and filter out recently alerted criminals
    unique_matches = []
    new_criminals = []
    
    for match in matches:
        name = match.get('name', 'Unknown')
        if not name or name == 'Unknown':
            continue
        
        # Check if this criminal was recently alerted (within cooldown period)
        last_alerted = _recently_alerted_criminals.get(name, 0)
        if now - last_alerted < ALERT_COOLDOWN:
            print(f"[notify-alert] Skipping alert for {name} - recently alerted {now - last_alerted:.1f}s ago")
            continue
        
        # Check if this is a duplicate in current matches
        if not any(m.get('name') == name for m in unique_matches):
            unique_matches.append(match)
            new_criminals.append(name)
    
    # If no new criminals to alert, skip
    if not unique_matches:
        print(f"[notify-alert] All criminals in this detection were recently alerted, skipping")
        return
    
    # Check global cooldown - prevent any alerts if too soon
    if now - _last_alert_time < ALERT_COOLDOWN:
        wait_time = ALERT_COOLDOWN - (now - _last_alert_time)
        print(f"[notify-alert] Global cooldown active, skipping alerts (wait {wait_time:.1f}s)")
        return
    
    # Update last alert time and track alerted criminals
    _last_alert_time = now
    for name in new_criminals:
        _recently_alerted_criminals[name] = now
    
    # Clean up old entries from tracking dict (older than 2x cooldown)
    cutoff_time = now - (ALERT_COOLDOWN * 2)
    _recently_alerted_criminals = {k: v for k, v in _recently_alerted_criminals.items() if v > cutoff_time}
    
    # Use only the first match for alert (or best match if sorted by score)
    # Sort by score descending to get best match first
    unique_matches.sort(key=lambda x: x.get('score', 0), reverse=True)
    primary_match = unique_matches[0]
    
    # Create alert message with primary match only
    summary_text = f"{primary_match['name']} | score {(primary_match.get('score') or 0):.2f}"
    
    # Add location for live surveillance only
    location_info = ""
    if is_live_surveillance:
        location = _get_random_mysore_location()
        location_info = f"\n📍 Location: {location}"
    
    full_message = f"{summary_text}{location_info}\n\nThis alert was triggered automatically by the Apna Criminal system."
    
    # Play audio alert
    try:
        import audio_alert
        if hasattr(audio_alert, "play_alert"):
            audio_alert.play_alert()
    except Exception:
        pass

    # Get phone number and email from user, with fallback to defaults
    phone_number = None
    email_address = None
    if isinstance(user, dict):
        phone_number = user.get("phone")
        email_address = user.get("email")
        # Fallback: check if username is an email
        if not email_address and user.get("username") and "@" in str(user.get("username")):
            email_address = user.get("username")
    elif isinstance(user, str):
        if user.replace("+", "").replace("-", "").replace(" ", "").isdigit():
            phone_number = user
        elif "@" in user:
            email_address = user
    
    # Use default recipients if user doesn't have phone/email
    if not phone_number and DEFAULT_SMS_RECIPIENT:
        phone_number = DEFAULT_SMS_RECIPIENT
        print(f"[notify-alert] Using default SMS recipient: {phone_number}")
    if not email_address and DEFAULT_EMAIL_RECIPIENT:
        email_address = DEFAULT_EMAIL_RECIPIENT
        print(f"[notify-alert] Using default email recipient: {email_address}")
    
    # Validate phone number format before sending
    if phone_number:
        phone_digits = "".join(c for c in phone_number if c.isdigit())
        if len(phone_digits) < 10:
            print(f"[notify-alert] Skipping SMS - invalid phone format: {phone_number}")
            phone_number = None
    
    # Validate email format before sending
    if email_address and ("@" not in email_address or "." not in email_address.split("@")[-1]):
        print(f"[notify-alert] Skipping email - invalid email format: {email_address}")
        email_address = None

    # Send SMS alert (Twilio)
    if phone_number and _sms_configured():
        _send_sms_alert(phone_number, full_message)
    
    # Send Pushover alert (works for all users if configured)
    # Use full_message to include location for live surveillance
    if _pushover_configured():
        pushover_message = full_message if is_live_surveillance else summary_text
        _send_pushover_alert(title, pushover_message, pil_image)
    
    # Send Email alert
    if email_address and _email_configured():
        _send_email_alert(email_address, title, full_message, pil_image)


# Utility helper to handle different return shapes from detector pipeline
def _unpack_pipeline_result(result, fallback_image=None):
    """
    Accepts result from _run_detection_pipeline and returns (annotated, matches, detections)
    Handles:
     - (annotated, matches, detections)
     - (annotated, matches)
     - annotated (single value)
    """
    annotated = fallback_image
    matches = []
    detections = None

    if isinstance(result, (tuple, list)):
        if len(result) == 3:
            annotated, matches, detections = result
        elif len(result) == 2:
            annotated, matches = result
            detections = None
        elif len(result) >= 1:
            annotated = result[0]
            matches = result[1] if len(result) > 1 else []
            detections = result[2] if len(result) > 2 else None
    else:
        # single value returned; treat as annotated image
        annotated = result
        matches = []
        detections = None

    return annotated, matches, detections


# ----------------- Auth endpoints -----------------
@app.post("/api/auth/login")
def login(
    username: str = Form(...), 
    password: str = Form(...),
    email: str = Form(None),
    phone: str = Form(None)
):
    """
    Login: compare against faces.DEFAULT_USERNAME / DEFAULT_PASSWORD if present.
    Accepts optional email and phone number for alert notifications.
    Returns a random token (in-memory). Frontend must include Authorization: Bearer <token>.
    """
    uname = getattr(faces, "DEFAULT_USERNAME", None)
    pwd = getattr(faces, "DEFAULT_PASSWORD", None)
    
    # Clean phone number if provided
    phone_clean = None
    if phone:
        phone_clean = "".join(c for c in phone if c.isdigit() or c == "+")
        if phone_clean and not phone_clean.startswith("+"):
            phone_clean = "+" + phone_clean.lstrip("+")
    
    # Use email from form or try to extract from username if it looks like email
    email_clean = email or (username if "@" in username else None)
    
    if uname is None or pwd is None:
        token = secrets.token_hex(16)
        TOKENS[token] = _make_session_payload(username, phone=phone_clean, email=email_clean)
        return {
            "token": token, 
            "email": email_clean or username,
            "phone": phone_clean or username,
            "name": username
        }
    if username == uname and password == pwd:
        token = secrets.token_hex(16)
        TOKENS[token] = _make_session_payload(username, phone=phone_clean, email=email_clean)
        return {
            "token": token, 
            "email": email_clean or username,
            "phone": phone_clean or username,
            "name": username
        }
    raise HTTPException(status_code=401, detail="Invalid credentials")


@app.post("/api/auth/register")
async def register_user(
    username: str = Form(...),
    password: str = Form(...),
    name: str = Form(None),
    email: str = Form(None),
    phone: str = Form(None)
):
    """
    Register a new user with the provided credentials.
    Validates Indian phone numbers (10 digits starting with 6-9).
    """
    # Basic validation
    if not username or not password:
        raise HTTPException(status_code=400, detail="Username and password are required")
    
    # Clean and validate Indian phone number
    phone_clean = None
    if phone:
        # Remove all non-digit characters
        phone_digits = ''.join(filter(str.isdigit, phone))
        
        # Validate Indian mobile number (10 digits starting with 6-9)
        if len(phone_digits) != 10 or not phone_digits[0] in "6789":
            raise HTTPException(
                status_code=400,
                detail="Please enter a valid 10-digit Indian mobile number starting with 6-9"
            )
        
        # Format as +91 XXXXXXXXXX
        phone_clean = f"+91{phone_digits}"
    
    # Check if username already exists
    for token, user_data in TOKENS.items():
        if user_data.get("username") == username:
            raise HTTPException(status_code=400, detail="Username already exists")
    
    # Generate a token for the new user
    token = secrets.token_hex(16)
    TOKENS[token] = _make_session_payload(
        username=username,
        name=name or username,
        email=email,
        phone=phone_clean
    )
    
    # Debug log
    print(f"New user registered - Username: {username}, Phone: {phone_clean}")
    
    return {
        "token": token,
        "username": username,
        "name": name or username,
        "email": email,
        "phone": phone_clean
    }


# ----------------- List criminals -----------------
@app.get("/api/criminals")
def list_criminals(user=Depends(fake_auth_header)):
    """
    Return list of criminals in a JSON-safe form. Embeddings or numpy arrays are removed.
    """
    try:
        raw = faces.load_all_criminals() or []
    except Exception:
        raw = []

    safe_list = []
    for entry in raw:
        try:
            safe = make_serializable_entry(entry)
            safe_list.append(safe)
        except Exception:
            # skip problematic entries
            continue
    return safe_list


# ----------------- Register from image upload (multipart file + form fields) -----------------
@app.post("/api/criminals/upload-image")
async def upload_image(
    file: UploadFile = File(...),
    name: str = Form(None),
    age: str = Form(""),
    gender: str = Form(""),
    crime: str = Form(""),
    token: str = Form(None),
    user=Depends(fake_auth_header),
):
    import traceback
    from PIL import Image

    try:
        data = await file.read()
        size = len(data)
        filename = getattr(file, "filename", "unknown")
        print(f"[upload-image] Received file: {filename} size={size} name(form)={name} token(form)={bool(token)}")

        pil = Image.open(io.BytesIO(data)).convert("RGB")

        details = {"name": name or "unknown", "age": age or "", "gender": gender or "", "crime": crime or ""}

        # Try the signature that expects (pil, name, age, gender, crime) first
        last_exc = None
        try:
            print("[upload-image] Trying faces.add_criminal_from_pil(pil, name, age, gender, crime)")
            faces.add_criminal_from_pil(pil, details.get("name"), details.get("age"), details.get("gender"), details.get("crime"))
            print("[upload-image] Success with (pil, name, age, gender, crime)")
            _invalidate_db_cache()  # Invalidate cache after adding criminal
            return {"ok": True}
        except Exception as e1:
            print("[upload-image] First attempt failed:", repr(e1))
            last_exc = e1

        # If first failed, try signature (pil, details)
        try:
            print("[upload-image] Trying faces.add_criminal_from_pil(pil, details)")
            faces.add_criminal_from_pil(pil, details)
            print("[upload-image] Success with (pil, details)")
            _invalidate_db_cache()  # Invalidate cache after adding criminal
            return {"ok": True}
        except Exception as e2:
            print("[upload-image] Second attempt failed:", repr(e2))
            last_exc = e2

        # Both failed — raise to outer handler
        raise last_exc if last_exc is not None else RuntimeError("Unknown error calling add_criminal_from_pil")

    except Exception as e:
        tb = traceback.format_exc()
        print("ERROR in /api/criminals/upload-image:\n", tb)
        return JSONResponse(
            status_code=500,
            content={
                "detail": "server error during upload",
                "error": str(e),
                "trace": tb.splitlines()[-20:]
            },
        )


# ----------------- Register from webcam (same as upload-image) -----------------
@app.post("/api/criminals/upload-webcam")
async def upload_webcam(
    file: UploadFile = File(...),
    name: str = Form(None),
    age: str = Form(""),
    gender: str = Form(""),
    crime: str = Form(""),
    token: str = Form(None),
    user=Depends(fake_auth_header),
):
    return await upload_image(file=file, name=name, age=age, gender=gender, crime=crime, token=token, user=user)


# ----------------- Delete criminal -----------------
@app.post("/api/criminals/delete")
def delete_criminal(payload: dict = Body(...), user=Depends(fake_auth_header)):
    """
    Accepts JSON body { "name": "..." } from frontend.
    """
    name = payload.get("name")
    if not name:
        raise HTTPException(status_code=400, detail="Name required")
    ok = faces.delete_criminal(name)
    if not ok:
        raise HTTPException(status_code=404, detail="Not found")
    _invalidate_db_cache()  # Invalidate cache after deleting criminal
    return {"ok": True}


# ----------------- Detect image endpoint (calls your detector and faces DB) -----------------
@app.post("/api/detect/image")
async def detect_image(
    file: UploadFile = File(...), 
    user=Depends(fake_auth_header),
    is_live: bool = Form(False)
):
    import time
    start_time = time.time()
    data = await file.read()
    from PIL import Image

    try:
        pil = Image.open(io.BytesIO(data)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image")

    load_start = time.time()
    db_bundle = _load_db_bundle()
    load_time = time.time() - load_start
    if load_time > 0.1:
        print(f"[perf] Database load took {load_time:.2f}s")
    
    detect_start = time.time()
    result = _run_detection_pipeline(pil, db_bundle=db_bundle)
    detect_time = time.time() - detect_start
    total_time = time.time() - start_time
    print(f"[perf] Image detection: load={load_time:.2f}s, detect={detect_time:.2f}s, total={total_time:.2f}s")
    annotated, matched, detections = _unpack_pipeline_result(result, fallback_image=pil)
    safe_matches = _serialize_matches(matched)
    safe_detections = _serialize_detections(detections)

    if safe_matches:
        # Pass is_live flag to include location for live surveillance
        _notify_alert("🚨 Criminal Detected", safe_matches, annotated, user=user, is_live_surveillance=is_live)

    buf = io.BytesIO()
    annotated.save(buf, format="JPEG")
    buf.seek(0)
    resp = StreamingResponse(buf, media_type="image/jpeg")
    if safe_matches:
        resp.headers["X-Matches"] = json.dumps(safe_matches)
    if safe_detections:
        resp.headers["X-Detections"] = json.dumps(safe_detections)
    return resp


@app.post("/api/detect/video")
async def detect_video(video: UploadFile = File(...), user=Depends(fake_auth_header)):
    data = await video.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty video")

    from PIL import Image

    suffix = Path(getattr(video, "filename", "") or "").suffix or ".mp4"
    tmp_file = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    try:
        tmp_file.write(data)
        tmp_path = tmp_file.name
    finally:
        tmp_file.close()

    cap = cv2.VideoCapture(tmp_path)
    if not cap or not cap.isOpened():
        try:
            os.remove(tmp_path)
        except Exception:
            pass
        raise HTTPException(status_code=400, detail="Unable to read video")

    frame_limit = 600
    db_bundle = _load_db_bundle()
    aggregated_matches: List[Dict[str, Any]] = []
    alert_sent = False

    # normalize processing to ~30 FPS so detection feels realtime even on high-FPS clips
    source_fps = cap.get(cv2.CAP_PROP_FPS) or 0
    target_fps = 30.0
    if not source_fps or np.isnan(source_fps) or source_fps <= 0:
        source_fps = target_fps
    frame_step = max(1, int(round(source_fps / target_fps)))

    def frame_stream():
        nonlocal alert_sent
        try:
            frame_count = 0
            while frame_count < frame_limit:
                ret, frame = cap.read()
                if not ret:
                    break
                frame_count += 1

                if frame_step > 1 and (frame_count - 1) % frame_step != 0:
                    continue

                pil_frame = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
                result = _run_detection_pipeline(pil_frame, db_bundle=db_bundle)
                annotated, matches, detections = _unpack_pipeline_result(result, fallback_image=pil_frame)
                safe_matches = _serialize_matches(matches)
                safe_detections = _serialize_detections(detections)
                if safe_matches:
                    aggregated_matches.extend(safe_matches)
                    if not alert_sent:
                        _notify_alert("🚨 Criminal Detected (Video)", safe_matches, annotated, user=user)
                        alert_sent = True

                buf = io.BytesIO()
                annotated.save(buf, format="JPEG")
                payload = {
                    "type": "frame",
                    "index": frame_count - 1,
                    "matches": safe_matches,
                    "detections": safe_detections,
                    "frame": base64.b64encode(buf.getvalue()).decode("ascii"),
                }
                yield (json.dumps(payload) + "\n").encode("utf-8")
        finally:
            cap.release()
            try:
                os.remove(tmp_path)
            except Exception:
                pass

        final_payload = {"type": "done", "matches": _serialize_matches(aggregated_matches)}
        yield (json.dumps(final_payload) + "\n").encode("utf-8")

    return StreamingResponse(frame_stream(), media_type="application/x-ndjson")


# ----------------- Detect sketch endpoint (use faces.preprocess_sketch or detector's function) -----------------
@app.post("/api/detect/sketch")
async def detect_sketch(file: UploadFile = File(...), user=Depends(fake_auth_header)):
    data = await file.read()
    from PIL import Image

    try:
        pil = Image.open(io.BytesIO(data)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image")

    import time
    start_time = time.time()
    processed = _preprocess_sketch_image(pil)
    preprocess_time = time.time() - start_time
    
    load_start = time.time()
    db_bundle = _load_db_bundle()
    load_time = time.time() - load_start
    if load_time > 0.1:
        print(f"[perf] Database load took {load_time:.2f}s")
    
    detect_start = time.time()
    result = _run_detection_pipeline(processed, db_bundle=db_bundle)
    detect_time = time.time() - detect_start
    total_time = time.time() - start_time
    print(f"[perf] Sketch detection: preprocess={preprocess_time:.2f}s, load={load_time:.2f}s, detect={detect_time:.2f}s, total={total_time:.2f}s")
    annotated, matched, detections = _unpack_pipeline_result(result, fallback_image=processed)
    safe_matches = _serialize_matches(matched)
    safe_detections = _serialize_detections(detections)

    buf = io.BytesIO()
    annotated.save(buf, format="JPEG")
    buf.seek(0)
    resp = StreamingResponse(buf, media_type="image/jpeg")
    if safe_matches:
        resp.headers["X-Matches"] = json.dumps(safe_matches)
    if safe_detections:
        resp.headers["X-Detections"] = json.dumps(safe_detections)
        _notify_alert("🚨 Criminal Detected (Sketch)", safe_matches, annotated, user=user)
    return resp


@app.post("/api/alerts/sms")
def send_sms_alert(
    payload: Dict[str, Any] = Body(...),
    user=Depends(fake_auth_header),
):
    """Send SMS alert to user's phone number."""
    import traceback
    try:
        if not _sms_configured():
            print("[sms-alert] SMS not configured - missing Twilio env vars")
            raise HTTPException(status_code=500, detail="SMS service not configured. Check TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER environment variables.")

        # Try to get recipient from: payload -> user phone -> default from env
        recipient = payload.get("recipient") or user.get("phone") or DEFAULT_SMS_RECIPIENT
        
        # Validate phone number - check if it looks like a real phone number
        if not recipient:
            print(f"[sms-alert] No recipient found - payload={payload}, user={user}, default={DEFAULT_SMS_RECIPIENT}")
            raise HTTPException(
                status_code=400, 
                detail="Recipient phone number missing. Provide 'recipient' in payload, set user phone during login, or configure DEFAULT_SMS_RECIPIENT in .env file."
            )
        
        # Check if recipient is actually a phone number (not just a username)
        phone_digits = "".join(c for c in recipient if c.isdigit())
        if len(phone_digits) < 10:  # Phone numbers should have at least 10 digits
            print(f"[sms-alert] Invalid phone number format: {recipient}")
            # Try default if user phone is invalid
            if recipient == user.get("phone") and DEFAULT_SMS_RECIPIENT:
                recipient = DEFAULT_SMS_RECIPIENT
                print(f"[sms-alert] Using default recipient: {recipient}")
            else:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid phone number format: {recipient}. Phone numbers must have at least 10 digits."
                )

        # Clean phone number
        if not recipient.startswith("+"):
            recipient = "+" + "".join(c for c in recipient if c.isdigit() or c == "+")

        message = payload.get("message")
        matches = payload.get("matches") or []
        if not message:
            summary_lines = [f"{m.get('name', 'Unknown')} | score {(m.get('score') or 0):.2f}" for m in matches]
            if summary_lines:
                message = "\n".join(summary_lines) + "\n\n🚨 Criminal Detection Alert from Apna Criminal"
            else:
                message = "🚨 Automated alert triggered from Apna Criminal dashboard."

        print(f"[sms-alert] Attempting to send to {recipient}")
        ok = _send_sms_alert(recipient, message)
        if not ok:
            print(f"[sms-alert] _send_sms_alert returned False")
            raise HTTPException(status_code=500, detail="Unable to send SMS alert. Check server logs for Twilio errors.")
        print(f"[sms-alert] Successfully sent to {recipient}")
        return {"ok": True, "recipient": recipient}
    except HTTPException:
        raise
    except Exception as e:
        tb = traceback.format_exc()
        print(f"[sms-alert] Exception:\n{tb}")
        raise HTTPException(status_code=500, detail=f"SMS alert error: {str(e)}")


@app.post("/api/alerts/pushover")
def send_pushover_alert(
    payload: Dict[str, Any] = Body(...),
    user=Depends(fake_auth_header),
):
    """Send Pushover notification."""
    import traceback
    try:
        if not _pushover_configured():
            print("[pushover-alert] Pushover not configured - missing env vars")
            raise HTTPException(status_code=500, detail="Pushover not configured. Check PUSHOVER_APP_TOKEN and PUSHOVER_USER_KEY environment variables.")

        title = payload.get("title") or "🚨 Criminal Detection Alert"
        message = payload.get("message")
        matches = payload.get("matches") or []
        if not message:
            summary_lines = [f"{m.get('name', 'Unknown')} | score {(m.get('score') or 0):.2f}" for m in matches]
            if summary_lines:
                message = "\n".join(summary_lines)
            else:
                message = "Automated alert triggered from Apna Criminal dashboard."

        print(f"[pushover-alert] Attempting to send notification")
        ok = _send_pushover_alert(title, message, None)
        if not ok:
            print(f"[pushover-alert] _send_pushover_alert returned False")
            raise HTTPException(status_code=500, detail="Unable to send Pushover alert. Check server logs.")
        print(f"[pushover-alert] Successfully sent notification")
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        tb = traceback.format_exc()
        print(f"[pushover-alert] Exception:\n{tb}")
        raise HTTPException(status_code=500, detail=f"Pushover alert error: {str(e)}")


@app.post("/api/alerts/email")
def send_email_alert(
    payload: Dict[str, Any] = Body(...),
    user=Depends(fake_auth_header),
):
    """Send email alert."""
    import traceback
    try:
        if not _email_configured():
            print("[email-alert] Email not configured - missing env vars")
            raise HTTPException(status_code=500, detail="Email not configured. Check EMAIL_HOST, EMAIL_USER, EMAIL_PASSWORD environment variables.")

        # Try to get recipient from: payload -> user email -> username (if email) -> default from env
        recipient = payload.get("recipient") or user.get("email") or (user.get("username") if "@" in str(user.get("username", "")) else None) or DEFAULT_EMAIL_RECIPIENT
        
        if not recipient:
            print(f"[email-alert] No recipient found - payload={payload}, user={user}, default={DEFAULT_EMAIL_RECIPIENT}")
            raise HTTPException(
                status_code=400,
                detail="Recipient email address missing. Provide 'recipient' in payload, set user email during login, or configure DEFAULT_EMAIL_RECIPIENT in .env file."
            )
        
        # Validate email format
        if "@" not in recipient or "." not in recipient.split("@")[-1]:
            print(f"[email-alert] Invalid email format: {recipient}")
            # Try default if user email is invalid
            if recipient in [user.get("email"), user.get("username")] and DEFAULT_EMAIL_RECIPIENT:
                recipient = DEFAULT_EMAIL_RECIPIENT
                print(f"[email-alert] Using default recipient: {recipient}")
            else:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid email address format: {recipient}"
                )

        subject = payload.get("subject") or "🚨 Criminal Detection Alert"
        message = payload.get("message")
        matches = payload.get("matches") or []
        if not message:
            summary_lines = [f"{m.get('name', 'Unknown')} | score {(m.get('score') or 0):.2f}" for m in matches]
            if summary_lines:
                message = "\n".join(summary_lines) + "\n\n🚨 Criminal Detection Alert from Apna Criminal"
            else:
                message = "🚨 Automated alert triggered from Apna Criminal dashboard."

        print(f"[email-alert] Attempting to send to {recipient}")
        ok = _send_email_alert(recipient, subject, message, None)
        if not ok:
            print(f"[email-alert] _send_email_alert returned False")
            raise HTTPException(status_code=500, detail="Unable to send email alert. Check server logs for SMTP errors.")
        print(f"[email-alert] Successfully sent to {recipient}")
        return {"ok": True, "recipient": recipient}
    except HTTPException:
        raise
    except Exception as e:
        tb = traceback.format_exc()
        print(f"[email-alert] Exception:\n{tb}")
        raise HTTPException(status_code=500, detail=f"Email alert error: {str(e)}")


# --- Simple health ---
@app.get("/api/health")
def health():
    return {"ok": True, "images_dir": _images_dir}
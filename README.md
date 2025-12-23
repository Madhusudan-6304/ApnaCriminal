// ...existing code...

# APNA Criminal Surveillance

A simple full-stack surveillance demo using a FastAPI backend and a React + Vite frontend. The backend provides endpoints for image/video processing and integrations (e.g., Twilio or other APIs), while the frontend is a Vite React app for interacting with the backend.

## Repo layout (relevant)
- real_survillance/
  - backend_adapter.py (FastAPI app entry)
  - requirements.txt
  - .venv/ (virtual environment, not committed)
  - frontend/
    - app/ (React + Vite project)
      - package.json
      - src/
      - vite.config.js

## Prerequisites (Windows)
- Python 3.10+ (installed and on PATH)
- Node.js 16+ and npm
- Git (optional)
- Recommended: PowerShell for the shown commands

## Environment variables
Create a `.env` file for secrets used by the backend (example keys — adapt to your code):
````env
# filepath: c:\Users\madhu\Downloads\apnacriminal_survillance\real_survillance\frontend\app\backend.env
# ...existing code...

Providing environment variables...
Also set the frontend backend URL (example .env in frontend app):
BACKEND_HOST=127.0.0.1
BACKEND_PORT=8000
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_FROM_NUMBER=+1234567890
OTHER_API_KEY=your_api_key
# ...existing code...
# filepath: [.env](http://_vscodecontentref_/0)
# ...existing code...
VITE_API_BASE_URL=http://127.0.0.1:8000
# ...existing code...

## Backend — install & run (PowerShell)
Create and activate venv:
python -m venv .venv
.\.venv\Scripts\Activate.ps1

pip install -r requirements.txt
# If requirements.txt missing, a fallback:
pip install fastapi uvicorn python-dotenv twilio requests pillow opencv-python

python -m uvicorn backend_adapter:app --host 127.0.0.1 --port 8000 --reload

Frontend — install & run
From the frontend app folder:

cd real_survillance\frontend\app
npm install
npm run dev

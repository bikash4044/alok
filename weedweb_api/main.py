from fastapi import FastAPI, Body, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from pywebpush import webpush, WebPushException
import uvicorn
import os
import glob
import pandas as pd
import requests
import json

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- CONFIGURATION & FILE SETUP ---
UPLOAD_DIR = "uploads"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

app.mount("/images", StaticFiles(directory=UPLOAD_DIR), name="images")

# 1. READ WEATHER API KEY
try:
    with open("weather.txt", "r") as f:
        WEATHER_API_KEY = f.read().strip()
except FileNotFoundError:
    print("WARNING: 'weather.txt' not found. Weather features will fail.")
    WEATHER_API_KEY = ""

# 2. READ VAPID KEYS (For Notifications)
VAPID_CLAIMS = {"sub": "mailto:admin@weedweb.com"}  # Replace with your email

# Read Private Key (Used to sign messages)
try:
    with open("private_key.pem", "r") as f:
        VAPID_PRIVATE_KEY = f.read().strip()
except FileNotFoundError:
    print("WARNING: 'private_key.pem' not found. Notifications will fail.")
    VAPID_PRIVATE_KEY = None

# Read Public Key (Sent to Frontend)
try:
    with open("public_key.pem", "r") as f:
        raw_pub = f.read().strip()
        # Clean the key for the frontend (Remove headers and newlines)
        VAPID_PUBLIC_KEY = raw_pub.replace("-----BEGIN PUBLIC KEY-----", "") \
            .replace("-----END PUBLIC KEY-----", "") \
            .replace("\n", "").strip()
except FileNotFoundError:
    print("WARNING: 'public_key.pem' not found.")
    VAPID_PUBLIC_KEY = None

CITY = "Kharagpur"


# --- NOTIFICATION DATA MODELS ---
class SubscriptionModel(BaseModel):
    endpoint: str
    keys: dict


# In-memory storage for subscriptions (Use a DB in production)
subscriptions = []


# --- NOTIFICATION ENDPOINTS ---

@app.get("/vapid_public_key")
def get_vapid_key():
    """Returns the public key so React can subscribe"""
    if not VAPID_PUBLIC_KEY:
        return {"error": "Server missing public_key.pem"}
    return {"publicKey": VAPID_PUBLIC_KEY}


@app.post("/subscribe")
def subscribe(sub: SubscriptionModel):
    """Saves the user's subscription details"""
    subscription_data = sub.dict()
    if subscription_data not in subscriptions:
        subscriptions.append(subscription_data)
        print(f"New subscriber! Total: {len(subscriptions)}")
    return {"message": "Subscribed successfully"}


@app.post("/trigger_alert")
def trigger_alert():
    """Sends the actual push notification"""
    if not VAPID_PRIVATE_KEY:
        return {"error": "Server missing private_key.pem"}

    message = json.dumps({
        "title": "Irrigation Alert! 💧",
        "body": "Soil moisture is critical (18%). Please irrigate now.",
    })

    print(f"Sending alert to {len(subscriptions)} users...")
    results = []

    for sub in subscriptions:
        try:
            webpush(
                subscription_info=sub,
                data=message,
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims=VAPID_CLAIMS
            )
            results.append("Sent")
        except WebPushException as ex:
            print(f"Push failed: {repr(ex)}")
            results.append("Failed")
            # Remove expired subscriptions (Status 410 = Gone)
            if ex.response and ex.response.status_code == 410:
                subscriptions.remove(sub)

    return {"status": "Notifications processed", "results": results}


# --- DATA ENDPOINTS ---

@app.get("/fetch_main")
async def fetch_main():
    png_files = glob.glob(os.path.join(UPLOAD_DIR, "*.png"))
    if not png_files:
        return {"error": "No PNG images found"}
    latest_image_path = sorted(png_files)[-1]
    filename = os.path.basename(latest_image_path)
    return {
        "image_url": f"http://localhost:8000/images/{filename}",
        "filename": filename
    }


@app.get("/fetch_timeseries")
async def fetch_timeseries():
    csv_path = os.path.join(UPLOAD_DIR, "diabetes.csv")
    if not os.path.exists(csv_path):
        return {"error": "diabetes.csv not found"}

    df = pd.read_csv(csv_path)
    if 'datetime' in df.columns:
        # --- FIX APPLIED HERE ---
        # Added format='mixed' to tell pandas to attempt parsing diverse date formats
        # without throwing the warning.
        try:
            df['datetime'] = pd.to_datetime(df['datetime'], format='mixed')
        except ValueError:
            # Fallback if 'mixed' fails or data is extremely dirty
            df['datetime'] = pd.to_datetime(df['datetime'], errors='coerce')

        # Drop rows where date conversion failed (if any)
        df = df.dropna(subset=['datetime'])

        df = df.sort_values('datetime')

        data = [
            {"time": row['datetime'].strftime('%Y-%m-%d %H:%M:%S'), "value": row['Pregnancies']}
            for _, row in df.iterrows()
        ]
        return {
            "source": "diabetes.csv",
            "column": "Pregnancies",
            "data": data
        }
    return {"error": "Column 'datetime' not found in CSV"}


@app.get("/fetch_weather")
async def fetch_weather():
    if not WEATHER_API_KEY:
        return {"error": "API Key missing in weather.txt"}

    url = f"http://api.weatherapi.com/v1/forecast.json?key={WEATHER_API_KEY}&q={CITY}&days=3&aqi=no&alerts=no"
    try:
        # ADD TIMEOUT HERE (5 seconds)
        response = requests.get(url, timeout=5)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Weather API Error: {e}")
        # Return a safe error structure so React doesn't crash
        return {"error": "Weather Unavailable", "forecast": []}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
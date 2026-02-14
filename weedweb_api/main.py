from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
import pandas as pd
import glob

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
app.mount("/images", StaticFiles(directory=UPLOAD_DIR), name="images")


@app.get("/fetch_main")
async def fetch_main():
    # Look specifically for .png files in the uploads folder
    png_files = glob.glob(os.path.join(UPLOAD_DIR, "*.png"))

    if not png_files:
        return {"error": "No PNG images found"}

    # Get the last file based on alphabetical/timestamp order
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

    # Read CSV and extract relevant columns
    df = pd.read_csv(csv_path)

    # Ensure datetime is sorted for a proper time series
    if 'datetime' in df.columns:
        df['datetime'] = pd.to_datetime(df['datetime'])
        df = df.sort_values('datetime')

        # Format response: list of {time: ..., value: ...}
        data = [
            {
                "time": row['datetime'].strftime('%Y-%m-%d %H:%M:%S'),
                "value": row['Pregnancies']
            }
            for _, row in df.iterrows()
        ]

        return {
            "source": "diabetes.csv",
            "column": "Pregnancies",
            "data": data
        }

    return {"error": "Column 'datetime' not found in CSV"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
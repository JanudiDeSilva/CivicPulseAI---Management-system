import json
import joblib
import pandas as pd
import httpx
import io
import numpy as np
from PIL import Image
import tensorflow as tf
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input

 
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
 

from fastapi import UploadFile, File

 
app = FastAPI(title="Flood Risk ML Service")
 
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
 

model = None
num_imputer = None
cat_imputer = None
model_columns = None
label_encoder = None
DISTRICT_LOOKUP = {}
model_loaded = False
model_load_error = None
 
try:
    model = joblib.load("artifacts/flood_model.pkl")
    num_imputer = joblib.load("artifacts/num_imputer.pkl")
    cat_imputer = joblib.load("artifacts/cat_imputer.pkl")
    model_columns = joblib.load("artifacts/model_columns.pkl")
    label_encoder = joblib.load("artifacts/label_encoder.pkl")
 
    with open("artifacts/district_lookup.json", "r") as f:
        DISTRICT_LOOKUP = json.load(f)
 
    model_loaded = True
except Exception as e:
    model_load_error = str(e)
 
NUMERIC_COLS = [
    "latitude", "longitude", "elevation_m", "distance_to_river_m",
    "population_density_per_km2", "built_up_percent", "rainfall_7d_mm",
    "monthly_rainfall_mm", "drainage_index", "ndvi", "ndwi",
    "water_presence_flag", "historical_flood_count", "infrastructure_score",
    "nearest_hospital_km", "nearest_evac_km",
]
 
CATEGORICAL_COLS = [
    "district", "place_name", "landcover", "soil_type",
    "water_supply", "electricity", "road_quality", "urban_rural",
]

 
GARBAGE_MODEL = None
GARBAGE_MODEL_LOADED = False
GARBAGE_MODEL_LOAD_ERROR = None
 
# Must match the image size the model was actually trained at
# (160x160 if you used the RAM-safe pipeline, 224x224 if you trained at full size)
GARBAGE_IMG_SIZE = (160, 160)
 
# Order must exactly match sorted(os.listdir(TRAIN_DIR)) from training
GARBAGE_CLASS_NAMES = [
    "battery", "biological", "cardboard", "clothes", "glass",
    "metal", "paper", "plastic", "shoes", "trash",
]
 
try:
    GARBAGE_MODEL = tf.keras.models.load_model("artifacts/garbage/garbage_classifier_best.keras")
    GARBAGE_MODEL_LOADED = True
except Exception as e:
    GARBAGE_MODEL_LOAD_ERROR = str(e)
 
 
def preprocess_garbage_image(image_bytes: bytes) -> np.ndarray:
    """Load raw image bytes, resize, and preprocess for MobileNetV2 input."""
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img = img.resize(GARBAGE_IMG_SIZE)
    img_array = np.array(img).astype("float32")
    img_array = preprocess_input(img_array)
    img_array = np.expand_dims(img_array, axis=0)  # add batch dimension
    return img_array
 
 
def run_garbage_prediction(image_bytes: bytes) -> dict:
    if not GARBAGE_MODEL_LOADED:
        return {"error": "Garbage classification model not loaded", "detail": GARBAGE_MODEL_LOAD_ERROR}
 
    img_array = preprocess_garbage_image(image_bytes)
    preds = GARBAGE_MODEL.predict(img_array, verbose=0)[0]
 
    top_idx = int(np.argmax(preds))
    predicted_class = GARBAGE_CLASS_NAMES[top_idx]
    confidence = float(preds[top_idx])
 
    all_scores = {
        GARBAGE_CLASS_NAMES[i]: round(float(preds[i]), 4)
        for i in range(len(GARBAGE_CLASS_NAMES))
    }
 
    return {
        "predicted_class": predicted_class,
        "confidence": round(confidence, 4),
        "all_class_scores": all_scores,
    } 
 
class FloodFeatures(BaseModel):
    district: Optional[str] = None
    place_name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    elevation_m: Optional[float] = None
    distance_to_river_m: Optional[float] = None
    landcover: Optional[str] = None
    soil_type: Optional[str] = None
    water_supply: Optional[str] = None
    electricity: Optional[str] = None
    road_quality: Optional[str] = None
    population_density_per_km2: Optional[float] = None
    built_up_percent: Optional[float] = None
    urban_rural: Optional[str] = None
    rainfall_7d_mm: Optional[float] = None
    monthly_rainfall_mm: Optional[float] = None
    drainage_index: Optional[float] = None
    ndvi: Optional[float] = None
    ndwi: Optional[float] = None
    water_presence_flag: Optional[float] = None
    historical_flood_count: Optional[float] = None
    infrastructure_score: Optional[float] = None
    nearest_hospital_km: Optional[float] = None
    nearest_evac_km: Optional[float] = None
 
 
class ComplaintInput(BaseModel):
    district: str
    place_name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    water_presence_flag: Optional[float] = 0
 
 
def run_prediction(payload: FloodFeatures) -> dict:
    if not model_loaded:
        return {"error": "Model not loaded", "detail": model_load_error}
 
    row = payload.dict()
    df = pd.DataFrame([row])
 
    df[NUMERIC_COLS] = num_imputer.transform(df[NUMERIC_COLS])
    df[CATEGORICAL_COLS] = cat_imputer.transform(df[CATEGORICAL_COLS])
 
    for c in CATEGORICAL_COLS:
        df[c] = df[c].astype(str).str.strip().str.lower()
 
    df_encoded = pd.get_dummies(df, drop_first=True)
    df_encoded = df_encoded.reindex(columns=model_columns, fill_value=0)
 
    pred = model.predict(df_encoded)[0]
    proba = model.predict_proba(df_encoded)[0]
    label = label_encoder.inverse_transform([pred])[0]
 
    confidence = float(max(proba))
    yes_idx = list(label_encoder.classes_).index("yes") if "yes" in label_encoder.classes_ else 1
    flood_prob = float(proba[yes_idx])
 
    if flood_prob >= 0.7:
        risk_level = "HIGH"
    elif flood_prob >= 0.3:
        risk_level = "MODERATE"
    else:
        risk_level = "LOW"
 
    return {
        "flood_occurrence": label,
        "flood_probability": round(flood_prob, 4),
        "risk_level": risk_level,
        "confidence": round(confidence, 4),
    }
 
 
async def get_live_rainfall(lat: float, lon: float) -> dict:
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                "https://api.open-meteo.com/v1/forecast",
                params={
                    "latitude": lat,
                    "longitude": lon,
                    "daily": "precipitation_sum",
                    "past_days": 7,
                    "timezone": "auto",
                },
            )
            data = resp.json()
            daily = data.get("daily", {}).get("precipitation_sum", [])
            rainfall_7d = sum(daily) if daily else 0.0
            return {
                "rainfall_7d_mm": rainfall_7d,
                "monthly_rainfall_mm": rainfall_7d * 4.3,
            }
    except Exception as e:
        print("Weather API failed, using fallback:", e)
        return {
            "rainfall_7d_mm": 0.0,
            "monthly_rainfall_mm": 0.0,
        }
 
 
@app.get("/")
def health():
    return {"status": "ok", "model": "XGBoost flood risk"}
 
 
@app.get("/model-status")
def model_status():
    """Model health endpoint for frontend/admin dashboard.
 
    Returns model load status, any load error, and basic artifact info.
    """
    return {
        "model_loaded": model_loaded,
        "load_error": model_load_error,
        "model_columns_count": len(model_columns) if model_columns is not None else 0,
        "districts_loaded": len(DISTRICT_LOOKUP) if DISTRICT_LOOKUP else 0,
    }
 
 
@app.post("/predict")
def predict(payload: FloodFeatures):
    return run_prediction(payload)
 
 
@app.post("/predict-from-complaint")
async def predict_from_complaint(payload: ComplaintInput):
    district_key = payload.district.strip().lower()
    base = DISTRICT_LOOKUP.get(district_key)
 
    if not base:
        return {"error": f"No lookup data for district '{payload.district}'"}
 
    rainfall = {
        "rainfall_7d_mm": 0.0,
        "monthly_rainfall_mm": 0.0,
    }
 
    if payload.latitude is not None and payload.longitude is not None:
        rainfall = await get_live_rainfall(payload.latitude, payload.longitude)
 
    features = FloodFeatures(
        **base,
        **rainfall,
        district=district_key,
        place_name=(payload.place_name or district_key),
        latitude=payload.latitude or 0.0,
        longitude=payload.longitude or 0.0,
        water_presence_flag=payload.water_presence_flag or 0,
    )
 
    return run_prediction(features)
 
 
@app.get("/garbage-model-status")
def garbage_model_status():
    """Health check for the garbage classification model."""
    return {
        "model_loaded": GARBAGE_MODEL_LOADED,
        "load_error": GARBAGE_MODEL_LOAD_ERROR,
        "classes": GARBAGE_CLASS_NAMES,
        "image_size": GARBAGE_IMG_SIZE,
    }
 
 
@app.post("/predict-garbage")
async def predict_garbage(file: UploadFile = File(...)):
    """Accepts an uploaded photo and returns the predicted garbage category."""
    image_bytes = await file.read()
    return run_garbage_prediction(image_bytes)
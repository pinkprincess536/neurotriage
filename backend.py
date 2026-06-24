from fastapi import FastAPI,UploadFile,Query,Request,HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from supabase import create_client
import tempfile
import os
import shutil
import json
import uuid as uuid_lib
from datetime import datetime, timezone, timedelta
import secrets
import jwt
import numpy as np
import torch
from eeg_core import EEGCNN1D, process_edf, score_windows
from retrain import (
    run_retrain, get_active_version, migrate_config, list_versions,
    activate_model, check_promotion_gate,
)

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
DOCTOR_PASSWORD = os.getenv("DOCTOR_PASSWORD")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")
if not DOCTOR_PASSWORD or not ADMIN_PASSWORD:
    raise RuntimeError("DOCTOR_PASSWORD and ADMIN_PASSWORD must be set")

JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    JWT_SECRET = secrets.token_hex(32)
    print("WARNING: JWT_SECRET not set; using an ephemeral secret. "
          "Tokens will be invalidated on restart. Set JWT_SECRET in production.")
JWT_EXPIRY_HOURS = int(os.getenv("JWT_EXPIRY_HOURS", "12"))

CORS_ORIGINS = [
    o.strip() for o in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174"
    ).split(",")
]


def create_token(role):
    payload = {
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def get_role(request: Request):
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    token = auth[len("Bearer "):]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None
    return payload.get("role")


def require_session(request: Request):
    role = get_role(request)
    if role not in ("admin", "doctor"):
        raise HTTPException(401, "Authentication required")
    return role


def require_admin(request: Request):
    if get_role(request) != "admin":
        raise HTTPException(403, "Admin access required")


def load_model(model_dir):
    import json

    config_path=os.path.join(model_dir,"model_config.json")
    mean_path=os.path.join(model_dir,"train_mean.npy")
    std_path=os.path.join(model_dir,"train_std.npy")
    
    with open(config_path, "r") as f:
        config = json.load(f)

    active = config.get("active_version", "v1")
    weights_path = os.path.join(model_dir, f"eegcnn1d_weights_{active}.pth")

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = EEGCNN1D(n_channels=config.get("n_channels", 22))
    model.load_state_dict(torch.load(weights_path, map_location=device))
    model.to(device)
    model.eval()

    train_mean = np.load(mean_path)
    train_std = np.load(std_path)

    return model, train_mean, train_std, device


model = None
train_mean = None
train_std = None
device = None
supabase = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global model, train_mean, train_std, device, supabase
    print("Connecting to Supabase...")
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    try:
        supabase.storage.create_bucket("eeg-recordings", options={"public": False})
        print("Bucket 'eeg-recordings' created or verified.")
    except Exception as e:
        print(f"Note: Could not automatically create bucket (already exists or key lacks permissions): {e}")

    print("Migrating model config...")
    migrate_config("model/")
    print("Loading model...")
    model, train_mean, train_std, device = load_model("model/")
    print(f"Model loaded (active: {get_active_version('model/')}). Ready for requests.")
    yield


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": model is not None}


@app.post("/login")
def login(data: dict):
    password = data.get("password")
    if password == ADMIN_PASSWORD:
        return {"token": create_token("admin"), "role": "admin"}
    if password == DOCTOR_PASSWORD:
        return {"token": create_token("doctor"), "role": "doctor"}
    raise HTTPException(401, "Wrong password")


@app.get("/patients")
def list_patients(request: Request):
    require_session(request)
    res = supabase.table("patients").select("*").order("created_at", desc=True).execute()
    return {"patients": res.data}


@app.post("/patients")
async def create_patient(request: Request):
    require_session(request)
    data = await request.json()
    res = supabase.table("patients").insert({"name": data["name"]}).execute()
    return {"patient": res.data[0]}


@app.delete("/patients/{patient_id}")
async def delete_patient(patient_id: int, request: Request):
    require_session(request)
    # Delete associated feedback first (via recordings)
    recordings_res = supabase.table("recordings").select("id").eq("patient_id", patient_id).execute()
    recording_ids = [r["id"] for r in recordings_res.data]
    if recording_ids:
        supabase.table("feedback").delete().in_("recording_id", recording_ids).execute()
    supabase.table("recordings").delete().eq("patient_id", patient_id).execute()
    supabase.table("patients").delete().eq("id", patient_id).execute()
    return {"status": "deleted"}


@app.get("/recordings/{recording_id}/windows")
def get_recording_windows(recording_id: int, request: Request):
    require_session(request)
    # Get the flagged windows stored as feedback entries for this recording
    feedback_res = (
        supabase.table("feedback")
        .select("id, timestamp_sec, model_score, doctor_label, created_at")
        .eq("recording_id", recording_id)
        .order("timestamp_sec")
        .execute()
    )
    return {"windows": feedback_res.data, "recording_id": recording_id}


@app.get("/patients/{patient_id}/recordings")
def get_patient_recordings(patient_id: int, request: Request):
    require_session(request)
    res = (
        supabase.table("recordings")
        .select("*")
        .eq("patient_id", patient_id)
        .order("created_at", desc=True)
        .execute()
    )
    return {"recordings": res.data}

@app.post("/patients/{patient_id}/upload")
async def upload_for_patient(patient_id: int, file: UploadFile, request: Request, threshold: float = 0.50):
    require_session(request)
    with tempfile.NamedTemporaryFile(delete=False, suffix=".edf") as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        windows, timestamps, duration_sec = process_edf(tmp_path)
        scores = score_windows(model, windows, train_mean, train_std, device)

        above = scores >= threshold
        flagged_indices = np.where(above)[0]
        order = flagged_indices[np.argsort(-scores[flagged_indices])]

        results = []
        for rank, idx in enumerate(order, 1):
            mins = int(timestamps[idx] // 60)
            secs = int(timestamps[idx] % 60)
            results.append({
                "rank": rank,
                "timestamp_str": f"{mins:02d}:{secs:02d}",
                "timestamp_sec": round(float(timestamps[idx]), 1),
                "score": round(float(scores[idx]), 4),
                "tier": "urgent" if scores[idx] >= 0.95 else "review",
            })

        storage_path = f"{patient_id}/{uuid_lib.uuid4().hex}_{file.filename}"
        with open(tmp_path, "rb") as f:
            try:
                supabase.storage.from_("eeg-recordings").upload(
                    path=storage_path, file=f,
                    file_options={"content-type": "application/octet-stream"}
                )
            except Exception as e:
                err_str = str(e)
                if "Bucket not found" in err_str:
                    raise HTTPException(
                        status_code=404,
                        detail="Storage bucket 'eeg-recordings' was not found in Supabase. "
                               "Please create a private bucket named 'eeg-recordings' in your Supabase Dashboard."
                    )
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to upload file to Supabase storage: {err_str}"
                )

        rec = supabase.table("recordings").insert({
            "patient_id": patient_id,
            "filename": file.filename,
            "storage_path": storage_path,
            "duration_sec": round(duration_sec, 1),
            "total_windows": len(windows),
            "flagged_windows": len(flagged_indices),
            "threshold_used": threshold,
            "model_version": get_active_version("model/"),
        }).execute()

        recording_id = rec.data[0]["id"]
        current_ver = get_active_version("model/")

        # Save each flagged window so history is persisted
        if results:
            supabase.table("feedback").insert([
                {
                    "recording_id": recording_id,
                    "timestamp_sec": r["timestamp_sec"],
                    "model_score": r["score"],
                    "doctor_label": None,   # null = not yet reviewed
                    "model_version": current_ver,
                }
                for r in results
            ]).execute()

        window_sec = 7.0
        stride_sec = window_sec * (1 - 0.3)
        windows_per_hour = 3600 / stride_sec
        est_per_hour = len(flagged_indices) / len(scores) * windows_per_hour

        return {
            "recording_id": recording_id,
            "patient_id": patient_id,
            "recording_duration_sec": round(duration_sec, 1),
            "total_windows": len(windows),
            "flagged_windows": len(flagged_indices),
            "estimated_per_hour": round(est_per_hour, 0),
            "threshold": threshold,
            "results": results,
        }

    finally:
        os.unlink(tmp_path)


@app.post("/feedback")
async def save_feedback(request: Request):
    require_session(request)
    data = await request.json()
    current_ver = get_active_version("model/")

    recording_id = data["recording_id"]
    timestamp_sec = data["timestamp_sec"]
    label = data["label"]

    # Check if a row already exists for this window (saved at upload time)
    existing = (
        supabase.table("feedback")
        .select("id")
        .eq("recording_id", recording_id)
        .eq("timestamp_sec", timestamp_sec)
        .execute()
    )

    if existing.data:
        # Update the existing row with the doctor's label
        supabase.table("feedback").update({
            "doctor_label": label,
            "model_version": current_ver,
        }).eq("id", existing.data[0]["id"]).execute()
    else:
        # Fallback: insert new row (for older recordings without pre-saved windows)
        supabase.table("feedback").insert({
            "recording_id": recording_id,
            "timestamp_sec": timestamp_sec,
            "model_score": data["score"],
            "doctor_label": label,
            "model_version": current_ver,
        }).execute()

    return {"status": "saved"}


@app.post("/retrain")
async def retrain(request: Request):
    require_admin(request)
    try:
        result = run_retrain(
            model=model,
            train_mean=train_mean,
            train_std=train_std,
            device=device,
            supabase=supabase,
            model_dir="model/",
        )
        return {"status": "success", **result}
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.get("/models")
def get_models(request: Request):
    require_admin(request)
    return list_versions("model/")


@app.post("/models/activate")
async def activate(request: Request):
    require_admin(request)
    data = await request.json()
    version_str = data.get("version")
    if not version_str:
        raise HTTPException(400, "version is required")
    force = bool(data.get("force", False))
    gate = check_promotion_gate("model/", version_str)
    if not gate["ok"] and not force:
        raise HTTPException(
            400,
            f"Activation blocked by promotion gate: {gate['reason']}. "
            f"Send force=true to override.",
        )
    try:
        activate_model(model, "model/", version_str, device)
        return {"status": "success", "active_version": version_str, "gate": gate}
    except ValueError as e:
        raise HTTPException(400, str(e))


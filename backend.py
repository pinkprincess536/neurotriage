import json
import os
import secrets
import shutil
import subprocess
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, UploadFile, Request, Response, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware

from db import init_db, create_patient, list_patients, get_patient, create_recording, get_recording, add_feedback, count_feedback
from eeg_core import load_model, predict_edf, get_model_version

MODEL_DIR = "model"
CANDIDATE_DIR = "model/candidate"
EDF_DIR = "data/edfs"
SESSION_COOKIE = "eeg_session"
MIN_FEEDBACK_LABELS = int(os.environ.get("MIN_FEEDBACK_LABELS", "20"))

sessions: set[str] = set()
admin_sessions: set[str] = set()

model = None
train_mean = None
train_std = None
device = None
model_config = None


def reload_model(model_dir=MODEL_DIR):
    global model, train_mean, train_std, device, model_config
    model, train_mean, train_std, device, model_config = load_model(model_dir)
    return model


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    print("Loading model...")
    reload_model()
    print("Model loaded. Ready for requests.")
    yield


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_session_token(request: Request) -> str | None:
    return request.cookies.get(SESSION_COOKIE)


def require_auth(request: Request):
    token = get_session_token(request)
    if not token or token not in sessions:
        raise HTTPException(status_code=401, detail="Not authenticated")


def require_admin(request: Request):
    token = get_session_token(request)
    if not token or token not in admin_sessions:
        raise HTTPException(status_code=403, detail="Admin access required")


@app.get("/health")
def health():
    metrics = {}
    metrics_path = os.path.join(MODEL_DIR, "test_metrics.json")
    if os.path.isfile(metrics_path):
        with open(metrics_path) as f:
            metrics = json.load(f)
    return {
        "status": "ok",
        "model_loaded": model is not None,
        "model_version": get_model_version(MODEL_DIR),
        "feedback_count": count_feedback(),
        "min_feedback_labels": MIN_FEEDBACK_LABELS,
        "metrics": metrics,
    }


@app.post("/login")
async def login(request: Request, response: Response):
    data = await request.json()
    password = data.get("password", "")
    doctor_pw = os.environ.get("DOCTOR_PASSWORD", "doctor")
    admin_pw = os.environ.get("ADMIN_PASSWORD", "admin")

    if password == doctor_pw:
        token = secrets.token_hex(16)
        sessions.add(token)
        response.set_cookie(SESSION_COOKIE, token, httponly=True, samesite="lax")
        return {"status": "ok", "role": "doctor"}

    if password == admin_pw:
        token = secrets.token_hex(16)
        admin_sessions.add(token)
        sessions.add(token)
        response.set_cookie(SESSION_COOKIE, token, httponly=True, samesite="lax")
        return {"status": "ok", "role": "admin"}

    raise HTTPException(status_code=401, detail="Invalid password")


@app.post("/logout")
async def logout(request: Request, response: Response):
    token = get_session_token(request)
    if token:
        sessions.discard(token)
        admin_sessions.discard(token)
    response.delete_cookie(SESSION_COOKIE)
    return {"status": "ok"}


@app.get("/auth/check")
def auth_check(request: Request):
    token = get_session_token(request)
    if not token or token not in sessions:
        return {"authenticated": False}
    role = "admin" if token in admin_sessions else "doctor"
    return {"authenticated": True, "role": role}


@app.get("/patients")
def get_patients(_: None = Depends(require_auth)):
    return {"patients": list_patients()}


@app.post("/patients")
async def post_patient(request: Request, _: None = Depends(require_auth)):
    data = await request.json()
    name = (data.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Patient name required")
    patient = create_patient(name)
    return patient


@app.post("/patients/{patient_id}/upload")
async def upload_recording(
    patient_id: int,
    file: UploadFile,
    threshold: float = 0.70,
    _: None = Depends(require_auth),
):
    patient = get_patient(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    os.makedirs(EDF_DIR, exist_ok=True)
    safe_name = os.path.basename(file.filename or "recording.edf")
    if not safe_name.lower().endswith(".edf"):
        safe_name += ".edf"

  temp_path = os.path.join(EDF_DIR, f"tmp_{secrets.token_hex(8)}_{safe_name}")
    content = await file.read()
    with open(temp_path, "wb") as f:
        f.write(content)

    try:
        version = get_model_version(MODEL_DIR)
        predict_result = predict_edf(temp_path, model, train_mean, train_std, device, threshold)
        final_path = os.path.join(EDF_DIR, f"{patient_id}_{safe_name}")
        if os.path.exists(final_path):
            os.remove(final_path)
        os.rename(temp_path, final_path)
        temp_path = None

        recording = create_recording(
            patient_id=patient_id,
            filename=safe_name,
            edf_path=final_path,
            duration_sec=predict_result["recording_duration_sec"],
            model_version=version,
        )

        return {
            "recording_id": recording["id"],
            "patient_id": patient_id,
            "filename": safe_name,
            **predict_result,
        }
    except Exception as e:
        if temp_path and os.path.isfile(temp_path):
            os.unlink(temp_path)
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/predict")
async def predict(file: UploadFile, threshold: float = 0.70):
    """Legacy endpoint: predict without persisting EDF."""
    import tempfile

    with tempfile.NamedTemporaryFile(delete=False, suffix=".edf") as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        return predict_edf(tmp_path, model, train_mean, train_std, device, threshold)
    finally:
        os.unlink(tmp_path)


@app.post("/feedback")
async def save_feedback(request: Request, _: None = Depends(require_auth)):
    data = await request.json()
    recording_id = data.get("recording_id")
    timestamp_sec = data.get("timestamp_sec")
    score = data.get("score")
    label = data.get("label")

    if not recording_id or timestamp_sec is None or not label:
        raise HTTPException(status_code=400, detail="recording_id, timestamp_sec, and label required")

    recording = get_recording(int(recording_id))
    if not recording:
        raise HTTPException(status_code=404, detail="Recording not found")

    version = get_model_version(MODEL_DIR)
    row = add_feedback(
        recording_id=int(recording_id),
        timestamp_sec=float(timestamp_sec),
        model_score=float(score) if score is not None else None,
        doctor_label=label,
        model_version=version,
    )

    entry = {
        "timestamp_sec": timestamp_sec,
        "model_score": score,
        "doctor_label": label,
        "recording_id": recording_id,
        "model_version": version,
        "submitted_at": datetime.now(timezone.utc).isoformat(),
    }
    with open("feedback.jsonl", "a") as f:
        f.write(json.dumps(entry) + "\n")

    return {"status": "saved", "feedback_id": row["id"]}


@app.get("/admin/status")
def admin_status(_: None = Depends(require_admin)):
    metrics = {}
    metrics_path = os.path.join(MODEL_DIR, "test_metrics.json")
    if os.path.isfile(metrics_path):
        with open(metrics_path) as f:
            metrics = json.load(f)

    candidate_metrics = {}
    candidate_path = os.path.join(CANDIDATE_DIR, "test_metrics.json")
    if os.path.isfile(candidate_path):
        with open(candidate_path) as f:
            candidate_metrics = json.load(f)

    retraining_status = {}
    status_path = "ml/retraining_status.json"
    if os.path.isfile(status_path):
        with open(status_path) as f:
            retraining_status = json.load(f)

    return {
        "production": {
            "model_version": get_model_version(MODEL_DIR),
            "metrics": metrics,
        },
        "candidate": candidate_metrics,
        "feedback_count": count_feedback(),
        "min_feedback_labels": MIN_FEEDBACK_LABELS,
        "retraining_status": retraining_status,
        "mlflow_ui": "http://127.0.0.1:5000",
    }


@app.post("/admin/retrain")
def admin_retrain(_: None = Depends(require_admin)):
    if count_feedback() < MIN_FEEDBACK_LABELS:
        raise HTTPException(
            status_code=400,
            detail=f"Need at least {MIN_FEEDBACK_LABELS} feedback labels (have {count_feedback()})",
        )

    try:
        subprocess.run(
            ["python", "ml/build_feedback_dataset.py"],
            check=True,
            capture_output=True,
            text=True,
        )
        subprocess.run(
            ["python", "ml/train_retrain.py"],
            check=True,
            capture_output=True,
            text=True,
        )
        result = subprocess.run(
            ["python", "ml/evaluate_promote.py"],
            check=True,
            capture_output=True,
            text=True,
        )
        return {"status": "completed", "output": result.stdout}
    except subprocess.CalledProcessError as e:
        raise HTTPException(status_code=500, detail=e.stderr or str(e))


@app.post("/admin/promote")
def admin_promote(_: None = Depends(require_admin)):
    candidate_weights = os.path.join(CANDIDATE_DIR, "eegcnn1d_weights.pth")
    if not os.path.isfile(candidate_weights):
        raise HTTPException(status_code=400, detail="No candidate model found")

    for name in ["eegcnn1d_weights.pth", "model_config.json", "test_metrics.json", "train_mean.npy", "train_std.npy"]:
        src = os.path.join(CANDIDATE_DIR, name)
        if os.path.isfile(src):
            shutil.copy2(src, os.path.join(MODEL_DIR, name))

    config_path = os.path.join(MODEL_DIR, "model_config.json")
    if os.path.isfile(config_path):
        with open(config_path) as f:
            config = json.load(f)
        config["model_version"] = config.get("model_version", "v1") + "_promoted"
        with open(config_path, "w") as f:
            json.dump(config, f, indent=2)

    reload_model()

    deploy_entry = {
        "promoted_at": datetime.now(timezone.utc).isoformat(),
        "model_version": get_model_version(MODEL_DIR),
        "metrics": json.load(open(os.path.join(MODEL_DIR, "test_metrics.json"))),
    }
    os.makedirs("ml", exist_ok=True)
    with open("ml/deployments.jsonl", "a") as f:
        f.write(json.dumps(deploy_entry) + "\n")

    return {"status": "promoted", "model_version": get_model_version(MODEL_DIR)}


@app.post("/admin/reject")
def admin_reject(_: None = Depends(require_admin)):
    if os.path.isdir(CANDIDATE_DIR):
        shutil.rmtree(CANDIDATE_DIR)
    status_path = "ml/retraining_status.json"
    if os.path.isfile(status_path):
        with open(status_path) as f:
            status = json.load(f)
        status["status"] = "rejected"
        with open(status_path, "w") as f:
            json.dump(status, f, indent=2)
    return {"status": "rejected"}

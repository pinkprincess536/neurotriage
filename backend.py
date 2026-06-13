from fastapi import FastAPI,UploadFile,Query
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import tempfile
import os
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as f



EEG_CHANNELS = [
    "FP1-F7", "F7-T7", "T7-P7", "P7-O1",
    "FP1-F3", "F3-C3", "C3-P3", "P3-O1",
    "FP2-F4", "F4-C4", "C4-P4", "P4-O2",
    "FP2-F8", "F8-T8", "T8-P8", "P8-O2",
    "FZ-CZ", "CZ-PZ",
    "P7-T7", "T7-FT9", "FT9-FT10", "FT10-T8",
]

WINDOW_SIZE_SEC = 7.0
OVERLAP = 0.3
LOWCUT = 0.5
HIGHCUT = 40.0
NOTCH_FREQ = 60.0


class EEGCNN1D(nn.Module):
    def __init__(self, n_channels=22, n_classes=2):
        super().__init__()

        self.conv1 = nn.Conv1d(n_channels, 32, kernel_size=7, padding=3)
        self.bn1 = nn.BatchNorm1d(32)
        self.pool1 = nn.MaxPool1d(4)

        self.conv2 = nn.Conv1d(32, 64, kernel_size=5, padding=2)
        self.bn2 = nn.BatchNorm1d(64)
        self.pool2 = nn.MaxPool1d(4)

        self.conv3 = nn.Conv1d(64, 128, kernel_size=3, padding=1)
        self.bn3 = nn.BatchNorm1d(128)
        self.adapt = nn.AdaptiveAvgPool1d(16)

        self.drop1 = nn.Dropout(0.4)
        self.fc1 = nn.Linear(128 * 16, 64)
        self.drop2 = nn.Dropout(0.3)
        self.fc2 = nn.Linear(64, n_classes)

    def forward(self, x):
        x = self.pool1(F.relu(self.bn1(self.conv1(x))))
        x = self.pool2(F.relu(self.bn2(self.conv2(x))))
        x = F.relu(self.bn3(self.conv3(x)))
        x = self.adapt(x)
        x = torch.flatten(x, 1)
        x = self.drop1(x)
        x = F.relu(self.fc1(x))
        x = self.drop2(x)
        x = self.fc2(x)
        return x

def load_model(model_dir):
    import json

    config_path=os.path.join(model_dir,"model_config.json")
    weights_path=os.path.join(model_dir,"eegcnn1d_weights.pth")
    mean_path=os.path.join(model_dir,"train_mean.npy")
    std_path=os.path.join(model_dir,"train_std.npy")
    
    with open(config_path, "r") as f:
        config = json.load(f)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = EEGCNN1D(n_channels=config.get("n_channels", 22))
    model.load_state_dict(torch.load(weights_path, map_location=device))
    model.to(device)
    model.eval()

    train_mean = np.load(mean_path)
    train_std = np.load(std_path)

    return model, train_mean, train_std, device

def process_edf(edf_path):
    import mne

    raw = mne.io.read_raw_edf(edf_path, preload=True, verbose=False)
    sfreq = raw.info["sfreq"]

    available = raw.ch_names
    channels_to_use = [ch for ch in EEG_CHANNELS if ch in available]
    if len(channels_to_use) < 18:
        raise ValueError(f"Only {len(channels_to_use)} matching channels found")

    raw.pick_channels(channels_to_use)
    raw.filter(LOWCUT, HIGHCUT, fir_design="firwin", verbose=False)
    raw.notch_filter(freqs=NOTCH_FREQ, verbose=False)
    signal = raw.get_data()
    n_chan = signal.shape[0]

    ws = int(WINDOW_SIZE_SEC * sfreq)
    stride = int(ws * (1 - OVERLAP))
    total = signal.shape[1]

    windows = []
    timestamps = []
    for start in range(0, total - ws + 1, stride):
        windows.append(signal[:, start:start + ws])
        timestamps.append(start / sfreq)

    windows = np.array(windows, dtype=np.float32)
    timestamps = np.array(timestamps)

    if n_chan < len(EEG_CHANNELS):
        pad = np.zeros(
            (windows.shape[0], len(EEG_CHANNELS) - n_chan, windows.shape[2]),
            dtype=np.float32,
        )
        windows = np.concatenate([windows, pad], axis=1)

    duration_sec = total / sfreq
    return windows, timestamps, duration_sec

def score_windows(model, windows, train_mean, train_std, device):
    mean_2d = train_mean.squeeze(0)
    std_2d = train_std.squeeze(0)

    if mean_2d.ndim == 2:
        mean_2d = mean_2d[:, :1]
        std_2d = std_2d[:, :1]

    X = (windows - mean_2d) / (std_2d + 1e-8)

    X_tensor = torch.tensor(X, dtype=torch.float32).to(device)

    with torch.no_grad():
        outputs = model(X_tensor)
        probs = torch.softmax(outputs, dim=1)[:, 1]

    return probs.cpu().numpy()


model = None
train_mean = None
train_std = None
device = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global model, train_mean, train_std, device
    print("Loading model...")
    model, train_mean, train_std, device = load_model("model/")
    print("Model loaded. Ready for requests.")
    yield


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": model is not None}

@app.post("/predict")
async def predict(file: UploadFile, threshold: float = 0.70):
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

        window_sec = 7.0
        stride_sec = window_sec * (1 - 0.3)
        windows_per_hour = 3600 / stride_sec
        est_per_hour = len(flagged_indices) / len(scores) * windows_per_hour

        return {
            "recording_duration_sec": round(duration_sec, 1),
            "total_windows": len(windows),
            "flagged_windows": len(flagged_indices),
            "estimated_per_hour": round(est_per_hour, 0),
            "threshold": threshold,
            "results": results,
        }

    finally:
        os.unlink(tmp_path)


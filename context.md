# CONTEXT.md — EEG Seizure Triage Assistant

*For LLM agents working on this project. Read this first.*

---

## 1. Project Summary

Building an **EEG Seizure Triage Assistant** — a system that takes long EEG recordings, automatically identifies seizure-like segments, ranks them, and surfaces the most relevant ones to a neurologist for review. Collects doctor feedback and improves over time.

**Current phase:** Backend (FastAPI) complete. React frontend complete. Inference pipeline proven end-to-end on real EEG. Model trained on 12 patients (4 with seizures), 20x seizure weight, 13 epochs. Best recall: 0.95 at threshold 0.50 on a realistic 400:1 test set. Working on feedback loop and deployment.

**GitHub:** `pinkprincess536/eeg` | **Dataset:** CHB-MIT (24 patients, 22-channel bipolar EEG)

---

## 2. Files & Purpose

| File | Purpose | Status |
|------|---------|--------|
| `preprocess.ipynb` | Download (boto3 S3) + preprocess EEG + save .npy | **Production** |
| `train_eeg.ipynb` | Load .npy on Kaggle + train 1D CNN + threshold sweep + save model | **Production** |
| `inference.py` | CLI script: score any .edf with trained model | **Production** |
| `backend.py` | FastAPI server: `/health`, `/predict`, `/feedback` endpoints | **Production** |
| `eeg-triage/` | React frontend: file upload, threshold slider, results table, ✓/✗ feedback | **Production** |
| `download_samples.py` | Download sample .edf files from PhysioNet for testing | **Utility** |
| `requirements.txt` | Python dependencies: fastapi, uvicorn, torch, numpy, mne, boto3 | **Config** |
| `learning.md` | Learning journal — filtering, MNE, logits/softmax, FastAPI, HTTP, separation of concerns | **Reference** |
| `HOW_IT_WORKS.md` | Plain-language explanation of the inference pipeline | **Documentation** |
| `journal.md` | Detailed technical journal — normalization, threshold tuning, recall drop, split asymmetry, weight sensitivity, initialization variance | **Reference** |
| `workflow.md` | Doctor workflow design — triage tiers, feedback loop | **Reference** |
| `PIPELINE_CHANGES.md` | Stakeholder summary of pipeline fixes | **Reference** |
| `PLATFORMS.md` | Colab vs Kaggle vs RunPod comparison | **Reference** |
| `eeg.ipynb` | Legacy all-in-one Colab notebook (no channel standardization) | **Archive** |
| `preprocessing.py` | Spectrogram pipeline (unused — project uses 1D CNN on raw windows) | **Stale** |
| `test_eeg.py` | Unit tests | **Reference** |
| `DVC_GUIDE.md` | DVC setup guide (DVC removed from pipeline) | **Archive** |
| `context.md` | This file | **LLM context** |

---

## 3. Architecture & Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      BUILD (per model version)               │
│                                                             │
│  PhysioNet S3                                               │
│    │  boto3 download (20 parallel threads)                   │
│    ▼                                                        │
│  preprocess.ipynb (Paperspace/Colab)                        │
│    │  bandpass 0.5-40Hz → notch 60Hz → 7s windows (30%      │
│    │  overlap) → pad to 22 channels → per-channel z-score   │
│    ▼                                                        │
│  processed/ (upload to Kaggle Dataset)                      │
│    │  X_train.npy, y_train.npy, X_test.npy, y_test.npy      │
│    │  train_mean.npy, train_std.npy, channel_names.npy      │
│    ▼                                                        │
│  train_eeg.ipynb (Kaggle)                                   │
│    │  EEGCNN1D (3 Conv1d + FC) → MLflow → threshold sweep  │
│    ▼                                                        │
│  model/ (download to laptop)                                │
│    │  eegcnn1d_weights.pth, model_config.json,              │
│    │  test_metrics.json, train_mean.npy, train_std.npy      │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                      RUN (every request)                     │
│                                                             │
│  Doctor uploads .edf                                        │
│    │                                                        │
│    ▼                                                        │
│  backend.py (FastAPI, port 8000)                            │
│    │  /predict: filter → window → pad → normalize → score   │
│    │  /health:  model status                                │
│    │  /feedback: save ✓/✗ labels                            │
│    ▼                                                        │
│  React frontend (port 5173)                                 │
│    │  FileUpload → ThresholdSlider → Process → ResultsTable│
│    │  ✓/✗ feedback buttons per flagged window               │
│    ▼                                                        │
│  feedback.jsonl → periodic retraining                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Current Configuration

### preprocess.ipynb — Key Variables

| Variable | Value | Notes |
|----------|-------|-------|
| `PATIENT_RANGE` | `range(1, 25)` | All 24 patients |
| `TRAIN_PATIENTS` | 12 (manual split) | chb01, chb02, chb05, chb06, chb08, chb09, chb11, chb14, chb17, chb19, chb22, chb24 |
| `TEST_PATIENTS` | 12 (manual split) | chb03, chb04, chb07, chb10, chb12, chb13, chb15, chb16, chb18, chb20, chb21, chb23 |
| `WINDOW_SIZE_SEC` | 7.0 | 1792 samples at 256 Hz |
| `OVERLAP` | 0.3 | Stride = 4.9s |
| `LOWCUT / HIGHCUT` | 0.5 / 40.0 Hz | |
| `NOTCH_FREQ` | 60.0 Hz | |
| `NON_SEIZURE_SAMPLES` | 500 | Training: balanced via reservoir sampling |
| `NON_SEIZURE_SAMPLES_TEST` | None (or capped at 15000) | Test: realistic unbalanced evaluation |
| `EEG_CHANNELS` | 22 channels | T8-P8 included, 22 unique bipolar channels |
| `BASE_DIR` | `./eeg_data` (Paperspace) or `/content/drive/MyDrive/EEG_PROJECT` (Colab) | |
| `MAX_RECORDINGS_PER_PATIENT` | None | All recordings processed |

### Patient split rationale

The original seed=42 random split placed only 2 seizure patients in training (chb01, chb02) and 4 in testing — including chb24 (12/12 seizure recordings, the most seizure-dense patient). The model trained on ~10 seizure recordings and was evaluated on ~26, creating a distributional mismatch.

The manual split moves chb24 and chb05 to training, giving 4 seizure patients in train and 2 in test. 12 train / 12 test total.

| | Train | Test |
|---|---|---|
| Seizure patients | chb01, chb02, chb05, chb24 (4) | chb03, chb04 (2) |
| Non-seizure patients | chb06, chb08, chb09, chb11, chb14, chb17, chb19, chb22 (8) | chb07, chb10, chb12, chb13, chb15, chb16, chb18, chb20, chb21, chb23 (10) |

### train_eeg.ipynb — Key Variables

| Variable | Value | Notes |
|----------|-------|-------|
| `DATA_DIR` | Updated Kaggle dataset path with 24-patient processed data | |
| `BATCH_SIZE` | 8 | |
| `LEARNING_RATE` | 0.001 | |
| `NUM_EPOCHS` | 13 | Increased from 10 |
| `SEIZURE_WEIGHT` | 7.0 (config default) | Actual sweep: [11.0, 12.0, 12.5, 13.0, 13.5, 14.0, 20.0] |
| `WEIGHTS_TO_TEST` | [11.0, 12.0, 12.5, 13.0, 13.5, 14.0, 20.0] | MLflow experiment: `seizure-weight-comparison` |

### Best model

| Parameter | Value |
|---|---|
| Seizure weight | 20x |
| Epochs | 13 |
| Test accuracy | 69.53% |
| Recall at threshold 0.50 | 0.94 (121/129 seizures caught) |
| Specificity at threshold 0.50 | 0.69 |
| Recall at threshold 0.70 | 0.64 |
| Recall at threshold 0.85 | 0.39 |
| FA/hr at threshold 0.50 | 223 |
| FA/hr at threshold 0.70 | 83 |
| FA/hr at threshold 0.85 | 42 |
| Test patients | 12 (chb03, chb04 + 10 non-seizure patients) |
| Test seizure windows | 129 |

### React threshold presets (mapped from 20x model)

| Preset | Threshold | Recall | FA/hr |
|---|---|---|---|
| Aggressive | 0.50 | 95% | 330 |
| Balanced | 0.70 | 88% | 224 |
| Conservative | 0.85 | 68% | 134 |

---

## 5. Model Architecture

**EEGCNN1D** — 3 Conv1d blocks + fully connected classifier.

```
Input: (batch, 22 channels, 1792 time samples)

Block 1: Conv1d(22→32, k=7) → BatchNorm → ReLU → MaxPool(4)  → (B,32,448)
Block 2: Conv1d(32→64, k=5) → BatchNorm → ReLU → MaxPool(4)  → (B,64,112)
Block 3: Conv1d(64→128, k=3) → BatchNorm → ReLU → AdaptiveAvgPool1d(16) → (B,128,16)
Flatten → Dropout(0.4) → FC(2048→64) → ReLU → Dropout(0.3) → FC(64→2)
Output: (batch, 2) [normal_score, seizure_score]
```

~300K parameters. Augmentation on seizure windows only: time shift ±200ms, amplitude ×0.85-1.15, Gaussian noise σ=0.01.

---

## 6. Backend Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/health` | GET | Model load status |
| `/predict?threshold=0.70` | POST (multipart) | Upload .edf → scored windows JSON |
| `/feedback` | POST (JSON) | Save doctor ✓/✗ label for retraining |

### `/predict` response shape

```json
{
  "recording_duration_sec": 1687.0,
  "total_windows": 343,
  "flagged_windows": 1,
  "estimated_per_hour": 2.0,
  "threshold": 0.70,
  "results": [
    {
      "rank": 1,
      "timestamp_str": "08:14",
      "timestamp_sec": 494.7,
      "score": 0.8459,
      "tier": "review"
    }
  ]
}
```

---

## 7. Frontend Components

| Component | Purpose |
|---|---|
| `App.jsx` | State management (file, threshold, results, loading, error), API call to `/predict` |
| `FileUpload.jsx` | Drag-and-drop .edf file picker |
| `ThresholdSlider.jsx` | Slider 0.50–0.95 with 3 presets (Aggressive/Balanced/Conservative), shows estimated recall + FA/hr |
| `ResultsTable.jsx` | Ranked table: timestamp, score, tier badge, ✓/✗ feedback buttons |

---

## 8. How to Run

### Backend
```bash
pip install -r requirements.txt
uvicorn backend:app --reload
```
→ `http://localhost:8000/docs` (Swagger UI)

### Frontend
```bash
cd eeg-triage
npm install
npm run dev
```
→ `http://localhost:5173`

### Inference (CLI)
```bash
python inference.py --edf test_data/chb24_01.edf --model ./model/ --threshold 0.70
```

### Download test EEG
```bash
python download_samples.py
```

---

## 9. Key Technical Decisions

| Decision | Rationale |
|---|---|
| 1D CNN on raw windows (not spectrograms) | Simpler, fewer dependencies |
| boto3 S3 download (not awscli) | Avoids OpenSSL/cryptography version conflicts in Colab |
| 22 unique channels | T8-P8 duplicate removed |
| Manual patient split (12/12) | Original random split put chb24 entirely in test — unfair evaluation |
| Per-channel z-score from train only | No test leakage. Stats saved for inference |
| Threshold tuning via probability sweep | Clinical workflow: doctor picks recall vs FA/hr balance |
| FastAPI + React (not Streamlit) | Production-grade, separate frontend/backend, standard MLOps pattern |
| Model loaded once at startup (lifespan) | Avoids per-request disk I/O and model reconstruction |
| tempfile + finally cleanup | Uploaded .edf cleaned up even on crash |
| CORS allow all origins | React (port 5173) needs to call FastAPI (port 8000) |
| Seizure weight 20x | Best test-time performance: 0.95 recall at threshold 0.50 |
| DVC removed | Overhead not justified for solo project with static 24-patient dataset |

---

## 10. Journal & Learning Content

| File | Topics covered |
|---|---|
| `journal.md` | Normalization, pipeline persistence, DVC, why NN needs normalization, inference vs training, threshold tuning, recall drop on realistic test set, split asymmetry, weight sensitivity (12-13x sweet spot), random initialization variance (23-33 point swings) |
| `learning.md` | Filter-before-windowing, MNE, architecture stack (6 layers), logits/softmax with examples, lifespan pattern, FastAPI free features (Swagger, CORS, validation), GET vs POST, normalization stats at inference, separation of concerns |

---

## 11. Next Steps (Priority Order)

1. Add `/feedback` endpoint + wire React ✓/✗ to save to `feedback.jsonl`
2. Deploy model to Hugging Face Hub (model registry)
3. Deploy backend on Render/Railway (free)
4. Deploy frontend on Vercel (free)
5. Feedback loop: retrain with collected doctor labels, compare recall, auto-deploy
6. Multi-seed evaluation (3 seeds per weight) for reliable hyperparameter selection
7. Integrate test samples (chb24 for seizure, chb06 for normal) into React demo

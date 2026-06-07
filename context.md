# CONTEXT.md — EEG Seizure Triage Assistant

*For LLM agents working on this project. Read this first.*

---

## 1. Project Summary

Building an **EEG Seizure Triage Assistant** — a system that takes long EEG recordings, automatically identifies seizure-like segments, ranks them, and surfaces the most relevant ones to a neurologist for review. Collects doctor feedback and improves over time.

**Current phase:** Data pipeline + model training complete. Working on production-readiness (saving artifacts, scaling to 24 patients, realistic evaluation, threshold tuning). Backend/frontend not started.

**GitHub:** `pinkprincess536/eeg` | **Dataset:** CHB-MIT (24 patients, 22-channel bipolar EEG)

---

## 2. Files & Purpose

| File | Purpose | Status |
|------|---------|--------|
| `preprocess.ipynb` | Download (S3) + preprocess EEG + save .npy to Drive | **Production** |
| `train_eeg.ipynb` | Load .npy on Kaggle + train 1D CNN + threshold sweep + save model | **Production** |
| `eeg.ipynb` | Legacy all-in-one Colab notebook (no channel standardization) | Archive |
| `preprocessing.py` | Spectrogram pipeline (unused — project uses 1D CNN on raw windows) | Stale |
| `test_eeg.py` | Unit tests | Reference |
| `journal.md` | Learning journal — normalization, inference, threshold tuning concepts | Reference |
| `workflow.md` | Doctor workflow design — triage tiers, feedback loop | Reference |
| `PIPELINE_CHANGES.md` | Stakeholder summary of 7 pipeline fixes | Reference |
| `DVC_GUIDE.md` | DVC setup and workflow guide | Reference |
| `PLATFORMS.md` | Colab vs Kaggle vs RunPod comparison | Reference |
| `context.md` | This file | LLM context |

---

## 3. Data Pipeline Flow

```
PhysioNet S3 bucket
  │  aws s3 sync (20 parallel, chunked)
  ▼
Google Drive: /MyDrive/EEG_PROJECT/
  │  raw .edf files (chb01/ ... chb24/ + summary.txt)
  ▼
Colab: preprocess.ipynb
  │  bandpass filter 0.5-40Hz → notch 60Hz → slice 7s windows (30% overlap)
  │  → pad to 22 channels → label from summary.txt
  │  → per-channel z-score normalize → save .npy to Drive
  ▼
Google Drive: /MyDrive/EEG_PROJECT/processed/
  │  X_train.npy, y_train.npy, X_test.npy, y_test.npy
  │  train_mean.npy, train_std.npy, channel_names.npy, info.txt
  ▼
Upload to Kaggle Dataset (manual or API)
  ▼
Kaggle: train_eeg.ipynb
  │  load .npy → 1D CNN → MLflow tracking → threshold sweep → save model
  ▼
/kaggle/working/model/
     eegcnn1d_weights.pth, model_config.json, test_metrics.json
```

**Kaggle never needs raw 55 GB .edf files.** Only `processed/` (~2-5 GB) is uploaded.

---

## 4. Current Configuration

### preprocess.ipynb — Key Variables

| Variable | Value | Notes |
|----------|-------|-------|
| `PATIENT_RANGE` | `range(1, 25)` | All 24 patients. Change to `range(1,12)` for quick runs |
| `TRAIN_PATIENTS` | 9 (from shuffle seed=42) | 9 train / 15 test split |
| `TEST_PATIENTS` | 15 (from shuffle seed=42) | |
| `WINDOW_SIZE_SEC` | 7.0 | 1792 samples at 256 Hz |
| `OVERLAP` | 0.3 | |
| `LOWCUT / HIGHCUT` | 0.5 / 40.0 Hz | |
| `NOTCH_FREQ` | 60.0 Hz | |
| `NON_SEIZURE_SAMPLES` | 500 | Training: balanced |
| `NON_SEIZURE_SAMPLES_TEST` | 9000 | Test: capped for RAM, captures ~27% of non-seizure windows |
| `EEG_CHANNELS` | 22 channels | T8-P8 duplicate removed; list in Cell 7 |
| `BASE_DIR` | `/content/drive/MyDrive/EEG_PROJECT` | |

### train_eeg.ipynb — Key Variables

| Variable | Value | Notes |
|----------|-------|-------|
| `DATA_DIR` | `/kaggle/input/datasets/rebelxhearts/23-patient-final/processed` | **Needs update** to new dataset |
| `BATCH_SIZE` | 8 | |
| `LEARNING_RATE` | 0.001 | |
| `NUM_EPOCHS` | 10 | |
| `SEIZURE_WEIGHT` | 7.0 | Default; loop tests [5.0, 7.5, 7.8, 9.0] |
| `WEIGHTS_TO_TEST` | [5.0, 7.8, 7.5, 9.0] | MLflow experiment: `seizure-weight-comparison` |

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

## 6. Notebook: preprocess.ipynb (Cell Reference)

| Cell | Name | What it does |
|------|------|-------------|
| 1 | Config | All tunable parameters. Patient split, window settings, balancing |
| 2 | S3 Sync | Downloads all 24 patients from PhysioNet S3 to Drive (20 parallel, skips existing) |
| 3 | Parse Annotations | Reads summary.txt per patient, builds SEIZURE_MAP |
| 4 | bandpass_filter() | Filters full recording before windowing |
| 5 | create_windows() | Slices filtered signal into 7s overlapping windows |
| 6 | create_labels() | Labels each window as seizure/non-seizure based on annotations |
| 7 | process_recording() | Full pipeline per .edf: load → pick channels → filter → window → pad → label |
| 8 | preprocess_streaming() | RAM-safe processing: reservoir samples non-seizure, keeps all seizures |
| 9 | Train Set | Runs preprocess_streaming on TRAIN_PATIENTS (balanced, 500 non-seizure cap) |
| 10 | Test Set | Runs preprocess_streaming on TEST_PATIENTS (realistic, 9000 non-seizure cap) |
| 11 | Normalize | Per-channel z-score from train stats, applied to train + test |
| 12 | Save | Saves .npy + norm stats + channel_names + info.txt to Drive |
| 13 | DVC | Tracks + pushes dataset version (runs in Drive-only git, not GitHub) |

---

## 7. Notebook: train_eeg.ipynb (Cell Reference)

| Cell | Name | What it does |
|------|------|-------------|
| - | Kaggle Auth | `kagglehub.login()` + dataset download |
| 1 | Config | Training params, paths, seizure weight |
| 1b | DVC Pull | Optional — pull latest dataset from Drive (currently broken) |
| 2 | Load Data | Loads X_train/X_test .npy files |
| 3 | Augmentation | `augment_seizure()` function |
| 4 | DataLoader | PyTorch tensors + DataLoader |
| 5 | Model | EEGCNN1D class definition |
| 6 | Training | Loop over WEIGHTS_TO_TEST: train → evaluate → MLflow logging → threshold sweep |
| 7 | Save Model | Saves weights.pth + model_config.json + test_metrics.json to /kaggle/working/model/ |

---

## 8. Recent Fixes Applied

| # | Fix | Where | Impact |
|---|-----|-------|--------|
| 1 | Save normalization stats | preprocess Cell 12 | Enables inference on new EEG |
| 2 | Save model with config + metrics | train_eeg last cell | Model exportable, reloadable anywhere |
| 3 | Remove duplicate T8-P8 channel | preprocess Cell 7 | 22 unique channels instead of 23-with-duplicate |
| 4 | Pass overlap param to create_labels | preprocess Cells 6,7 | Labels respect OVERLAP config |
| 5 | Consistent return values | preprocess Cell 7 | Bad recordings skipped, not crashed |
| 6 | Save canonical channel names | preprocess Cell 8 | EEG_CHANNELS list, not per-file garbage |
| 7 | Threshold tuning sweep | train_eeg Cell 6 | FA/hr table for clinical decision-making |
| 8 | Unbalanced test evaluation | preprocess Cell 1,10 | Test set now realistic (9000 non-seizure cap) |
| 9 | S3 sync download | preprocess Cell 2 | 20-parallel, 3-5x faster than wget |
| 10 | Fix channel padding dimensions | preprocess Cell 7 | Pad along channel axis, not window axis |
| 11 | Fix f-string newline errors | Both notebooks | `print("\n" + f"...")` pattern |

---

## 9. Known Issues & Workarounds

| Issue | Impact | Workaround |
|-------|--------|------------|
| **RAM crash on large test set** | Colab OOM with 15 patients + unlimited non-seizure | Capped at 9000. Need checkpoint streaming for full capture |
| **f-string `\n` syntax error** | Syntax error in Colab Python | Use `print("\n" + f"...")` pattern everywhere |
| **DVC not in GitHub** | DVC runs in separate Drive-only git repo | .dvc files not in pinkprincess536/eeg. Needs one-time setup |
| **train_eeg uses old dataset** | `DATA_DIR` points at rebelxhearts/23-patient-final | Update after uploading new processed/ folder |
| **JSON corruption from edit tools** | Notebooks can break when edited as text | Always validate with `json.load()` after edits |
| **Edit tool double-escapes backslashes** | `.ipynb` files get `\\n` instead of `\n` | Use Python `json.load/dump` for all notebook edits |

---

## 10. Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| 1D CNN on raw windows (not spectrograms) | Simpler, fewer dependencies. spectrogram pipeline (`preprocessing.py`) is stale |
| S3 sync over wget | 20 parallel, 3-5x faster, skips unused .seizures files |
| Colab preprocess + Kaggle train | Colab has native Drive mount. Kaggle has 9hr batch mode |
| 22 channels (not 23) | T8-P8 was duplicated. 22 unique channels, pad to standardize |
| Option B for test set (None-capable list) | No RAM waste, scales to any patient count. Capped at 9000 for Colab limits |
| Reservoir sampling (not full collect) | Prevents overfitting on non-seizure, keeps RAM manageable |
| Per-channel z-score from train only | No test leakage. Stats saved for inference |
| Threshold tuning via probability sweep | Clinical workflow: doctor picks recall vs FA/hr balance |

---

## 11. Commands & Setup

### GitHub
```
git clone https://github.com/pinkprincess536/eeg.git
```
Branch: `main` | Email: `f24ce245@ms.pict.edu`

### Colab (preprocess)
1. Open `preprocess.ipynb` from GitHub in Colab
2. Run cells top to bottom
3. Download `processed/` folder from Drive

### Kaggle (train)
1. Upload `processed/` as Kaggle Dataset
2. Update `DATA_DIR` in `train_eeg.ipynb` to point at dataset
3. Run cells top to bottom
4. Download `/kaggle/working/model/` before session ends

### Reload trained model for inference
```python
config = json.load(open("model_config.json"))
model = EEGCNN1D(n_channels=config["n_channels"])
model.load_state_dict(torch.load("eegcnn1d_weights.pth"))
model.eval()

# Normalize new data with saved stats
train_mean = np.load("train_mean.npy")
train_std  = np.load("train_std.npy")
X_new = (X_new - train_mean) / (train_std + 1e-8)
```

---

## 12. Next Steps (Priority Order)

1. Upload updated `processed/` to Kaggle + update `DATA_DIR`
2. Fix DVC: connect to GitHub repo (one-time setup)
3. Add checkpoint streaming for test preprocessing (eliminate 9000 cap)
4. Implement download speedups from `DOWNLOAD_SPEEDUP.md`
5. Backend (FastAPI inference endpoint)
6. Frontend (Streamlit triage UI)
7. Feedback loop (store doctor ✓/✗, retrain)

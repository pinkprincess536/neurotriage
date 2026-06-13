# Pipeline Fixes & Optimizations — EEG Seizure Project

Use this file in Cursor / OpenCode as context alongside `DOWNLOAD_SPEEDUP.md` and `context.md`.

Download speedups live in **`DOWNLOAD_SPEEDUP.md`**. This doc covers everything else: saving artifacts, code fixes, workflow, evaluation, and priority order.

---

## The real problem (simple)

She is not blocked by "bad model" or "not enough patients." The pipeline does not yet **persist or reproduce** its own work:

- Normalization recipe is thrown away after preprocess
- Trained model disappears when Kaggle session ends
- DVC versioning lives on Drive, not in the GitHub repo

Fix these before scaling data or tuning the model.

---

## Priority order

```
1. Save norm stats          (preprocess.ipynb Cell 12)
2. Save model + metrics     (train.ipynb — new cell)
3. Download speedups        (DOWNLOAD_SPEEDUP.md)
4. Fix DVC in GitHub repo
5. Small code fixes         (overlap param, T8-P8 duplicate)
6. Better evaluation        (unbalanced test, saved metrics)
7. More patients            (only after 1–6 work)
```

---

## 1. Save normalization stats (CRITICAL)

**Notebook:** `preprocess.ipynb` — Cell 12 (after Cell 11)

**Problem:** Cell 11 computes `train_mean` and `train_std`, normalizes data, then Cell 12 only saves the normalized arrays. Inference on new EEG cannot use the same normalization.

**Fix:** Add these lines in Cell 12 after the existing `np.save` calls:

```python
# Save normalization stats (needed for inference on new EEG)
np.save(os.path.join(OUTPUT_DIR, "train_mean.npy"), train_mean)
np.save(os.path.join(OUTPUT_DIR, "train_std.npy"),  train_std)
np.save(os.path.join(OUTPUT_DIR, "channel_names.npy"), np.array(ch_names))
```

Add inside the `info.txt` block:

```python
f.write("Normalization: per-channel z-score using train_mean.npy / train_std.npy\n")
```

**Expected `processed/` folder after re-run:**

```
X_train.npy
y_train.npy
X_test.npy
y_test.npy
train_mean.npy      ← new
train_std.npy       ← new
channel_names.npy   ← new
info.txt
```

**Reload at inference time:**

```python
train_mean = np.load("processed/train_mean.npy")
train_std  = np.load("processed/train_std.npy")
X_new = (X_new - train_mean) / (train_std + 1e-8)
```

Re-upload the full `processed/` folder to the Kaggle Dataset after re-running preprocess.

---

## 2. Save the trained model (CRITICAL)

**Notebook:** `train.ipynb` — new cell after Cell 9 (evaluation)

**Problem:** Kaggle sessions end and the model is lost.

**Fix:** Add this cell at the end of `train.ipynb`:

```python
import json
from datetime import datetime

MODEL_DIR = "/kaggle/working/model"
os.makedirs(MODEL_DIR, exist_ok=True)

# Save weights
torch.save(model.state_dict(), os.path.join(MODEL_DIR, "eegcnn1d_weights.pth"))

# Save config to rebuild the model
config = {
    "model": "EEGCNN1D",
    "n_channels": int(X_train.shape[1]),
    "n_time_samples": int(X_train.shape[2]),
    "seizure_weight": SEIZURE_WEIGHT,
    "learning_rate": LEARNING_RATE,
    "batch_size": BATCH_SIZE,
    "num_epochs": NUM_EPOCHS,
    "random_seed": RANDOM_SEED,
    "data_dir": DATA_DIR,
    "saved_at": datetime.utcnow().isoformat() + "Z",
}
with open(os.path.join(MODEL_DIR, "model_config.json"), "w") as f:
    json.dump(config, f, indent=2)

# Save test metrics from Cell 9
metrics = {
    "test_accuracy": float(accuracy),
    "sensitivity": float(sens) if seizure_mask.sum() > 0 else None,
    "specificity": float(spec) if non_mask.sum() > 0 else None,
}
with open(os.path.join(MODEL_DIR, "test_metrics.json"), "w") as f:
    json.dump(metrics, f, indent=2)

print("Saved to /kaggle/working/model/:")
for fn in os.listdir(MODEL_DIR):
    print(f"  {fn}")
print("\nDownload these before closing Kaggle.")
```

**Reload later:**

```python
with open("model_config.json") as f:
    config = json.load(f)

model = EEGCNN1D(n_channels=config["n_channels"])
model.load_state_dict(torch.load("eegcnn1d_weights.pth", map_location=device))
model.eval()
```

`/kaggle/working/` is temporary — download the `model/` folder or add it as a Kaggle output before the session ends.

---

## 3. Fix DVC in the GitHub repo (CRITICAL)

**Problem:** DVC runs inside Google Drive (`/content/drive/MyDrive/EEG_PROJECT`) with a separate `git init`. The `.dvc` pointer files never reach GitHub (`pinkprincess536/eeg`). Versioning only exists on Drive.

**What DVC should do:**
- Git (GitHub) tracks small `.dvc` metadata files
- DVC stores large `.npy` blobs in a Drive cache
- Anyone cloning GitHub can `dvc pull` to get data

### One-time setup (Colab)

```python
%cd /content/drive/MyDrive
!git clone https://github.com/pinkprincess536/eeg.git EEG_REPO
%cd EEG_REPO

!pip install -q dvc[gdrive]
!dvc init
!dvc remote add -d myremote /content/drive/MyDrive/EEG_REPO/.dvc/cache
!git add .dvc .dvcignore .gitignore
!git commit -m "init dvc"
!git push origin main
```

**Stop** running `git init` inside the old Drive-only DVC cell. Use one git repo: GitHub.

Point `OUTPUT_DIR` at `EEG_REPO/processed/` (or copy `processed/` there after each preprocess run).

### After every preprocess

```python
!dvc add processed/X_train.npy processed/y_train.npy processed/X_test.npy processed/y_test.npy \
         processed/train_mean.npy processed/train_std.npy processed/channel_names.npy processed/info.txt

!git add processed/*.dvc processed/.gitignore
!git commit -m "dataset: 11 patients + norm stats"
!dvc push
!git push origin main
```

### On Kaggle (optional, once auth is set up)

```python
!git clone https://github.com/pinkprincess536/eeg.git /kaggle/working/repo
%cd /kaggle/working/repo
!pip install -q dvc
!dvc pull
DATA_DIR = "/kaggle/working/repo/processed"
```

Until DVC on Kaggle is wired up, keep using the Kaggle Dataset upload as backup — but still commit `.dvc` files to GitHub for version history.

---

## 4. Small code fixes

### 4a. `create_labels()` hardcodes 30% overlap

**Where:** `preprocess.ipynb` Cell 6, `preprocessing.py`

**Problem:** `stride = int(window_samples * (1 - 0.3))` ignores the `OVERLAP` config if you change it.

**Fix:** Pass `overlap` into `create_labels`:

```python
def create_labels(windows, sfreq, seizure_intervals, overlap=0.3):
    n = windows.shape[0]
    ws = windows.shape[2]
    labels = np.zeros(n, dtype=int)
    if not seizure_intervals:
        return labels
    stride = int(ws * (1 - overlap))
    for i in range(n):
        start_sec = (i * stride) / sfreq
        end_sec = (i * stride + ws) / sfreq
        for seizure_start, seizure_end in seizure_intervals:
            if end_sec >= seizure_start and start_sec <= seizure_end:
                labels[i] = 1
                break
    return labels
```

Update callers to pass `overlap=OVERLAP`.

---

### 4b. Duplicate `T8-P8` in channel list

**Where:** `preprocess.ipynb` Cell 7 — `EEG_23_CHANNELS`

**Problem:** List has 23 entries but only 22 unique channels (`T8-P8` appears twice). Wastes a channel slot and can misalign padding.

**Fix:** Remove the duplicate `T8-P8` at the end of the list. Verify the canonical CHB-MIT bipolar montage matches what most recordings use.

---

### 4c. `process_recording` inconsistent return values

**Where:** `preprocess.ipynb` Cell 7

**Problem:** Some failure paths return `(None, None)`, short recordings return `(None, None, None)`.

**Fix:** Always return three values: `return None, None, None` on every failure path.

---

### 4d. `ch_names` from last recording only

**Where:** `preprocess_streaming()` in `preprocess.ipynb` Cell 8

**Problem:** Channel names come from whichever file was processed last — may not match padded layout across patients.

**Fix:** Save the canonical `EEG_23_CHANNELS` list (after fixing 4b) to `channel_names.npy` and `info.txt`, not the per-file mutable list.

---

### 4e. Comment / code mismatch on seizure weight

**Where:** `train.ipynb` Cell 1

**Problem:** `SEIZURE_WEIGHT = 8.0` but print says "5x penalty".

**Fix:** Update the print line to say `8x` or set weight to `5.0` — pick one and align comment + print + commit message.

---

## 5. Workflow optimizations

| Don't do this | Do this instead |
|---------------|-----------------|
| Download all 24 patients now | Stay on 11 until pipeline saves model + norm stats |
| Upload 55 GB raw `.edf` to Kaggle | Upload only `processed/` (~2–5 GB) as Kaggle Dataset |
| Re-download on retry from scratch | Re-run download — existing files are skipped |
| Use `eeg.ipynb` for production runs | Use `preprocess.ipynb` → `train.ipynb` |
| Keep `eeg.ipynb` | Fine as archive / learning notebook — she prefers keeping it |
| Train without saving output from Kaggle | Download `/kaggle/working/model/` before session ends |
| Re-preprocess on every training tweak | Re-preprocess only when patients or preprocess config change |

### Correct data flow

```
PhysioNet
  → Colab download → Google Drive (raw .edf)
  → Colab preprocess → Google Drive (processed/*.npy + norm stats)
  → Upload processed/ → Kaggle Dataset
  → train.ipynb on Kaggle → save model → download model/
```

Kaggle never needs raw 55 GB files.

---

## 6. Preprocessing optimizations

| Setting / pattern | Where | Purpose |
|-------------------|-------|---------|
| `MAX_RECORDINGS_PER_PATIENT = 3` | `preprocess.ipynb` Cell 1 | Fast sanity check before full run |
| `MAX_RECORDINGS_PER_PATIENT = None` | Same | Full production preprocess |
| Streaming + reservoir sampling | Cell 8 | RAM-safe on Colab (vs loading all into RAM in `eeg.ipynb`) |
| `NON_SEIZURE_SAMPLES = 500` | Cell 1 | Keeps dataset small and training fast |
| Per-channel normalize from train only | Cell 11 | Correct — no test leakage |

---

## 7. Training optimizations

| Already done | Worth adding |
|--------------|--------------|
| 8× seizure class weight | Save best checkpoint by test recall |
| Augmentation on seizure windows only | Log per-epoch metrics to JSON |
| Patient-level train/test split | Threshold tuning (not just argmax) for recall vs false alarms |
| GPU auto-detect | Name each run in `model_config.json` (date, patients, weight) |

---

## 8. Evaluation optimizations

| Current issue | Better approach |
|---------------|-----------------|
| Test set balanced (500 non-seizure + all seizures) | Also evaluate on **unbalanced** windows for realistic specificity / FA rate |
| Metrics only printed to notebook | Save `test_metrics.json` every run |
| No comparison across runs | Keep a simple spreadsheet or JSON log of runs |
| Balanced accuracy can look misleading | Report sensitivity, specificity, and eventually false alarms per hour |

Clinical triage cares about **missing seizures** and **false alarms on normal EEG** — balanced window metrics understate how hard the real problem is.

---

## 9. Skip for now

| Item | Why |
|------|-----|
| All 24 patients | Diminishing returns until 1–6 are done |
| Spectrogram / 2D CNN (`preprocessing.py`) | Project uses 1D CNN on raw windows; module is stale |
| FastAPI / Streamlit / MLflow | Product layer — after baseline is saved and evaluated |
| `google-drive-ocamlfuse` on Kaggle | Kaggle Dataset upload is simpler for 2–5 GB |
| Deleting `eeg.ipynb` | She wants to keep it — fine as legacy reference |

---

## 10. Notebook roles (reference)

| Notebook | Role |
|----------|------|
| `preprocess.ipynb` | **Production** — download, preprocess, save `.npy` to Drive |
| `train.ipynb` | **Production** — load `.npy` on Kaggle, train, should save model |
| `eeg.ipynb` | **Legacy** — all-in-one Colab notebook; less robust (no channel standardization, loads all RAM) |
| `preprocessing.py` | **Stale** — spectrogram pipeline; not used by current notebooks |

---

## 11. Checklist after a full run

- [ ] `processed/` on Drive has `train_mean.npy`, `train_std.npy`, `channel_names.npy`
- [ ] Kaggle Dataset updated with latest `processed/`
- [ ] Training completed on Kaggle
- [ ] `eegcnn1d_weights.pth`, `model_config.json`, `test_metrics.json` downloaded
- [ ] `.dvc` files committed and pushed to GitHub (if using DVC)
- [ ] Metrics recorded somewhere for comparison with next run

---

## One-liner summary

> Save the normalization stats, save the model, put DVC in GitHub — then fix small code bugs and improve evaluation. Don't add more patients until you can train, save, and re-run the same pipeline twice with the same results.

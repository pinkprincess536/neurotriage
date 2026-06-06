# Pipeline Changes — EEG Seizure Triage Project

*Prepared for stakeholder review — June 2026*

---

## What We Fixed & Why

The pipeline had bugs that made the model results untrustworthy and prevented using it on real patients. Here's what changed:

### 1. Normalization Stats Now Saved

**Problem:** The model learned to recognize seizures using a specific "measuring stick" (called normalization). But that measuring stick was thrown away after training. When a new patient's EEG arrived, there was no way to measure it the same way — like baking with the wrong cup size.

**Fix:** The preprocessing notebook now saves the measuring stick alongside the data. Anyone can normalize a new patient's EEG identically to how the model was trained.

**Impact:** Enables real inference on new patients. Without this, the model only works on training data — useless for a doctor.

---

### 2. Model Fully Exportable

**Problem:** After training, only the raw model file was saved — no instructions on how to rebuild it, no record of test performance. If the Kaggle session ended, everything was lost.

**Fix:** The training notebook now saves a complete package:
- Model weights (the learned patterns)
- Configuration (how to rebuild the exact same model architecture)
- Test metrics (sensitivity, specificity, seizure catch rate)

**Impact:** Model can be reloaded anywhere — Colab, Kaggle, a hospital server — by anyone with access.

---

### 3. Channel List Cleaned Up

**Problem:** The list of EEG channels had a duplicate ("T8-P8" appeared twice), wasting a channel slot. Plus the saved channel names came from whichever recording was processed last — sometimes including garbage like "---MISSING---" as if it were a real brain sensor.

**Fix:** Removed the duplicate. Channel names are now saved from a canonical list, not from the last recording.

**Impact:** Correct channel alignment at inference time. The model won't feed zeros into the wrong brain location.

---

### 4. Labeling Bug Fixed

**Problem:** The overlap between EEG windows was hardcoded at 30% inside the labeling function. If anyone changed the overlap setting in config, the seizure labels would get glued to the wrong windows — the model learned from wrong answers.

**Fix:** The labeling function now reads the overlap from the config like everything else. Changing the config changes the labels correctly.

**Impact:** Data integrity. Labels always match the windows they describe.

---

### 5. Pipeline No Longer Crashes on Bad Recordings

**Problem:** When a recording was too short or corrupted, the processing function sometimes returned 2 values, sometimes 3. The caller expected exactly 3 and would crash — stopping the entire batch.

**Fix:** All failure paths now return exactly 3 values. Bad recordings are skipped cleanly instead of crashing everything.

**Impact:** Reliable batch processing of multiple patients. One bad file doesn't kill the run.

---

### 6. Threshold Tuning Added

**Problem:** The model had one fixed rule for calling a seizure: "anything above 50% probability is a seizure." The doctor had no control. A 51% confidence flag and a 99% confidence flag looked the same.

**Fix:** The training notebook now tests multiple thresholds (50%, 60%, 70%... up to 95%) and prints a table showing the tradeoff: higher thresholds = fewer false alarms but might miss subtle seizures. The doctor picks the balance.

**Impact:** The clinical workflow is now tunable. A doctor can say "I want to catch everything, even if I get 50 false alarms per hour" or "I only have 5 minutes — show me only the top 3 most confident flags."

---

### 7. Realistic Test Evaluation

**Problem:** The test set was artificially balanced — 500 normal windows, 500 seizure windows. Real EEG is 99%+ normal. The model looked better on paper than it actually was.

**Fix:** Test set now includes ALL normal windows from held-out patients (no cap), matching real-world proportions. Training stays balanced (prevents overfitting), testing is realistic (honest metrics).

**Impact:** The "false alarms per hour" number now means something clinically real. No more lying to ourselves about model performance.

---

## Before vs After

| | Before | After |
|---|---|---|
| Normalization | Computed, thrown away | Saved as .npy files |
| Trained model | Weights only, no config | Weights + config + metrics package |
| Channel names | Garbage from last recording | Clean canonical list |
| Overlap config | Hardcoded, ignored config | Reads from config correctly |
| Bad recordings | Crash the entire run | Skipped gracefully |
| Decision threshold | Fixed at 50% | Tunable 50%-95% with FA/hr table |
| Test set | Fake balanced (50/50) | Clinically realistic (99%+ normal) |
| Adding more patients | Everything works | Nothing breaks, no hidden caps |

---

## What This Enables Next

- **Inference:** A doctor can upload a new EEG recording and get ranked seizure segments
- **Deployment:** The model + config + norm stats package can be loaded in FastAPI
- **Scaling:** Adding more patients requires only a config change, no code changes
- **Feedback loop:** Doctor clicks ✓/✗ → stored with model scores → retrain → better thresholds over time

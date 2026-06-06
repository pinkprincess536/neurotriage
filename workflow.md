# Doctor Workflow — EEG Seizure Triage Assistant

---

## The Problem

Neurologists manually review hours of EEG recordings to find short seizure events. This is slow and cognitively exhausting.

## The Solution

The triage assistant automatically identifies and ranks seizure-like segments. The doctor sees only the most relevant windows — not hours of raw EEG.

---

## Workflow

### 1. Doctor logs in

Sees a dashboard with pending recordings and flagged window counts:

| Recording | Duration | 🔴 Urgent | 🟡 Review |
|-----------|----------|-----------|-----------|
| chb24 | 1h 12m | 4 | 38 |
| chb25 | 55m | 2 | 26 |
| chb26 | 2h 05m | 0 | 3 |

The 🔴 urgent count tells them where to look first.

### 2. Reviews urgent segments first

High-confidence seizure windows (score > 0.95) shown at the top. Doctor plays the EEG waveform, confirms or rejects each segment in seconds.

### 3. Browses review segments if time allows

Medium-confidence windows (score 0.50–0.95) shown next. Doctor can quickly dismiss false alarms (sleep spindles, blinks, artifacts) or catch missed seizures that the model was less sure about.

### 4. Never sees normal windows

All windows scored below the review threshold are hidden. The model correctly ignores 99%+ of normal EEG. The doctor never scrubs through raw recordings manually.

---

## Feedback Loop

Every ✓ (True Seizure) and ✗ (Not a Seizure) click is stored:

- Linked to the specific window and model score
- Used to retrain the model over time
- Used to auto-tune thresholds per patient, per recording, per setup

After 50 reviewed recordings, the system learns the doctor's preferences and shows fewer false alarms.

---

## Why This Matters

| Without triage | With triage |
|---------------|-------------|
| Doctor watches 1 hour of raw EEG | Doctor reviews ~40 seconds of flagged segments |
| Must stay focused for hours | Confirms or dismisses in seconds |
| Fatigue causes missed seizures | System catches everything above threshold |
| No learning over time | Every click improves future predictions |
| One person's workload | Scalable — multiple recordings processed simultaneously |

---

## Threshold Tiers

| Tier | Threshold | What it means |
|------|-----------|---------------|
| 🔴 Urgent | > 0.95 | Almost certainly a seizure — look now |
| 🟡 Review | 0.50–0.95 | Might be a seizure — review when possible |
| ⬜ Hidden | < 0.50 | Very likely normal — never shown |

The threshold is not a fixed number. It's a dial the system learns to tune from doctor behavior over time.

---

*From: Learning Journal & Threshold Tuning Discussion, June 2026*

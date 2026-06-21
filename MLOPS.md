# MLOps Learnings

This document captures the core MLOps concepts behind each change we make to this project.

---

## Step 1: Model Evaluation Metrics & Versioned Model Management

### What is MLOps?

MLOps = Machine Learning + DevOps. It's the practice of applying DevOps principles (automation, versioning, CI/CD, monitoring) to machine learning systems.

A traditional software app is: **code → build → deploy → monitor**.
An ML system is: **data + code + model → train → evaluate → deploy → monitor → retrain**.

The extra complexity comes from the fact that ML systems have **three things that can change** (data, code, and model), not just one (code). MLOps gives you tools and practices to manage all three.

### The ML Lifecycle

```
┌─────────┐     ┌──────────┐     ┌────────┐     ┌─────────┐     ┌───────────┐
│  Train   │ ──→ │ Evaluate │ ──→ │ Deploy │ ──→ │ Monitor │ ──→ │ Retrain   │
└─────────┘     └──────────┘     └────────┘     └─────────┘     └───────────┘
     ↑                                                                │
     └────────────────────────────────────────────────────────────────┘
```

1. **Train** — Feed data into a model architecture, optimize weights
2. **Evaluate** — Measure how well the model performs using metrics
3. **Deploy** — Put the model into production where users interact with it
4. **Monitor** — Watch how the model performs on real-world data
5. **Retrain** — When performance degrades or new data arrives, train again

Our project implements this full loop:
- **Train**: Original model trained in `train_eeg.ipynb` on CHB-MIT dataset
- **Evaluate**: `compute_metrics()` in `retrain.py` computes accuracy, recall, precision, etc.
- **Deploy**: FastAPI backend serves predictions via `/patients/{id}/upload`
- **Monitor**: Doctors provide feedback (correct/incorrect) on model predictions
- **Retrain**: Admin triggers `/retrain`, model learns from doctor feedback

### Model Versioning — Why It Matters

Imagine you retrain your model and it performs worse than before. Without versioning, your old model is gone. With versioning, you can **roll back** instantly.

**What we built:**
- Each model version is saved as `eegcnn1d_weights_v1.pth`, `v2.pth`, etc.
- `model_config.json` tracks all versions, their metrics, and which one is active
- Admin can activate any version — the doctor always uses whichever version the admin chose
- New retrained models are **not activated automatically** — admin reviews metrics first

**Why this matters:**
- **Reproducibility** — You can always recreate the exact model that produced a given prediction
- **Rollback** — Bad retrain? Switch back to the previous version in one click
- **A/B comparison** — Compare metrics between v1 and v2 before deciding which to deploy
- **Audit trail** — Know exactly which model version was used for each patient's results

This is analogous to git for code — you'd never deploy code without version control, and you shouldn't deploy models without it either.

### Evaluation Metrics — The Confusion Matrix

Every prediction falls into one of four categories. For seizure detection:

```
                        Predicted
                   Seizure    Normal
                ┌──────────┬──────────┐
Actual Seizure  │    TP    │    FN    │
                ├──────────┼──────────┤
Actual Normal   │    FP    │    TN    │
                └──────────┴──────────┘
```

- **TP (True Positive)** — Model said "seizure" and it WAS a seizure. Correct.
- **FP (False Positive)** — Model said "seizure" but it was normal. False alarm.
- **TN (True Negative)** — Model said "normal" and it WAS normal. Correct.
- **FN (False Negative)** — Model said "normal" but it was a seizure. **Missed seizure.**

### The Five Metrics

**1. Accuracy** = (TP + TN) / (TP + FP + TN + FN)

"Of all predictions, how many were correct?"

Sounds great, but it's **misleading with imbalanced data**. If 95% of EEG windows are normal, a model that always says "normal" gets 95% accuracy — but catches zero seizures. Useless.

**2. Recall (Sensitivity)** = TP / (TP + FN)

"Of all actual seizures, how many did we catch?"

This is the **most important metric for medical ML**. A recall of 0.59 means we catch 59% of seizures and miss 41%. Every missed seizure (FN) is a patient who doesn't get treated.

**3. Precision** = TP / (TP + FP)

"Of all windows we flagged as seizure, how many actually were?"

Low precision means lots of false alarms. Doctors waste time reviewing normal windows. Annoying but not dangerous.

**4. Specificity** = TN / (TN + FP)

"Of all normal windows, how many did we correctly ignore?"

High specificity means few false alarms. A specificity of 0.95 means only 5% of normal windows get incorrectly flagged.

**5. F1 Score** = 2 * (Precision * Recall) / (Precision + Recall)

The harmonic mean of precision and recall. It balances both — useful when you care about both catching seizures AND not flooding doctors with false alarms.

### Why Recall > Accuracy for Seizure Detection

In medical ML, the **cost of errors is asymmetric**:

| Error Type | What Happens | Severity |
|---|---|---|
| False Negative (missed seizure) | Patient doesn't get treatment | **Dangerous** |
| False Positive (false alarm) | Doctor reviews a normal window | Annoying but safe |

Missing a seizure can lead to injury or death. A false alarm just wastes a few seconds of a doctor's time.

That's why we optimize for **recall first** — catch as many real seizures as possible, even if it means some false alarms. Then we tune precision/specificity to reduce the noise.

Our original model (v1):
- Recall: 59% — catches about 6 out of 10 seizures
- Specificity: 95.3% — correctly ignores most normal windows
- There's room to improve recall through retraining on doctor feedback

### Training Metrics vs Test Metrics

When we retrain on doctor feedback and then evaluate on that **same feedback data**, the numbers look optimistic. The model has already "seen" these examples during training, so it naturally scores higher.

This is like studying the answer key and then taking the test — you'll ace it, but it doesn't prove you understand the material.

**What our metrics mean right now:**
- v1 metrics → evaluated on a **held-out test set** (real, honest numbers)
- v2+ metrics → evaluated on **training data** (optimistic, marked as "Training metrics" in the UI)

As feedback data grows (50+ samples), we can hold out 20% for honest evaluation. For now, training metrics still show whether the model learned anything from the feedback — if accuracy is low even on training data, something is wrong.

### What We Implemented (Code ↔ Concepts)

| Concept | Implementation |
|---|---|
| ML Lifecycle | Full loop: train → evaluate → deploy → monitor (feedback) → retrain |
| Model Versioning | `model_config.json` with versions array, versioned weight files |
| Confusion Matrix | `compute_metrics()` in `retrain.py` computes TP, FP, TN, FN |
| Evaluation Metrics | accuracy, recall, precision, specificity, F1 saved per version |
| Admin Model Control | `GET /models` lists versions + metrics, `POST /models/activate` switches |
| Role-based Access | Doctor sees patients/upload, Admin sees model dashboard + retrain |
| Safe Deployment | Retrained model saved but NOT activated until admin reviews metrics |

### Files Changed

| File | What Changed |
|---|---|
| `retrain.py` | Added `compute_metrics()`, metrics saved per version, v1 gets original test metrics |
| `App.jsx` | Split into doctor view (upload flow) and admin view (model dashboard) |
| `App.css` | Metrics table styling, scrollable for wide tables |
| `backend.py` | No changes — `GET /models` already returns version data with metrics |

# NeuroTriage

**Smart Seizure Triage & Detection Portal**

> AI-assisted EEG analysis that helps neurologists find seizure activity faster ,so patients get the right care sooner.

---

## The Problem


Reviewing EEG recordings for seizure activity is time-consuming and demanding. A single recording can last hours, and neurologists must manually scan through the entire signal to identify suspicious segments. Without decision support, potential consequences include:

- Delayed identification of seizure activity
- Increased workload for neurologists
- Longer patient waiting times
- Difficulty prioritizing urgent cases

---

## The Solution

<img width="1519" height="945" alt="Screenshot_24-6-2026_142358_neurotriage-hazel vercel app" src="https://github.com/user-attachments/assets/1fb5ef4e-aa12-4ef3-b4bf-384bb81c203e" />


NeuroTriage uses a deep learning model to automatically scan EEG recordings and flag the moments most likely to contain seizure activity ranked by urgency, so clinicians know exactly where to look first.

Doctors review only the flagged segments, label them, and those labels feed back into the system to continuously improve the model over time.

## The Platform

**Login** — role is determined automatically by password. Doctors and admins get different views. See [User Roles](#user-roles) for details.

> 1D CNN · 22-channel bipolar EEG · Threshold-based seizure triage · Doctor feedback → retraining loop

---

## Who Benefits?

| Role | How NeuroTriage helps |
|---|---|
| **Neurologists** | Spend less time scanning, more time deciding |
| **Hospital administrators** | Faster turnaround, better resource allocation |
| **Patients** | Quicker diagnosis and prioritization of urgent cases |
| **Research teams** | Structured feedback loop for ongoing model improvement |

---

## How Does It Work?

1. A doctor logs in and selects a patient
2. An EEG recording (EDF format) is uploaded via drag-and-drop
3. The doctor sets a **detection sensitivity threshold** — balancing how many flags to surface vs. how specific they need to be
4. The AI model scans the recording in 7-second windows across 22 brain channels
5. Each window is scored for seizure probability (0–100%)
6. Results are ranked — **🔴 Urgent** (≥ 95% confidence) and **🟡 Review** (above threshold)
7. The doctor reviews flagged segments and labels them
8. Labels feed back into the model, which improves with every retraining cycle


<img width="1024" height="757" alt="download" src="https://github.com/user-attachments/assets/f1699e47-d908-451b-8e09-4ba9bfc2a734" />


   

### Detection Sensitivity

The threshold slider gives clinicians direct control over the sensitivity/specificity trade-off:

| Preset | Threshold | Behaviour |
|---|---|---|
| **Aggressive** | ~0.50 | More sensitive — flags more windows, fewer missed seizures |
| **Balanced** | ~0.70 | Default — good trade-off (Recall ~88%, FA/hr ~224) |
| **Conservative** | ~0.95 | More specific — fewer false alarms, may miss borderline cases |

At the default threshold of **0.70**, the model achieves approximately **88% recall** with around **224 false alarms per hour** — meaning it catches most seizure activity while remaining clinically actionable.

---

## Workflow

```
Upload EDF recording
        ↓
AI scans 7-second windows across 22 EEG channels
        ↓
Flags suspicious segments (ranked by urgency)
        ↓
Neurologist reviews & labels flagged windows
        ↓
Labels stored in database
        ↓
Admin triggers retraining from Admin Panel
        ↓
New model version evaluated against baseline
        ↓
Admin reviews metrics → Activates new version if better
        ↓
Doctors now use the improved model
```

---

## Why Should You Trust It?

- **Clinician-in-the-loop** — the model never makes a final decision. Every result requires a doctor's review and confirmation
- **Transparent model versioning** — every model version is tracked with its training date, sample count, recall, specificity, and F1 score
- **Gated promotion** — a new model version cannot replace the active one unless it meets evaluation criteria. Worse-performing versions are blocked by default
- **Audit trail** - every upload, label, and model activation is logged against a patient record

---

## Impact

- Reduces the time neurologists spend manually scanning recordings
- Surfaces the most urgent cases first, enabling faster clinical decisions
- Creates a structured feedback loop that improves detection accuracy over time
- Provides a foundation for scalable, AI-assisted neurological triage

---

## Results

Current model versions tracked in the system:

| Version | Type | Recall | Specificity | F1 | Status |
|---|---|---|---|---|---|
| v2 | Retrained | — | — | — | Active |
| v3 | Retrained | 16.7% | 100.0% | 28.6% | Inactive |

The model continues to improve as doctors submit more labeled feedback.


---

## The Dataset — CHB-MIT Scalp EEG

The model was trained on the **CHB-MIT Scalp EEG Database**, a publicly available dataset from Children's Hospital Boston and MIT.

- **Subjects:** 22 pediatric patients with intractable seizures
- **Recordings:** Continuous scalp EEG, sampled at 256 Hz
- **Channels:** 22-channel bipolar montage (standard 10–20 system)
- **Labels:** Precise seizure onset and offset times annotated by clinicians
- **Split used:** 12 patients for training, 12 patients for testing
- **Class imbalance:** Seizure windows are rare (~1–5% of total), addressed with weighted loss (seizure weight: 20×)

The dataset represents real clinical EEG recordings from pediatric patients, making it a relevant starting point for seizure detection research.

```
find it here: https://physionet.org/content/chbmit/1.0.0/
```
---

## The AI Model — EEGCNN1D

### Architecture

The model is a custom **1D Convolutional Neural Network** designed specifically for time-series EEG data. Unlike image-based approaches, 1D convolutions directly process the raw temporal signal across all EEG channels simultaneously.

```
Input: [batch, 22 channels, 1792 time samples]
        ↓
Conv1D(22→32, kernel=7) + BatchNorm + ReLU + MaxPool(4)
        ↓
Conv1D(32→64, kernel=5) + BatchNorm + ReLU + MaxPool(4)
        ↓
Conv1D(64→128, kernel=3) + BatchNorm + ReLU
        ↓
AdaptiveAvgPool → [batch, 128, 16]
        ↓
Flatten → [batch, 2048]
        ↓
Dropout(0.4) → FC(2048→64) → ReLU
        ↓
Dropout(0.3) → FC(64→2)
        ↓
Output: [batch, 2] — softmax → seizure probability
```

### Hyperparameters

| Parameter | Value |
|---|---|
| Architecture | EEGCNN1D (3 ConvBlocks + FC classifier) |
| Trainable parameters | ~300,000 |
| Input channels | 22-channel bipolar EEG |
| Input length | 1792 samples (7.0 seconds @ 256 Hz) |
| Window overlap | 30% |
| Frequency filter | 0.5–40 Hz Bandpass + 60 Hz Notch |
| Dataset split | 12 train / 12 test patients (CHB-MIT) |
| Batch size | 8 |
| Loss function | Weighted CrossEntropyLoss (Seizure Weight: 20×) |
| Optimizer | Adam |
| Learning rate | 0.001 (initial training), 0.0001 (fine-tuning) |
| Epochs | 13 (initial), 5 (fine-tuning per retrain) |

### Weights

Model weights are stored as `.pth` files in the `model/` directory, versioned as `eegcnn1d_weights_v1.pth`, `eegcnn1d_weights_v2.pth`, etc. The active version is tracked in `model_config.json`.

<img width="1001" height="1023" alt="download" src="https://github.com/user-attachments/assets/fc0ae6d8-cc11-485e-a56a-6d3d6642173f" />


### Preprocessing & Inference Pipeline

When an EDF recording is uploaded, the following happens before the model sees any data:

1. **Channel selection** — 22 standard bipolar channels are selected from the recording (e.g. FP1-F7, F7-T7, FZ-CZ). Recordings with fewer than 18 matching channels are rejected
2. **Bandpass filter** — 0.5–40 Hz FIR filter removes slow drift and high-frequency noise
3. **Notch filter** — 60 Hz filter removes power line interference
4. **Sliding windows** — the signal is sliced into 7-second windows with 30% overlap, generating hundreds of windows per recording
5. **Zero-padding** — if a recording has fewer than 22 channels, missing channels are zero-padded to maintain consistent input shape
6. **Z-score normalisation** — each window is normalised using the training set mean and standard deviation (`train_mean.npy`, `train_std.npy`)
7. **Inference** — all windows are passed through the model in a single batch. Softmax probabilities for the seizure class are extracted
8. **Thresholding** — windows above the doctor's chosen threshold are flagged. Windows ≥ 0.95 are marked **Urgent**, the rest **Review**
9. **Ranking** — flagged windows are sorted by score (highest first) so the most suspicious moments appear at the top

### Retraining Mechanism

NeuroTriage includes a full feedback-driven retraining loop:

**How it works:**

1. **Feedback collection** — when a doctor labels a flagged window (seizure / not seizure), that label is stored in the database linked to the exact EDF timestamp and recording
2. **Dataset construction** — when retraining is triggered, the system downloads the original EDF files from storage, re-processes them, and aligns doctor labels to the closest matching window
3. **Stratified split** — feedback data is split 80% train / 20% validation, stratified by class
4. **Fine-tuning** — a deep copy of the current active model is fine-tuned on the feedback dataset using Adam (LR=0.0001, 5 epochs, batch size 8). A class-weighted loss is applied to handle the natural imbalance between seizure and normal windows
5. **Evaluation** — the fine-tuned model is evaluated on the held-out validation set. Metrics computed: accuracy, recall, precision, specificity, F1, confusion matrix
6. **Versioning** — the new weights are saved as the next version (e.g. `v4`) and recorded in `model_config.json` with metrics. The active model is unchanged

   and arguably, the most important part of this project:
8. **Promotion gate** — before an admin can activate a new version, the system checks that recall ≥ baseline recall AND specificity ≥ baseline specificity (with 2% tolerance). A version that performs worse is blocked from activation unless force-overridden
9. **Activation** — the admin reviews the metrics table in the Admin Panel, compares versions, and clicks **Activate** on the version they want doctors to use. The active model is hot-swapped without restarting the server

**Minimum samples required:** 25 labeled feedback windows (configurable via `RETRAIN_MIN_SAMPLES` env var).



---

## User Roles

NeuroTriage has two roles — the password entered at login determines which role you get.

### Doctor
- Create and manage patients
- Upload EEG recordings and run analysis
- Review flagged windows and label them (seizure / not seizure)
- Browse recording history per patient

### Admin
Has all doctor capabilities, plus:
- View all trained model versions with their performance metrics side by side
- Trigger model retraining from accumulated doctor feedback
- Choose which model version gets deployed to doctors (with promotion gate validation)
- Override the promotion gate if needed

The admin is the gatekeeper of model quality — no new model reaches doctors without explicit admin approval.

---

## Limitations

NeuroTriage is a clinical decision support tool, not a diagnostic system.

- **Not intended for standalone diagnosis** — all results must be reviewed by a qualified clinician
- **Requires clinician review** — the AI flags; the doctor decides
- **Trained on publicly available EEG datasets** — specifically the CHB-MIT scalp EEG dataset (pediatric patients)
- **Performance may vary across patient populations** — the model has not been validated across all demographics, EEG equipment types, or adult populations

---

## Setup & Installation

For technical setup instructions :
local development, Docker, environment variables, and production deployment — see **[SETUP.md](SETUP.md)**.

---

## Project Structure

```
eeg/
├── backend.py                 # FastAPI API server
├── eeg_core.py                # Model definition, EDF processing, inference
├── retrain.py                 # Feedback-driven retraining pipeline
├── preprocessing.py           # Preprocessing utilities
├── model/                     # Model weights + config (versioned)
├── ml/                        # Offline training scripts + datasets
├── eeg-triage/                # React frontend (NeuroTriage UI)
├── docker-compose.yml         # Local Docker setup
├── docker-compose.prod.yml    # Production setup (Caddy + HTTPS)
├── SETUP.md                   # Installation & deployment guide
└── DEPLOY.md                  # Detailed production deployment guide
```

---

## CI / CD

GitHub Actions automatically builds and validates both the backend and frontend Docker images on every push and pull request to `main`. See [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React 19 | UI framework |
| | Tailwind CSS 4 | Styling |
| | Vite 8 | Build tooling |
| | Vercel | Hosting + CDN |
| **Backend** | FastAPI | REST API server |
| | Python 3.10 | Runtime |
| | PyTorch (CPU) | Model inference + retraining |
| | MNE | EEG file parsing and signal processing |
| | Uvicorn | ASGI server |
| **Database** | Supabase (Postgres) | Patient, recording, and feedback data |
| | Supabase Storage | EDF file storage |
| **Auth** | PyJWT | JWT-based authentication |
| | Role-based access | Doctor and Admin roles |
| **ML** | EEGCNN1D (custom) | Seizure detection model |
| | CHB-MIT dataset | Training data |
| | MLflow | Experiment tracking |
| **Infrastructure** | Docker | Containerisation |
| | Docker Compose | Local and production orchestration |
| | Caddy | Reverse proxy + automatic TLS (Let's Encrypt) |
| | AWS EC2 | Backend hosting |
| **CI/CD** | GitHub Actions | Automated Docker builds on every push |

---

## Learning Journal

All learnings accumulated during the development of this project , covering topics like MLOps, data versioning, pipeline design, deployment, platform differences, and EEG signal processing are documented in the [`journaling/`](journaling/) folder.

These were also my personal notes so have fun reading them <3

| File | Topic |
|---|---|
| [`journal.md`](journaling/journal.md) | General development journal and notes |
| [`learning.md`](journaling/learning.md) | Key learnings across the project |
| [`HOW_IT_WORKS.md`](journaling/HOW_IT_WORKS.md) | How the system works end to end |
| [`workflow.md`](journaling/workflow.md) | Development and ML workflow notes |
| [`PIPELINE_CHANGES.md`](journaling/PIPELINE_CHANGES.md) | Changes made to the ML pipeline |
| [`PIPELINE_FIXES (1).md`](<journaling/PIPELINE_FIXES (1).md>) | Pipeline bug fixes and resolutions |
| [`DVC_GUIDE.md`](journaling/DVC_GUIDE.md) | Data Version Control guide |
| [`DOWNLOAD_SPEEDUP (1).md`](<journaling/DOWNLOAD_SPEEDUP (1).md>) | Dataset download optimisation notes |
| [`PLATFORMS.md`](journaling/PLATFORMS.md) | Notes on platform-specific differences |
| [`context.md`](journaling/context.md) | Project context and background |
